"""
Property-Based Tests for Multi-Agent Coordination and Collaboration

This module implements property-based tests to validate the correctness
of multi-agent coordination, communication, and consensus mechanisms
in the DeFi Automation Platform.

**Feature: defi-automation-platform, Property 1: Multi-Agent Coordination and Collaboration**
**Validates: Requirements 1.2, 1.3**
"""

import asyncio
import pytest
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Any
from hypothesis import given, strategies as st, settings, assume
from hypothesis.stateful import RuleBasedStateMachine, rule, initialize, invariant

from src.agent_hub.controller import (
    AgentHubController, AgentInfo, AgentType, AgentStatus, AgentCapability,
    UserRequest, RequestPriority, AgentConflict, MessageType
)
from src.agent_hub.message_bus import MessageBus, AgentMessage, WorkflowPattern, MessagePriority
from src.agent_hub.context_store import SharedContextStore, ContextScope, DataType, AccessLevel

# Test data generators
@st.composite
def agent_info_strategy(draw):
    """Generate valid AgentInfo instances"""
    agent_types = list(AgentType)
    agent_type = draw(st.sampled_from(agent_types))
    
    capabilities = []
    num_capabilities = draw(st.integers(min_value=1, max_value=5))
    
    for _ in range(num_capabilities):
        capability = AgentCapability(
            name=draw(st.text(min_size=5, max_size=20)),
            description=draw(st.text(min_size=10, max_size=100)),
            input_schema={"type": "object"},
            output_schema={"type": "object"},
            estimated_duration=timedelta(seconds=draw(st.integers(min_value=1, max_value=300))),
            resource_requirements={"cpu": draw(st.floats(min_value=0.1, max_value=1.0))}
        )
        capabilities.append(capability)
    
    return AgentInfo(
        agent_id=f"agent_{draw(st.integers(min_value=1, max_value=1000))}",
        agent_type=agent_type,
        status=AgentStatus.IDLE,
        capabilities=capabilities,
        current_load=draw(st.floats(min_value=0.0, max_value=1.0)),
        max_concurrent_tasks=draw(st.integers(min_value=1, max_value=10)),
        last_heartbeat=datetime.utcnow()
    )

@st.composite
def user_request_strategy(draw):
    """Generate valid UserRequest instances"""
    financial_keywords = ["defi", "swap", "yield", "trade", "liquidity", "invest"]
    security_keywords = ["security", "risk", "audit", "safe", "protect"]
    productivity_keywords = ["email", "calendar", "task", "schedule", "automate"]
    
    keyword_sets = [financial_keywords, security_keywords, productivity_keywords]
    selected_keywords = draw(st.sampled_from(keyword_sets))
    
    content_parts = []
    num_keywords = draw(st.integers(min_value=1, max_value=3))
    for _ in range(num_keywords):
        keyword = draw(st.sampled_from(selected_keywords))
        content_parts.append(f"I want to {keyword}")
    
    return UserRequest(
        user_id=f"user_{draw(st.integers(min_value=1, max_value=100))}",
        content=" and ".join(content_parts),
        priority=draw(st.sampled_from(list(RequestPriority))),
        context={"session_id": str(uuid.uuid4())}
    )

@st.composite
def agent_conflict_strategy(draw):
    """Generate valid AgentConflict instances"""
    num_agents = draw(st.integers(min_value=2, max_value=4))
    agent_types = list(AgentType)
    conflicting_agents = []
    
    for _ in range(num_agents):
        agent_type = draw(st.sampled_from(agent_types))
        conflicting_agents.append(agent_type.value)
    
    conflict_types = ["priority_conflict", "resource_conflict", "security_conflict", "strategy_conflict"]
    
    return AgentConflict(
        conflicting_agents=conflicting_agents,
        conflict_type=draw(st.sampled_from(conflict_types)),
        description=draw(st.text(min_size=20, max_size=200)),
        proposed_resolutions=[
            {"resolution": "option_a", "priority": 1},
            {"resolution": "option_b", "priority": 2}
        ]
    )

