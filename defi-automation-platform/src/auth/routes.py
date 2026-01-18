"""
Authentication API Routes

This module implements FastAPI routes for OAuth2 authentication,
user management, and session handling.
"""

from datetime import datetime
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, Request, Response, status
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import structlog

from .oauth_service import OAuth2Service, UserProfile, TokenData

logger = structlog.get_logger()
security = HTTPBearer()

# Global OAuth service instance
oauth_service = OAuth2Service()

# Request/Response models
class AuthURLResponse(BaseModel):
    """Response model for auth URL generation"""
    auth_url: str
    state: str

class CallbackRequest(BaseModel):
    """Request model for OAuth callback"""
    code: str
    state: str

class RefreshTokenRequest(BaseModel):
    """Request model for token refresh"""
    refresh_token: str

class UserPreferencesRequest(BaseModel):
    """Request model for user preferences update"""
    preferences: Dict[str, Any]
    risk_tolerance: Optional[float] = None
    investment_goals: Optional[list] = None
    notification_settings: Optional[Dict[str, bool]] = None

class UserProfileResponse(BaseModel):
    """Response model for user profile"""
    user_id: str
    email: str
    name: str
    picture: Optional[str]
    created_at: datetime
    last_login: Optional[datetime]
    preferences: Dict[str, Any]
    risk_tolerance: float
    investment_goals: list
    notification_settings: Dict[str, bool]

# Create router
router = APIRouter(prefix="/auth", tags=["authentication"])

# Dependency to get current user
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UserProfile:
    """
    Dependency to get current authenticated user
    
    Args:
        credentials: HTTP authorization credentials
        
    Returns:
        Current user profile
        
    Raises:
        HTTPException: If authentication fails
    """
    return await oauth_service.validate_token(credentials)

# Authentication routes

@router.on_event("startup")
async def startup_event():
    """Initialize OAuth service on startup"""
    await oauth_service.initialize()

@router.on_event("shutdown")
async def shutdown_event():
    """Shutdown OAuth service"""
    await oauth_service.shutdown()

@router.get("/login", response_model=AuthURLResponse)
async def login(request: Request):
    """
    Initiate Google OAuth2 login flow
    
    Returns:
        Google OAuth2 authorization URL and state parameter
    """
    try:
        # Check rate limiting
        client_ip = request.client.host
        if not await oauth_service.check_rate_limit(client_ip):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many login attempts. Please try again later."
            )
        
        # Generate auth URL
        auth_url = await oauth_service.get_google_auth_url()
        
        # Extract state from URL for response
        from urllib.parse import urlparse, parse_qs
        parsed_url = urlparse(auth_url)
        state = parse_qs(parsed_url.query).get('state', [''])[0]
        
        logger.info("Login initiated", client_ip=client_ip)
        
        return AuthURLResponse(auth_url=auth_url, state=state)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Login initiation failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initiate login"
        )

@router.get("/callback")
async def auth_callback(request: Request, code: str, state: str):
    """
    Handle Google OAuth2 callback
    
    Args:
        request: FastAPI request object
        code: Authorization code from Google
        state: State parameter for CSRF protection
        
    Returns:
        Redirect to frontend with tokens or error
    """
    try:
        # Get client information
        client_ip = request.client.host
        user_agent = request.headers.get("user-agent")
        
        # Check rate limiting
        if not await oauth_service.check_rate_limit(client_ip):
            await oauth_service.record_login_attempt(client_ip, False)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many login attempts"
            )
        
        # Handle OAuth callback
        token_data = await oauth_service.handle_google_callback(
            code=code,
            state=state,
            ip_address=client_ip,
            user_agent=user_agent
        )
        
        # Record successful login
        await oauth_service.record_login_attempt(client_ip, True)
        
        # In production, redirect to frontend with tokens
        # For now, return tokens directly
        return {
            "message": "Authentication successful",
            "tokens": token_data.dict()
        }
        
    except HTTPException:
        await oauth_service.record_login_attempt(request.client.host, False)
        raise
    except Exception as e:
        logger.error("OAuth callback failed", error=str(e))
        await oauth_service.record_login_attempt(request.client.host, False)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed"
        )

@router.post("/callback", response_model=TokenData)
async def auth_callback_post(request: Request, callback_data: CallbackRequest):
    """
    Handle Google OAuth2 callback via POST request
    
    Args:
        request: FastAPI request object
        callback_data: Callback data with code and state
        
    Returns:
        JWT tokens
    """
    try:
        # Get client information
        client_ip = request.client.host
        user_agent = request.headers.get("user-agent")
        
        # Check rate limiting
        if not await oauth_service.check_rate_limit(client_ip):
            await oauth_service.record_login_attempt(client_ip, False)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many login attempts"
            )
        
        # Handle OAuth callback
        token_data = await oauth_service.handle_google_callback(
            code=callback_data.code,
            state=callback_data.state,
            ip_address=client_ip,
            user_agent=user_agent
        )
        
        # Record successful login
        await oauth_service.record_login_attempt(client_ip, True)
        
        logger.info("OAuth callback handled successfully", client_ip=client_ip)
        
        return token_data
        
    except HTTPException:
        await oauth_service.record_login_attempt(request.client.host, False)
        raise
    except Exception as e:
        logger.error("OAuth callback POST failed", error=str(e))
        await oauth_service.record_login_attempt(request.client.host, False)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed"
        )

