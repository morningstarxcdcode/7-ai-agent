"""
OAuth2 Authentication Service with Google Integration

This module implements OAuth2 authentication using Google Identity Services,
JWT token management, session handling, and user profile management with
Supabase integration for the DeFi Automation Platform.
"""

import asyncio
import json
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from urllib.parse import urlencode, parse_qs
import structlog
import httpx
from jose import JWTError, jwt
from passlib.context import CryptContext
import redis.asyncio as redis
from pydantic import BaseModel, Field, validator
from fastapi import HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = structlog.get_logger()

# JWT Configuration
SECRET_KEY = secrets.token_urlsafe(32)  # In production, use environment variable
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Google OAuth Configuration
GOOGLE_CLIENT_ID = "your-google-client-id"  # Set from environment
GOOGLE_CLIENT_SECRET = "your-google-client-secret"  # Set from environment
GOOGLE_REDIRECT_URI = "http://localhost:8000/auth/callback"
GOOGLE_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid_configuration"

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

class UserProfile(BaseModel):
    """User profile model"""
    user_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    google_id: str
    email: str
    name: str
    picture: Optional[str] = None
    locale: Optional[str] = None
    verified_email: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    preferences: Dict[str, Any] = Field(default_factory=dict)
    risk_tolerance: float = Field(default=0.5, ge=0.0, le=1.0)
    investment_goals: List[str] = Field(default_factory=list)
    notification_settings: Dict[str, bool] = Field(default_factory=lambda: {
        "email_notifications": True,
        "push_notifications": True,
        "security_alerts": True,
        "portfolio_updates": True
    })