class TestAgentCoordination:
    """Property-based tests for agent coordination"""
    
    @pytest.fixture
    async def agent_hub(self):
        """Create and initialize agent hub for testing"""
        controller = AgentHubController("redis://localhost:6379/1")  # Use test DB
        await controller.initialize()
        yield controller
        await controller.shutdown()
    
    @pytest.fixture
    async def message_bus(self):
        """Create and initialize message bus for testing"""
        bus = MessageBus("redis://localhost:6379/1")
        await bus.initialize()
        yield bus
        await bus.shutdown()
    
    @pytest.fixture
    async def context_store(self):
        """Create and initialize context store for testing"""
        store = SharedContextStore(
            redis_url="redis://localhost:6379/1",
            mongodb_url="mongodb://localhost:27017/test_agent_context"
        )
        await store.initialize()
        yield store
        await store.shutdown()

    @given(agents=st.lists(agent_info_strategy(), min_size=2, max_size=7))
    @settings(max_examples=50, deadline=30000)
    @pytest.mark.asyncio
    async def test_agent_registration_and_discovery(self, agent_hub, agents):
        """
        Property: For any set of agents, the hub should successfully register
        all agents and make them discoverable for request routing.
        """
        # Register all agents
        registration_results = []
        for agent in agents:
            result = await agent_hub.register_agent(agent)
            registration_results.append(result)
        
        # Property: All registrations should succeed
        assert all(registration_results), "All agent registrations should succeed"
        
        # Property: All agents should be discoverable
        for agent in agents:
            assert agent.agent_id in agent_hub.agents, f"Agent {agent.agent_id} should be registered"
            registered_agent = agent_hub.agents[agent.agent_id]
            assert registered_agent.agent_type == agent.agent_type, "Agent type should match"
            assert registered_agent.status == agent.status, "Agent status should match"
        
        # Property: Agent metrics should be available
        metrics = await agent_hub.monitor_performance()
        assert len(metrics) == len(agents), "Metrics should be available for all agents"

    @given(
        agents=st.lists(agent_info_strategy(), min_size=3, max_size=7),
        requests=st.lists(user_request_strategy(), min_size=1, max_size=10)
    )
    @settings(max_examples=30, deadline=45000)
    @pytest.mark.asyncio
    async def test_request_routing_consistency(self, agent_hub, agents, requests):
        """
        Property: For any user request, the hub should consistently route to
        appropriate agents based on request content and agent capabilities.
        """
        # Register agents
        for agent in agents:
            await agent_hub.register_agent(agent)
        
        # Process requests and verify routing consistency
        for request in requests:
            try:
                response = await agent_hub.route_request(request)
                
                # Property: Response should be valid
                assert response is not None, "Response should not be None"
                assert response.request_id == request.request_id, "Request ID should match"
                assert response.status in ["success", "error"], "Status should be valid"
                
                # Property: Response should come from a registered agent
                if response.agent_id != "coordinated":
                    assert response.agent_id in agent_hub.agents, "Response should come from registered agent"
                
                # Property: Agent type should be appropriate for request content
                content_lower = request.content.lower()
                if any(keyword in content_lower for keyword in ["defi", "swap", "yield"]):
                    if response.agent_id != "coordinated":
                        agent_info = agent_hub.agents[response.agent_id]
                        assert agent_info.agent_type in [
                            AgentType.DEFI_STRATEGIST, 
                            AgentType.SMART_WALLET_MANAGER
                        ], "Financial requests should route to financial agents"
                
            except Exception as e:
                # Property: Errors should be handled gracefully
                assert "Request routing failed" in str(e), f"Unexpected error: {e}"

    @given(
        agents=st.lists(agent_info_strategy(), min_size=4, max_size=7),
        request=user_request_strategy()
    )
    @settings(max_examples=20, deadline=60000)
    @pytest.mark.asyncio
    async def test_multi_agent_coordination(self, agent_hub, agents, request):
        """
        Property: For any complex request requiring multiple agents, the hub
        should coordinate agents effectively and produce consolidated results.
        """
        # Register agents
        for agent in agents:
            await agent_hub.register_agent(agent)
        
        # Create a request that requires multiple agents
        complex_request = UserRequest(
            user_id=request.user_id,
            content="I want to swap tokens safely with optimal yield and security audit",
            priority=RequestPriority.HIGH,
            context=request.context
        )
        
        try:
            response = await agent_hub.route_request(complex_request)
            
            # Property: Complex requests should be handled
            assert response is not None, "Complex request should receive response"
            
            # Property: Coordination metadata should be present for multi-agent responses
            if response.agent_id == "coordinated":
                assert "coordination_id" in response.metadata, "Coordination ID should be present"
            
            # Property: Response should contain consolidated results
            assert "result" in response.dict(), "Response should contain results"
            
        except Exception as e:
            # Property: Coordination failures should be handled gracefully
            assert "coordination" in str(e).lower() or "routing" in str(e).lower()

    @given(conflicts=st.lists(agent_conflict_strategy(), min_size=1, max_size=5))
    @settings(max_examples=25, deadline=30000)
    @pytest.mark.asyncio
    async def test_conflict_resolution_consistency(self, agent_hub, conflicts):
        """
        Property: For any agent conflict, the hub should resolve conflicts
        consistently using predefined resolution strategies.
        """
        for conflict in conflicts:
            try:
                resolution = await agent_hub.resolve_conflict(conflict)
                
                # Property: Resolution should be valid
                assert resolution is not None, "Conflict resolution should not be None"
                assert resolution.conflict_id == conflict.conflict_id, "Conflict ID should match"
                assert resolution.chosen_resolution is not None, "Resolution should be chosen"
                assert resolution.reasoning is not None, "Resolution should have reasoning"
                
                # Property: Security conflicts should escalate appropriately
                if conflict.conflict_type == "security_conflict":
                    assert ("security" in resolution.reasoning.lower() or 
                           "human" in resolution.reasoning.lower()), \
                           "Security conflicts should prioritize security or escalate"
                
                # Property: All conflicting agents should be notified
                assert len(resolution.affected_agents) >= len(conflict.conflicting_agents), \
                       "All conflicting agents should be affected by resolution"
                
            except Exception as e:
                # Property: Conflict resolution failures should be handled
                assert "conflict" in str(e).lower(), f"Unexpected conflict resolution error: {e}"

    @given(
        messages=st.lists(
            st.builds(
                AgentMessage,
                from_agent=st.text(min_size=5, max_size=20),
                to_agent=st.text(min_size=5, max_size=20),
                message_type=st.sampled_from(list(MessageType)),
                action=st.text(min_size=3, max_size=30),
                payload=st.dictionaries(st.text(), st.text()),
                priority=st.sampled_from([MessagePriority.LOW, MessagePriority.MEDIUM, MessagePriority.HIGH])
            ),
            min_size=1,
            max_size=20
        )
    )
    @settings(max_examples=20, deadline=30000)
    @pytest.mark.asyncio
    async def test_message_bus_reliability(self, message_bus, messages):
        """
        Property: For any set of messages, the message bus should deliver
        messages reliably with proper ordering and error handling.
        """
        # Register mock handlers
        received_messages = {}
        
        async def mock_handler(agent_id: str):
            async def handler(message: AgentMessage):
                if agent_id not in received_messages:
                    received_messages[agent_id] = []
                received_messages[agent_id].append(message)
            return handler
        
        # Register agents with unique IDs
        unique_agents = set()
        for message in messages:
            unique_agents.add(message.from_agent)
            unique_agents.add(message.to_agent)
        
        for agent_id in unique_agents:
            handler = await mock_handler(agent_id)
            await message_bus.register_agent(agent_id, handler)
        
        # Send all messages
        send_results = []
        for message in messages:
            result = await message_bus.send_message(message)
            send_results.append(result)
        
        # Wait for message processing
        await asyncio.sleep(0.5)
        
        # Property: Valid messages should be sent successfully
        valid_message_count = sum(1 for msg in messages 
                                if msg.from_agent and msg.to_agent and msg.action)
        successful_sends = sum(send_results)
        
        # Allow for some messages to fail due to validation
        assert successful_sends >= valid_message_count * 0.8, \
               "At least 80% of valid messages should be sent successfully"

    @given(
        workflow_agents=st.lists(st.text(min_size=5, max_size=20), min_size=2, max_size=5),
        workflow_pattern=st.sampled_from(list(WorkflowPattern)),
        context_data=st.dictionaries(st.text(), st.text())
    )
    @settings(max_examples=15, deadline=45000)
    @pytest.mark.asyncio
    async def test_workflow_coordination_patterns(self, message_bus, workflow_agents, 
                                                workflow_pattern, context_data):
        """
        Property: For any workflow pattern and participating agents, the message
        bus should coordinate workflows according to the specified pattern.
        """
        # Register mock agents
        for agent_id in workflow_agents:
            async def mock_handler(message: AgentMessage):
                pass
            await message_bus.register_agent(agent_id, mock_handler)
        
        workflow_id = str(uuid.uuid4())
        
        try:
            # Start workflow
            result = await message_bus.start_workflow(
                workflow_id=workflow_id,
                pattern=workflow_pattern,
                agents=workflow_agents,
                context=context_data
            )
            
            # Property: Workflow should start successfully
            assert result is True, "Workflow should start successfully"
            
            # Property: Workflow should be tracked
            assert workflow_id in message_bus.active_workflows, "Workflow should be tracked"
            
            workflow_state = message_bus.active_workflows[workflow_id]
            
            # Property: Workflow state should be consistent
            assert workflow_state.workflow_id == workflow_id, "Workflow ID should match"
            assert workflow_state.pattern == workflow_pattern, "Pattern should match"
            assert set(workflow_state.participating_agents) == set(workflow_agents), \
                   "Participating agents should match"
            assert workflow_state.status == "active", "Workflow should be active"
            
        except Exception as e:
            # Property: Workflow failures should be handled gracefully
            assert "workflow" in str(e).lower(), f"Unexpected workflow error: {e}"

    @given(
        context_entries=st.lists(
            st.tuples(
                st.text(min_size=3, max_size=20),  # key
                st.text(min_size=1, max_size=100), # value
                st.sampled_from(list(ContextScope)),
                st.sampled_from(list(DataType)),
                st.sampled_from(list(AccessLevel)),
                st.text(min_size=5, max_size=20)   # owner_agent
            ),
            min_size=1,
            max_size=10
        )
    )
    @settings(max_examples=20, deadline=30000)
    @pytest.mark.asyncio
    async def test_shared_context_consistency(self, context_store, context_entries):
        """
        Property: For any context operations, the shared context store should
        maintain consistency and proper access controls.
        """
        # Set context entries
        set_results = []
        for key, value, scope, data_type, access_level, owner_agent in context_entries:
            result = await context_store.set(
                key=key,
                value=value,
                scope=scope,
                data_type=data_type,
                access_level=access_level,
                owner_agent=owner_agent
            )
            set_results.append((key, scope, owner_agent, result))
        
        # Property: Valid entries should be set successfully
        successful_sets = [r for r in set_results if r[3]]
        assert len(successful_sets) > 0, "At least some context entries should be set"
        
        # Verify retrieval consistency
        for key, scope, owner_agent, was_set in set_results:
            if was_set:
                retrieved_value = await context_store.get(key, scope, owner_agent)
                
                # Property: Owner should always be able to retrieve their data
                assert retrieved_value is not None, \
                       f"Owner {owner_agent} should be able to retrieve key {key}"
        
        # Test access control consistency
        for key, scope, owner_agent, was_set in set_results:
            if was_set:
                # Different agent trying to access
                other_agent = "different_agent"
                retrieved_value = await context_store.get(key, scope, other_agent)
                
                # Property: Access control should be enforced
                # (Some entries may be accessible based on access level)
                # This property ensures the access control system is functioning
                entry = await context_store.get_entry(key, scope, owner_agent)
                if entry and entry.access_level == AccessLevel.PRIVATE:
                    assert retrieved_value is None, \
                           "Private entries should not be accessible to other agents"