@router.post("/refresh", response_model=TokenData)
async def refresh_token(refresh_request: RefreshTokenRequest):
    """
    Refresh access token using refresh token
    
    Args:
        refresh_request: Refresh token request
        
    Returns:
        New JWT tokens
    """
    try:
        token_data = await oauth_service.refresh_access_token(refresh_request.refresh_token)
        
        logger.info("Token refreshed successfully")
        
        return token_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Token refresh failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh failed"
        )

@router.post("/logout")
async def logout(current_user: UserProfile = Depends(get_current_user),
                credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Logout current user and invalidate session
    
    Args:
        current_user: Current authenticated user
        credentials: HTTP authorization credentials
        
    Returns:
        Logout confirmation
    """
    try:
        # Extract session ID from token
        from jose import jwt
        from .oauth_service import SECRET_KEY, ALGORITHM
        
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        session_id = payload.get("session_id")
        
        if session_id:
            success = await oauth_service.logout(current_user.user_id, session_id)
            
            if success:
                logger.info("User logged out successfully", user_id=current_user.user_id)
                return {"message": "Logout successful"}
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Logout failed"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Logout failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Logout failed"
        )

# User management routes

@router.get("/me", response_model=UserProfileResponse)
async def get_current_user_profile(current_user: UserProfile = Depends(get_current_user)):
    """
    Get current user profile
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        User profile information
    """
    try:
        return UserProfileResponse(
            user_id=current_user.user_id,
            email=current_user.email,
            name=current_user.name,
            picture=current_user.picture,
            created_at=current_user.created_at,
            last_login=current_user.last_login,
            preferences=current_user.preferences,
            risk_tolerance=current_user.risk_tolerance,
            investment_goals=current_user.investment_goals,
            notification_settings=current_user.notification_settings
        )
        
    except Exception as e:
        logger.error("Failed to get user profile", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user profile"
        )

@router.put("/me/preferences")
async def update_user_preferences(
    preferences_request: UserPreferencesRequest,
    current_user: UserProfile = Depends(get_current_user)
):
    """
    Update user preferences
    
    Args:
        preferences_request: Updated preferences
        current_user: Current authenticated user
        
    Returns:
        Update confirmation
    """
    try:
        # Prepare update data
        update_data = preferences_request.preferences.copy()
        
        if preferences_request.risk_tolerance is not None:
            if not (0.0 <= preferences_request.risk_tolerance <= 1.0):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Risk tolerance must be between 0.0 and 1.0"
                )
            update_data["risk_tolerance"] = preferences_request.risk_tolerance
        
        if preferences_request.investment_goals is not None:
            update_data["investment_goals"] = preferences_request.investment_goals
        
        if preferences_request.notification_settings is not None:
            update_data["notification_settings"] = preferences_request.notification_settings
        
        # Update preferences
        success = await oauth_service.update_user_preferences(current_user.user_id, update_data)
        
        if success:
            logger.info("User preferences updated", user_id=current_user.user_id)
            return {"message": "Preferences updated successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update preferences"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update user preferences", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update preferences"
        )

@router.get("/sessions")
async def get_user_sessions(current_user: UserProfile = Depends(get_current_user)):
    """
    Get user's active sessions
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        List of active sessions
    """
    try:
        # In a full implementation, this would query all sessions for the user
        # For now, return a placeholder
        return {
            "message": "Sessions endpoint - implementation pending",
            "user_id": current_user.user_id
        }
        
    except Exception as e:
        logger.error("Failed to get user sessions", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get sessions"
        )

@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: str,
    current_user: UserProfile = Depends(get_current_user)
):
    """
    Revoke a specific session
    
    Args:
        session_id: Session ID to revoke
        current_user: Current authenticated user
        
    Returns:
        Revocation confirmation
    """
    try:
        success = await oauth_service.logout(current_user.user_id, session_id)
        
        if success:
            logger.info("Session revoked", user_id=current_user.user_id, session_id=session_id)
            return {"message": "Session revoked successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found or already revoked"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to revoke session", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to revoke session"
        )

# Health check route
@router.get("/health")
async def auth_health_check():
    """
    Authentication service health check
    
    Returns:
        Service health status
    """
    try:
        # Check Redis connection
        await oauth_service.redis_client.ping()
        
        return {
            "status": "healthy",
            "service": "authentication",
            "timestamp": datetime.utcnow().isoformat(),
            "components": {
                "redis": "healthy",
                "oauth_service": "healthy"
            }
        }
        
    except Exception as e:
        logger.error("Auth health check failed", error=str(e))
        return {
            "status": "unhealthy",
            "service": "authentication",
            "timestamp": datetime.utcnow().isoformat(),
            "error": str(e)
        }