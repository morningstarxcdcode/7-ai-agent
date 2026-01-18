"""
WebSocket API Routes

FastAPI WebSocket endpoints for real-time chat communication.

Requirements: 2.3, 2.4
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.security import HTTPBearer
import structlog

from ..websocket.chat_handler import chat_handler
from ..auth.oauth_service import verify_jwt_token

logger = structlog.get_logger()
security = HTTPBearer()

router = APIRouter()

@router.websocket("/ws/{user_id}/{conversation_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, conversation_id: str):
    """
    WebSocket endpoint for real-time chat communication
    
    Args:
        websocket: WebSocket connection
        user_id: User identifier
        conversation_id: Conversation identifier (can be 'new' for new conversations)
    """
    try:
        # Note: WebSocket authentication would typically be handled via query params
        # or initial handshake message in production
        
        logger.info("WebSocket connection attempt", 
                   user_id=user_id, 
                   conversation_id=conversation_id)
        
        # Handle the WebSocket connection
        await chat_handler.handle_connection(websocket, user_id, conversation_id)
        
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected", 
                   user_id=user_id, 
                   conversation_id=conversation_id)
    
    except Exception as e:
        logger.error("WebSocket error", 
                    user_id=user_id, 
                    conversation_id=conversation_id, 
                    error=str(e))

@router.websocket("/ws/authenticated/{user_id}/{conversation_id}")
async def authenticated_websocket_endpoint(
    websocket: WebSocket, 
    user_id: str, 
    conversation_id: str,
    token: str = None
):
    """
    Authenticated WebSocket endpoint for real-time chat communication
    
    Args:
        websocket: WebSocket connection
        user_id: User identifier
        conversation_id: Conversation identifier
        token: JWT token for authentication (passed as query parameter)
    """
    try:
        # Authenticate user via token
        if token:
            try:
                payload = verify_jwt_token(token)
                authenticated_user_id = payload.get("sub")
                
                if authenticated_user_id != user_id:
                    await websocket.close(code=4001, reason="Unauthorized")
                    return
                    
            except Exception as e:
                logger.error("WebSocket authentication failed", error=str(e))
                await websocket.close(code=4001, reason="Authentication failed")
                return
        else:
            # For development/testing, allow unauthenticated connections
            logger.warning("Unauthenticated WebSocket connection", user_id=user_id)
        
        logger.info("Authenticated WebSocket connection", 
                   user_id=user_id, 
                   conversation_id=conversation_id)
        
        # Handle the WebSocket connection
        await chat_handler.handle_connection(websocket, user_id, conversation_id)
        
    except WebSocketDisconnect:
        logger.info("Authenticated WebSocket disconnected", 
                   user_id=user_id, 
                   conversation_id=conversation_id)
    
    except Exception as e:
        logger.error("Authenticated WebSocket error", 
                    user_id=user_id, 
                    conversation_id=conversation_id, 
                    error=str(e))

# Health check endpoint for WebSocket service
@router.get("/ws/health")
async def websocket_health():
    """Health check for WebSocket service"""
    try:
        # Check if chat handler is responsive
        connection_count = len(chat_handler.connection_manager.active_connections)
        
        return {
            "status": "healthy",
            "active_connections": connection_count,
            "timestamp": "2024-01-01T00:00:00Z"  # Would use actual timestamp
        }
    
    except Exception as e:
        logger.error("WebSocket health check failed", error=str(e))
        raise HTTPException(status_code=500, detail="WebSocket service unhealthy")

# WebSocket connection statistics
@router.get("/ws/stats")
async def websocket_stats():
    """Get WebSocket connection statistics"""
    try:
        manager = chat_handler.connection_manager
        
        return {
            "active_connections": len(manager.active_connections),
            "users_connected": len(manager.user_connections),
            "active_conversations": len(manager.conversation_connections),
            "connections_by_user": {
                user_id: len(connections) 
                for user_id, connections in manager.user_connections.items()
            }
        }
    
    except Exception as e:
        logger.error("WebSocket stats retrieval failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve stats")