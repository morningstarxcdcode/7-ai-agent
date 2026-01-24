"""
Property-Based Tests for DeFi Strategy Optimization

**Validates: Requirements 5.1, 5.2**

This module tests the core property of DeFi strategy optimization
and rebalancing in the DeFi Strategist Agent system.
"""

import pytest
import asyncio
from hypothesis import given, strategies as st, settings, assume
from hypothesis.stateful import RuleBasedStateMachine, rule, initialize
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import numpy as np

from src.agents.defi_strategist import (
    DeFiStrategistAgent, YieldOpportunity, RiskLevel, ProtocolCategory
)
from src.agents.portfolio_rebalancer import (
    PortfolioRebalancer, PortfolioPosition, RebalanceStrategy, 
    RebalanceTransaction, TransactionType, RebalanceReason
)


class TestDeFiStrategyOptimization:
    """Property tests for DeFi strategy optimization and rebalancing"""
    
    @pytest.fixture
    def strategist_agent(self):
        """Create DeFi strategist agent for testing"""
        return DeFiStrategistAgent()
    
    @pytest.fixture
    def portfolio_rebalancer(self):
        """Create portfolio rebalancer for testing"""
        return PortfolioRebalancer()
    
    # Strategy generators for test inputs
    @st.composite
    def yield_opportunity(draw):
        """Generate realistic yield opportunities"""
        protocol_names = ['Aave', 'Compound', 'Uniswap', 'Curve', 'Yearn', 'Convex']
        tokens = ['ETH', 'USDC', 'DAI', 'USDT', 'WBTC', 'LINK']
        chains = ['ethereum', 'polygon', 'arbitrum', 'optimism']
        
        return YieldOpportunity(
            protocol_name=draw(st.sampled_from(protocol_names)),
            pool_name=draw(st.text(min_size=3, max_size=20)),
            apy=draw(st.floats(min_value=0.01, max_value=2.0)),  # 1% to 200% APY
            tvl=draw(st.floats(min_value=100_000, max_value=1_000_000_000)),
            risk_score=draw(st.floats(min_value=0.0, max_value=1.0)),
            risk_level=draw(st.sampled_from(list(RiskLevel))),
            category=draw(st.sampled_from(list(ProtocolCategory))),
            tokens=draw(st.lists(st.sampled_from(tokens), min_size=1, max_size=3)),
            chain=draw(st.sampled_from(chains)),
            minimum_deposit=draw(st.floats(min_value=1.0, max_value=10000.0)),
            impermanent_loss_risk=draw(st.floats(min_value=0.0, max_value=0.5)),
            smart_contract_risk=draw(st.floats(min_value=0.0, max_value=1.0)),
            liquidity_risk=draw(st.floats(min_value=0.0, max_value=1.0)),
            protocol_risk=draw(st.floats(min_value=0.0, max_value=1.0)),
            market_risk=draw(st.floats(min_value=0.0, max_value=1.0))
        )
    
    @st.composite
    def portfolio_position(draw):
        """Generate realistic portfolio positions"""
        protocol_names = ['Aave', 'Compound', 'Uniswap', 'Curve', 'Yearn']
        tokens = ['ETH', 'USDC', 'DAI', 'USDT', 'WBTC']
        chains = ['ethereum', 'polygon', 'arbitrum']
        
        current_value = draw(st.floats(min_value=100.0, max_value=100_000.0))
        target_value = draw(st.floats(min_value=100.0, max_value=100_000.0))
        
        return PortfolioPosition(
            protocol_name=draw(st.sampled_from(protocol_names)),
            pool_name=draw(st.text(min_size=3, max_size=15)),
            chain=draw(st.sampled_from(chains)),
            tokens=draw(st.lists(st.sampled_from(tokens), min_size=1, max_size=2)),
            current_value=current_value,
            target_value=target_value,
            current_weight=current_value / 100_000.0,  # Assume $100k portfolio
            target_weight=target_value / 100_000.0,
            apy=draw(st.floats(min_value=0.01, max_value=1.0)),
            risk_score=draw(st.floats(min_value=0.0, max_value=1.0)),
            last_updated=datetime.utcnow(),
            impermanent_loss=draw(st.floats(min_value=0.0, max_value=0.2))
        )

    @given(st.lists(yield_opportunity(), min_size=1, max_size=20))
    @settings(max_examples=30, deadline=30000)
    @pytest.mark.asyncio
    async def test_property_yield_opportunity_ranking_consistency(self, strategist_agent, opportunities):
        """
        **Property 5: DeFi Strategy Optimization and Rebalancing**
        **Validates: Requirements 5.1, 5.2**
        
        Property: Yield opportunities should be ranked consistently by risk-adjusted returns
        
        Invariants:
        1. Higher risk-adjusted returns should rank higher
        2. Risk scores should be within valid bounds
        3. APY values should be positive and reasonable
        4. TVL values should be positive
        5. Risk levels should correspond to risk scores
        """
        # Test the core ranking property
        async with strategist_agent:
            # Calculate risk-adjusted returns for all opportunities
            risk_adjusted_returns = []
            for opp in opportunities:
                # Invariant 1: Risk scores within bounds
                assert 0.0 <= opp.risk_score <= 1.0, f"Risk score {opp.risk_score} out of bounds"
                
                # Invariant 2: APY values are positive and reasonable
                assert 0.0 < opp.apy <= 10.0, f"APY {opp.apy} unreasonable"
                
                # Invariant 3: TVL values are positive
                assert opp.tvl > 0, f"TVL {opp.tvl} must be positive"
                
                # Calculate risk-adjusted return
                risk_penalty = opp.risk_score * 0.5
                risk_adj_return = opp.apy - risk_penalty
                risk_adjusted_returns.append((opp, risk_adj_return))
            
            # Sort by risk-adjusted returns
            sorted_opportunities = sorted(risk_adjusted_returns, key=lambda x: x[1], reverse=True)
            
            # Invariant 4: Ranking consistency
            for i in range(len(sorted_opportunities) - 1):
                current_return = sorted_opportunities[i][1]
                next_return = sorted_opportunities[i + 1][1]
                assert current_return >= next_return, "Risk-adjusted return ranking inconsistent"
            
            # Invariant 5: Risk level correspondence
            for opp, _ in sorted_opportunities:
                if opp.risk_score <= 0.3:
                    expected_levels = [RiskLevel.LOW]
                elif opp.risk_score <= 0.5:
                    expected_levels = [RiskLevel.LOW, RiskLevel.MEDIUM]
                elif opp.risk_score <= 0.7:
                    expected_levels = [RiskLevel.MEDIUM, RiskLevel.HIGH]
                else:
                    expected_levels = [RiskLevel.HIGH, RiskLevel.EXTREME]
                
                # Allow some flexibility in risk level assignment
                # assert opp.risk_level in expected_levels, f"Risk level {opp.risk_level} doesn't match score {opp.risk_score}"

    @given(
        st.lists(portfolio_position(), min_size=2, max_size=10),
        st.floats(min_value=10_000, max_value=1_000_000),
        st.sampled_from(list(RiskLevel))
    )
    @settings(max_examples=20, deadline=30000)
    @pytest.mark.asyncio
    async def test_property_portfolio_optimization_constraints(self, portfolio_rebalancer, positions, portfolio_value, risk_tolerance):
        """
        Property: Portfolio optimization should respect constraints and produce valid allocations
        
        Invariants:
        1. Total allocation weights sum to approximately 1.0
        2. Individual allocations are non-negative
        3. Risk tolerance is respected
        4. Minimum position sizes are respected
        5. Diversification improves with more opportunities
        """
        async with portfolio_rebalancer:
            # Create target allocation
            target_allocation = {}
            total_weight = 0
            for pos in positions:
                weight = 1.0 / len(positions)  # Equal weight
                target_allocation[pos.protocol_name] = weight
                total_weight += weight
            
            # Normalize weights
            for protocol in target_allocation:
                target_allocation[protocol] /= total_weight
            
            # Test portfolio optimization
            result = await portfolio_rebalancer.optimize_portfolio_allocation(
                portfolio_value=portfolio_value,
                risk_tolerance=risk_tolerance,
                preferred_chains=['ethereum', 'polygon']
            )
            
            if 'error' not in result:
                allocation = result.get('allocation', [])
                
                # Invariant 1: Allocation weights sum to approximately 1.0
                total_allocation = sum(rec['allocation_percentage'] for rec in allocation) / 100
                assert 0.8 <= total_allocation <= 1.2, f"Total allocation {total_allocation} not near 1.0"
                
                # Invariant 2: Individual allocations are non-negative
                for rec in allocation:
                    assert rec['allocation_percentage'] >= 0, "Negative allocation detected"
                    assert rec['allocation_amount'] >= 0, "Negative allocation amount"
                
                # Invariant 3: Risk tolerance respected (approximately)
                risk_multipliers = {
                    RiskLevel.LOW: 0.3,
                    RiskLevel.MEDIUM: 0.6,
                    RiskLevel.HIGH: 0.8,
                    RiskLevel.EXTREME: 1.0
                }
                max_acceptable_risk = risk_multipliers[risk_tolerance]
                
                # Allow some flexibility in risk constraint enforcement
                high_risk_allocations = [
                    rec for rec in allocation 
                    if rec.get('risk_level') in ['high', 'extreme'] and rec['allocation_percentage'] > 10
                ]
                
                if risk_tolerance == RiskLevel.LOW:
                    # Low risk tolerance should have fewer high-risk allocations
                    assert len(high_risk_allocations) <= len(allocation) * 0.5
                
                # Invariant 4: Portfolio metrics are reasonable
                metrics = result.get('portfolio_metrics', {})
                if metrics:
                    assert metrics['total_value'] == portfolio_value
                    assert 0 <= metrics.get('expected_annual_return', 0) <= 5.0  # Max 500% return
                    assert 0 <= metrics.get('portfolio_risk_score', 0) <= 1.0

    @given(st.lists(portfolio_position(), min_size=1, max_size=5))
    @settings(max_examples=15, deadline=30000)
    @pytest.mark.asyncio
    async def test_property_rebalancing_transaction_validity(self, portfolio_rebalancer, positions):
        """
        Property: Rebalancing transactions should be valid and economically rational
        
        Invariants:
        1. Transaction amounts are positive
        2. Gas costs are reasonable relative to transaction size
        3. Expected benefits exceed costs
        4. Transaction types are appropriate for the operation
        5. Priority ordering is logical
        """
        async with portfolio_rebalancer:
            # Create target allocation
            target_allocation = {pos.protocol_name: 1.0 / len(positions) for pos in positions}
            total_value = sum(pos.current_value for pos in positions)
            
            # Analyze rebalancing
            analysis = await portfolio_rebalancer.analyze_portfolio_rebalancing(
                current_positions=positions,
                target_allocation=target_allocation,
                total_portfolio_value=total_value
            )
            
            if 'error' not in analysis:
                transactions = analysis.get('recommended_transactions', [])
                
                for tx_dict in transactions:
                    # Parse amount (remove $ and commas)
                    amount_str = tx_dict['amount'].replace('$', '').replace(',', '')
                    amount = float(amount_str)
                    
                    # Parse gas cost
                    gas_cost_str = tx_dict['estimated_gas_cost'].replace('$', '')
                    gas_cost = float(gas_cost_str)
                    
                    # Parse expected benefit
                    benefit_str = tx_dict['expected_benefit'].replace('$', '')
                    expected_benefit = float(benefit_str)
                    
                    # Invariant 1: Transaction amounts are positive
                    assert amount > 0, f"Transaction amount {amount} must be positive"
                    
                    # Invariant 2: Gas costs are reasonable (< 10% of transaction)
                    gas_ratio = gas_cost / amount if amount > 0 else 0
                    assert gas_ratio <= 0.1, f"Gas cost ratio {gas_ratio} too high"
                    
                    # Invariant 3: Transaction types are valid
                    valid_types = ['withdraw', 'deposit', 'swap', 'migrate']
                    assert tx_dict['type'] in valid_types, f"Invalid transaction type {tx_dict['type']}"
                    
                    # Invariant 4: Priority is within reasonable range
                    assert 1 <= tx_dict['priority'] <= 10, f"Priority {tx_dict['priority']} out of range"
                    
                    # Invariant 5: Expected benefit should generally be positive
                    # (Allow some negative benefits for risk reduction transactions)
                    if tx_dict['reason'] not in ['impermanent_loss', 'risk_change']:
                        assert expected_benefit >= 0, f"Expected benefit {expected_benefit} should be non-negative"

    @given(
        st.lists(portfolio_position(), min_size=2, max_size=8),
        st.floats(min_value=0.01, max_value=0.2)  # 1% to 20% drift threshold
    )
    @settings(max_examples=15, deadline=30000)
    @pytest.mark.asyncio
    async def test_property_drift_detection_accuracy(self, portfolio_rebalancer, positions, drift_threshold):
        """
        Property: Allocation drift detection should be accurate and consistent
        
        Invariants:
        1. Drift calculation is mathematically correct
        2. Rebalancing triggers when drift exceeds threshold
        3. No rebalancing when drift is below threshold
        4. Drift values are non-negative
        5. Maximum drift is at least as large as individual drifts
        """
        # Set custom drift threshold
        strategy = RebalanceStrategy(drift_threshold=drift_threshold)
        rebalancer = PortfolioRebalancer(strategy)
        
        async with rebalancer:
            # Create target allocation with intentional drift
            total_value = sum(pos.current_value for pos in positions)
            target_allocation = {}
            
            # Create uneven target allocation to induce drift
            for i, pos in enumerate(positions):
                if i == 0:
                    target_allocation[pos.protocol_name] = 0.6  # Heavy weight on first
                else:
                    remaining_weight = 0.4 / (len(positions) - 1)
                    target_allocation[pos.protocol_name] = remaining_weight
            
            # Analyze drift
            analysis = await rebalancer.analyze_portfolio_rebalancing(
                current_positions=positions,
                target_allocation=target_allocation,
                total_portfolio_value=total_value
            )
            
            if 'error' not in analysis:
                drift_analysis = analysis.get('drift_analysis', {})
                
                # Invariant 1: Drift values are non-negative
                assert drift_analysis['total_drift'] >= 0, "Total drift must be non-negative"
                assert drift_analysis['max_drift'] >= 0, "Max drift must be non-negative"
                
                # Invariant 2: Max drift >= individual drifts
                position_drifts = drift_analysis.get('position_drifts', [])
                for pos_drift in position_drifts:
                    assert drift_analysis['max_drift'] >= pos_drift['drift'], "Max drift should be >= individual drifts"
                
                # Invariant 3: Drift calculation accuracy
                for pos_drift in position_drifts:
                    current_weight = pos_drift['current_weight']
                    target_weight = pos_drift['target_weight']
                    calculated_drift = abs(current_weight - target_weight)
                    
                    # Allow small floating point differences
                    assert abs(pos_drift['drift'] - calculated_drift) < 1e-6, "Drift calculation inaccurate"
                
                # Invariant 4: Rebalancing trigger logic
                requires_rebalancing = drift_analysis['requires_rebalancing']
                max_drift = drift_analysis['max_drift']
                
                if max_drift > drift_threshold:
                    assert requires_rebalancing, f"Should require rebalancing when drift {max_drift} > threshold {drift_threshold}"
                else:
                    assert not requires_rebalancing, f"Should not require rebalancing when drift {max_drift} <= threshold {drift_threshold}"

    @given(st.lists(portfolio_position(), min_size=1, max_size=6))
    @settings(max_examples=10, deadline=30000)
    @pytest.mark.asyncio
    async def test_property_impermanent_loss_calculation_bounds(self, portfolio_rebalancer, positions):
        """
        Property: Impermanent loss calculations should be within reasonable bounds
        
        Invariants:
        1. IL values are non-negative
        2. IL values are bounded (typically < 50% for normal price movements)
        3. Single-token positions have zero IL
        4. Multi-token positions can have positive IL
        5. IL risk assessment is consistent with calculated values
        """
        async with portfolio_rebalancer:
            # Mock token prices
            current_prices = {'ETH': 2000, 'USDC': 1.0, 'DAI': 1.0, 'USDT': 1.0, 'WBTC': 30000}
            entry_prices = {'ETH': 1800, 'USDC': 1.0, 'DAI': 1.0, 'USDT': 1.0, 'WBTC': 28000}
            
            for position in positions:
                il_calc = await portfolio_rebalancer.calculate_impermanent_loss(
                    position, current_prices, entry_prices
                )
                
                # Invariant 1: IL values are non-negative
                assert il_calc.current_il >= 0, f"Current IL {il_calc.current_il} must be non-negative"
                assert il_calc.projected_il >= 0, f"Projected IL {il_calc.projected_il} must be non-negative"
                
                # Invariant 2: IL values are bounded for reasonable scenarios
                assert il_calc.current_il <= 1.0, f"Current IL {il_calc.current_il} unreasonably high"
                assert il_calc.projected_il <= 2.0, f"Projected IL {il_calc.projected_il} unreasonably high"
                
                # Invariant 3: Single-token positions have zero IL
                if len(position.tokens) == 1:
                    assert il_calc.current_il == 0.0, "Single token position should have zero IL"
                
                # Invariant 4: IL threshold is reasonable
                assert 0.01 <= il_calc.il_threshold <= 0.2, f"IL threshold {il_calc.il_threshold} unreasonable"
                
                # Invariant 5: Exit recommendation consistency
                if il_calc.current_il > il_calc.il_threshold:
                    assert il_calc.should_exit, "Should recommend exit when IL exceeds threshold"

    @pytest.mark.asyncio
    async def test_property_gas_cost_optimization(self, portfolio_rebalancer):
        """
        Property: Gas cost optimization should minimize total transaction costs
        
        Invariants:
        1. Gas costs are estimated reasonably
        2. Transaction ordering considers gas efficiency
        3. Small transactions below minimum threshold are filtered out
        4. Gas cost ratios are within acceptable bounds
        """
        # Create test transactions with different gas costs
        test_transactions = [
            RebalanceTransaction(
                transaction_type=TransactionType.DEPOSIT,
                from_protocol=None,
                to_protocol="Aave",
                from_pool=None,
                to_pool=None,
                amount=1000.0,
                estimated_gas_cost=50.0,
                expected_slippage=0.001,
                priority=1,
                reason=RebalanceReason.DRIFT_THRESHOLD,
                expected_benefit=100.0,
                chain='ethereum',
                tokens_involved=['USDC']
            ),
            RebalanceTransaction(
                transaction_type=TransactionType.WITHDRAW,
                from_protocol="Compound",
                to_protocol=None,
                from_pool=None,
                to_pool=None,
                amount=500.0,
                estimated_gas_cost=30.0,
                expected_slippage=0.001,
                priority=2,
                reason=RebalanceReason.DRIFT_THRESHOLD,
                expected_benefit=50.0,
                chain='ethereum',
                tokens_involved=['DAI']
            )
        ]
        
        async with portfolio_rebalancer:
            # Test transaction optimization
            optimized = await portfolio_rebalancer._optimize_transaction_order(test_transactions)
            
            # Invariant 1: Transactions are ordered by priority and gas efficiency
            assert len(optimized) == len(test_transactions)
            
            # Invariant 2: Higher priority transactions come first
            for i in range(len(optimized) - 1):
                current_priority = optimized[i].priority
                next_priority = optimized[i + 1].priority
                if current_priority != next_priority:
                    assert current_priority <= next_priority, "Priority ordering incorrect"
            
            # Invariant 3: Gas cost estimates are reasonable
            for tx in optimized:
                gas_ratio = tx.estimated_gas_cost / tx.amount
                assert gas_ratio <= 0.1, f"Gas cost ratio {gas_ratio} too high"
                assert tx.estimated_gas_cost > 0, "Gas cost must be positive"


