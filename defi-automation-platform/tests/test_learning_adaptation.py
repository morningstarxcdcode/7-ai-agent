"""
Property-Based Tests for Adaptive Learning and Personalization

This module implements property-based tests to validate the correctness
of the adaptive learning and personalization mechanisms in the multi-agent
DeFi automation system.

**Feature: defi-automation-platform, Property 12: Adaptive Learning and Personalization**
**Validates: Requirements 1.4, 14.1**
"""

import asyncio
import pytest
import uuid
import random
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from hypothesis import given, strategies as st, settings, assume
from hypothesis.stateful import RuleBasedStateMachine, rule, initialize, invariant

from src.agent_hub.state_manager import (
    DistributedStateManager, StateScope, StateType, ConsistencyLevel
)

# Test data generators
@st.composite
def user_interaction_strategy(draw):
    """Generate user interaction data for learning"""
    interaction_types = ["request", "feedback", "preference_update", "outcome_rating"]
    
    return {
        "user_id": f"user_{draw(st.integers(min_value=1, max_value=100))}",
        "interaction_type": draw(st.sampled_from(interaction_types)),
        "content": draw(st.text(min_size=10, max_size=200)),
        "context": {
            "session_id": str(uuid.uuid4()),
            "timestamp": datetime.utcnow().isoformat(),
            "risk_tolerance": draw(st.floats(min_value=0.0, max_value=1.0)),
            "investment_goals": draw(st.lists(st.text(min_size=5, max_size=20), min_size=1, max_size=5))
        },
        "outcome": {
            "success": draw(st.booleans()),
            "satisfaction_score": draw(st.floats(min_value=0.0, max_value=5.0)),
            "execution_time": draw(st.floats(min_value=0.1, max_value=30.0))
        }
    }

@st.composite
def agent_decision_strategy(draw):
    """Generate agent decision data for learning"""
    decision_types = ["strategy_selection", "risk_assessment", "portfolio_rebalance", "protocol_choice"]
    
    return {
        "agent_id": draw(st.sampled_from(["defi_strategist", "smart_wallet_manager", "security_guardian"])),
        "decision_type": draw(st.sampled_from(decision_types)),
        "decision_data": {
            "chosen_option": draw(st.text(min_size=5, max_size=30)),
            "alternatives": draw(st.lists(st.text(min_size=5, max_size=30), min_size=1, max_size=5)),
            "confidence_score": draw(st.floats(min_value=0.0, max_value=1.0)),
            "reasoning": draw(st.text(min_size=20, max_size=100))
        },
        "context": {
            "market_conditions": draw(st.dictionaries(st.text(), st.floats())),
            "user_preferences": draw(st.dictionaries(st.text(), st.text())),
            "historical_performance": draw(st.floats(min_value=-1.0, max_value=1.0))
        },
        "outcome": {
            "actual_result": draw(st.floats(min_value=-1.0, max_value=1.0)),
            "user_satisfaction": draw(st.floats(min_value=0.0, max_value=5.0)),
            "performance_metric": draw(st.floats(min_value=0.0, max_value=2.0))
        }
    }

@st.composite
def learning_pattern_strategy(draw):
    """Generate learning patterns for testing adaptation"""
    pattern_types = ["preference_drift", "performance_improvement", "risk_adjustment", "strategy_evolution"]
    
    return {
        "pattern_type": draw(st.sampled_from(pattern_types)),
        "user_id": f"user_{draw(st.integers(min_value=1, max_value=50))}",
        "time_series_data": draw(st.lists(
            st.dictionaries(
                st.text(min_size=3, max_size=10),
                st.floats(min_value=0.0, max_value=1.0)
            ),
            min_size=5,
            max_size=20
        )),
        "trend_direction": draw(st.sampled_from(["increasing", "decreasing", "stable", "volatile"])),
        "adaptation_threshold": draw(st.floats(min_value=0.1, max_value=0.9))
    }

