"""
Message Bus Implementation for Multi-Agent Communication

This module implements the centralized message bus architecture that enables
communication between the 7 specialized agents following the hub-and-spoke pattern
with the Intent Router as the central orchestrator.
"""

import asyncio
import json
import uuid
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Any, Callable, Set
from dataclasses import dataclass, field
import structlog
import redis.asyncio as redis
from pydantic import BaseModel, Field

logger = structlog.get_logger()

class MessageType(str, Enum):
    """Types of messages in the agent communication protocol"""
    REQUEST = "request"
    RESPONSE = "response"
    EVENT = "event"
    COORDINATION = "coordination"
    ESCALATION = "escalation"

class MessagePriority(str, Enum):
    """Message priority levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class AgentRole(str, Enum):
    """Agent roles in the coordination hierarchy"""
    ORCHESTRATOR = "orchestrator"  # Intent Router
    DESIGN_LEAD = "design_lead"    # Product Architect
    IMPLEMENTATION_LEAD = "implementation_lead"  # Code Engineer
    QUALITY_LEAD = "quality_lead"  # Test Agent
    SECURITY_LEAD = "security_lead"  # Security Validator
    INFORMATION_LEAD = "information_lead"  # Research Agent
    COMPLIANCE_LEAD = "compliance_lead"  # Audit Agent

class WorkflowPattern(str, Enum):
    """Workflow coordination patterns"""
    SEQUENTIAL = "sequential"
    PARALLEL = "parallel"
    ITERATIVE = "iterative"
    ESCALATION = "escalation"

@dataclass
class AgentMessage:
    """Standard message format for agent communication"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    from_agent: str = ""
    to_agent: str = ""
    message_type: MessageType = MessageType.REQUEST
    action: str = ""
    payload: Dict[str, Any] = field(default_factory=dict)
    priority: MessagePriority = MessagePriority.MEDIUM
    timestamp: datetime = field(default_factory=datetime.utcnow)
    correlation_id: Optional[str] = None
    in_reply_to: Optional[str] = None
    expires_at: Optional[datetime] = None
    retry_count: int = 0
    max_retries: int = 3

    def to_dict(self) -> Dict[str, Any]:
        """Convert message to dictionary for serialization"""
        return {
            "id": self.id,
            "from": self.from_agent,
            "to": self.to_agent,
            "type": self.message_type.value,
            "action": self.action,
            "payload": self.payload,
            "priority": self.priority.value,
            "timestamp": self.timestamp.isoformat(),
            "correlation_id": self.correlation_id,
            "in_reply_to": self.in_reply_to,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "retry_count": self.retry_count,
            "max_retries": self.max_retries
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AgentMessage':
        """Create message from dictionary"""
        return cls(
            id=data["id"],
            from_agent=data["from"],
            to_agent=data["to"],
            message_type=MessageType(data["type"]),
            action=data["action"],
            payload=data["payload"],
            priority=MessagePriority(data["priority"]),
            timestamp=datetime.fromisoformat(data["timestamp"]),
            correlation_id=data.get("correlation_id"),
            in_reply_to=data.get("in_reply_to"),
            expires_at=datetime.fromisoformat(data["expires_at"]) if data.get("expires_at") else None,
            retry_count=data.get("retry_count", 0),
            max_retries=data.get("max_retries", 3)
        )

@dataclass
class WorkflowState:
    """Represents the state of a multi-agent workflow"""
    workflow_id: str
    pattern: WorkflowPattern
    participating_agents: List[str]
    current_step: int
    total_steps: int
    status: str
    created_at: datetime
    updated_at: datetime
    context: Dict[str, Any] = field(default_factory=dict)
    results: Dict[str, Any] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)