class TokenData(BaseModel):
    """Token data model"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    scope: Optional[str] = None

class SessionData(BaseModel):
    """Session data model"""
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
    last_activity: datetime = Field(default_factory=datetime.utcnow)
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    is_active: bool = True
    metadata: Dict[str, Any] = Field(default_factory=dict)

class GoogleUserInfo(BaseModel):
    """Google user information model"""
    id: str
    email: str
    verified_email: bool
    name: str
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    picture: Optional[str] = None
    locale: Optional[str] = None

class OAuth2Service:
    """
    OAuth2 authentication service with Google integration
    
    Provides comprehensive authentication services including OAuth2 flow,
    JWT token management, session handling, and user profile management.
    """
    
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_url = redis_url
        self.redis_client: Optional[redis.Redis] = None
        self.google_config: Optional[Dict[str, Any]] = None
        self.http_client = httpx.AsyncClient()
        
        # User storage (in production, use Supabase)
        self.users: Dict[str, UserProfile] = {}
        self.sessions: Dict[str, SessionData] = {}
        
        # Rate limiting for security
        self.login_attempts: Dict[str, List[datetime]] = {}
        self.max_login_attempts = 5
        self.lockout_duration = timedelta(minutes=15)
    
    async def initialize(self):
        """Initialize the OAuth2 service"""
        try:
            # Initialize Redis for session storage
            self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
            await self.redis_client.ping()
            
            # Load Google OAuth configuration
            await self._load_google_config()
            
            logger.info("OAuth2 service initialized successfully")
            
        except Exception as e:
            logger.error("Failed to initialize OAuth2 service", error=str(e))
            raise
    
    async def shutdown(self):
        """Shutdown the OAuth2 service"""
        try:
            if self.http_client:
                await self.http_client.aclose()
            
            if self.redis_client:
                await self.redis_client.close()
            
            logger.info("OAuth2 service shutdown completed")
            
        except Exception as e:
            logger.error("OAuth2 service shutdown error", error=str(e))
    
    async def get_google_auth_url(self, state: Optional[str] = None) -> str:
        """
        Generate Google OAuth2 authorization URL
        
        Args:
            state: Optional state parameter for CSRF protection
            
        Returns:
            Google OAuth2 authorization URL
        """
        try:
            if not self.google_config:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Google OAuth configuration not loaded"
                )
            
            # Generate state for CSRF protection if not provided
            if not state:
                state = secrets.token_urlsafe(32)
            
            # Store state in Redis for validation
            await self.redis_client.setex(f"oauth_state:{state}", 600, "valid")  # 10 minutes
            
            params = {
                "client_id": GOOGLE_CLIENT_ID,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "scope": "openid email profile",
                "response_type": "code",
                "state": state,
                "access_type": "offline",
                "prompt": "consent"
            }
            
            auth_url = f"{self.google_config['authorization_endpoint']}?{urlencode(params)}"
            
            logger.info("Generated Google auth URL", state=state)
            return auth_url
            
        except Exception as e:
            logger.error("Failed to generate Google auth URL", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate authorization URL"
            )
    
    async def handle_google_callback(self, code: str, state: str, 
                                   ip_address: Optional[str] = None,
                                   user_agent: Optional[str] = None) -> TokenData:
        """
        Handle Google OAuth2 callback and create user session
        
        Args:
            code: Authorization code from Google
            state: State parameter for CSRF protection
            ip_address: Client IP address
            user_agent: Client user agent
            
        Returns:
            JWT tokens and user session data
        """
        try:
            # Validate state parameter
            state_valid = await self.redis_client.get(f"oauth_state:{state}")
            if not state_valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid or expired state parameter"
                )
            
            # Clean up used state
            await self.redis_client.delete(f"oauth_state:{state}")
            
            # Exchange authorization code for tokens
            token_response = await self._exchange_code_for_tokens(code)
            
            # Get user information from Google
            user_info = await self._get_google_user_info(token_response["access_token"])
            
            # Create or update user profile
            user_profile = await self._create_or_update_user(user_info)
            
            # Create session
            session = await self._create_session(user_profile.user_id, ip_address, user_agent)
            
            # Generate JWT tokens
            access_token = await self._create_access_token(user_profile.user_id, session.session_id)
            refresh_token = await self._create_refresh_token(user_profile.user_id, session.session_id)
            
            # Store tokens in Redis
            await self._store_tokens(user_profile.user_id, session.session_id, access_token, refresh_token)
            
            logger.info("Google OAuth callback handled successfully", 
                       user_id=user_profile.user_id, email=user_profile.email)
            
            return TokenData(
                access_token=access_token,
                refresh_token=refresh_token,
                expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Google OAuth callback failed", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authentication failed"
            )
    
    async def refresh_access_token(self, refresh_token: str) -> TokenData:
        """
        Refresh access token using refresh token
        
        Args:
            refresh_token: Valid refresh token
            
        Returns:
            New access token and refresh token
        """
        try:
            # Validate refresh token
            payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            session_id = payload.get("session_id")
            
            if not user_id or not session_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid refresh token"
                )
            
            # Check if session is still valid
            session = await self._get_session(session_id)
            if not session or not session.is_active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session expired or invalid"
                )
            
            # Generate new tokens
            new_access_token = await self._create_access_token(user_id, session_id)
            new_refresh_token = await self._create_refresh_token(user_id, session_id)
            
            # Store new tokens
            await self._store_tokens(user_id, session_id, new_access_token, new_refresh_token)
            
            # Update session activity
            session.last_activity = datetime.utcnow()
            await self._update_session(session)
            
            logger.info("Access token refreshed successfully", user_id=user_id)
            
            return TokenData(
                access_token=new_access_token,
                refresh_token=new_refresh_token,
                expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
            )
            
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        except Exception as e:
            logger.error("Token refresh failed", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Token refresh failed"
            )
    
    async def validate_token(self, credentials: HTTPAuthorizationCredentials) -> UserProfile:
        """
        Validate JWT access token and return user profile
        
        Args:
            credentials: HTTP authorization credentials
            
        Returns:
            User profile if token is valid
        """
        try:
            token = credentials.credentials
            
            # Decode JWT token
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            session_id = payload.get("session_id")
            
            if not user_id or not session_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token"
                )
            
            # Check if session is still valid
            session = await self._get_session(session_id)
            if not session or not session.is_active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session expired"
                )
            
            # Get user profile
            user_profile = await self._get_user_profile(user_id)
            if not user_profile:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found"
                )
            
            # Update session activity
            session.last_activity = datetime.utcnow()
            await self._update_session(session)
            
            return user_profile
            
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Token validation failed", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Token validation failed"
            )
    
    async def logout(self, user_id: str, session_id: str) -> bool:
        """
        Logout user and invalidate session
        
        Args:
            user_id: User ID
            session_id: Session ID
            
        Returns:
            True if logout successful
        """
        try:
            # Invalidate session
            session = await self._get_session(session_id)
            if session:
                session.is_active = False
                await self._update_session(session)
            
            # Remove tokens from Redis
            await self.redis_client.delete(f"tokens:{user_id}:{session_id}")
            
            logger.info("User logged out successfully", user_id=user_id, session_id=session_id)
            return True
            
        except Exception as e:
            logger.error("Logout failed", user_id=user_id, error=str(e))
            return False
    
    async def update_user_preferences(self, user_id: str, preferences: Dict[str, Any]) -> bool:
        """
        Update user preferences
        
        Args:
            user_id: User ID
            preferences: Updated preferences
            
        Returns:
            True if update successful
        """
        try:
            user_profile = await self._get_user_profile(user_id)
            if not user_profile:
                return False
            
            # Update preferences
            user_profile.preferences.update(preferences)
            user_profile.updated_at = datetime.utcnow()
            
            # Save updated profile
            await self._save_user_profile(user_profile)
            
            logger.info("User preferences updated", user_id=user_id)
            return True
            
        except Exception as e:
            logger.error("Failed to update user preferences", user_id=user_id, error=str(e))
            return False
    
    async def check_rate_limit(self, identifier: str) -> bool:
        """
        Check if identifier is rate limited
        
        Args:
            identifier: IP address or user identifier
            
        Returns:
            True if within rate limit, False if rate limited
        """
        try:
            current_time = datetime.utcnow()
            
            # Clean old attempts
            if identifier in self.login_attempts:
                self.login_attempts[identifier] = [
                    attempt for attempt in self.login_attempts[identifier]
                    if current_time - attempt < self.lockout_duration
                ]
            
            # Check rate limit
            attempts = self.login_attempts.get(identifier, [])
            if len(attempts) >= self.max_login_attempts:
                logger.warning("Rate limit exceeded", identifier=identifier)
                return False
            
            return True
            
        except Exception as e:
            logger.error("Rate limit check failed", error=str(e))
            return True  # Allow on error to avoid blocking legitimate users
    
    async def record_login_attempt(self, identifier: str, success: bool):
        """
        Record login attempt for rate limiting
        
        Args:
            identifier: IP address or user identifier
            success: Whether login was successful
        """
        try:
            if not success:
                if identifier not in self.login_attempts:
                    self.login_attempts[identifier] = []
                self.login_attempts[identifier].append(datetime.utcnow())
            else:
                # Clear attempts on successful login
                self.login_attempts.pop(identifier, None)
                
        except Exception as e:
            logger.error("Failed to record login attempt", error=str(e))
    
    # Private helper methods
    
    async def _load_google_config(self):
        """Load Google OAuth configuration from discovery endpoint"""
        try:
            response = await self.http_client.get(GOOGLE_DISCOVERY_URL)
            response.raise_for_status()
            self.google_config = response.json()
            
        except Exception as e:
            logger.error("Failed to load Google OAuth configuration", error=str(e))
            raise
    
    async def _exchange_code_for_tokens(self, code: str) -> Dict[str, Any]:
        """Exchange authorization code for access tokens"""
        try:
            token_data = {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": GOOGLE_REDIRECT_URI
            }
            
            response = await self.http_client.post(
                self.google_config["token_endpoint"],
                data=token_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            response.raise_for_status()
            
            return response.json()
            
        except Exception as e:
            logger.error("Failed to exchange code for tokens", error=str(e))
            raise
    
    async def _get_google_user_info(self, access_token: str) -> GoogleUserInfo:
        """Get user information from Google using access token"""
        try:
            response = await self.http_client.get(
                self.google_config["userinfo_endpoint"],
                headers={"Authorization": f"Bearer {access_token}"}
            )
            response.raise_for_status()
            
            user_data = response.json()
            return GoogleUserInfo(**user_data)
            
        except Exception as e:
            logger.error("Failed to get Google user info", error=str(e))
            raise
    
    async def _create_or_update_user(self, google_user: GoogleUserInfo) -> UserProfile:
        """Create new user or update existing user profile"""
        try:
            # Check if user already exists
            existing_user = None
            for user in self.users.values():
                if user.google_id == google_user.id:
                    existing_user = user
                    break
            
            if existing_user:
                # Update existing user
                existing_user.email = google_user.email
                existing_user.name = google_user.name
                existing_user.picture = google_user.picture
                existing_user.locale = google_user.locale
                existing_user.verified_email = google_user.verified_email
                existing_user.updated_at = datetime.utcnow()
                existing_user.last_login = datetime.utcnow()
                
                await self._save_user_profile(existing_user)
                return existing_user
            else:
                # Create new user
                new_user = UserProfile(
                    google_id=google_user.id,
                    email=google_user.email,
                    name=google_user.name,
                    picture=google_user.picture,
                    locale=google_user.locale,
                    verified_email=google_user.verified_email,
                    last_login=datetime.utcnow()
                )
                
                await self._save_user_profile(new_user)
                return new_user
                
        except Exception as e:
            logger.error("Failed to create or update user", error=str(e))
            raise
    
    async def _create_session(self, user_id: str, ip_address: Optional[str] = None,
                            user_agent: Optional[str] = None) -> SessionData:
        """Create new user session"""
        try:
            session = SessionData(
                user_id=user_id,
                expires_at=datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
                ip_address=ip_address,
                user_agent=user_agent
            )
            
            # Store session
            self.sessions[session.session_id] = session
            
            # Store in Redis for persistence
            await self.redis_client.setex(
                f"session:{session.session_id}",
                int(timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS).total_seconds()),
                session.json()
            )
            
            return session
            
        except Exception as e:
            logger.error("Failed to create session", error=str(e))
            raise
    
    async def _create_access_token(self, user_id: str, session_id: str) -> str:
        """Create JWT access token"""
        try:
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
            payload = {
                "sub": user_id,
                "session_id": session_id,
                "exp": expire,
                "iat": datetime.utcnow(),
                "type": "access"
            }
            
            return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
            
        except Exception as e:
            logger.error("Failed to create access token", error=str(e))
            raise
    
    async def _create_refresh_token(self, user_id: str, session_id: str) -> str:
        """Create JWT refresh token"""
        try:
            expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
            payload = {
                "sub": user_id,
                "session_id": session_id,
                "exp": expire,
                "iat": datetime.utcnow(),
                "type": "refresh"
            }
            
            return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
            
        except Exception as e:
            logger.error("Failed to create refresh token", error=str(e))
            raise
    
    async def _store_tokens(self, user_id: str, session_id: str, 
                          access_token: str, refresh_token: str):
        """Store tokens in Redis"""
        try:
            token_data = {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "created_at": datetime.utcnow().isoformat()
            }
            
            await self.redis_client.setex(
                f"tokens:{user_id}:{session_id}",
                int(timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS).total_seconds()),
                json.dumps(token_data)
            )
            
        except Exception as e:
            logger.error("Failed to store tokens", error=str(e))
            raise
    
    async def _get_session(self, session_id: str) -> Optional[SessionData]:
        """Get session by ID"""
        try:
            # Try memory first
            if session_id in self.sessions:
                return self.sessions[session_id]
            
            # Try Redis
            session_data = await self.redis_client.get(f"session:{session_id}")
            if session_data:
                session = SessionData.parse_raw(session_data)
                self.sessions[session_id] = session  # Cache in memory
                return session
            
            return None
            
        except Exception as e:
            logger.error("Failed to get session", session_id=session_id, error=str(e))
            return None
    
    async def _update_session(self, session: SessionData):
        """Update session data"""
        try:
            # Update in memory
            self.sessions[session.session_id] = session
            
            # Update in Redis
            await self.redis_client.setex(
                f"session:{session.session_id}",
                int((session.expires_at - datetime.utcnow()).total_seconds()),
                session.json()
            )
            
        except Exception as e:
            logger.error("Failed to update session", error=str(e))
            raise
    
    async def _get_user_profile(self, user_id: str) -> Optional[UserProfile]:
        """Get user profile by ID"""
        try:
            return self.users.get(user_id)
            
        except Exception as e:
            logger.error("Failed to get user profile", user_id=user_id, error=str(e))
            return None
    
    async def _save_user_profile(self, user_profile: UserProfile):
        """Save user profile"""
        try:
            # Store in memory
            self.users[user_profile.user_id] = user_profile
            
            # In production, save to Supabase
            # await self.supabase_client.table("users").upsert(user_profile.dict())
            
        except Exception as e:
            logger.error("Failed to save user profile", error=str(e))
            raise