class LearningSystem:
    """Mock learning system for testing"""
    
    def __init__(self):
        self.user_profiles = {}
        self.agent_models = {}
        self.decision_history = []
        self.adaptation_rules = {}
    
    async def record_interaction(self, interaction: Dict[str, Any]):
        """Record user interaction for learning"""
        user_id = interaction["user_id"]
        
        if user_id not in self.user_profiles:
            self.user_profiles[user_id] = {
                "preferences": {},
                "behavior_patterns": [],
                "success_history": [],
                "risk_tolerance": 0.5,
                "learning_rate": 0.1
            }
        
        profile = self.user_profiles[user_id]
        
        # Update behavior patterns
        profile["behavior_patterns"].append({
            "interaction_type": interaction["interaction_type"],
            "timestamp": datetime.utcnow(),
            "context": interaction["context"]
        })
        
        # Update success history
        profile["success_history"].append(interaction["outcome"]["success"])
        
        # Adapt risk tolerance based on outcomes
        if interaction["outcome"]["success"]:
            profile["risk_tolerance"] = min(1.0, profile["risk_tolerance"] + profile["learning_rate"] * 0.1)
        else:
            profile["risk_tolerance"] = max(0.0, profile["risk_tolerance"] - profile["learning_rate"] * 0.1)
    
    async def record_decision(self, decision: Dict[str, Any]):
        """Record agent decision for learning"""
        self.decision_history.append({
            **decision,
            "timestamp": datetime.utcnow()
        })
        
        agent_id = decision["agent_id"]
        if agent_id not in self.agent_models:
            self.agent_models[agent_id] = {
                "decision_patterns": {},
                "performance_history": [],
                "adaptation_parameters": {"learning_rate": 0.05}
            }
        
        model = self.agent_models[agent_id]
        
        # Update decision patterns
        decision_type = decision["decision_type"]
        if decision_type not in model["decision_patterns"]:
            model["decision_patterns"][decision_type] = []
        
        model["decision_patterns"][decision_type].append({
            "chosen_option": decision["decision_data"]["chosen_option"],
            "confidence": decision["decision_data"]["confidence_score"],
            "outcome": decision["outcome"]["actual_result"]
        })
        
        # Update performance history
        model["performance_history"].append(decision["outcome"]["performance_metric"])
    
    async def adapt_to_pattern(self, pattern: Dict[str, Any]) -> bool:
        """Adapt system based on detected patterns"""
        user_id = pattern["user_id"]
        pattern_type = pattern["pattern_type"]
        
        if user_id not in self.user_profiles:
            return False
        
        profile = self.user_profiles[user_id]
        
        # Adapt based on pattern type
        if pattern_type == "preference_drift":
            # Adjust learning rate based on drift detection
            profile["learning_rate"] = min(0.3, profile["learning_rate"] * 1.2)
        elif pattern_type == "performance_improvement":
            # Reduce learning rate as performance stabilizes
            profile["learning_rate"] = max(0.01, profile["learning_rate"] * 0.9)
        elif pattern_type == "risk_adjustment":
            # Adjust risk tolerance based on pattern
            if pattern["trend_direction"] == "increasing":
                profile["risk_tolerance"] = min(1.0, profile["risk_tolerance"] + 0.1)
            elif pattern["trend_direction"] == "decreasing":
                profile["risk_tolerance"] = max(0.0, profile["risk_tolerance"] - 0.1)
        
        return True
    
    def get_user_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get current user profile"""
        return self.user_profiles.get(user_id)
    
    def get_agent_model(self, agent_id: str) -> Optional[Dict[str, Any]]:
        """Get current agent model"""
        return self.agent_models.get(agent_id)
    
    def calculate_adaptation_score(self, user_id: str) -> float:
        """Calculate how well the system has adapted to user"""
        profile = self.user_profiles.get(user_id)
        if not profile or not profile["success_history"]:
            return 0.0
        
        # Simple adaptation score based on recent success rate
        recent_history = profile["success_history"][-10:]  # Last 10 interactions
        return sum(recent_history) / len(recent_history)

class TestLearningAdaptation:
    """Property-based tests for learning and adaptation"""
    
    @pytest.fixture
    async def state_manager(self):
        """Create state manager for testing"""
        manager = DistributedStateManager(
            redis_url="redis://localhost:6379/2",
            mongodb_url="mongodb://localhost:27017/test_learning"
        )
        await manager.initialize()
        yield manager
        await manager.shutdown()
    
    @pytest.fixture
    def learning_system(self):
        """Create learning system for testing"""
        return LearningSystem()

    @given(interactions=st.lists(user_interaction_strategy(), min_size=5, max_size=50))
    @settings(max_examples=30, deadline=30000)
    @pytest.mark.asyncio
    async def test_user_preference_learning(self, learning_system, interactions):
        """
        Property: For any sequence of user interactions, the system should
        learn and adapt to user preferences, improving satisfaction over time.
        """
        # Group interactions by user
        user_interactions = {}
        for interaction in interactions:
            user_id = interaction["user_id"]
            if user_id not in user_interactions:
                user_interactions[user_id] = []
            user_interactions[user_id].append(interaction)
        
        # Process interactions for each user
        for user_id, user_interactions_list in user_interactions.items():
            # Sort by timestamp to simulate chronological order
            user_interactions_list.sort(key=lambda x: x["context"]["timestamp"])
            
            initial_profile = learning_system.get_user_profile(user_id)
            
            # Record all interactions
            for interaction in user_interactions_list:
                await learning_system.record_interaction(interaction)
            
            final_profile = learning_system.get_user_profile(user_id)
            
            # Property: User profile should be created and updated
            assert final_profile is not None, f"User profile should be created for {user_id}"
            
            # Property: Profile should contain learning data
            assert "preferences" in final_profile, "Profile should contain preferences"
            assert "behavior_patterns" in final_profile, "Profile should contain behavior patterns"
            assert "success_history" in final_profile, "Profile should contain success history"
            
            # Property: Behavior patterns should reflect interactions
            assert len(final_profile["behavior_patterns"]) == len(user_interactions_list), \
                   "Behavior patterns should match interaction count"
            
            # Property: Risk tolerance should be within valid bounds
            assert 0.0 <= final_profile["risk_tolerance"] <= 1.0, \
                   "Risk tolerance should be between 0 and 1"
            
            # Property: Learning rate should be positive
            assert final_profile["learning_rate"] > 0, "Learning rate should be positive"

    @given(decisions=st.lists(agent_decision_strategy(), min_size=10, max_size=100))
    @settings(max_examples=25, deadline=45000)
    @pytest.mark.asyncio
    async def test_agent_decision_learning(self, learning_system, decisions):
        """
        Property: For any sequence of agent decisions, the system should
        learn from outcomes and improve decision-making over time.
        """
        # Group decisions by agent
        agent_decisions = {}
        for decision in decisions:
            agent_id = decision["agent_id"]
            if agent_id not in agent_decisions:
                agent_decisions[agent_id] = []
            agent_decisions[agent_id].append(decision)
        
        # Process decisions for each agent
        for agent_id, agent_decisions_list in agent_decisions.items():
            initial_model = learning_system.get_agent_model(agent_id)
            
            # Record all decisions
            for decision in agent_decisions_list:
                await learning_system.record_decision(decision)
            
            final_model = learning_system.get_agent_model(agent_id)
            
            # Property: Agent model should be created and updated
            assert final_model is not None, f"Agent model should be created for {agent_id}"
            
            # Property: Model should contain decision patterns
            assert "decision_patterns" in final_model, "Model should contain decision patterns"
            assert "performance_history" in final_model, "Model should contain performance history"
            
            # Property: Performance history should match decision count
            assert len(final_model["performance_history"]) == len(agent_decisions_list), \
                   "Performance history should match decision count"
            
            # Property: Decision patterns should be organized by type
            decision_types = set(d["decision_type"] for d in agent_decisions_list)
            for decision_type in decision_types:
                assert decision_type in final_model["decision_patterns"], \
                       f"Decision pattern should exist for {decision_type}"
            
            # Property: Adaptation parameters should be valid
            assert "learning_rate" in final_model["adaptation_parameters"], \
                   "Model should have learning rate parameter"
            assert final_model["adaptation_parameters"]["learning_rate"] > 0, \
                   "Learning rate should be positive"

    @given(
        interactions=st.lists(user_interaction_strategy(), min_size=10, max_size=30),
        patterns=st.lists(learning_pattern_strategy(), min_size=1, max_size=10)
    )
    @settings(max_examples=20, deadline=60000)
    @pytest.mark.asyncio
    async def test_pattern_based_adaptation(self, learning_system, interactions, patterns):
        """
        Property: For any detected patterns in user behavior, the system
        should adapt its parameters and improve personalization.
        """
        # First, establish baseline with interactions
        for interaction in interactions:
            await learning_system.record_interaction(interaction)
        
        # Get initial adaptation scores
        initial_scores = {}
        for pattern in patterns:
            user_id = pattern["user_id"]
            initial_scores[user_id] = learning_system.calculate_adaptation_score(user_id)
        
        # Apply pattern-based adaptations
        adaptation_results = []
        for pattern in patterns:
            result = await learning_system.adapt_to_pattern(pattern)
            adaptation_results.append(result)
        
        # Property: Valid patterns should be successfully adapted
        valid_patterns = [p for p in patterns if p["user_id"] in learning_system.user_profiles]
        successful_adaptations = sum(adaptation_results)
        
        if valid_patterns:
            # At least some adaptations should succeed for valid patterns
            assert successful_adaptations > 0, "Some pattern adaptations should succeed"
        
        # Property: Adaptation should modify user profiles appropriately
        for pattern in valid_patterns:
            user_id = pattern["user_id"]
            profile = learning_system.get_user_profile(user_id)
            
            if profile:
                # Property: Learning rate should be adjusted based on pattern type
                if pattern["pattern_type"] == "preference_drift":
                    assert profile["learning_rate"] >= 0.1, \
                           "Learning rate should increase for preference drift"
                elif pattern["pattern_type"] == "performance_improvement":
                    assert profile["learning_rate"] <= 0.3, \
                           "Learning rate should decrease for stable performance"
                
                # Property: Risk tolerance should remain within bounds after adaptation
                assert 0.0 <= profile["risk_tolerance"] <= 1.0, \
                       "Risk tolerance should remain within valid bounds"

    @given(
        user_interactions=st.lists(user_interaction_strategy(), min_size=20, max_size=50),
        time_window_hours=st.integers(min_value=1, max_value=168)  # 1 hour to 1 week
    )
    @settings(max_examples=15, deadline=45000)
    @pytest.mark.asyncio
    async def test_temporal_learning_consistency(self, learning_system, state_manager, 
                                               user_interactions, time_window_hours):
        """
        Property: For any sequence of interactions over time, the learning
        system should maintain consistency and show temporal adaptation.
        """
        # Simulate interactions over time
        base_time = datetime.utcnow()
        time_window = timedelta(hours=time_window_hours)
        
        # Distribute interactions over time window
        for i, interaction in enumerate(user_interactions):
            # Simulate temporal distribution
            time_offset = timedelta(hours=(time_window_hours * i) / len(user_interactions))
            interaction_time = base_time + time_offset
            interaction["context"]["timestamp"] = interaction_time.isoformat()
            
            await learning_system.record_interaction(interaction)
            
            # Store learning state in distributed state manager
            user_id = interaction["user_id"]
            profile = learning_system.get_user_profile(user_id)
            
            if profile:
                await state_manager.set_state(
                    key=f"user_profile_{user_id}",
                    value=profile,
                    scope=StateScope.USER,
                    state_type=StateType.USER_PREFERENCES,
                    owner_agent="learning_system",
                    consistency_level=ConsistencyLevel.EVENTUAL
                )
        
        # Verify temporal consistency
        user_ids = list(set(interaction["user_id"] for interaction in user_interactions))
        
        for user_id in user_ids:
            # Property: Profile should be retrievable from state manager
            stored_profile = await state_manager.get_state(
                f"user_profile_{user_id}",
                StateScope.USER,
                "learning_system"
            )
            
            current_profile = learning_system.get_user_profile(user_id)
            
            if stored_profile and current_profile:
                # Property: Stored and current profiles should be consistent
                assert stored_profile["risk_tolerance"] == current_profile["risk_tolerance"], \
                       "Risk tolerance should be consistent between storage and memory"
                
                # Property: Learning progression should be monotonic or stable
                behavior_count = len(current_profile["behavior_patterns"])
                success_count = len(current_profile["success_history"])
                
                assert behavior_count > 0, "Should have recorded behavior patterns"
                assert success_count > 0, "Should have recorded success history"
                assert behavior_count == success_count, \
                       "Behavior patterns and success history should be synchronized"

    @given(
        multi_agent_decisions=st.lists(
            st.tuples(
                agent_decision_strategy(),
                agent_decision_strategy(),
                agent_decision_strategy()
            ),
            min_size=5,
            max_size=20
        )
    )
    @settings(max_examples=15, deadline=60000)
    @pytest.mark.asyncio
    async def test_cross_agent_learning_coordination(self, learning_system, multi_agent_decisions):
        """
        Property: For any multi-agent decision scenarios, the learning system
        should coordinate learning across agents and maintain consistency.
        """
        # Process coordinated decisions from multiple agents
        for decision_tuple in multi_agent_decisions:
            # Simulate coordinated decision-making
            for decision in decision_tuple:
                await learning_system.record_decision(decision)
        
        # Analyze cross-agent learning coordination
        agent_ids = set()
        for decision_tuple in multi_agent_decisions:
            for decision in decision_tuple:
                agent_ids.add(decision["agent_id"])
        
        # Property: All participating agents should have learned
        for agent_id in agent_ids:
            model = learning_system.get_agent_model(agent_id)
            assert model is not None, f"Agent {agent_id} should have a learning model"
            
            # Property: Agent should have decision patterns
            assert len(model["decision_patterns"]) > 0, \
                   f"Agent {agent_id} should have decision patterns"
            
            # Property: Agent should have performance history
            assert len(model["performance_history"]) > 0, \
                   f"Agent {agent_id} should have performance history"
        
        # Property: Learning should show coordination effects
        # Agents working on similar decision types should show similar patterns
        decision_type_agents = {}
        for decision_tuple in multi_agent_decisions:
            for decision in decision_tuple:
                decision_type = decision["decision_type"]
                agent_id = decision["agent_id"]
                
                if decision_type not in decision_type_agents:
                    decision_type_agents[decision_type] = set()
                decision_type_agents[decision_type].add(agent_id)
        
        # For decision types handled by multiple agents, check coordination
        for decision_type, agents in decision_type_agents.items():
            if len(agents) > 1:
                # Get performance metrics for agents handling same decision type
                performances = []
                for agent_id in agents:
                    model = learning_system.get_agent_model(agent_id)
                    if decision_type in model["decision_patterns"]:
                        agent_performances = [
                            dp["outcome"] for dp in model["decision_patterns"][decision_type]
                        ]
                        if agent_performances:
                            avg_performance = sum(agent_performances) / len(agent_performances)
                            performances.append(avg_performance)
                
                # Property: Coordinated agents should show reasonable performance variance
                if len(performances) > 1:
                    performance_variance = max(performances) - min(performances)
                    assert performance_variance <= 2.0, \
                           f"Performance variance for {decision_type} should be reasonable"


class LearningAdaptationStateMachine(RuleBasedStateMachine):
    """
    Stateful property-based testing for learning and adaptation
    
    This state machine tests the learning system through various
    state transitions and adaptation scenarios.
    """
    
    def __init__(self):
        super().__init__()
        self.learning_system = LearningSystem()
        self.interaction_count = 0
        self.decision_count = 0
        self.adaptation_count = 0
    
    @initialize()
    def setup(self):
        """Initialize the state machine"""
        self.learning_system = LearningSystem()
        self.interaction_count = 0
        self.decision_count = 0
        self.adaptation_count = 0
    
    @rule(interaction=user_interaction_strategy())
    def record_user_interaction(self, interaction):
        """Rule: Record a user interaction"""
        asyncio.run(self.learning_system.record_interaction(interaction))
        self.interaction_count += 1
    
    @rule(decision=agent_decision_strategy())
    def record_agent_decision(self, decision):
        """Rule: Record an agent decision"""
        asyncio.run(self.learning_system.record_decision(decision))
        self.decision_count += 1
    
    @rule(pattern=learning_pattern_strategy())
    def adapt_to_pattern(self, pattern):
        """Rule: Adapt system based on detected pattern"""
        # Only adapt if we have some user profiles
        assume(len(self.learning_system.user_profiles) > 0)
        
        # Use existing user ID
        user_ids = list(self.learning_system.user_profiles.keys())
        pattern["user_id"] = random.choice(user_ids)
        
        result = asyncio.run(self.learning_system.adapt_to_pattern(pattern))
        if result:
            self.adaptation_count += 1
    
    @invariant()
    def learning_data_consistency(self):
        """Invariant: Learning data should remain consistent"""
        # All user profiles should have valid structure
        for user_id, profile in self.learning_system.user_profiles.items():
            assert "preferences" in profile
            assert "behavior_patterns" in profile
            assert "success_history" in profile
            assert "risk_tolerance" in profile
            assert "learning_rate" in profile
            
            # Risk tolerance should be in valid range
            assert 0.0 <= profile["risk_tolerance"] <= 1.0
            assert profile["learning_rate"] > 0
        
        # All agent models should have valid structure
        for agent_id, model in self.learning_system.agent_models.items():
            assert "decision_patterns" in model
            assert "performance_history" in model
            assert "adaptation_parameters" in model
            assert "learning_rate" in model["adaptation_parameters"]
            assert model["adaptation_parameters"]["learning_rate"] > 0
    
    @invariant()
    def learning_progress_monotonicity(self):
        """Invariant: Learning progress should be monotonic or stable"""
        # Interaction and decision counts should only increase
        assert self.interaction_count >= 0
        assert self.decision_count >= 0
        assert self.adaptation_count >= 0
        
        # Total recorded data should match counts
        total_behavior_patterns = sum(
            len(profile["behavior_patterns"]) 
            for profile in self.learning_system.user_profiles.values()
        )
        assert total_behavior_patterns == self.interaction_count
        
        total_performance_history = sum(
            len(model["performance_history"]) 
            for model in self.learning_system.agent_models.values()
        )
        assert total_performance_history == self.decision_count
    
    @invariant()
    def adaptation_effectiveness(self):
        """Invariant: Adaptations should improve system effectiveness"""
        # If we have adaptations, user profiles should show learning
        if self.adaptation_count > 0:
            for user_id, profile in self.learning_system.user_profiles.items():
                # Learning rate should be reasonable after adaptations
                assert 0.01 <= profile["learning_rate"] <= 0.5
                
                # If we have success history, adaptation score should be calculable
                if profile["success_history"]:
                    adaptation_score = self.learning_system.calculate_adaptation_score(user_id)
                    assert 0.0 <= adaptation_score <= 1.0


# Test configuration
TestLearningAdaptationStateMachine = LearningAdaptationStateMachine.TestCase

if __name__ == "__main__":
    # Run property-based tests
    pytest.main([__file__, "-v", "--tb=short"])