class MessageBus:
    """
    Centralized message bus for agent communication
    
    Implements the hub-and-spoke communication pattern with the Intent Router
    as the central orchestrator. Provides reliable message delivery, routing,
    and workflow coordination capabilities.
    """
    
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_url = redis_url
        self.redis_client: Optional[redis.Redis] = None
        self.message_handlers: Dict[str, Callable] = {}
        self.agent_subscriptions: Dict[str, Set[str]] = {}
        self.active_workflows: Dict[str, WorkflowState] = {}
        self.message_queue = asyncio.Queue()
        self.dead_letter_queue = asyncio.Queue()
        self.running = False
        
        # Agent role mapping for conflict resolution
        self.agent_roles = {
            "intent_router": AgentRole.ORCHESTRATOR,
            "product_architect": AgentRole.DESIGN_LEAD,
            "code_engineer": AgentRole.IMPLEMENTATION_LEAD,
            "test_agent": AgentRole.QUALITY_LEAD,
            "security_validator": AgentRole.SECURITY_LEAD,
            "research_agent": AgentRole.INFORMATION_LEAD,
            "audit_agent": AgentRole.COMPLIANCE_LEAD
        }
        
        # Priority hierarchy for conflict resolution
        self.role_priority = {
            AgentRole.SECURITY_LEAD: 1,      # Security always wins
            AgentRole.ORCHESTRATOR: 2,       # Intent Router arbitrates
            AgentRole.COMPLIANCE_LEAD: 3,    # Audit for compliance
            AgentRole.QUALITY_LEAD: 4,       # Quality assurance
            AgentRole.DESIGN_LEAD: 5,        # Architecture decisions
            AgentRole.IMPLEMENTATION_LEAD: 6, # Implementation details
            AgentRole.INFORMATION_LEAD: 7    # Information support
        }
    
    async def initialize(self):
        """Initialize the message bus"""
        try:
            self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
            await self.redis_client.ping()
            
            self.running = True
            
            # Start background tasks
            asyncio.create_task(self._process_message_queue())
            asyncio.create_task(self._process_dead_letter_queue())
            asyncio.create_task(self._cleanup_expired_messages())
            asyncio.create_task(self._monitor_workflow_health())
            
            logger.info("Message bus initialized successfully")
            
        except Exception as e:
            logger.error("Failed to initialize message bus", error=str(e))
            raise
    
    async def shutdown(self):
        """Shutdown the message bus gracefully"""
        self.running = False
        
        if self.redis_client:
            await self.redis_client.close()
        
        logger.info("Message bus shutdown completed")
    
    async def register_agent(self, agent_id: str, message_handler: Callable):
        """Register an agent with the message bus"""
        self.message_handlers[agent_id] = message_handler
        self.agent_subscriptions[agent_id] = set()
        
        logger.info("Agent registered with message bus", agent_id=agent_id)
    
    async def subscribe_to_events(self, agent_id: str, event_types: List[str]):
        """Subscribe an agent to specific event types"""
        if agent_id not in self.agent_subscriptions:
            self.agent_subscriptions[agent_id] = set()
        
        self.agent_subscriptions[agent_id].update(event_types)
        logger.info("Agent subscribed to events", agent_id=agent_id, events=event_types)
    
    async def send_message(self, message: AgentMessage) -> bool:
        """Send a message through the bus"""
        try:
            # Validate message
            if not await self._validate_message(message):
                logger.warning("Invalid message rejected", message_id=message.id)
                return False
            
            # Check if message has expired
            if message.expires_at and datetime.utcnow() > message.expires_at:
                logger.warning("Expired message rejected", message_id=message.id)
                return False
            
            # Route message based on type and priority
            if message.priority == MessagePriority.CRITICAL:
                await self._handle_critical_message(message)
            else:
                await self.message_queue.put(message)
            
            # Store message for audit trail
            await self._store_message(message)
            
            logger.info("Message queued for delivery", 
                       message_id=message.id,
                       from_agent=message.from_agent,
                       to_agent=message.to_agent,
                       priority=message.priority.value)
            
            return True
            
        except Exception as e:
            logger.error("Failed to send message", message_id=message.id, error=str(e))
            return False
    
    async def broadcast_event(self, event_type: str, payload: Dict[str, Any], from_agent: str) -> int:
        """Broadcast an event to all subscribed agents"""
        try:
            delivered_count = 0
            
            for agent_id, subscriptions in self.agent_subscriptions.items():
                if event_type in subscriptions and agent_id != from_agent:
                    event_message = AgentMessage(
                        from_agent=from_agent,
                        to_agent=agent_id,
                        message_type=MessageType.EVENT,
                        action=event_type,
                        payload=payload,
                        priority=MessagePriority.MEDIUM
                    )
                    
                    if await self.send_message(event_message):
                        delivered_count += 1
            
            logger.info("Event broadcast completed", 
                       event_type=event_type,
                       from_agent=from_agent,
                       delivered_count=delivered_count)
            
            return delivered_count
            
        except Exception as e:
            logger.error("Event broadcast failed", event_type=event_type, error=str(e))
            return 0
    
    async def start_workflow(self, workflow_id: str, pattern: WorkflowPattern, 
                           agents: List[str], context: Dict[str, Any]) -> bool:
        """Start a new multi-agent workflow"""
        try:
            workflow = WorkflowState(
                workflow_id=workflow_id,
                pattern=pattern,
                participating_agents=agents,
                current_step=0,
                total_steps=len(agents) if pattern == WorkflowPattern.SEQUENTIAL else 1,
                status="active",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
                context=context
            )
            
            self.active_workflows[workflow_id] = workflow
            
            # Execute workflow based on pattern
            if pattern == WorkflowPattern.SEQUENTIAL:
                await self._execute_sequential_workflow(workflow)
            elif pattern == WorkflowPattern.PARALLEL:
                await self._execute_parallel_workflow(workflow)
            elif pattern == WorkflowPattern.ITERATIVE:
                await self._execute_iterative_workflow(workflow)
            elif pattern == WorkflowPattern.ESCALATION:
                await self._execute_escalation_workflow(workflow)
            
            logger.info("Workflow started", 
                       workflow_id=workflow_id,
                       pattern=pattern.value,
                       agents=len(agents))
            
            return True
            
        except Exception as e:
            logger.error("Failed to start workflow", workflow_id=workflow_id, error=str(e))
            return False
    
    async def resolve_conflict(self, conflicting_agents: List[str], 
                             conflict_data: Dict[str, Any]) -> str:
        """Resolve conflicts between agents using priority hierarchy"""
        try:
            # Determine highest priority agent
            highest_priority_agent = None
            highest_priority = float('inf')
            
            for agent_id in conflicting_agents:
                agent_role = self.agent_roles.get(agent_id)
                if agent_role:
                    priority = self.role_priority.get(agent_role, 999)
                    if priority < highest_priority:
                        highest_priority = priority
                        highest_priority_agent = agent_id
            
            # Security Validator always wins
            if "security_validator" in conflicting_agents:
                resolution_agent = "security_validator"
                resolution_reason = "Security concerns override all other considerations"
            
            # Intent Router arbitrates if no security concerns
            elif "intent_router" in conflicting_agents:
                resolution_agent = "intent_router"
                resolution_reason = "Intent Router has final arbitration authority"
            
            # Use highest priority agent
            elif highest_priority_agent:
                resolution_agent = highest_priority_agent
                resolution_reason = f"Resolved by agent with highest priority role"
            
            # Escalate to human if unresolvable
            else:
                resolution_agent = "human_oversight"
                resolution_reason = "Conflict requires human intervention"
            
            # Notify all agents of resolution
            resolution_message = {
                "conflict_id": str(uuid.uuid4()),
                "resolution_agent": resolution_agent,
                "reason": resolution_reason,
                "conflict_data": conflict_data,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            for agent_id in conflicting_agents:
                await self.send_message(AgentMessage(
                    from_agent="message_bus",
                    to_agent=agent_id,
                    message_type=MessageType.EVENT,
                    action="conflict_resolved",
                    payload=resolution_message,
                    priority=MessagePriority.HIGH
                ))
            
            logger.info("Conflict resolved", 
                       conflicting_agents=conflicting_agents,
                       resolution_agent=resolution_agent)
            
            return resolution_agent
            
        except Exception as e:
            logger.error("Conflict resolution failed", error=str(e))
            return "human_oversight"
    
    # Private helper methods
    
    async def _validate_message(self, message: AgentMessage) -> bool:
        """Validate message format and content"""
        if not message.from_agent or not message.to_agent:
            return False
        
        if not message.action:
            return False
        
        if message.to_agent not in self.message_handlers:
            logger.warning("Message to unregistered agent", to_agent=message.to_agent)
            return False
        
        return True
    
    async def _handle_critical_message(self, message: AgentMessage):
        """Handle critical priority messages immediately"""
        try:
            handler = self.message_handlers.get(message.to_agent)
            if handler:
                await handler(message)
            else:
                await self.dead_letter_queue.put(message)
        except Exception as e:
            logger.error("Critical message handling failed", message_id=message.id, error=str(e))
            await self.dead_letter_queue.put(message)
    
    async def _store_message(self, message: AgentMessage):
        """Store message in Redis for audit trail"""
        try:
            message_key = f"message:{message.id}"
            await self.redis_client.hset(message_key, mapping=message.to_dict())
            await self.redis_client.expire(message_key, 86400)  # 24 hours
        except Exception as e:
            logger.error("Failed to store message", message_id=message.id, error=str(e))
    
    async def _process_message_queue(self):
        """Background task to process the message queue"""
        while self.running:
            try:
                # Get message with timeout
                try:
                    message = await asyncio.wait_for(self.message_queue.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue
                
                # Deliver message
                success = await self._deliver_message(message)
                
                if not success and message.retry_count < message.max_retries:
                    # Retry with exponential backoff
                    message.retry_count += 1
                    await asyncio.sleep(2 ** message.retry_count)
                    await self.message_queue.put(message)
                elif not success:
                    # Move to dead letter queue
                    await self.dead_letter_queue.put(message)
                
                self.message_queue.task_done()
                
            except Exception as e:
                logger.error("Message queue processing error", error=str(e))
                await asyncio.sleep(1)
    
    async def _deliver_message(self, message: AgentMessage) -> bool:
        """Deliver message to target agent"""
        try:
            handler = self.message_handlers.get(message.to_agent)
            if handler:
                await handler(message)
                logger.debug("Message delivered", 
                           message_id=message.id,
                           to_agent=message.to_agent)
                return True
            else:
                logger.warning("No handler for agent", to_agent=message.to_agent)
                return False
        except Exception as e:
            logger.error("Message delivery failed", 
                        message_id=message.id,
                        to_agent=message.to_agent,
                        error=str(e))
            return False
    
    async def _process_dead_letter_queue(self):
        """Process messages that failed delivery"""
        while self.running:
            try:
                try:
                    message = await asyncio.wait_for(self.dead_letter_queue.get(), timeout=5.0)
                except asyncio.TimeoutError:
                    continue
                
                logger.warning("Message moved to dead letter queue", 
                             message_id=message.id,
                             from_agent=message.from_agent,
                             to_agent=message.to_agent)
                
                # Store in Redis for manual inspection
                dead_letter_key = f"dead_letter:{message.id}"
                await self.redis_client.hset(dead_letter_key, mapping=message.to_dict())
                
                self.dead_letter_queue.task_done()
                
            except Exception as e:
                logger.error("Dead letter queue processing error", error=str(e))
                await asyncio.sleep(5)
    
    async def _cleanup_expired_messages(self):
        """Clean up expired messages and workflows"""
        while self.running:
            try:
                current_time = datetime.utcnow()
                
                # Clean up expired workflows
                expired_workflows = []
                for workflow_id, workflow in self.active_workflows.items():
                    if current_time - workflow.created_at > timedelta(hours=24):
                        expired_workflows.append(workflow_id)
                
                for workflow_id in expired_workflows:
                    del self.active_workflows[workflow_id]
                    logger.info("Expired workflow cleaned up", workflow_id=workflow_id)
                
                await asyncio.sleep(300)  # Check every 5 minutes
                
            except Exception as e:
                logger.error("Cleanup task error", error=str(e))
                await asyncio.sleep(300)
    
    async def _monitor_workflow_health(self):
        """Monitor health of active workflows"""
        while self.running:
            try:
                current_time = datetime.utcnow()
                
                for workflow_id, workflow in self.active_workflows.items():
                    # Check for stuck workflows
                    if (current_time - workflow.updated_at > timedelta(minutes=30) and 
                        workflow.status == "active"):
                        
                        logger.warning("Workflow appears stuck", 
                                     workflow_id=workflow_id,
                                     last_update=workflow.updated_at)
                        
                        # Attempt to recover or escalate
                        await self._recover_stuck_workflow(workflow)
                
                await asyncio.sleep(60)  # Check every minute
                
            except Exception as e:
                logger.error("Workflow monitoring error", error=str(e))
                await asyncio.sleep(60)
    
    async def _recover_stuck_workflow(self, workflow: WorkflowState):
        """Attempt to recover a stuck workflow"""
        try:
            # Send recovery message to all participating agents
            recovery_message = AgentMessage(
                from_agent="message_bus",
                to_agent="intent_router",  # Route through orchestrator
                message_type=MessageType.EVENT,
                action="workflow_recovery",
                payload={
                    "workflow_id": workflow.workflow_id,
                    "stuck_since": workflow.updated_at.isoformat(),
                    "participating_agents": workflow.participating_agents
                },
                priority=MessagePriority.HIGH
            )
            
            await self.send_message(recovery_message)
            
        except Exception as e:
            logger.error("Workflow recovery failed", 
                        workflow_id=workflow.workflow_id,
                        error=str(e))
    
    async def _execute_sequential_workflow(self, workflow: WorkflowState):
        """Execute sequential workflow pattern"""
        # Implementation for sequential agent coordination
        pass
    
    async def _execute_parallel_workflow(self, workflow: WorkflowState):
        """Execute parallel workflow pattern"""
        # Implementation for parallel agent coordination
        pass
    
    async def _execute_iterative_workflow(self, workflow: WorkflowState):
        """Execute iterative workflow pattern"""
        # Implementation for iterative agent coordination
        pass
    
    async def _execute_escalation_workflow(self, workflow: WorkflowState):
        """Execute escalation workflow pattern"""
        # Implementation for escalation workflow
        pass