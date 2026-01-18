"""
WebSocket Chat Handler

Handles real-time WebSocket connections for the chat interface,
processes messages through the conversational AI system, and
manages agent status updates.

Requirements: 2.3, 2.4
"""

import asyncio
import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any
import structlog
from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ValidationError

from ..ai.conversational_ai import ConversationalAI, ConversationRequest
from ..agent_hub.controller import AgentHubController
from ..agent_hub.message_bus import MessageBus, Message, MessageType

logger = structlog.get_logger()

class WebSocketMessage(BaseModel):
    """WebSocket message model"""
    type: str
    payload: Dict[str, Any]
    timestamp: str
    id: Optional[str] = None

class ConnectionManager:
    """Manages WebSocket connections"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_connections: Dict[str, List[str]] = {}  # user_id -> [connection_ids]
        self.conversation_connections: Dict[str, List[str]] = {}  # conversation_id -> [connection_ids]
    
    async def connect(self, websocket: WebSocket, connection_id: str, user_id: str, conversation_id: str):
        """Accept new WebSocket connection"""
        await websocket.accept()
        
        self.active_connections[connection_id] = websocket
        
        # Track user connections
        if user_id not in self.user_connections:
            self.user_connections[user_id] = []
        self.user_connections[user_id].append(connection_id)
        
        # Track conversation connections
        if conversation_id not in self.conversation_connections:
            self.conversation_connections[conversation_id] = []
        self.conversation_connections[conversation_id].append(connection_id)
        
        logger.info("WebSocket connected", 
                   connection_id=connection_id, 
                   user_id=user_id, 
                   conversation_id=conversation_id)
    
    def disconnect(self, connection_id: str, user_id: str, conversation_id: str):
        """Remove WebSocket connection"""
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
        
        # Remove from user connections
        if user_id in self.user_connections:
            self.user_connections[user_id] = [
                cid for cid in self.user_connections[user_id] if cid != connection_id
            ]
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
        
        # Remove from conversation connections
        if conversation_id in self.conversation_connections:
            self.conversation_connections[conversation_id] = [
                cid for cid in self.conversation_connections[conversation_id] if cid != connection_id
            ]
            if not self.conversation_connections[conversation_id]:
                del self.conversation_connections[conversation_id]
        
        logger.info("WebSocket disconnected", 
                   connection_id=connection_id, 
                   user_id=user_id, 
                   conversation_id=conversation_id)
    
    async def send_personal_message(self, message: Dict[str, Any], connection_id: str):
        """Send message to specific connection"""
        if connection_id in self.active_connections:
            websocket = self.active_connections[connection_id]
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error("Failed to send message", 
                           connection_id=connection_id, 
                           error=str(e))
                # Remove broken connection
                if connection_id in self.active_connections:
                    del self.active_connections[connection_id]
    
    async def send_to_user(self, message: Dict[str, Any], user_id: str):
        """Send message to all connections for a user"""
        if user_id in self.user_connections:
            for connection_id in self.user_connections[user_id].copy():
                await self.send_personal_message(message, connection_id)
    
    async def send_to_conversation(self, message: Dict[str, Any], conversation_id: str):
        """Send message to all connections for a conversation"""
        if conversation_id in self.conversation_connections:
            for connection_id in self.conversation_connections[conversation_id].copy():
                await self.send_personal_message(message, connection_id)
    
    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast message to all connections"""
        for connection_id in list(self.active_connections.keys()):
            await self.send_personal_message(message, connection_id)

