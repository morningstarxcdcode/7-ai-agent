"""
Agent Hub Controller - Central orchestration system for multi-agent coordination

This module implements the core Agent Hub Controller that manages seven specialized
AI agents: DeFi_Strategist, Smart_Wallet_Manager, Prediction_Market_Analyst,
Productivity_Orchestrator, Security_Guardian, Quality_Assurance_Agent, and
World_Problem_Solver.

The controller provides:
- Request routing and agent selection
- Cross-agent communication and coordination
- Conflict resolution and consensus mechanisms
- Resource management and load balancing
- Performance monitoring and optimization
"""

import asyncio
import logging
import uuid
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, field
from contextlib import asynccontextmanager

import redis.asyncio as redis
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
import structlog
from prometheus_client import Counter, Histogram, Gauge, generate_latest

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Prometheus metrics
REQUEST_COUNT = Counter('agent_hub_requests_total', 'Total requests', ['agent_type', 'status'])
REQUEST_DURATION = Histogram('agent_hub_request_duration_seconds', 'Request duration')
ACTIVE_AGENTS = Gauge('agent_hub_active_agents', 'Number of active agents', ['agent_type'])
CROSS_AGENT_MESSAGES = Counter('agent_hub_cross_agent_messages_total', 'Cross-agent messages', ['from_agent', 'to_agent'])

class AgentType(str, Enum):
    """Enumeration of specialized agent types in the system"""
    DEFI_STRATEGIST = "defi_strategist"
    SMART_WALLET_MANAGER = "smart_wallet_manager"
    PREDICTION_MARKET_ANALYST = "prediction_market_analyst"
    PRODUCTIVITY_ORCHESTRATOR = "productivity_orchestrator"
    SECURITY_GUARDIAN = "security_guardian"
    QUALITY_ASSURANCE_AGENT = "quality_assurance_agent"
    WORLD_PROBLEM_SOLVER = "world_problem_solver"