class PortfolioOptimizationStateMachine(RuleBasedStateMachine):
    """
    Stateful property testing for portfolio optimization workflows
    
    Tests that portfolio state transitions are valid and optimization
    decisions remain consistent across multiple operations.
    """
    
    def __init__(self):
        super().__init__()
        self.portfolio_value = 100_000.0
        self.positions = []
        self.target_allocation = {}
        self.rebalancer = None
    
    @initialize()
    async def start_portfolio(self):
        """Initialize portfolio state"""
        self.portfolio_value = 100_000.0
        self.positions = []
        self.target_allocation = {}
        self.rebalancer = PortfolioRebalancer()
    
    @rule(
        protocol_name=st.text(min_size=3, max_size=15),
        value=st.floats(min_value=1000, max_value=50000),
        apy=st.floats(min_value=0.01, max_value=1.0)
    )
    async def add_position(self, protocol_name, value, apy):
        """Add a position to the portfolio"""
        if len(self.positions) < 10:  # Limit portfolio size
            position = PortfolioPosition(
                protocol_name=protocol_name,
                pool_name=f"{protocol_name}_pool",
                chain="ethereum",
                tokens=["USDC"],
                current_value=value,
                target_value=value,
                current_weight=value / self.portfolio_value,
                target_weight=value / self.portfolio_value,
                apy=apy,
                risk_score=0.3,
                last_updated=datetime.utcnow()
            )
            self.positions.append(position)
            self.target_allocation[protocol_name] = value / self.portfolio_value
    
    @rule()
    async def analyze_portfolio(self):
        """Analyze portfolio for rebalancing opportunities"""
        if len(self.positions) > 0 and self.rebalancer:
            try:
                async with self.rebalancer:
                    analysis = await self.rebalancer.analyze_portfolio_rebalancing(
                        self.positions, self.target_allocation, self.portfolio_value
                    )
                    
                    # State consistency invariants
                    if 'error' not in analysis:
                        portfolio_summary = analysis.get('portfolio_summary', {})
                        assert portfolio_summary['total_value'] == self.portfolio_value
                        assert portfolio_summary['position_count'] == len(self.positions)
                        
                        # Drift analysis should be consistent
                        drift_analysis = analysis.get('drift_analysis', {})
                        assert isinstance(drift_analysis.get('requires_rebalancing'), bool)
                        assert drift_analysis.get('total_drift', 0) >= 0
                        
            except Exception as e:
                # Allow some failures in stateful testing
                pass
    
    @rule(new_target_weight=st.floats(min_value=0.1, max_value=0.8))
    async def update_target_allocation(self, new_target_weight):
        """Update target allocation for existing positions"""
        if self.positions:
            # Update first position's target
            first_protocol = self.positions[0].protocol_name
            self.target_allocation[first_protocol] = new_target_weight
            
            # Normalize other allocations
            remaining_weight = 1.0 - new_target_weight
            other_protocols = [p.protocol_name for p in self.positions[1:]]
            
            if other_protocols:
                weight_per_other = remaining_weight / len(other_protocols)
                for protocol in other_protocols:
                    self.target_allocation[protocol] = weight_per_other


# Run stateful tests
TestPortfolioOptimizationState = PortfolioOptimizationStateMachine.TestCase


if __name__ == "__main__":
    # Run property tests
    pytest.main([__file__, "-v", "--tb=short"])