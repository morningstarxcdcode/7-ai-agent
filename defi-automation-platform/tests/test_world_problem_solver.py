"""
Tests for World Problem Solver Agent

Tests the global challenge identification system, problem-to-solution mapping,
and ESG protocol scoring functionality.
"""

import pytest
import sys
import os
from datetime import datetime, timedelta

# Add the src directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from agents.world_problem_solver import (
    WorldProblemSolverAgent,
    GlobalChallenge,
    ESGProtocol,
    SocialImpactInvestment,
    ImpactCategory,
    ESGRating
)


class TestWorldProblemSolverAgent:
    """Test suite for World Problem Solver Agent"""
    
    @pytest.fixture
    async def agent(self):
        """Create agent instance for testing"""
        agent = WorldProblemSolverAgent()
        async with agent:
            yield agent
    
    @pytest.fixture
    def sample_challenge(self):
        """Sample global challenge for testing"""
        return GlobalChallenge(
            challenge_id="test_climate_001",
            title="Test Climate Challenge",
            description="Test climate change challenge",
            category=ImpactCategory.CLIMATE_CHANGE,
            severity_score=85.0,
            urgency_score=90.0,
            affected_population=1_000_000_000,
            geographic_scope=["global"],
            sdg_goals=[13, 7],
            funding_gap=1_000_000_000_000,
            current_solutions=["Carbon credits", "Renewable energy"],
            blockchain_applicability=0.8
        )
    
    @pytest.fixture
    def sample_protocol(self):
        """Sample ESG protocol for testing"""
        return ESGProtocol(
            protocol_name="Test Climate Protocol",
            protocol_address="0x123",
            chain="ethereum",
            esg_rating=ESGRating.EXCELLENT,
            esg_score=90.0,
            impact_categories=[ImpactCategory.CLIMATE_CHANGE],
            environmental_score=95.0,
            social_score=85.0,
            governance_score=90.0,
            tvl=50_000_000,
            apy=0.08,
            impact_metrics={"carbon_credits": "1M tonnes"},
            verification_status="Third-party verified",
            audit_reports=["CertiK", "Quantstamp"],
            carbon_footprint=-100000.0
        )
    
    @pytest.mark.asyncio
    async def test_identify_global_challenges(self, agent):
        """Test global challenge identification"""
        # Test basic challenge identification
        challenges = await agent.identify_global_challenges()
        
        assert isinstance(challenges, list)
        assert len(challenges) > 0
        
        # Verify challenge structure
        for challenge in challenges:
            assert isinstance(challenge, GlobalChallenge)
            assert challenge.severity_score >= 50.0  # Above threshold
            assert challenge.urgency_score > 0
            assert challenge.affected_population > 0
            assert challenge.blockchain_applicability > 0
    
    @pytest.mark.asyncio
    async def test_identify_challenges_with_filters(self, agent):
        """Test challenge identification with filters"""
        # Test category filtering
        climate_challenges = await agent.identify_global_challenges(
            categories=[ImpactCategory.CLIMATE_CHANGE]
        )
        
        assert all(c.category == ImpactCategory.CLIMATE_CHANGE for c in climate_challenges)
        
        # Test geographic filtering
        regional_challenges = await agent.identify_global_challenges(
            geographic_filter=["Sub-Saharan Africa"]
        )
        
        assert len(regional_challenges) >= 0
        
        # Test severity threshold
        high_severity = await agent.identify_global_challenges(
            severity_threshold=80.0
        )
        
        assert all(c.severity_score >= 80.0 for c in high_severity)
    
    @pytest.mark.asyncio
    async def test_analyze_esg_protocols(self, agent):
        """Test ESG protocol analysis"""
        protocols = await agent.analyze_esg_protocols()
        
        assert isinstance(protocols, list)
        
        # Verify protocol structure
        for protocol in protocols:
            assert isinstance(protocol, ESGProtocol)
            assert protocol.esg_score >= agent.impact_thresholds['minimum_esg_score']
            assert protocol.environmental_score >= 0
            assert protocol.social_score >= 0
            assert protocol.governance_score >= 0
    
    @pytest.mark.asyncio
    async def test_analyze_esg_protocols_with_filters(self, agent):
        """Test ESG protocol analysis with filters"""
        # Test chain filtering
        eth_protocols = await agent.analyze_esg_protocols(chains=["ethereum"])
        
        for protocol in eth_protocols:
            assert protocol.chain == "ethereum"
        
        # Test ESG score filtering
        high_esg = await agent.analyze_esg_protocols(min_esg_score=85.0)
        
        assert all(p.esg_score >= 85.0 for p in high_esg)
        
        # Test impact category filtering
        climate_protocols = await agent.analyze_esg_protocols(
            impact_categories=[ImpactCategory.CLIMATE_CHANGE]
        )
        
        for protocol in climate_protocols:
            assert ImpactCategory.CLIMATE_CHANGE in protocol.impact_categories
    
    @pytest.mark.asyncio
    async def test_problem_to_solution_mapping(self, agent, sample_challenge, sample_protocol):
        """Test problem-to-solution mapping algorithm"""
        challenges = [sample_challenge]
        protocols = [sample_protocol]
        
        solution_mapping = await agent.map_problems_to_solutions(challenges, protocols)
        
        assert isinstance(solution_mapping, dict)
        assert sample_challenge.challenge_id in solution_mapping
        
        solutions = solution_mapping[sample_challenge.challenge_id]
        assert isinstance(solutions, list)
        assert len(solutions) > 0
        
        # Verify solution structure
        for solution in solutions:
            assert 'solution_id' in solution
            assert 'confidence' in solution
            assert 'impact_score' in solution
            assert 'implementation_complexity' in solution
            assert 'estimated_funding' in solution
            assert 'timeline_months' in solution
            assert 'key_benefits' in solution
            assert 'risk_factors' in solution
            assert 'success_metrics' in solution
            
            # Verify score ranges
            assert 0 <= solution['confidence'] <= 1
            assert 0 <= solution['impact_score'] <= 100
            assert solution['implementation_complexity'] in ['low', 'medium', 'high']
            assert solution['estimated_funding'] > 0
            assert solution['timeline_months'] > 0
    
    @pytest.mark.asyncio
    async def test_enhanced_esg_scoring_system(self, agent, sample_protocol):
        """Test enhanced ESG scoring system"""
        protocols = [sample_protocol]
        
        enhanced_scores = await agent.build_enhanced_esg_scoring_system(protocols)
        
        assert isinstance(enhanced_scores, dict)
        assert sample_protocol.protocol_name in enhanced_scores
        
        score_data = enhanced_scores[sample_protocol.protocol_name]
        
        # Verify enhanced scoring structure
        assert 'base_esg_score' in score_data
        assert 'enhanced_esg_score' in score_data
        assert 'risk_adjusted_score' in score_data
        assert 'verification_score' in score_data
        assert 'market_correlation' in score_data
        assert 'sustainability_trend' in score_data
        assert 'detailed_analysis' in score_data
        assert 'investment_recommendation' in score_data
        assert 'impact_forecast' in score_data
        
        # Verify score ranges
        assert 0 <= score_data['enhanced_esg_score'] <= 100
        assert 0 <= score_data['risk_adjusted_score'] <= 100
        assert 0 <= score_data['verification_score'] <= 100
        
        # Verify detailed analysis structure
        analysis = score_data['detailed_analysis']
        assert 'environmental_factors' in analysis
        assert 'social_factors' in analysis
        assert 'governance_factors' in analysis
        assert 'composite_score' in analysis
    
    @pytest.mark.asyncio
    async def test_generate_impact_investment_recommendations(self, agent):
        """Test social impact investment recommendation generation"""
        portfolio_value = 100_000.0
        impact_preferences = [ImpactCategory.CLIMATE_CHANGE, ImpactCategory.CLEAN_ENERGY]
        
        recommendations = await agent.generate_impact_investment_recommendations(
            portfolio_value=portfolio_value,
            impact_preferences=impact_preferences,
            risk_tolerance=0.7,
            min_impact_allocation=0.1
        )
        
        assert isinstance(recommendations, list)
        
        # Verify recommendation structure
        for rec in recommendations:
            assert isinstance(rec, SocialImpactInvestment)
            assert rec.investment_amount > 0
            assert rec.investment_amount <= portfolio_value * 0.1  # Within allocation limit
            assert rec.expected_return >= 0
            assert 0 <= rec.impact_potential <= 100
            assert 0 <= rec.risk_score <= 100
            assert rec.time_horizon > 0
            assert isinstance(rec.impact_metrics, dict)
    
    def test_calculate_solution_impact_score(self, agent, sample_challenge, sample_protocol):
        """Test solution impact score calculation"""
        impact_score = agent._calculate_solution_impact_score(sample_challenge, sample_protocol)
        
        assert isinstance(impact_score, float)
        assert 0 <= impact_score <= 100
        
        # Test with different challenge categories
        education_challenge = GlobalChallenge(
            challenge_id="edu_001",
            title="Education Challenge",
            description="Test education challenge",
            category=ImpactCategory.EDUCATION,
            severity_score=70.0,
            urgency_score=75.0,
            affected_population=100_000_000,
            geographic_scope=["Sub-Saharan Africa"],
            sdg_goals=[4],
            funding_gap=50_000_000_000,
            current_solutions=["Digital learning"],
            blockchain_applicability=0.6
        )
        
        edu_score = agent._calculate_solution_impact_score(education_challenge, sample_protocol)
        assert isinstance(edu_score, float)
        assert 0 <= edu_score <= 100
    
    def test_estimate_implementation_complexity(self, agent, sample_challenge, sample_protocol):
        """Test implementation complexity estimation"""
        complexity = agent._estimate_implementation_complexity(
            sample_challenge, sample_protocol, "direct_protocol"
        )
        
        assert complexity in ['low', 'medium', 'high']
        
        # Test different solution types
        blockchain_complexity = agent._estimate_implementation_complexity(
            sample_challenge, sample_protocol, "blockchain_native"
        )
        assert blockchain_complexity in ['low', 'medium', 'high']
        
        hybrid_complexity = agent._estimate_implementation_complexity(
            sample_challenge, sample_protocol, "hybrid_solution"
        )
        assert hybrid_complexity in ['low', 'medium', 'high']
    
    def test_estimate_funding_requirements(self, agent, sample_challenge, sample_protocol):
        """Test funding requirements estimation"""
        funding = agent._estimate_funding_requirements(sample_challenge, sample_protocol)
        
        assert isinstance(funding, float)
        assert funding >= 100_000  # Minimum funding threshold
        assert funding <= sample_challenge.funding_gap  # Not more than total gap
    
    def test_esg_assessment_methods(self, agent, sample_protocol):
        """Test individual ESG assessment methods"""
        # Test carbon impact assessment
        carbon_score = agent._assess_carbon_impact(sample_protocol)
        assert 0 <= carbon_score <= 100
        
        # Test resource efficiency assessment
        efficiency_score = agent._assess_resource_efficiency(sample_protocol)
        assert 0 <= efficiency_score <= 100
        
        # Test community impact assessment
        community_score = agent._assess_community_impact(sample_protocol)
        assert 0 <= community_score <= 100
        
        # Test transparency assessment
        transparency_score = agent._assess_transparency(sample_protocol)
        assert 0 <= transparency_score <= 100
    
    @pytest.mark.asyncio
    async def test_comprehensive_esg_analysis(self, agent, sample_protocol):
        """Test comprehensive ESG analysis"""
        analysis = await agent._comprehensive_esg_analysis(sample_protocol)
        
        assert isinstance(analysis, dict)
        assert 'environmental_factors' in analysis
        assert 'social_factors' in analysis
        assert 'governance_factors' in analysis
        assert 'composite_score' in analysis
        
        # Verify factor scores
        assert 0 <= analysis['environmental_score'] <= 100
        assert 0 <= analysis['social_score'] <= 100
        assert 0 <= analysis['governance_score'] <= 100
        assert 0 <= analysis['composite_score'] <= 100
    
    def test_find_suitable_protocols(self, agent, sample_challenge, sample_protocol):
        """Test finding suitable protocols for challenges"""
        protocols = [sample_protocol]
        suitable = agent._find_suitable_protocols(sample_challenge, protocols)
        
        assert isinstance(suitable, list)
        assert len(suitable) > 0
        assert sample_protocol in suitable
    
    def test_get_related_categories(self, agent):
        """Test getting related impact categories"""
        climate_related = agent._get_related_categories(ImpactCategory.CLIMATE_CHANGE)
        assert isinstance(climate_related, list)
        assert ImpactCategory.CLEAN_ENERGY in climate_related
        
        poverty_related = agent._get_related_categories(ImpactCategory.POVERTY_REDUCTION)
        assert isinstance(poverty_related, list)
        assert ImpactCategory.EDUCATION in poverty_related
    
    def test_calculate_investment_risk(self, agent, sample_protocol):
        """Test investment risk calculation"""
        risk_score = agent._calculate_investment_risk(sample_protocol, 10_000)
        
        assert isinstance(risk_score, float)
        assert 0 <= risk_score <= 100
        
        # Test with different investment amounts
        large_investment_risk = agent._calculate_investment_risk(sample_protocol, 1_000_000)
        assert isinstance(large_investment_risk, float)
        assert 0 <= large_investment_risk <= 100
    
    @pytest.mark.asyncio
    async def test_optimize_impact_allocation(self, agent):
        """Test impact allocation optimization"""
        # Create sample recommendations
        recommendations = [
            SocialImpactInvestment(
                investment_id="test_1",
                protocol=ESGProtocol(
                    protocol_name="Test Protocol 1",
                    protocol_address="0x1",
                    chain="ethereum",
                    esg_rating=ESGRating.EXCELLENT,
                    esg_score=90.0,
                    impact_categories=[ImpactCategory.CLIMATE_CHANGE],
                    environmental_score=90.0,
                    social_score=85.0,
                    governance_score=88.0,
                    tvl=10_000_000,
                    apy=0.08,
                    impact_metrics={},
                    verification_status="verified",
                    audit_reports=[]
                ),
                challenge=GlobalChallenge(
                    challenge_id="test_challenge",
                    title="Test Challenge",
                    description="Test",
                    category=ImpactCategory.CLIMATE_CHANGE,
                    severity_score=80.0,
                    urgency_score=85.0,
                    affected_population=1_000_000,
                    geographic_scope=["global"],
                    sdg_goals=[13],
                    funding_gap=1_000_000_000,
                    current_solutions=[],
                    blockchain_applicability=0.8
                ),
                investment_amount=5_000,
                expected_return=0.08,
                impact_potential=85.0,
                risk_score=30.0,
                time_horizon=12,
                impact_metrics={},
                verification_method="verified",
                monitoring_frequency="monthly"
            )
        ]
        
        optimized = await agent._optimize_impact_allocation(
            recommendations, 100_000, 0.1
        )
        
        assert isinstance(optimized, list)
        assert len(optimized) <= len(recommendations)
        
        # Verify allocation constraints
        total_allocation = sum(rec.investment_amount for rec in optimized)
        assert total_allocation <= 100_000 * 0.1  # Within allocation limit
    
    @pytest.mark.asyncio
    async def test_data_fetching_methods(self, agent):
        """Test data fetching methods"""
        # Test UN SDG data fetching
        sdg_data = await agent._fetch_un_sdg_data()
        assert isinstance(sdg_data, dict)
        
        # Test World Bank data fetching
        wb_data = await agent._fetch_world_bank_data()
        assert isinstance(wb_data, dict)
        
        # Test climate data fetching
        climate_data = await agent._fetch_climate_data()
        assert isinstance(climate_data, dict)
    
    def test_generate_investment_recommendation(self, agent, sample_protocol):
        """Test investment recommendation generation"""
        analysis = {
            'composite_score': 85.0,
            'environmental_score': 90.0,
            'social_score': 80.0,
            'governance_score': 85.0
        }
        
        recommendation = agent._generate_investment_recommendation(
            sample_protocol, analysis, 80.0
        )
        
        assert isinstance(recommendation, str)
        assert len(recommendation) > 0
        assert any(word in recommendation.lower() for word in ['buy', 'hold', 'avoid'])
    
    @pytest.mark.asyncio
    async def test_forecast_impact_potential(self, agent, sample_protocol):
        """Test impact potential forecasting"""
        forecast = await agent._forecast_impact_potential(sample_protocol)
        
        assert isinstance(forecast, dict)
        assert '1_year_impact_forecast' in forecast
        assert '3_year_impact_forecast' in forecast
        assert '5_year_impact_forecast' in forecast
        assert 'key_growth_drivers' in forecast
        assert 'potential_obstacles' in forecast
        
        # Verify forecast values
        assert 0 <= forecast['1_year_impact_forecast'] <= 100
        assert 0 <= forecast['3_year_impact_forecast'] <= 100
        assert 0 <= forecast['5_year_impact_forecast'] <= 100
    
    def test_identify_growth_drivers(self, agent, sample_protocol):
        """Test growth driver identification"""
        drivers = agent._identify_growth_drivers(sample_protocol)
        
        assert isinstance(drivers, list)
        assert all(isinstance(driver, str) for driver in drivers)
    
    def test_identify_potential_obstacles(self, agent, sample_protocol):
        """Test potential obstacle identification"""
        obstacles = agent._identify_potential_obstacles(sample_protocol)
        
        assert isinstance(obstacles, list)
        assert all(isinstance(obstacle, str) for obstacle in obstacles)
    
    @pytest.mark.asyncio
    async def test_error_handling(self, agent):
        """Test error handling in various methods"""
        # Test with invalid inputs
        empty_challenges = await agent.identify_global_challenges(
            categories=[],
            severity_threshold=200.0  # Invalid threshold
        )
        assert isinstance(empty_challenges, list)
        
        empty_protocols = await agent.analyze_esg_protocols(
            chains=["nonexistent_chain"]
        )
        assert isinstance(empty_protocols, list)
        
        # Test with empty inputs
        empty_mapping = await agent.map_problems_to_solutions([], [])
        assert isinstance(empty_mapping, dict)
        assert len(empty_mapping) == 0
    
    @pytest.mark.asyncio
    async def test_cache_behavior(self, agent):
        """Test caching behavior for data updates"""
        # First call should update cache
        await agent._update_challenge_database()
        first_update = agent.last_data_update
        
        # Second call within cache expiry should not update
        await agent._update_challenge_database()
        second_update = agent.last_data_update
        
        assert first_update == second_update
        
        # Force cache expiry and test update
        agent.last_data_update = datetime.utcnow() - timedelta(hours=7)
        await agent._update_challenge_database()
        third_update = agent.last_data_update
        
        assert third_update > first_update