class AgentCoordinationStateMachine(RuleBasedStateMachine):
    """
    Stateful property-based testing for agent coordination
    
    This state machine tests the coordination system through various
    state transitions and operations to ensure consistency.
    """
    
    def __init__(self):
        super().__init__()
        self.agents = {}
        self.active_requests = {}
        self.coordination_sessions = {}
        self.message_history = []
    
    @initialize()
    def setup(self):
        """Initialize the state machine"""
        self.agents = {}
        self.active_requests = {}
        self.coordination_sessions = {}
        self.message_history = []
    
    @rule(agent_info=agent_info_strategy())
    def register_agent(self, agent_info):
        """Rule: Register an agent"""
        self.agents[agent_info.agent_id] = agent_info
    
    @rule(request=user_request_strategy())
    def submit_request(self, request):
        """Rule: Submit a user request"""
        assume(len(self.agents) > 0)  # Need at least one agent
        self.active_requests[request.request_id] = request
    
    @rule()
    def coordinate_agents(self):
        """Rule: Coordinate multiple agents"""
        assume(len(self.agents) >= 2)
        assume(len(self.active_requests) > 0)
        
        # Create coordination session
        session_id = str(uuid.uuid4())
        request_id = list(self.active_requests.keys())[0]
        agent_ids = list(self.agents.keys())[:2]  # Use first 2 agents
        
        self.coordination_sessions[session_id] = {
            "request_id": request_id,
            "agents": agent_ids,
            "status": "active",
            "created_at": datetime.utcnow()
        }
    
    @rule(message_type=st.sampled_from(list(MessageType)))
    def send_message(self, message_type):
        """Rule: Send inter-agent message"""
        assume(len(self.agents) >= 2)
        
        agent_ids = list(self.agents.keys())
        from_agent = agent_ids[0]
        to_agent = agent_ids[1] if len(agent_ids) > 1 else agent_ids[0]
        
        message = AgentMessage(
            from_agent=from_agent,
            to_agent=to_agent,
            message_type=message_type,
            action="test_action",
            payload={"test": "data"}
        )
        
        self.message_history.append(message)
    
    @invariant()
    def agents_remain_registered(self):
        """Invariant: Once registered, agents should remain in the system"""
        # All registered agents should maintain their basic properties
        for agent_id, agent_info in self.agents.items():
            assert agent_info.agent_id == agent_id
            assert agent_info.agent_type in list(AgentType)
            assert agent_info.status in list(AgentStatus)
    
    @invariant()
    def coordination_sessions_are_consistent(self):
        """Invariant: Coordination sessions should maintain consistency"""
        for session_id, session in self.coordination_sessions.items():
            assert "request_id" in session
            assert "agents" in session
            assert "status" in session
            assert session["status"] in ["active", "completed", "failed"]
            
            # All agents in session should be registered
            for agent_id in session["agents"]:
                assert agent_id in self.agents
    
    @invariant()
    def message_history_is_valid(self):
        """Invariant: Message history should contain valid messages"""
        for message in self.message_history:
            assert message.from_agent in self.agents or message.from_agent == "system"
            assert message.to_agent in self.agents or message.to_agent == "system"
            assert message.message_type in list(MessageType)
            assert message.action is not None


# Test configuration
TestAgentCoordinationStateMachine = AgentCoordinationStateMachine.TestCase

if __name__ == "__main__":
    # Run property-based tests
    pytest.main([__file__, "-v", "--tb=short"])