class RequestPriority(str, Enum):
    """Request priority levels for agent task scheduling"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class AgentStatus(str, Enum):
    """Agent operational status"""
    IDLE = "idle"
    BUSY = "busy"
    ERROR = "error"
    MAINTENANCE = "maintenance"

class MessageType(str, Enum):
    """Types of inter-agent messages"""
    REQUEST = "request"
    RESPONSE = "response"
    NOTIFICATION = "notification"
    COORDINATION = "coordination"

@dataclass
class AgentCapability:
    """Represents a specific capability of an agent"""
    name: str
    description: str
    input_schema: Dict[str, Any]
    output_schema: Dict[str, Any]
    estimated_duration: timedelta
    resource_requirements: Dict[str, Any]

@dataclass
class AgentInfo:
    """Information about a registered agent"""
    agent_id: str
    agent_type: AgentType
    status: AgentStatus
    capabilities: List[AgentCapability]
    current_load: float
    max_concurrent_tasks: int
    last_heartbeat: datetime
    performance_metrics: Dict[str, Any] = field(default_factory=dict)

class UserRequest(BaseModel):
    """Incoming user request model"""
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    content: str
    priority: RequestPriority = RequestPriority.MEDIUM
    context: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class AgentMessage(BaseModel):
    """Inter-agent communication message"""
    message_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    from_agent: str
    to_agent: str
    message_type: MessageType
    payload: Dict[str, Any]
    correlation_id: Optional[str] = None
    priority: RequestPriority = RequestPriority.MEDIUM
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None

class AgentResponse(BaseModel):
    """Response from an agent"""
    response_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    request_id: str
    agent_id: str
    agent_type: AgentType
    status: str
    result: Dict[str, Any]
    metadata: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    execution_time: Optional[float] = None

class CoordinatedResponse(BaseModel):
    """Response from coordinated multi-agent operation"""
    coordination_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    request_id: str
    participating_agents: List[str]
    consolidated_result: Dict[str, Any]
    individual_responses: List[AgentResponse]
    consensus_reached: bool
    confidence_score: float
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    total_execution_time: float

class AgentConflict(BaseModel):
    """Represents a conflict between agents"""
    conflict_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conflicting_agents: List[str]
    conflict_type: str
    description: str
    proposed_resolutions: List[Dict[str, Any]]
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class Resolution(BaseModel):
    """Resolution of an agent conflict"""
    resolution_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conflict_id: str
    chosen_resolution: Dict[str, Any]
    reasoning: str
    affected_agents: List[str]
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class AgentMetrics(BaseModel):
    """Performance metrics for an agent"""
    agent_id: str
    agent_type: AgentType
    requests_processed: int
    average_response_time: float
    success_rate: float
    current_load: float
    uptime: timedelta
    last_updated: datetime = Field(default_factory=datetime.utcnow)

class AgentHubController:
    """
    Central orchestration controller for the multi-agent system
    
    This class manages the lifecycle, coordination, and communication
    between all specialized agents in the DeFi automation platform.
    """
    
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_url = redis_url
        self.redis_client: Optional[redis.Redis] = None
        self.agents: Dict[str, AgentInfo] = {}
        self.active_requests: Dict[str, UserRequest] = {}
        self.message_queue: asyncio.Queue = asyncio.Queue()
        self.websocket_connections: Dict[str, WebSocket] = {}
        self.coordination_sessions: Dict[str, Dict[str, Any]] = {}
        
        # Agent selection strategies
        self.agent_selectors = {
            "financial": [AgentType.DEFI_STRATEGIST, AgentType.SMART_WALLET_MANAGER],
            "analysis": [AgentType.PREDICTION_MARKET_ANALYST, AgentType.WORLD_PROBLEM_SOLVER],
            "security": [AgentType.SECURITY_GUARDIAN],
            "productivity": [AgentType.PRODUCTIVITY_ORCHESTRATOR],
            "quality": [AgentType.QUALITY_ASSURANCE_AGENT]
        }
    
    async def initialize(self):
        """Initialize the Agent Hub Controller"""
        try:
            self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
            await self.redis_client.ping()
            logger.info("Agent Hub Controller initialized successfully")
            
            # Start background tasks
            asyncio.create_task(self._process_message_queue())
            asyncio.create_task(self._monitor_agent_health())
            asyncio.create_task(self._cleanup_expired_sessions())
            
        except Exception as e:
            logger.error("Failed to initialize Agent Hub Controller", error=str(e))
            raise
    
    async def shutdown(self):
        """Gracefully shutdown the controller"""
        try:
            # Close all websocket connections
            for ws in self.websocket_connections.values():
                await ws.close()
            
            # Close Redis connection
            if self.redis_client:
                await self.redis_client.close()
            
            logger.info("Agent Hub Controller shutdown completed")
        except Exception as e:
            logger.error("Error during shutdown", error=str(e))
    
    async def register_agent(self, agent_info: AgentInfo) -> bool:
        """Register a new agent with the hub"""
        try:
            self.agents[agent_info.agent_id] = agent_info
            
            # Store in Redis for persistence
            await self.redis_client.hset(
                f"agent:{agent_info.agent_id}",
                mapping={
                    "type": agent_info.agent_type.value,
                    "status": agent_info.status.value,
                    "registered_at": datetime.utcnow().isoformat(),
                    "capabilities": len(agent_info.capabilities)
                }
            )
            
            ACTIVE_AGENTS.labels(agent_type=agent_info.agent_type.value).inc()
            logger.info("Agent registered successfully", agent_id=agent_info.agent_id, agent_type=agent_info.agent_type.value)
            return True
            
        except Exception as e:
            logger.error("Failed to register agent", agent_id=agent_info.agent_id, error=str(e))
            return False
    
    async def route_request(self, request: UserRequest) -> AgentResponse:
        """
        Route a user request to the most appropriate agent
        
        This method analyzes the request content and context to determine
        which agent(s) should handle the request, considering current load
        and agent capabilities.
        """
        start_time = asyncio.get_event_loop().time()
        
        try:
            # Analyze request to determine required agents
            selected_agents = await self._analyze_and_select_agents(request)
            
            if not selected_agents:
                raise HTTPException(status_code=400, detail="No suitable agents available for this request")
            
            # For single agent requests
            if len(selected_agents) == 1:
                agent_id = selected_agents[0]
                response = await self._send_request_to_agent(agent_id, request)
                
                REQUEST_COUNT.labels(
                    agent_type=self.agents[agent_id].agent_type.value,
                    status="success"
                ).inc()
                
                return response
            
            # For multi-agent coordination
            else:
                coordinated_response = await self.coordinate_agents(request, selected_agents)
                return AgentResponse(
                    request_id=request.request_id,
                    agent_id="coordinated",
                    agent_type=AgentType.DEFI_STRATEGIST,  # Default for coordinated responses
                    status="success",
                    result=coordinated_response.consolidated_result,
                    metadata={"coordination_id": coordinated_response.coordination_id},
                    execution_time=asyncio.get_event_loop().time() - start_time
                )
        
        except Exception as e:
            logger.error("Request routing failed", request_id=request.request_id, error=str(e))
            REQUEST_COUNT.labels(agent_type="unknown", status="error").inc()
            raise HTTPException(status_code=500, detail=f"Request routing failed: {str(e)}")
        
        finally:
            REQUEST_DURATION.observe(asyncio.get_event_loop().time() - start_time)
    
    async def coordinate_agents(self, request: UserRequest, agent_ids: List[str]) -> CoordinatedResponse:
        """
        Coordinate multiple agents to handle a complex request
        
        This method orchestrates collaboration between multiple agents,
        manages their interactions, and consolidates their responses
        into a unified result.
        """
        coordination_id = str(uuid.uuid4())
        start_time = asyncio.get_event_loop().time()
        
        try:
            # Create coordination session
            self.coordination_sessions[coordination_id] = {
                "request": request,
                "agents": agent_ids,
                "responses": {},
                "status": "active",
                "created_at": datetime.utcnow()
            }
            
            # Send request to all participating agents
            tasks = []
            for agent_id in agent_ids:
                task = asyncio.create_task(
                    self._send_request_to_agent(agent_id, request, coordination_id)
                )
                tasks.append(task)
            
            # Wait for all responses
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process responses and handle any exceptions
            valid_responses = []
            for i, response in enumerate(responses):
                if isinstance(response, Exception):
                    logger.error("Agent response failed", agent_id=agent_ids[i], error=str(response))
                else:
                    valid_responses.append(response)
            
            # Consolidate responses using consensus mechanism
            consolidated_result = await self._consolidate_responses(valid_responses)
            consensus_reached = len(valid_responses) >= len(agent_ids) * 0.6  # 60% consensus threshold
            
            # Calculate confidence score based on agreement
            confidence_score = await self._calculate_confidence_score(valid_responses)
            
            coordinated_response = CoordinatedResponse(
                request_id=request.request_id,
                participating_agents=agent_ids,
                consolidated_result=consolidated_result,
                individual_responses=valid_responses,
                consensus_reached=consensus_reached,
                confidence_score=confidence_score,
                total_execution_time=asyncio.get_event_loop().time() - start_time
            )
            
            # Clean up coordination session
            del self.coordination_sessions[coordination_id]
            
            logger.info("Agent coordination completed", 
                       coordination_id=coordination_id,
                       participating_agents=len(agent_ids),
                       consensus_reached=consensus_reached,
                       confidence_score=confidence_score)
            
            return coordinated_response
            
        except Exception as e:
            logger.error("Agent coordination failed", coordination_id=coordination_id, error=str(e))
            # Clean up failed session
            self.coordination_sessions.pop(coordination_id, None)
            raise
    
    async def resolve_conflict(self, conflict: AgentConflict) -> Resolution:
        """
        Resolve conflicts between agents using predefined resolution strategies
        
        This method implements various conflict resolution mechanisms
        including voting, priority-based resolution, and escalation to
        human oversight when necessary.
        """
        try:
            # Analyze conflict type and determine resolution strategy
            resolution_strategy = await self._determine_resolution_strategy(conflict)
            
            if resolution_strategy == "voting":
                chosen_resolution = await self._resolve_by_voting(conflict)
            elif resolution_strategy == "priority":
                chosen_resolution = await self._resolve_by_priority(conflict)
            elif resolution_strategy == "escalation":
                chosen_resolution = await self._escalate_to_human(conflict)
            else:
                chosen_resolution = conflict.proposed_resolutions[0]  # Default to first proposal
            
            resolution = Resolution(
                conflict_id=conflict.conflict_id,
                chosen_resolution=chosen_resolution,
                reasoning=f"Resolved using {resolution_strategy} strategy",
                affected_agents=conflict.conflicting_agents
            )
            
            # Notify affected agents of the resolution
            await self._notify_agents_of_resolution(resolution)
            
            logger.info("Conflict resolved", 
                       conflict_id=conflict.conflict_id,
                       strategy=resolution_strategy,
                       affected_agents=len(conflict.conflicting_agents))
            
            return resolution
            
        except Exception as e:
            logger.error("Conflict resolution failed", conflict_id=conflict.conflict_id, error=str(e))
            raise
    
    async def monitor_performance(self) -> List[AgentMetrics]:
        """
        Monitor and return performance metrics for all agents
        
        This method collects performance data from all registered agents
        and provides insights into system health and efficiency.
        """
        try:
            metrics = []
            
            for agent_id, agent_info in self.agents.items():
                # Calculate metrics from stored data
                agent_metrics = AgentMetrics(
                    agent_id=agent_id,
                    agent_type=agent_info.agent_type,
                    requests_processed=agent_info.performance_metrics.get("requests_processed", 0),
                    average_response_time=agent_info.performance_metrics.get("avg_response_time", 0.0),
                    success_rate=agent_info.performance_metrics.get("success_rate", 1.0),
                    current_load=agent_info.current_load,
                    uptime=datetime.utcnow() - agent_info.last_heartbeat
                )
                metrics.append(agent_metrics)
            
            return metrics
            
        except Exception as e:
            logger.error("Performance monitoring failed", error=str(e))
            return []
    
    async def update_agent_capabilities(self, agent_id: str, capabilities: List[AgentCapability]) -> bool:
        """Update the capabilities of a registered agent"""
        try:
            if agent_id not in self.agents:
                logger.warning("Attempted to update capabilities for unregistered agent", agent_id=agent_id)
                return False
            
            self.agents[agent_id].capabilities = capabilities
            
            # Update in Redis
            await self.redis_client.hset(
                f"agent:{agent_id}",
                "capabilities",
                len(capabilities)
            )
            
            logger.info("Agent capabilities updated", agent_id=agent_id, capability_count=len(capabilities))
            return True
            
        except Exception as e:
            logger.error("Failed to update agent capabilities", agent_id=agent_id, error=str(e))
            return False
    
    # Private helper methods
    
    async def _analyze_and_select_agents(self, request: UserRequest) -> List[str]:
        """Analyze request content and select appropriate agents"""
        # Simple keyword-based agent selection (can be enhanced with ML)
        content_lower = request.content.lower()
        selected_agents = []
        
        # Financial operations
        if any(keyword in content_lower for keyword in ["defi", "swap", "yield", "liquidity", "trade"]):
            selected_agents.extend(self._get_available_agents([AgentType.DEFI_STRATEGIST]))
        
        if any(keyword in content_lower for keyword in ["wallet", "transaction", "send", "receive"]):
            selected_agents.extend(self._get_available_agents([AgentType.SMART_WALLET_MANAGER]))
        
        # Analysis and prediction
        if any(keyword in content_lower for keyword in ["predict", "forecast", "market", "trend"]):
            selected_agents.extend(self._get_available_agents([AgentType.PREDICTION_MARKET_ANALYST]))
        
        # Security concerns
        if any(keyword in content_lower for keyword in ["security", "risk", "safe", "audit"]):
            selected_agents.extend(self._get_available_agents([AgentType.SECURITY_GUARDIAN]))
        
        # Productivity tasks
        if any(keyword in content_lower for keyword in ["email", "calendar", "task", "schedule"]):
            selected_agents.extend(self._get_available_agents([AgentType.PRODUCTIVITY_ORCHESTRATOR]))
        
        # World problems
        if any(keyword in content_lower for keyword in ["climate", "social", "impact", "problem"]):
            selected_agents.extend(self._get_available_agents([AgentType.WORLD_PROBLEM_SOLVER]))
        
        # Default to DeFi Strategist if no specific match
        if not selected_agents:
            selected_agents.extend(self._get_available_agents([AgentType.DEFI_STRATEGIST]))
        
        return list(set(selected_agents))  # Remove duplicates
    
    def _get_available_agents(self, agent_types: List[AgentType]) -> List[str]:
        """Get available agents of specified types"""
        available = []
        for agent_id, agent_info in self.agents.items():
            if (agent_info.agent_type in agent_types and 
                agent_info.status == AgentStatus.IDLE and
                agent_info.current_load < 0.8):  # 80% load threshold
                available.append(agent_id)
        return available
    
    async def _send_request_to_agent(self, agent_id: str, request: UserRequest, coordination_id: Optional[str] = None) -> AgentResponse:
        """Send a request to a specific agent"""
        # This would integrate with the actual agent implementation
        # For now, return a mock response
        await asyncio.sleep(0.1)  # Simulate processing time
        
        return AgentResponse(
            request_id=request.request_id,
            agent_id=agent_id,
            agent_type=self.agents[agent_id].agent_type,
            status="success",
            result={"message": f"Processed by {agent_id}", "coordination_id": coordination_id},
            execution_time=0.1
        )
    
    async def _consolidate_responses(self, responses: List[AgentResponse]) -> Dict[str, Any]:
        """Consolidate multiple agent responses into a unified result"""
        if not responses:
            return {"error": "No valid responses received"}
        
        # Simple consolidation strategy - can be enhanced with ML
        consolidated = {
            "primary_result": responses[0].result,
            "supporting_results": [r.result for r in responses[1:]],
            "agent_count": len(responses),
            "consensus_indicators": []
        }
        
        return consolidated
    
    async def _calculate_confidence_score(self, responses: List[AgentResponse]) -> float:
        """Calculate confidence score based on response agreement"""
        if not responses:
            return 0.0
        
        # Simple confidence calculation - can be enhanced
        base_confidence = 0.5
        agreement_bonus = min(0.4, len(responses) * 0.1)
        return min(1.0, base_confidence + agreement_bonus)
    
    async def _determine_resolution_strategy(self, conflict: AgentConflict) -> str:
        """Determine the best strategy for resolving a conflict"""
        # Simple strategy selection based on conflict type
        if conflict.conflict_type == "priority_conflict":
            return "priority"
        elif conflict.conflict_type == "resource_conflict":
            return "voting"
        elif conflict.conflict_type == "security_conflict":
            return "escalation"
        else:
            return "voting"
    
    async def _resolve_by_voting(self, conflict: AgentConflict) -> Dict[str, Any]:
        """Resolve conflict by agent voting"""
        # Mock voting resolution
        return conflict.proposed_resolutions[0] if conflict.proposed_resolutions else {}
    
    async def _resolve_by_priority(self, conflict: AgentConflict) -> Dict[str, Any]:
        """Resolve conflict by agent priority"""
        # Mock priority resolution
        return conflict.proposed_resolutions[0] if conflict.proposed_resolutions else {}
    
    async def _escalate_to_human(self, conflict: AgentConflict) -> Dict[str, Any]:
        """Escalate conflict to human oversight"""
        # Mock human escalation
        return {"escalated": True, "requires_human_intervention": True}
    
    async def _notify_agents_of_resolution(self, resolution: Resolution):
        """Notify affected agents of conflict resolution"""
        for agent_id in resolution.affected_agents:
            if agent_id in self.agents:
                # Send notification message
                message = AgentMessage(
                    from_agent="hub_controller",
                    to_agent=agent_id,
                    message_type=MessageType.NOTIFICATION,
                    payload={"resolution": resolution.dict()}
                )
                await self.message_queue.put(message)
    
    async def _process_message_queue(self):
        """Background task to process inter-agent messages"""
        while True:
            try:
                message = await self.message_queue.get()
                CROSS_AGENT_MESSAGES.labels(
                    from_agent=message.from_agent,
                    to_agent=message.to_agent
                ).inc()
                
                # Process message based on type
                if message.message_type == MessageType.NOTIFICATION:
                    await self._deliver_notification(message)
                elif message.message_type == MessageType.COORDINATION:
                    await self._handle_coordination_message(message)
                
                self.message_queue.task_done()
                
            except Exception as e:
                logger.error("Message processing failed", error=str(e))
                await asyncio.sleep(1)
    
    async def _deliver_notification(self, message: AgentMessage):
        """Deliver notification to target agent"""
        # Mock notification delivery
        logger.info("Notification delivered", 
                   from_agent=message.from_agent,
                   to_agent=message.to_agent)
    
    async def _handle_coordination_message(self, message: AgentMessage):
        """Handle coordination messages between agents"""
        # Mock coordination message handling
        logger.info("Coordination message processed",
                   from_agent=message.from_agent,
                   to_agent=message.to_agent)
    
    async def _monitor_agent_health(self):
        """Background task to monitor agent health"""
        while True:
            try:
                current_time = datetime.utcnow()
                for agent_id, agent_info in list(self.agents.items()):
                    # Check if agent has sent heartbeat recently
                    if current_time - agent_info.last_heartbeat > timedelta(minutes=5):
                        logger.warning("Agent heartbeat timeout", agent_id=agent_id)
                        agent_info.status = AgentStatus.ERROR
                
                await asyncio.sleep(60)  # Check every minute
                
            except Exception as e:
                logger.error("Agent health monitoring failed", error=str(e))
                await asyncio.sleep(60)
    
    async def _cleanup_expired_sessions(self):
        """Background task to clean up expired coordination sessions"""
        while True:
            try:
                current_time = datetime.utcnow()
                expired_sessions = []
                
                for session_id, session_data in self.coordination_sessions.items():
                    if current_time - session_data["created_at"] > timedelta(hours=1):
                        expired_sessions.append(session_id)
                
                for session_id in expired_sessions:
                    del self.coordination_sessions[session_id]
                    logger.info("Expired coordination session cleaned up", session_id=session_id)
                
                await asyncio.sleep(300)  # Check every 5 minutes
                
            except Exception as e:
                logger.error("Session cleanup failed", error=str(e))
                await asyncio.sleep(300)

# Global controller instance
controller = AgentHubController()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan context manager"""
    # Startup
    await controller.initialize()
    yield
    # Shutdown
    await controller.shutdown()