# Property-based tests for global challenge identification system
class TestWorldProblemSolverProperties:
    """Property-based tests for World Problem Solver Agent"""
    
    @pytest.fixture
    async def agent(self):
        """Create agent instance for property testing"""
        agent = WorldProblemSolverAgent()
        async with agent:
            yield agent
    
    @pytest.mark.asyncio
    async def test_property_challenge_identification_consistency(self, agent):
        """
        Property: Challenge identification should be consistent and comprehensive
        **Validates: Requirements 3.1, 3.2**
        """
        # Test multiple calls return consistent results
        challenges1 = await agent.identify_global_challenges()
        challenges2 = await agent.identify_global_challenges()
        
        # Should return same challenges (within cache period)
        assert len(challenges1) == len(challenges2)
        
        # All challenges should meet minimum criteria
        for challenge in challenges1:
            assert challenge.severity_score >= 50.0
            assert challenge.urgency_score > 0
            assert challenge.affected_population > 0
            assert 0 <= challenge.blockchain_applicability <= 1
            assert len(challenge.sdg_goals) > 0
            assert challenge.funding_gap > 0
    
    @pytest.mark.asyncio
    async def test_property_esg_scoring_monotonicity(self, agent):
        """
        Property: ESG scoring should be monotonic with respect to input quality
        **Validates: Requirements 12.1**
        """
        # Create protocols with different ESG characteristics
        high_esg_protocol = ESGProtocol(
            protocol_name="High ESG Protocol",
            protocol_address="0x_high",
            chain="ethereum",
            esg_rating=ESGRating.EXCELLENT,
            esg_score=95.0,
            impact_categories=[ImpactCategory.CLIMATE_CHANGE],
            environmental_score=95.0,
            social_score=90.0,
            governance_score=95.0,
            tvl=100_000_000,
            apy=0.08,
            impact_metrics={"impact": "high"},
            verification_status="Third-party verified",
            audit_reports=["Audit1", "Audit2"],
            carbon_footprint=-50000.0
        )
        
        low_esg_protocol = ESGProtocol(
            protocol_name="Low ESG Protocol",
            protocol_address="0x_low",
            chain="ethereum",
            esg_rating=ESGRating.POOR,
            esg_score=40.0,
            impact_categories=[ImpactCategory.CLIMATE_CHANGE],
            environmental_score=30.0,
            social_score=40.0,
            governance_score=50.0,
            tvl=1_000_000,
            apy=0.15,
            impact_metrics={},
            verification_status="unverified",
            audit_reports=[],
            carbon_footprint=10000.0
        )
        
        protocols = [high_esg_protocol, low_esg_protocol]
        enhanced_scores = await agent.build_enhanced_esg_scoring_system(protocols)
        
        high_score = enhanced_scores["High ESG Protocol"]["enhanced_esg_score"]
        low_score = enhanced_scores["Low ESG Protocol"]["enhanced_esg_score"]
        
        # Higher quality protocol should have higher enhanced score
        assert high_score > low_score
        
        # Risk-adjusted scores should also follow this pattern
        high_risk_adj = enhanced_scores["High ESG Protocol"]["risk_adjusted_score"]
        low_risk_adj = enhanced_scores["Low ESG Protocol"]["risk_adjusted_score"]
        
        assert high_risk_adj > low_risk_adj
    
    @pytest.mark.asyncio
    async def test_property_solution_mapping_completeness(self, agent):
        """
        Property: Solution mapping should provide complete coverage of challenges
        **Validates: Requirements 3.2**
        """
        # Get sample challenges and protocols
        challenges = await agent.identify_global_challenges()
        protocols = await agent.analyze_esg_protocols()
        
        if challenges and protocols:
            solution_mapping = await agent.map_problems_to_solutions(challenges[:5], protocols)
            
            # Every challenge should have at least one solution mapped
            for challenge in challenges[:5]:
                assert challenge.challenge_id in solution_mapping
                solutions = solution_mapping[challenge.challenge_id]
                assert len(solutions) > 0
                
                # Each solution should have required fields
                for solution in solutions:
                    assert 'confidence' in solution
                    assert 'impact_score' in solution
                    assert 'implementation_complexity' in solution
                    assert 0 <= solution['confidence'] <= 1
                    assert 0 <= solution['impact_score'] <= 100
    
    @pytest.mark.asyncio
    async def test_property_impact_investment_allocation_constraints(self, agent):
        """
        Property: Impact investment allocation should respect portfolio constraints
        **Validates: Requirements 12.1**
        """
        portfolio_values = [50_000, 100_000, 500_000, 1_000_000]
        min_allocations = [0.05, 0.1, 0.15, 0.2]
        
        for portfolio_value in portfolio_values:
            for min_allocation in min_allocations:
                recommendations = await agent.generate_impact_investment_recommendations(
                    portfolio_value=portfolio_value,
                    impact_preferences=[ImpactCategory.CLIMATE_CHANGE],
                    risk_tolerance=0.5,
                    min_impact_allocation=min_allocation
                )
                
                if recommendations:
                    total_allocation = sum(rec.investment_amount for rec in recommendations)
                    max_allocation = portfolio_value * min_allocation
                    
                    # Total allocation should not exceed maximum
                    assert total_allocation <= max_allocation
                    
                    # Each recommendation should meet minimum investment threshold
                    for rec in recommendations:
                        assert rec.investment_amount >= 1000  # Minimum $1000
                        assert rec.impact_potential >= agent.impact_thresholds['minimum_impact_potential']
    
    def test_property_esg_assessment_bounds(self, agent):
        """
        Property: All ESG assessment methods should return scores within valid bounds
        **Validates: Requirements 12.1**
        """
        # Create test protocol with various characteristics
        test_protocol = ESGProtocol(
            protocol_name="Test Protocol",
            protocol_address="0x_test",
            chain="polygon",
            esg_rating=ESGRating.GOOD,
            esg_score=75.0,
            impact_categories=[ImpactCategory.CLIMATE_CHANGE, ImpactCategory.CLEAN_ENERGY],
            environmental_score=80.0,
            social_score=70.0,
            governance_score=75.0,
            tvl=25_000_000,
            apy=0.06,
            impact_metrics={"test": "value"},
            verification_status="verified",
            audit_reports=["Audit1"],
            carbon_footprint=0.0
        )
        
        # Test all assessment methods return valid scores
        assessment_methods = [
            agent._assess_carbon_impact,
            agent._assess_resource_efficiency,
            agent._assess_circular_economy_principles,
            agent._assess_biodiversity_impact,
            agent._assess_community_impact,
            agent._assess_accessibility,
            agent._assess_stakeholder_engagement,
            agent._assess_human_rights_compliance,
            agent._assess_transparency,
            agent._assess_decentralization,
            agent._assess_accountability,
            agent._assess_risk_management
        ]
        
        for method in assessment_methods:
            score = method(test_protocol)
            assert isinstance(score, float)
            assert 0 <= score <= 100
    
    def test_property_risk_calculation_consistency(self, agent):
        """
        Property: Risk calculations should be consistent and inversely related to quality
        **Validates: Requirements 12.1**
        """
        # Create protocols with different risk profiles
        low_risk_protocol = ESGProtocol(
            protocol_name="Low Risk Protocol",
            protocol_address="0x_low_risk",
            chain="ethereum",
            esg_rating=ESGRating.EXCELLENT,
            esg_score=90.0,
            impact_categories=[ImpactCategory.CLIMATE_CHANGE],
            environmental_score=90.0,
            social_score=85.0,
            governance_score=95.0,  # High governance = low risk
            tvl=200_000_000,  # High TVL = low risk
            apy=0.05,
            impact_metrics={},
            verification_status="verified",
            audit_reports=["Audit1", "Audit2"]  # Multiple audits = low risk
        )
        
        high_risk_protocol = ESGProtocol(
            protocol_name="High Risk Protocol",
            protocol_address="0x_high_risk",
            chain="ethereum",
            esg_rating=ESGRating.POOR,
            esg_score=40.0,
            impact_categories=[ImpactCategory.CLIMATE_CHANGE],
            environmental_score=30.0,
            social_score=40.0,
            governance_score=50.0,  # Low governance = high risk
            tvl=500_000,  # Low TVL = high risk
            apy=0.20,
            impact_metrics={},
            verification_status="unverified",
            audit_reports=[]  # No audits = high risk
        )
        
        investment_amount = 10_000
        
        low_risk_score = agent._calculate_investment_risk(low_risk_protocol, investment_amount)
        high_risk_score = agent._calculate_investment_risk(high_risk_protocol, investment_amount)
        
        # High risk protocol should have higher risk score
        assert high_risk_score > low_risk_score
        
        # Both scores should be within valid bounds
        assert 0 <= low_risk_score <= 100
        assert 0 <= high_risk_score <= 100
    
    @pytest.mark.asyncio
    async def test_property_data_consistency_across_calls(self, agent):
        """
        Property: Data should remain consistent across multiple calls within cache period
        **Validates: Requirements 3.1, 3.2**
        """
        # Multiple calls to the same method should return consistent results
        challenges1 = await agent.identify_global_challenges(
            categories=[ImpactCategory.CLIMATE_CHANGE],
            severity_threshold=70.0
        )
        
        challenges2 = await agent.identify_global_challenges(
            categories=[ImpactCategory.CLIMATE_CHANGE],
            severity_threshold=70.0
        )
        
        # Should return same number of challenges
        assert len(challenges1) == len(challenges2)
        
        # Challenge IDs should be the same
        ids1 = {c.challenge_id for c in challenges1}
        ids2 = {c.challenge_id for c in challenges2}
        assert ids1 == ids2
        
        # Same for protocols
        protocols1 = await agent.analyze_esg_protocols(min_esg_score=70.0)
        protocols2 = await agent.analyze_esg_protocols(min_esg_score=70.0)
        
        assert len(protocols1) == len(protocols2)
        
        names1 = {p.protocol_name for p in protocols1}
        names2 = {p.protocol_name for p in protocols2}
        assert names1 == names2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])