class ChatWebSocketHandler:
    """Handles WebSocket chat communications"""
    
    def __init__(self):
        self.connection_manager = ConnectionManager()
        self.conversational_ai = ConversationalAI()
        self.agent_hub = AgentHubController()
        self.message_bus = MessageBus()
        
        # Subscribe to agent status updates
        self.message_bus.subscribe("agent.status.update", self._handle_agent_status_update)
        self.message_bus.subscribe("agent.notification", self._handle_agent_notification)
    
    async def handle_connection(self, websocket: WebSocket, user_id: str, conversation_id: str):
        """Handle new WebSocket connection"""
        connection_id = str(uuid.uuid4())
        
        try:
            await self.connection_manager.connect(websocket, connection_id, user_id, conversation_id)
            
            # Send initial status
            await self._send_initial_status(connection_id, user_id, conversation_id)
            
            # Handle messages
            while True:
                try:
                    data = await websocket.receive_text()
                    message = json.loads(data)
                    
                    await self._handle_message(
                        message, connection_id, user_id, conversation_id
                    )
                    
                except json.JSONDecodeError as e:
                    logger.error("Invalid JSON received", error=str(e))
                    await self._send_error(connection_id, "Invalid JSON format")
                
                except ValidationError as e:
                    logger.error("Invalid message format", error=str(e))
                    await self._send_error(connection_id, "Invalid message format")
        
        except WebSocketDisconnect:
            logger.info("WebSocket disconnected normally")
        
        except Exception as e:
            logger.error("WebSocket error", error=str(e))
        
        finally:
            self.connection_manager.disconnect(connection_id, user_id, conversation_id)
    
    async def _handle_message(self, message: Dict[str, Any], connection_id: str, 
                            user_id: str, conversation_id: str):
        """Handle incoming WebSocket message"""
        try:
            message_type = message.get('type')
            payload = message.get('payload', {})
            
            if message_type == 'user_message':
                await self._handle_user_message(payload, connection_id, user_id, conversation_id)
            
            elif message_type == 'action_approval':
                await self._handle_action_approval(payload, connection_id, user_id, conversation_id)
            
            elif message_type == 'typing_indicator':
                await self._handle_typing_indicator(payload, connection_id, user_id, conversation_id)
            
            elif message_type == 'ping':
                await self._handle_ping(payload, connection_id)
            
            else:
                logger.warning("Unknown message type", message_type=message_type)
                await self._send_error(connection_id, f"Unknown message type: {message_type}")
        
        except Exception as e:
            logger.error("Message handling failed", error=str(e))
            await self._send_error(connection_id, "Message processing failed")
    
    async def _handle_user_message(self, payload: Dict[str, Any], connection_id: str,
                                 user_id: str, conversation_id: str):
        """Handle user message"""
        try:
            content = payload.get('content', '')
            metadata = payload.get('metadata', {})
            
            # Create conversation request
            request = ConversationRequest(
                user_id=user_id,
                message=content,
                conversation_id=conversation_id,
                context=metadata.get('context', {}),
                user_preferences=metadata.get('user_preferences', {})
            )
            
            # Send typing indicator
            await self._send_typing_indicator(conversation_id, True)
            
            # Process through conversational AI
            response = await self.conversational_ai.process_conversation(request)
            
            # Stop typing indicator
            await self._send_typing_indicator(conversation_id, False)
            
            # Send response
            await self._send_message_response(response, conversation_id)
            
            # If high-risk operation, notify security agent
            if response.requires_approval:
                await self._notify_security_agent(response, user_id, conversation_id)
        
        except Exception as e:
            logger.error("User message handling failed", error=str(e))
            await self._send_error(connection_id, "Failed to process message")
    
    async def _handle_action_approval(self, payload: Dict[str, Any], connection_id: str,
                                    user_id: str, conversation_id: str):
        """Handle action approval/rejection"""
        try:
            action_id = payload.get('action_id')
            approved = payload.get('approved', False)
            action = payload.get('action', {})
            
            if approved:
                # Execute action through agent hub
                result = await self.agent_hub.execute_action(
                    action_type=action.get('type'),
                    parameters=action.get('data', {}),
                    user_id=user_id,
                    conversation_id=conversation_id
                )
                
                # Send result
                await self.connection_manager.send_to_conversation({
                    'type': 'action_result',
                    'payload': {
                        'action_id': action_id,
                        'success': result.get('success', False),
                        'message': result.get('message', ''),
                        'data': result.get('data', {})
                    },
                    'timestamp': datetime.utcnow().isoformat()
                }, conversation_id)
            
            else:
                # Action rejected
                await self.connection_manager.send_to_conversation({
                    'type': 'action_result',
                    'payload': {
                        'action_id': action_id,
                        'success': False,
                        'message': 'Action rejected by user',
                        'rejected': True
                    },
                    'timestamp': datetime.utcnow().isoformat()
                }, conversation_id)
        
        except Exception as e:
            logger.error("Action approval handling failed", error=str(e))
            await self._send_error(connection_id, "Failed to process action approval")
    
    async def _handle_typing_indicator(self, payload: Dict[str, Any], connection_id: str,
                                     user_id: str, conversation_id: str):
        """Handle typing indicator"""
        is_typing = payload.get('is_typing', False)
        
        # Broadcast to other users in conversation
        await self.connection_manager.send_to_conversation({
            'type': 'typing_indicator',
            'payload': {
                'user_id': user_id,
                'is_typing': is_typing
            },
            'timestamp': datetime.utcnow().isoformat()
        }, conversation_id)
    
    async def _handle_ping(self, payload: Dict[str, Any], connection_id: str):
        """Handle ping message"""
        await self.connection_manager.send_personal_message({
            'type': 'pong',
            'payload': payload,
            'timestamp': datetime.utcnow().isoformat()
        }, connection_id)
    
    async def _send_initial_status(self, connection_id: str, user_id: str, conversation_id: str):
        """Send initial status information"""
        # Get agent statuses
        agent_statuses = await self.agent_hub.get_agent_statuses()
        
        await self.connection_manager.send_personal_message({
            'type': 'initial_status',
            'payload': {
                'user_id': user_id,
                'conversation_id': conversation_id,
                'agent_statuses': agent_statuses,
                'connected': True
            },
            'timestamp': datetime.utcnow().isoformat()
        }, connection_id)
    
    async def _send_message_response(self, response, conversation_id: str):
        """Send conversational AI response"""
        await self.connection_manager.send_to_conversation({
            'type': 'message_response',
            'payload': {
                'response_id': response.response_id,
                'conversation_id': response.conversation_id,
                'message': response.message,
                'intent_analysis': response.intent_analysis,
                'suggested_actions': response.suggested_actions,
                'requires_approval': response.requires_approval,
                'risk_warnings': response.risk_warnings,
                'educational_content': response.educational_content,
                'follow_up_questions': response.follow_up_questions,
                'timestamp': response.timestamp.isoformat()
            },
            'timestamp': datetime.utcnow().isoformat()
        }, conversation_id)
    
    async def _send_typing_indicator(self, conversation_id: str, is_typing: bool):
        """Send typing indicator"""
        await self.connection_manager.send_to_conversation({
            'type': 'typing_indicator',
            'payload': {
                'user_id': 'assistant',
                'is_typing': is_typing
            },
            'timestamp': datetime.utcnow().isoformat()
        }, conversation_id)
    
    async def _send_error(self, connection_id: str, error_message: str):
        """Send error message"""
        await self.connection_manager.send_personal_message({
            'type': 'error',
            'payload': {
                'message': error_message
            },
            'timestamp': datetime.utcnow().isoformat()
        }, connection_id)
    
    async def _notify_security_agent(self, response, user_id: str, conversation_id: str):
        """Notify security agent of high-risk operation"""
        try:
            message = Message(
                id=str(uuid.uuid4()),
                type=MessageType.REQUEST,
                sender="chat_handler",
                recipient="security_guardian",
                payload={
                    "type": "risk_assessment_request",
                    "user_id": user_id,
                    "conversation_id": conversation_id,
                    "response": response.__dict__,
                    "timestamp": datetime.utcnow().isoformat()
                }
            )
            
            await self.message_bus.publish("security.risk_assessment", message)
        
        except Exception as e:
            logger.error("Failed to notify security agent", error=str(e))
    
    async def _handle_agent_status_update(self, message: Message):
        """Handle agent status updates"""
        try:
            payload = message.payload
            agent_id = payload.get('agent_id')
            status = payload.get('status')
            activity = payload.get('activity')
            
            # Broadcast to all connections
            await self.connection_manager.broadcast({
                'type': 'agent_status_update',
                'payload': {
                    'agent_id': agent_id,
                    'status': status,
                    'activity': activity
                },
                'timestamp': datetime.utcnow().isoformat()
            })
        
        except Exception as e:
            logger.error("Agent status update handling failed", error=str(e))
    
    async def _handle_agent_notification(self, message: Message):
        """Handle agent notifications"""
        try:
            payload = message.payload
            notification_type = payload.get('type', 'info')
            notification_message = payload.get('message', '')
            user_id = payload.get('user_id')
            conversation_id = payload.get('conversation_id')
            
            notification = {
                'type': 'system_notification',
                'payload': {
                    'notification_type': notification_type,
                    'message': notification_message
                },
                'timestamp': datetime.utcnow().isoformat()
            }
            
            if user_id:
                await self.connection_manager.send_to_user(notification, user_id)
            elif conversation_id:
                await self.connection_manager.send_to_conversation(notification, conversation_id)
            else:
                await self.connection_manager.broadcast(notification)
        
        except Exception as e:
            logger.error("Agent notification handling failed", error=str(e))

# Global instance
chat_handler = ChatWebSocketHandler()