# FastAPI application
app = FastAPI(
    title="DeFi Automation Platform - Agent Hub",
    description="Central orchestration system for multi-agent DeFi automation",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get controller instance
async def get_controller() -> AgentHubController:
    return controller

# API Routes

@app.post("/api/v1/requests", response_model=AgentResponse)
async def submit_request(
    request: UserRequest,
    hub: AgentHubController = Depends(get_controller)
) -> AgentResponse:
    """Submit a user request to the agent hub for processing"""
    return await hub.route_request(request)

@app.post("/api/v1/agents/register")
async def register_agent(
    agent_info: AgentInfo,
    hub: AgentHubController = Depends(get_controller)
) -> Dict[str, Any]:
    """Register a new agent with the hub"""
    success = await hub.register_agent(agent_info)
    return {"success": success, "agent_id": agent_info.agent_id}

@app.get("/api/v1/agents", response_model=List[AgentMetrics])
async def get_agent_metrics(
    hub: AgentHubController = Depends(get_controller)
) -> List[AgentMetrics]:
    """Get performance metrics for all registered agents"""
    return await hub.monitor_performance()

@app.post("/api/v1/conflicts/resolve", response_model=Resolution)
async def resolve_conflict(
    conflict: AgentConflict,
    hub: AgentHubController = Depends(get_controller)
) -> Resolution:
    """Resolve a conflict between agents"""
    return await hub.resolve_conflict(conflict)

@app.websocket("/ws/agent-hub")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time agent hub communication"""
    await websocket.accept()
    connection_id = str(uuid.uuid4())
    controller.websocket_connections[connection_id] = websocket
    
    try:
        while True:
            data = await websocket.receive_text()
            # Echo back for now - can be enhanced for real-time updates
            await websocket.send_text(f"Echo: {data}")
    except WebSocketDisconnect:
        del controller.websocket_connections[connection_id]

@app.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint"""
    return generate_latest()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "active_agents": len(controller.agents),
        "active_sessions": len(controller.coordination_sessions)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)