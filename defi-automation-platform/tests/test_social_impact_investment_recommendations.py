"""
Test suite for social impact investment recommendations (Task 10.2)

Tests the enhanced World Problem Solver Agent functionality for:
- ESG protocol discovery and integration
- Carbon credit token recommendations
- Social impact ROI calculations
- Impact measurement and tracking systems
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from decimal import Decimal
from datetime import datetime, timedelta

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from src.agents.world_problem_solver import (
    WorldProblemSolverAgent,
    ImpactCategory,
    ESGRating,
    GlobalChallenge,
    ESGProtocol,
    SocialImpactInvestment
)


class TestSocialImpactInvestmentRecommendations:
    """Test social impact investment recommendation functionality"""
    
    @pytest.fixture
    async def agent(self):
        """Create World Problem Solver Agent instance"""
        agent = WorldProblemSolverAgent()
        async with agent:
            yield agent
    
    @pytest.fixture
    def sample_esg_protocol(self):
        """Create sample ESG protocol for testing"""
        return ESGProtocol(
            protocol_name="Test Climate Protocol",
            protocol_address="0x1234567890123456789012345678901234567890",
            chain="polygon",
            esg_rating=ESGRating.EXCELLENT,
            esg_score=90.0,
            impact_categories=[ImpactCategory.CLIMATE_CHANGE],
            environmental_score=95.0,
            social_score=85.0,
            governance_score=90.0,
            tvl=25_000_000,
            apy=0.12,
            impact_metrics={
                "carbon_credits_tokenized": "10M+ tonnes CO2",
                "projects_supported": "100+",
                "countries_active": "15+"
            },
            verification_status="Third-party verified",
            audit_reports=["CertiK", "Quantstamp"],
            carbon_footprint=-500_000.0
        )
    
    @pytest.fixture
    def sample_global_challenge(self):
        """Create sample global challenge for testing"""
        return GlobalChallenge(
            challenge_id="climate_test_001",
            title="Test Climate Challenge",
            description="Test climate change mitigation challenge",
            category=ImpactCategory.CLIMATE_CHANGE,
            severity_score=85.0,
            urgency_score=90.0,
            affected_population=1_000_000,
            geographic_scope=["Global"],
            sdg_goals=[13, 7],
            funding_gap=1_000_000_000,
            current_solutions=["Carbon credits", "Renewable energy"],
            blockchain_applicability=0.8
        )
    
    @pytest.fixture
    def sample_investment(self, sample_esg_protocol, sample_global_challenge):
        """Create sample social impact investment"""
        return SocialImpactInvestment(
            investment_id="test_investment_001",
            protocol=sample_esg_protocol,
            challenge=sample_global_challenge,
            investment_amount=10_000.0,
            expected_return=0.12,
            impact_potential=85.0,
            risk_score=35.0,
            time_horizon=12,
            impact_metrics={
                "estimated_beneficiaries": 100,
                "co2_impact": 10.0
            },
            verification_method="Third-party verified",
            monitoring_frequency="monthly"
        )
    
    @pytest.mark.asyncio
    async def test_discover_esg_protocols(self, agent):
        """Test ESG protocol discovery functionality"""
        # Test climate protocol discovery
        protocols = await agent.discover_esg_protocols(
            impact_categories=[ImpactCategory.CLIMATE_CHANGE],
            min_tvl=1_000_000,
            chains=["polygon", "ethereum"]
        )
        
        assert len(protocols) > 0
        assert all(ImpactCategory.CLIMATE_CHANGE in p.impact_categories for p in protocols)
        assert all(p.tvl >= 1_000_000 for p in protocols)
        assert all(p.chain in ["polygon", "ethereum"] for p in protocols)
        assert all(p.esg_score >= 60.0 for p in protocols)
        
        # Verify protocols are sorted by ESG score
        for i in range(len(protocols) - 1):
            assert protocols[i].esg_score >= protocols[i + 1].esg_score
    
    @pytest.mark.asyncio
    async def test_carbon_credit_integration(self, agent):
        """Test carbon credit token integration"""
        investment_amount = 50_000.0
        preferences = {
            "project_types": ["forestry", "renewable_energy"],
            "verification_standards": ["verra", "gold_standard"],
            "geographic_focus": ["global"]
        }
        
        opportunities = await agent.integrate_carbon_credit_tokens(
            investment_amount, preferences
        )
        
        assert len(opportunities) > 0
        
        # Verify opportunity structure
        for opp in opportunities:
            assert "protocol" in opp
            assert "carbon_tonnes" in opp
            assert "expected_roi" in opp
            assert "impact_score" in opp
            assert "risk_score" in opp
            assert opp["investment_amount"] <= investment_amount
            assert opp["carbon_tonnes"] > 0
            assert 0 <= opp["expected_roi"] <= 1
            assert 0 <= opp["impact_score"] <= 100
            assert 0 <= opp["risk_score"] <= 100
    
    @pytest.mark.asyncio
    async def test_comprehensive_carbon_recommendations(self, agent):
        """Test comprehensive carbon credit recommendations"""
        investment_amount = 100_000.0
        preferences = {"risk_tolerance": "medium"}
        risk_tolerance = 0.5
        
        recommendations = await agent.get_comprehensive_carbon_credit_recommendations(
            investment_amount, preferences, risk_tolerance
        )
        
        assert "total_investment" in recommendations
        assert "recommended_allocation" in recommendations
        assert "impact_projection" in recommendations
        assert "risk_analysis" in recommendations
        assert "roi_analysis" in recommendations
        
        # Verify allocation doesn't exceed total investment
        total_allocated = sum(
            alloc.get("allocated_amount", 0) 
            for alloc in recommendations["recommended_allocation"]
        )
        assert total_allocated <= investment_amount
        
        # Verify impact projection structure
        impact_proj = recommendations["impact_projection"]
        assert "immediate_impact" in impact_proj
        assert "1_year_projection" in impact_proj
        assert "5_year_projection" in impact_proj
        assert "impact_metrics" in impact_proj
    
    @pytest.mark.asyncio
    async def test_social_impact_roi_calculation(self, agent, sample_investment):
        """Test social impact ROI calculation"""
        time_horizon = 3
        
        roi_metrics = await agent.calculate_social_impact_roi(
            sample_investment, time_horizon
        )
        
        assert "financial_roi" in roi_metrics
        assert "social_roi" in roi_metrics
        assert "environmental_roi" in roi_metrics
        assert "impact_adjusted_roi" in roi_metrics
        assert "risk_adjusted_roi" in roi_metrics
        
        # Verify financial ROI structure
        financial_roi = roi_metrics["financial_roi"]
        assert "annual_return_rate" in financial_roi
        assert "total_return" in financial_roi
        assert "roi_percentage" in financial_roi
        
        # Verify social ROI structure
        social_roi = roi_metrics["social_roi"]
        assert "total_value" in social_roi
        assert "impact_metrics" in social_roi
        assert "value_per_dollar_invested" in social_roi
        
        # Verify environmental ROI structure
        environmental_roi = roi_metrics["environmental_roi"]
        assert "total_value" in environmental_roi
        assert "impact_metrics" in environmental_roi
        
        # Verify ROI values are reasonable
        assert roi_metrics["impact_adjusted_roi"] > 0
        assert roi_metrics["risk_adjusted_roi"] >= 0
    
    @pytest.mark.asyncio
    async def test_impact_measurement_system(self, agent, sample_investment):
        """Test impact measurement and tracking system"""
        investments = [sample_investment]
        
        measurement_system = await agent.build_impact_measurement_system(investments)
        
        assert "tracking_framework" in measurement_system
        assert "data_collection_system" in measurement_system
        assert "verification_protocols" in measurement_system
        assert "reporting_dashboard" in measurement_system
        assert "automated_monitoring" in measurement_system
        
        # Verify tracking framework
        tracking = measurement_system["tracking_framework"]
        assert "theory_of_change" in tracking
        assert "impact_indicators" in tracking
        assert "measurement_frequency" in tracking
        
        # Verify data collection system
        data_collection = measurement_system["data_collection_system"]
        assert "blockchain_monitoring" in data_collection
        assert "api_integrations" in data_collection
        assert "survey_system" in data_collection
    
    @pytest.mark.asyncio
    async def test_advanced_impact_tracking_dashboard(self, agent, sample_investment):
        """Test advanced impact tracking dashboard creation"""
        investments = [sample_investment]
        
        dashboard = await agent.create_advanced_impact_tracking_dashboard(investments)
        
        assert "real_time_metrics" in dashboard
        assert "automated_data_collection" in dashboard
        assert "impact_verification_system" in dashboard
        assert "stakeholder_reporting" in dashboard
        assert "predictive_analytics" in dashboard
        assert "blockchain_integration" in dashboard
        
        # Verify real-time metrics configuration
        metrics = dashboard["real_time_metrics"]
        assert "climate_metrics" in metrics
        assert "social_metrics" in metrics
        assert "financial_metrics" in metrics
        
        # Verify each metric has required fields
        for category in metrics.values():
            for metric in category.values():
                assert "unit" in metric
                assert "update_frequency" in metric
                assert "data_sources" in metric
                assert "visualization" in metric
    
    @pytest.mark.asyncio
    async def test_comprehensive_impact_report(self, agent, sample_investment):
        """Test comprehensive impact report generation"""
        investments = [sample_investment]
        time_period = "quarterly"
        
        report = await agent.generate_comprehensive_impact_report(
            investments, time_period
        )
        
        assert "report_metadata" in report
        assert "executive_summary" in report
        assert "financial_performance" in report
        assert "impact_outcomes" in report
        assert "risk_assessment" in report
        assert "stakeholder_feedback" in report
        assert "strategic_recommendations" in report
        assert "future_outlook" in report
        assert "appendices" in report
        
        # Verify report metadata
        metadata = report["report_metadata"]
        assert metadata["reporting_period"] == time_period
        assert metadata["investments_covered"] == len(investments)
        assert metadata["total_portfolio_value"] > 0
        
        # Verify executive summary
        summary = report["executive_summary"]
        assert "key_highlights" in summary
        assert "performance_summary" in summary
        assert "period_achievements" in summary
        
        # Verify financial performance
        financial = report["financial_performance"]
        assert "portfolio_metrics" in financial
        assert "performance_by_category" in financial
        assert "benchmark_comparison" in financial
    
    @pytest.mark.asyncio
    async def test_enhanced_esg_scoring(self, agent, sample_esg_protocol):
        """Test enhanced ESG scoring system"""
        enhanced_score = await agent._calculate_enhanced_esg_score(sample_esg_protocol)
        
        # Enhanced score should be higher than base score due to bonuses
        assert enhanced_score >= sample_esg_protocol.esg_score
        assert enhanced_score <= 100.0
        
        # Test with protocol with fewer features
        basic_protocol = ESGProtocol(
            protocol_name="Basic Protocol",
            protocol_address="0x0000000000000000000000000000000000000000",
            chain="ethereum",
            esg_rating=ESGRating.FAIR,
            esg_score=60.0,
            impact_categories=[ImpactCategory.CLEAN_ENERGY],
            environmental_score=65.0,
            social_score=55.0,
            governance_score=60.0,
            tvl=1_000_000,
            apy=0.05,
            impact_metrics={},
            verification_status="unverified",
            audit_reports=[]
        )
        
        basic_enhanced_score = await agent._calculate_enhanced_esg_score(basic_protocol)
        assert basic_enhanced_score < enhanced_score  # Should score lower
    
    @pytest.mark.asyncio
    async def test_problem_solution_mapping(self, agent, sample_global_challenge, sample_esg_protocol):
        """Test problem-to-solution mapping functionality"""
        challenges = [sample_global_challenge]
        protocols = [sample_esg_protocol]
        
        solution_mapping = await agent.map_problems_to_solutions(challenges, protocols)
        
        assert len(solution_mapping) > 0
        assert sample_global_challenge.challenge_id in solution_mapping
        
        solutions = solution_mapping[sample_global_challenge.challenge_id]
        assert len(solutions) > 0
        
        # Verify solution structure
        for solution in solutions:
            assert "solution_id" in solution
            assert "solution_type" in solution
            assert "protocol" in solution
            assert "confidence" in solution
            assert "impact_score" in solution
            assert "implementation_complexity" in solution
            assert "estimated_funding" in solution
            assert "timeline_months" in solution
            assert "key_benefits" in solution
            assert "risk_factors" in solution
            assert "success_metrics" in solution
            
            # Verify value ranges
            assert 0 <= solution["confidence"] <= 1
            assert 0 <= solution["impact_score"] <= 100
            assert solution["estimated_funding"] > 0
            assert solution["timeline_months"] > 0
    
    @pytest.mark.asyncio
    async def test_carbon_portfolio_optimization(self, agent):
        """Test carbon credit portfolio optimization"""
        # Create mock opportunities
        opportunities = [
            {
                "protocol": "Toucan Protocol",
                "allocated_amount": 0,
                "risk_adjusted_score": 90,
                "liquidity_score": 85,
                "risk_score": 25
            },
            {
                "protocol": "KlimaDAO", 
                "allocated_amount": 0,
                "risk_adjusted_score": 85,
                "liquidity_score": 80,
                "risk_score": 35
            },
            {
                "protocol": "Moss.Earth",
                "allocated_amount": 0,
                "risk_adjusted_score": 80,
                "liquidity_score": 70,
                "risk_score": 30
            }
        ]
        
        total_amount = 100_000.0
        risk_tolerance = 0.5
        
        portfolio = await agent._optimize_carbon_credit_portfolio(
            opportunities, total_amount, risk_tolerance
        )
        
        assert len(portfolio) > 0
        
        # Verify allocation doesn't exceed total
        total_allocated = sum(p.get("allocated_amount", 0) for p in portfolio)
        assert total_allocated <= total_amount
        
        # Verify each allocation has required fields
        for allocation in portfolio:
            assert "allocated_amount" in allocation
            assert "allocation_percentage" in allocation
            assert allocation["allocated_amount"] >= 500  # Minimum allocation
            assert 0 <= allocation["allocation_percentage"] <= 1
    
    @pytest.mark.asyncio
    async def test_impact_projection(self, agent):
        """Test carbon impact projection calculations"""
        portfolio = [
            {
                "protocol": "Test Protocol",
                "carbon_tonnes": 1000,
                "impact_value": 50000,
                "allocated_amount": 25000
            }
        ]
        
        projection = await agent._project_carbon_impact(portfolio)
        
        assert "immediate_impact" in projection
        assert "1_year_projection" in projection
        assert "5_year_projection" in projection
        assert "impact_metrics" in projection
        
        # Verify immediate impact
        immediate = projection["immediate_impact"]
        assert immediate["total_carbon_tonnes"] == 1000
        assert immediate["total_impact_value"] == 50000
        assert "impact_breakdown" in immediate
        
        # Verify projections show growth
        year_1 = projection["1_year_projection"]
        year_5 = projection["5_year_projection"]
        assert year_1["carbon_tonnes"] > immediate["total_carbon_tonnes"]
        assert year_5["carbon_tonnes"] > year_1["carbon_tonnes"]
        
        # Verify impact metrics
        metrics = projection["impact_metrics"]
        assert "equivalent_cars_removed" in metrics
        assert "equivalent_trees_planted" in metrics
        assert "households_carbon_neutral" in metrics
        assert all(isinstance(v, int) for v in metrics.values())
    
    def test_impact_category_relationships(self, agent):
        """Test impact category relationship mapping"""
        # Test climate change relationships
        climate_related = agent._get_related_categories(ImpactCategory.CLIMATE_CHANGE)
        assert ImpactCategory.CLEAN_ENERGY in climate_related
        assert ImpactCategory.SUSTAINABLE_AGRICULTURE in climate_related
        
        # Test poverty reduction relationships
        poverty_related = agent._get_related_categories(ImpactCategory.POVERTY_REDUCTION)
        assert ImpactCategory.EDUCATION in poverty_related
        assert ImpactCategory.HEALTHCARE in poverty_related
        
        # Test education relationships
        education_related = agent._get_related_categories(ImpactCategory.EDUCATION)
        assert ImpactCategory.POVERTY_REDUCTION in education_related
        assert ImpactCategory.GENDER_EQUALITY in education_related
    
    def test_esg_rating_scoring(self, agent):
        """Test ESG rating to score conversion"""
        # Test different ESG ratings
        excellent_protocol = ESGProtocol(
            protocol_name="Excellent Protocol",
            protocol_address="0x1",
            chain="ethereum",
            esg_rating=ESGRating.EXCELLENT,
            esg_score=95.0,
            impact_categories=[ImpactCategory.CLIMATE_CHANGE],
            environmental_score=95.0,
            social_score=95.0,
            governance_score=95.0,
            tvl=100_000_000,
            apy=0.10,
            impact_metrics={"test": "value"},
            verification_status="third-party verified",
            audit_reports=["Audit1", "Audit2"]
        )
        
        verification_score = agent._calculate_verification_score(excellent_protocol)
        assert verification_score >= 80  # Should get high score
        
        poor_protocol = ESGProtocol(
            protocol_name="Poor Protocol",
            protocol_address="0x2",
            chain="ethereum",
            esg_rating=ESGRating.POOR,
            esg_score=35.0,
            impact_categories=[ImpactCategory.CLEAN_ENERGY],
            environmental_score=40.0,
            social_score=30.0,
            governance_score=35.0,
            tvl=500_000,
            apy=0.03,
            impact_metrics={},
            verification_status="unverified",
            audit_reports=[]
        )
        
        poor_verification_score = agent._calculate_verification_score(poor_protocol)
        assert poor_verification_score < verification_score  # Should score lower


class TestPropertyBasedSocialImpactInvestments:
    """Property-based tests for social impact investment recommendations"""
    
    @pytest.fixture
    async def agent(self):
        """Create World Problem Solver Agent instance"""
        agent = WorldProblemSolverAgent()
        async with agent:
            yield agent
    
    @pytest.mark.asyncio
    async def test_property_esg_protocol_discovery_consistency(self, agent):
        """
        Property: ESG protocol discovery should be consistent and deterministic
        **Validates: Requirements 12.1, 3.2**
        """
        # Test multiple calls with same parameters return consistent results
        impact_categories = [ImpactCategory.CLIMATE_CHANGE]
        min_tvl = 5_000_000
        chains = ["polygon", "ethereum"]
        
        results1 = await agent.discover_esg_protocols(impact_categories, min_tvl, chains)
        results2 = await agent.discover_esg_protocols(impact_categories, min_tvl, chains)
        
        # Results should be consistent
        assert len(results1) == len(results2)
        
        # Protocol names should match
        names1 = {p.protocol_name for p in results1}
        names2 = {p.protocol_name for p in results2}
        assert names1 == names2
        
        # ESG scores should be identical
        for p1, p2 in zip(results1, results2):
            if p1.protocol_name == p2.protocol_name:
                assert p1.esg_score == p2.esg_score
    
    @pytest.mark.asyncio
    async def test_property_carbon_allocation_conservation(self, agent):
        """
        Property: Carbon credit portfolio allocation should never exceed total investment
        **Validates: Requirements 12.1**
        """
        investment_amounts = [10_000, 50_000, 100_000, 500_000]
        risk_tolerances = [0.2, 0.5, 0.8]
        
        for amount in investment_amounts:
            for risk_tolerance in risk_tolerances:
                preferences = {"risk_tolerance": risk_tolerance}
                
                recommendations = await agent.get_comprehensive_carbon_credit_recommendations(
                    amount, preferences, risk_tolerance
                )
                
                if "recommended_allocation" in recommendations:
                    total_allocated = sum(
                        alloc.get("allocated_amount", 0) 
                        for alloc in recommendations["recommended_allocation"]
                    )
                    
                    # Property: Total allocation should never exceed investment amount
                    assert total_allocated <= amount, f"Over-allocation: {total_allocated} > {amount}"
                    
                    # Property: Each individual allocation should be positive
                    for alloc in recommendations["recommended_allocation"]:
                        assert alloc.get("allocated_amount", 0) > 0, "Negative allocation found"
    
    @pytest.mark.asyncio
    async def test_property_impact_roi_monotonicity(self, agent):
        """
        Property: Higher impact potential should generally lead to higher impact-adjusted ROI
        **Validates: Requirements 12.1, 3.2**
        """
        # Create test investments with varying impact potential
        base_protocol = ESGProtocol(
            protocol_name="Test Protocol",
            protocol_address="0x1234",
            chain="polygon",
            esg_rating=ESGRating.GOOD,
            esg_score=75.0,
            impact_categories=[ImpactCategory.CLIMATE_CHANGE],
            environmental_score=80.0,
            social_score=70.0,
            governance_score=75.0,
            tvl=10_000_000,
            apy=0.10,
            impact_metrics={"co2_impact": 100},
            verification_status="verified",
            audit_reports=["Audit1"]
        )
        
        base_challenge = GlobalChallenge(
            challenge_id="test_challenge",
            title="Test Challenge",
            description="Test challenge",
            category=ImpactCategory.CLIMATE_CHANGE,
            severity_score=80.0,
            urgency_score=85.0,
            affected_population=1_000_000,
            geographic_scope=["Global"],
            sdg_goals=[13],
            funding_gap=1_000_000_000,
            current_solutions=["Test"],
            blockchain_applicability=0.8
        )
        
        impact_potentials = [60.0, 70.0, 80.0, 90.0]
        roi_results = []
        
        for impact_potential in impact_potentials:
            investment = SocialImpactInvestment(
                investment_id=f"test_{impact_potential}",
                protocol=base_protocol,
                challenge=base_challenge,
                investment_amount=10_000.0,
                expected_return=0.10,
                impact_potential=impact_potential,
                risk_score=40.0,
                time_horizon=12,
                impact_metrics={"estimated_beneficiaries": 100, "co2_impact": 10.0},
                verification_method="verified",
                monitoring_frequency="monthly"
            )
            
            roi_metrics = await agent.calculate_social_impact_roi(investment, 3)
            roi_results.append((impact_potential, roi_metrics.get("impact_adjusted_roi", 0)))
        
        # Property: Generally, higher impact potential should lead to higher impact-adjusted ROI
        # (allowing for some variance due to other factors)
        for i in range(len(roi_results) - 1):
            current_impact, current_roi = roi_results[i]
            next_impact, next_roi = roi_results[i + 1]
            
            # Higher impact should generally lead to higher ROI (with some tolerance)
            if next_impact > current_impact:
                # Allow for some variance, but trend should be generally upward
                assert next_roi >= current_roi * 0.9, f"ROI decreased significantly: {current_roi} -> {next_roi}"
    
    @pytest.mark.asyncio
    async def test_property_risk_score_bounds(self, agent):
        """
        Property: All risk scores should be within valid bounds (0-100)
        **Validates: Requirements 12.1**
        """
        # Test with various protocol configurations
        test_protocols = []
        
        # High-risk protocol
        high_risk = ESGProtocol(
            protocol_name="High Risk Protocol",
            protocol_address="0x1",
            chain="ethereum",
            esg_rating=ESGRating.POOR,
            esg_score=30.0,
            impact_categories=[ImpactCategory.CLEAN_ENERGY],
            environmental_score=40.0,
            social_score=20.0,
            governance_score=30.0,
            tvl=100_000,  # Low TVL
            apy=0.25,  # High APY (risky)
            impact_metrics={},
            verification_status="unverified",
            audit_reports=[]
        )
        test_protocols.append(high_risk)
        
        # Low-risk protocol
        low_risk = ESGProtocol(
            protocol_name="Low Risk Protocol",
            protocol_address="0x2",
            chain="polygon",
            esg_rating=ESGRating.EXCELLENT,
            esg_score=95.0,
            impact_categories=[ImpactCategory.CLIMATE_CHANGE],
            environmental_score=98.0,
            social_score=92.0,
            governance_score=95.0,
            tvl=500_000_000,  # High TVL
            apy=0.06,  # Conservative APY
            impact_metrics={"verified_impact": "high"},
            verification_status="third-party verified",
            audit_reports=["Audit1", "Audit2", "Audit3"]
        )
        test_protocols.append(low_risk)
        
        for protocol in test_protocols:
            # Test risk calculation for different investment amounts
            investment_amounts = [1_000, 10_000, 100_000, 1_000_000]
            
            for amount in investment_amounts:
                risk_score = agent._calculate_investment_risk(protocol, amount)
                
                # Property: Risk score must be within bounds
                assert 0 <= risk_score <= 100, f"Risk score out of bounds: {risk_score}"
                
                # Property: Higher investment amounts relative to TVL should increase risk
                if protocol.tvl > 0:
                    concentration_risk = (amount / protocol.tvl) * 100
                    if concentration_risk > 10:  # Significant concentration
                        assert risk_score > 30, f"High concentration should increase risk: {risk_score}"
    
    @pytest.mark.asyncio
    async def test_property_impact_measurement_completeness(self, agent):
        """
        Property: Impact measurement system should provide complete tracking for all investment categories
        **Validates: Requirements 12.1, 3.2**
        """
        # Test with investments across different impact categories
        impact_categories = [
            ImpactCategory.CLIMATE_CHANGE,
            ImpactCategory.POVERTY_REDUCTION,
            ImpactCategory.EDUCATION,
            ImpactCategory.HEALTHCARE,
            ImpactCategory.CLEAN_ENERGY
        ]
        
        for category in impact_categories:
            # Create test investment for each category
            protocol = ESGProtocol(
                protocol_name=f"{category.value} Protocol",
                protocol_address="0x1234",
                chain="polygon",
                esg_rating=ESGRating.GOOD,
                esg_score=80.0,
                impact_categories=[category],
                environmental_score=85.0,
                social_score=75.0,
                governance_score=80.0,
                tvl=25_000_000,
                apy=0.08,
                impact_metrics={"test_metric": "value"},
                verification_status="verified",
                audit_reports=["Audit1"]
            )
            
            challenge = GlobalChallenge(
                challenge_id=f"{category.value}_challenge",
                title=f"{category.value} Challenge",
                description=f"Test {category.value} challenge",
                category=category,
                severity_score=75.0,
                urgency_score=80.0,
                affected_population=500_000,
                geographic_scope=["Global"],
                sdg_goals=[1, 3, 4, 7, 13],  # Various SDGs
                funding_gap=500_000_000,
                current_solutions=["Test solution"],
                blockchain_applicability=0.7
            )
            
            investment = SocialImpactInvestment(
                investment_id=f"{category.value}_investment",
                protocol=protocol,
                challenge=challenge,
                investment_amount=25_000.0,
                expected_return=0.08,
                impact_potential=80.0,
                risk_score=40.0,
                time_horizon=12,
                impact_metrics={"estimated_beneficiaries": 250, "co2_impact": 25.0},
                verification_method="verified",
                monitoring_frequency="monthly"
            )
            
            # Test impact measurement system creation
            measurement_system = await agent.build_impact_measurement_system([investment])
            
            # Property: System should provide complete tracking framework
            assert "tracking_framework" in measurement_system
            assert "data_collection_system" in measurement_system
            assert "verification_protocols" in measurement_system
            assert "reporting_dashboard" in measurement_system
            
            # Property: Tracking framework should cover the investment
            tracking = measurement_system["tracking_framework"]
            assert investment.challenge.challenge_id in tracking.get("theory_of_change", {})
            assert investment.challenge.challenge_id in tracking.get("impact_indicators", {})
            
            # Property: Data collection should be configured
            data_collection = measurement_system["data_collection_system"]
            assert "blockchain_monitoring" in data_collection
            assert "api_integrations" in data_collection
            
            # Property: Verification protocols should be established
            verification = measurement_system["verification_protocols"]
            assert "verification_standards" in verification
            assert "verification_frequency" in verification


if __name__ == "__main__":
    pytest.main([__file__, "-v"])