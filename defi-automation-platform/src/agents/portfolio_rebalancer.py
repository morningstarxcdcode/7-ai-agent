"""
Portfolio Rebalancing Algorithms

Implements automated rebalancing logic considering gas costs,
impermanent loss calculation for liquidity positions, and
cross-protocol arbitrage detection and execution.

Requirements: 5.1, 5.2
"""

import asyncio
import aiohttp
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
import structlog
import numpy as np
from decimal import Decimal, ROUND_HALF_UP

from .defi_strategist import DeFiStrategistAgent, YieldOpportunity, RiskLevel

logger = structlog.get_logger()

class RebalanceReason(str, Enum):
    """Reasons for portfolio rebalancing"""
    DRIFT_THRESHOLD = "drift_threshold"
    APY_CHANGE = "apy_change"
    RISK_CHANGE = "risk_change"
    NEW_OPPORTUNITY = "new_opportunity"
    GAS_OPTIMIZATION = "gas_optimization"
    IMPERMANENT_LOSS = "impermanent_loss"
    SCHEDULED = "scheduled"

class TransactionType(str, Enum):
    """Types of rebalancing transactions"""
    WITHDRAW = "withdraw"
    DEPOSIT = "deposit"
    SWAP = "swap"
    MIGRATE = "migrate"

@dataclass
class PortfolioPosition:
    """Represents a current portfolio position"""
    protocol_name: str
    pool_name: str
    chain: str
    tokens: List[str]
    current_value: float
    target_value: float
    current_weight: float
    target_weight: float
    apy: float
    risk_score: float
    last_updated: datetime
    entry_price: Optional[float] = None
    impermanent_loss: float = 0.0
    gas_cost_to_exit: float = 0.0

@dataclass
class RebalanceTransaction:
    """Represents a rebalancing transaction"""
    transaction_type: TransactionType
    from_protocol: Optional[str]
    to_protocol: Optional[str]
    from_pool: Optional[str]
    to_pool: Optional[str]
    amount: float
    estimated_gas_cost: float
    expected_slippage: float
    priority: int
    reason: RebalanceReason
    expected_benefit: float
    chain: str
    tokens_involved: List[str]

@dataclass
class RebalanceStrategy:
    """Rebalancing strategy configuration"""
    drift_threshold: float = 0.05  # 5% drift threshold
    min_rebalance_amount: float = 100.0  # Minimum $100 to rebalance
    max_gas_cost_ratio: float = 0.02  # Max 2% of transaction in gas
    rebalance_frequency: timedelta = timedelta(days=7)
    apy_change_threshold: float = 0.20  # 20% APY change triggers rebalance
    risk_change_threshold: float = 0.15  # 15% risk change triggers rebalance
    max_slippage: float = 0.005  # 0.5% max slippage
    enable_cross_protocol_arbitrage: bool = True
    enable_gas_optimization: bool = True

@dataclass
class ImpermanentLossCalculation:
    """Impermanent loss calculation result"""
    current_il: float
    projected_il: float
    il_threshold: float
    should_exit: bool
    alternative_strategies: List[str]

class PortfolioRebalancer:
    """
    Portfolio Rebalancing Engine
    
    Implements automated rebalancing logic with gas cost optimization,
    impermanent loss monitoring, and cross-protocol arbitrage detection.
    """
    
    def __init__(self, strategy: Optional[RebalanceStrategy] = None):
        self.strategy = strategy or RebalanceStrategy()
        self.defi_strategist = DeFiStrategistAgent()
        self.session: Optional[aiohttp.ClientSession] = None
        
        # Gas price APIs
        self.gas_apis = {
            'ethereum': 'https://api.etherscan.io/api?module=gastracker&action=gasoracle',
            'polygon': 'https://api.polygonscan.com/api?module=gastracker&action=gasoracle',
            'arbitrum': 'https://api.arbiscan.io/api?module=gastracker&action=gasoracle'
        }
        
        # Price APIs for impermanent loss calculations
        self.price_apis = {
            'coingecko': 'https://api.coingecko.com/api/v3',
            'defipulse': 'https://data-api.defipulse.com/api/v1'
        }
        
        # Cache for gas prices and token prices
        self.gas_price_cache: Dict[str, Dict[str, Any]] = {}
        self.token_price_cache: Dict[str, float] = {}
        self.cache_expiry = timedelta(minutes=5)
        self.last_price_update = datetime.min
    
    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30)
        )
        await self.defi_strategist.__aenter__()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()
        await self.defi_strategist.__aexit__(exc_type, exc_val, exc_tb)
    
    async def analyze_portfolio_rebalancing(self, 
                                          current_positions: List[PortfolioPosition],
                                          target_allocation: Dict[str, float],
                                          total_portfolio_value: float) -> Dict[str, Any]:
        """
        Analyze portfolio and generate rebalancing recommendations
        
        Args:
            current_positions: Current portfolio positions
            target_allocation: Target allocation weights by protocol
            total_portfolio_value: Total portfolio value in USD
            
        Returns:
            Comprehensive rebalancing analysis and recommendations
        """
        try:
            logger.info("Starting portfolio rebalancing analysis",
                       positions=len(current_positions),
                       portfolio_value=total_portfolio_value)
            
            # Update price and gas data
            await self._update_market_data()
            
            # Calculate current allocation drift
            drift_analysis = await self._analyze_allocation_drift(
                current_positions, target_allocation, total_portfolio_value
            )
            
            # Analyze impermanent loss for LP positions
            il_analysis = await self._analyze_impermanent_loss(current_positions)
            
            # Check for better yield opportunities
            opportunity_analysis = await self._analyze_new_opportunities(current_positions)
            
            # Generate rebalancing transactions
            transactions = await self._generate_rebalancing_transactions(
                current_positions, target_allocation, total_portfolio_value,
                drift_analysis, il_analysis, opportunity_analysis
            )
            
            # Optimize transaction order for gas efficiency
            optimized_transactions = await self._optimize_transaction_order(transactions)
            
            # Calculate expected benefits and costs
            cost_benefit = await self._calculate_cost_benefit_analysis(optimized_transactions)
            
            # Generate final recommendations
            recommendations = await self._generate_recommendations(
                drift_analysis, il_analysis, opportunity_analysis,
                optimized_transactions, cost_benefit
            )
            
            return {
                'analysis_timestamp': datetime.utcnow().isoformat(),
                'portfolio_summary': {
                    'total_value': total_portfolio_value,
                    'position_count': len(current_positions),
                    'drift_detected': drift_analysis['requires_rebalancing'],
                    'il_risk_positions': len(il_analysis['high_risk_positions']),
                    'new_opportunities': len(opportunity_analysis['better_opportunities'])
                },
                'drift_analysis': drift_analysis,
                'impermanent_loss_analysis': il_analysis,
                'opportunity_analysis': opportunity_analysis,
                'recommended_transactions': [self._transaction_to_dict(tx) for tx in optimized_transactions],
                'cost_benefit_analysis': cost_benefit,
                'recommendations': recommendations,
                'next_review_date': (datetime.utcnow() + self.strategy.rebalance_frequency).isoformat()
            }
            
        except Exception as e:
            logger.error("Portfolio rebalancing analysis failed", error=str(e))
            return {'error': f'Rebalancing analysis failed: {str(e)}'}
    
    async def execute_rebalancing(self, 
                                transactions: List[RebalanceTransaction],
                                dry_run: bool = True) -> Dict[str, Any]:
        """
        Execute rebalancing transactions
        
        Args:
            transactions: List of transactions to execute
            dry_run: If True, simulate without actual execution
            
        Returns:
            Execution results and status
        """
        try:
            logger.info("Starting rebalancing execution",
                       transaction_count=len(transactions),
                       dry_run=dry_run)
            
            execution_results = []
            total_gas_cost = 0
            total_benefit = 0
            
            for i, transaction in enumerate(transactions):
                try:
                    if dry_run:
                        # Simulate transaction
                        result = await self._simulate_transaction(transaction)
                    else:
                        # Execute actual transaction (would integrate with Web3)
                        result = await self._execute_transaction(transaction)
                    
                    execution_results.append({
                        'transaction_index': i,
                        'transaction': self._transaction_to_dict(transaction),
                        'result': result,
                        'status': 'success' if result['success'] else 'failed'
                    })
                    
                    if result['success']:
                        total_gas_cost += result.get('gas_cost', 0)
                        total_benefit += result.get('benefit', 0)
                    
                except Exception as e:
                    logger.error("Transaction execution failed", 
                               transaction_index=i, error=str(e))
                    execution_results.append({
                        'transaction_index': i,
                        'transaction': self._transaction_to_dict(transaction),
                        'result': {'success': False, 'error': str(e)},
                        'status': 'failed'
                    })
            
            success_count = sum(1 for r in execution_results if r['status'] == 'success')
            
            return {
                'execution_summary': {
                    'total_transactions': len(transactions),
                    'successful_transactions': success_count,
                    'failed_transactions': len(transactions) - success_count,
                    'total_gas_cost': total_gas_cost,
                    'total_expected_benefit': total_benefit,
                    'net_benefit': total_benefit - total_gas_cost,
                    'dry_run': dry_run
                },
                'transaction_results': execution_results,
                'execution_timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error("Rebalancing execution failed", error=str(e))
            return {'error': f'Rebalancing execution failed: {str(e)}'}
    
    async def calculate_impermanent_loss(self, 
                                       position: PortfolioPosition,
                                       current_prices: Dict[str, float],
                                       entry_prices: Dict[str, float]) -> ImpermanentLossCalculation:
        """
        Calculate impermanent loss for a liquidity position
        
        Args:
            position: Portfolio position to analyze
            current_prices: Current token prices
            entry_prices: Token prices at entry
            
        Returns:
            Impermanent loss calculation result
        """
        try:
            if len(position.tokens) < 2:
                # Single token position has no impermanent loss
                return ImpermanentLossCalculation(
                    current_il=0.0,
                    projected_il=0.0,
                    il_threshold=0.05,
                    should_exit=False,
                    alternative_strategies=[]
                )
            
            # Calculate impermanent loss for two-token pool
            token_a, token_b = position.tokens[0], position.tokens[1]
            
            if token_a not in current_prices or token_b not in current_prices:
                logger.warning("Missing price data for IL calculation", 
                             tokens=position.tokens)
                return ImpermanentLossCalculation(
                    current_il=0.0,
                    projected_il=0.0,
                    il_threshold=0.05,
                    should_exit=False,
                    alternative_strategies=["Insufficient price data"]
                )
            
            # Price ratios
            current_ratio = current_prices[token_a] / current_prices[token_b]
            entry_ratio = entry_prices.get(token_a, current_prices[token_a]) / entry_prices.get(token_b, current_prices[token_b])
            
            # Impermanent loss formula for 50/50 pools
            price_ratio_change = current_ratio / entry_ratio
            il = 2 * np.sqrt(price_ratio_change) / (1 + price_ratio_change) - 1
            current_il = abs(il)
            
            # Project future IL based on volatility
            volatility = await self._estimate_token_volatility(position.tokens)
            projected_il = current_il * (1 + volatility)
            
            # Determine if should exit
            il_threshold = 0.05  # 5% IL threshold
            should_exit = current_il > il_threshold or projected_il > il_threshold * 1.5
            
            # Generate alternative strategies
            alternatives = []
            if should_exit:
                alternatives.extend([
                    "Exit liquidity position and stake single tokens",
                    "Switch to correlated token pairs",
                    "Use impermanent loss protection protocols"
                ])
            
            return ImpermanentLossCalculation(
                current_il=current_il,
                projected_il=projected_il,
                il_threshold=il_threshold,
                should_exit=should_exit,
                alternative_strategies=alternatives
            )
            
        except Exception as e:
            logger.error("Impermanent loss calculation failed", error=str(e))
            return ImpermanentLossCalculation(
                current_il=0.0,
                projected_il=0.0,
                il_threshold=0.05,
                should_exit=False,
                alternative_strategies=[f"Calculation error: {str(e)}"]
            )
    
    async def detect_arbitrage_opportunities(self, 
                                           current_positions: List[PortfolioPosition]) -> List[Dict[str, Any]]:
        """
        Detect cross-protocol arbitrage opportunities
        
        Args:
            current_positions: Current portfolio positions
            
        Returns:
            List of arbitrage opportunities
        """
        try:
            if not self.strategy.enable_cross_protocol_arbitrage:
                return []
            
            opportunities = []
            
            # Get current yield opportunities
            yield_opportunities = await self.defi_strategist.analyze_yield_opportunities()
            
            # Group by token pairs
            token_pair_opportunities = {}
            for opp in yield_opportunities:
                token_key = tuple(sorted(opp.tokens))
                if token_key not in token_pair_opportunities:
                    token_pair_opportunities[token_key] = []
                token_pair_opportunities[token_key].append(opp)
            
            # Find arbitrage opportunities
            for token_pair, opps in token_pair_opportunities.items():
                if len(opps) < 2:
                    continue
                
                # Sort by APY
                opps.sort(key=lambda x: x.apy, reverse=True)
                best_opp = opps[0]
                
                # Check if we have positions in lower-yielding protocols
                for position in current_positions:
                    position_tokens = tuple(sorted(position.tokens))
                    if position_tokens == token_pair and position.apy < best_opp.apy:
                        
                        # Calculate potential benefit
                        apy_difference = best_opp.apy - position.apy
                        annual_benefit = position.current_value * apy_difference
                        
                        # Estimate migration costs
                        migration_cost = await self._estimate_migration_cost(
                            position, best_opp
                        )
                        
                        # Check if profitable
                        if annual_benefit > migration_cost * 4:  # 3-month payback
                            opportunities.append({
                                'type': 'yield_arbitrage',
                                'from_protocol': position.protocol_name,
                                'to_protocol': best_opp.protocol_name,
                                'from_apy': position.apy,
                                'to_apy': best_opp.apy,
                                'apy_difference': apy_difference,
                                'position_value': position.current_value,
                                'annual_benefit': annual_benefit,
                                'migration_cost': migration_cost,
                                'payback_period_days': (migration_cost / annual_benefit) * 365,
                                'tokens': list(token_pair),
                                'risk_change': best_opp.risk_score - position.risk_score
                            })
            
            return opportunities
            
        except Exception as e:
            logger.error("Arbitrage detection failed", error=str(e))
            return []
    
    async def _update_market_data(self):
        """Update gas prices and token prices"""
        if datetime.utcnow() - self.last_price_update < self.cache_expiry:
            return
        
        try:
            # Update gas prices
            await self._update_gas_prices()
            
            # Update token prices
            await self._update_token_prices()
            
            self.last_price_update = datetime.utcnow()
            
        except Exception as e:
            logger.error("Market data update failed", error=str(e))
    
    async def _update_gas_prices(self):
        """Update gas prices for different chains"""
        for chain, api_url in self.gas_apis.items():
            try:
                async with self.session.get(api_url) as response:
                    if response.status == 200:
                        data = await response.json()
                        self.gas_price_cache[chain] = {
                            'standard': float(data.get('result', {}).get('SafeGasPrice', 20)),
                            'fast': float(data.get('result', {}).get('FastGasPrice', 25)),
                            'instant': float(data.get('result', {}).get('ProposeGasPrice', 30)),
                            'timestamp': datetime.utcnow()
                        }
            except Exception as e:
                logger.warning("Failed to update gas prices", chain=chain, error=str(e))
                # Use default values
                self.gas_price_cache[chain] = {
                    'standard': 20, 'fast': 25, 'instant': 30,
                    'timestamp': datetime.utcnow()
                }
    
    async def _update_token_prices(self):
        """Update token prices from CoinGecko"""
        try:
            # Get top 100 tokens by market cap
            url = f"{self.price_apis['coingecko']}/coins/markets"
            params = {
                'vs_currency': 'usd',
                'order': 'market_cap_desc',
                'per_page': 100,
                'page': 1
            }
            
            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    for token in data:
                        symbol = token['symbol'].upper()
                        self.token_price_cache[symbol] = float(token['current_price'])
                        
        except Exception as e:
            logger.warning("Failed to update token prices", error=str(e))
    
    async def _analyze_allocation_drift(self, 
                                      positions: List[PortfolioPosition],
                                      target_allocation: Dict[str, float],
                                      total_value: float) -> Dict[str, Any]:
        """Analyze allocation drift from target"""
        drift_analysis = {
            'requires_rebalancing': False,
            'total_drift': 0.0,
            'position_drifts': [],
            'max_drift': 0.0,
            'drift_threshold': self.strategy.drift_threshold
        }
        
        for position in positions:
            current_weight = position.current_value / total_value
            target_weight = target_allocation.get(position.protocol_name, 0.0)
            drift = abs(current_weight - target_weight)
            
            drift_analysis['position_drifts'].append({
                'protocol': position.protocol_name,
                'current_weight': current_weight,
                'target_weight': target_weight,
                'drift': drift,
                'requires_rebalancing': drift > self.strategy.drift_threshold
            })
            
            drift_analysis['total_drift'] += drift
            drift_analysis['max_drift'] = max(drift_analysis['max_drift'], drift)
        
        drift_analysis['requires_rebalancing'] = drift_analysis['max_drift'] > self.strategy.drift_threshold
        
        return drift_analysis
    
    async def _analyze_impermanent_loss(self, positions: List[PortfolioPosition]) -> Dict[str, Any]:
        """Analyze impermanent loss for all positions"""
        il_analysis = {
            'total_il_exposure': 0.0,
            'high_risk_positions': [],
            'recommendations': []
        }
        
        for position in positions:
            if len(position.tokens) > 1:  # Only LP positions have IL risk
                # Estimate current IL (simplified)
                estimated_il = position.impermanent_loss
                il_analysis['total_il_exposure'] += estimated_il * position.current_value
                
                if estimated_il > 0.05:  # 5% IL threshold
                    il_analysis['high_risk_positions'].append({
                        'protocol': position.protocol_name,
                        'pool': position.pool_name,
                        'estimated_il': estimated_il,
                        'value_at_risk': estimated_il * position.current_value,
                        'recommendation': 'Consider exiting position'
                    })
        
        return il_analysis
    
    async def _analyze_new_opportunities(self, positions: List[PortfolioPosition]) -> Dict[str, Any]:
        """Analyze new yield opportunities"""
        current_protocols = {pos.protocol_name for pos in positions}
        
        # Get latest opportunities
        opportunities = await self.defi_strategist.analyze_yield_opportunities()
        
        better_opportunities = []
        for opp in opportunities:
            if opp.protocol_name not in current_protocols:
                # Find comparable current positions
                for position in positions:
                    if (set(position.tokens) == set(opp.tokens) and 
                        opp.apy > position.apy * 1.2):  # 20% better APY
                        
                        better_opportunities.append({
                            'new_protocol': opp.protocol_name,
                            'current_protocol': position.protocol_name,
                            'apy_improvement': opp.apy - position.apy,
                            'risk_change': opp.risk_score - position.risk_score,
                            'tokens': opp.tokens
                        })
        
        return {
            'better_opportunities': better_opportunities,
            'total_potential_improvement': sum(
                opp['apy_improvement'] for opp in better_opportunities
            )
        }
    
    async def _generate_rebalancing_transactions(self, 
                                               positions: List[PortfolioPosition],
                                               target_allocation: Dict[str, float],
                                               total_value: float,
                                               drift_analysis: Dict[str, Any],
                                               il_analysis: Dict[str, Any],
                                               opportunity_analysis: Dict[str, Any]) -> List[RebalanceTransaction]:
        """Generate rebalancing transactions"""
        transactions = []
        
        # Handle allocation drift
        for drift in drift_analysis['position_drifts']:
            if drift['requires_rebalancing']:
                current_value = drift['current_weight'] * total_value
                target_value = drift['target_weight'] * total_value
                amount_diff = target_value - current_value
                
                if abs(amount_diff) > self.strategy.min_rebalance_amount:
                    if amount_diff > 0:
                        # Need to increase position
                        transactions.append(RebalanceTransaction(
                            transaction_type=TransactionType.DEPOSIT,
                            from_protocol=None,
                            to_protocol=drift['protocol'],
                            from_pool=None,
                            to_pool=None,
                            amount=amount_diff,
                            estimated_gas_cost=await self._estimate_gas_cost('deposit', amount_diff),
                            expected_slippage=0.001,
                            priority=1,
                            reason=RebalanceReason.DRIFT_THRESHOLD,
                            expected_benefit=amount_diff * 0.1,  # Estimated benefit
                            chain='ethereum',  # Default chain
                            tokens_involved=[]
                        ))
                    else:
                        # Need to decrease position
                        transactions.append(RebalanceTransaction(
                            transaction_type=TransactionType.WITHDRAW,
                            from_protocol=drift['protocol'],
                            to_protocol=None,
                            from_pool=None,
                            to_pool=None,
                            amount=abs(amount_diff),
                            estimated_gas_cost=await self._estimate_gas_cost('withdraw', abs(amount_diff)),
                            expected_slippage=0.001,
                            priority=1,
                            reason=RebalanceReason.DRIFT_THRESHOLD,
                            expected_benefit=abs(amount_diff) * 0.05,
                            chain='ethereum',
                            tokens_involved=[]
                        ))
        
        # Handle high IL positions
        for high_il_pos in il_analysis['high_risk_positions']:
            transactions.append(RebalanceTransaction(
                transaction_type=TransactionType.WITHDRAW,
                from_protocol=high_il_pos['protocol'],
                to_protocol=None,
                from_pool=high_il_pos['pool'],
                to_pool=None,
                amount=high_il_pos['value_at_risk'],
                estimated_gas_cost=await self._estimate_gas_cost('withdraw', high_il_pos['value_at_risk']),
                expected_slippage=0.002,
                priority=2,
                reason=RebalanceReason.IMPERMANENT_LOSS,
                expected_benefit=high_il_pos['value_at_risk'] * 0.05,
                chain='ethereum',
                tokens_involved=[]
            ))
        
        return transactions
    
    async def _optimize_transaction_order(self, transactions: List[RebalanceTransaction]) -> List[RebalanceTransaction]:
        """Optimize transaction order for gas efficiency"""
        # Sort by priority, then by gas efficiency
        return sorted(transactions, key=lambda tx: (tx.priority, tx.estimated_gas_cost / tx.amount))
    
    async def _calculate_cost_benefit_analysis(self, transactions: List[RebalanceTransaction]) -> Dict[str, Any]:
        """Calculate cost-benefit analysis for transactions"""
        total_gas_cost = sum(tx.estimated_gas_cost for tx in transactions)
        total_benefit = sum(tx.expected_benefit for tx in transactions)
        
        return {
            'total_transactions': len(transactions),
            'total_gas_cost': total_gas_cost,
            'total_expected_benefit': total_benefit,
            'net_benefit': total_benefit - total_gas_cost,
            'benefit_to_cost_ratio': total_benefit / total_gas_cost if total_gas_cost > 0 else 0,
            'recommended': total_benefit > total_gas_cost * 2  # 2x benefit threshold
        }
    
    async def _generate_recommendations(self, 
                                      drift_analysis: Dict[str, Any],
                                      il_analysis: Dict[str, Any],
                                      opportunity_analysis: Dict[str, Any],
                                      transactions: List[RebalanceTransaction],
                                      cost_benefit: Dict[str, Any]) -> List[str]:
        """Generate human-readable recommendations"""
        recommendations = []
        
        if drift_analysis['requires_rebalancing']:
            recommendations.append(
                f"🎯 Portfolio has drifted {drift_analysis['max_drift']:.1%} from target allocation"
            )
        
        if il_analysis['high_risk_positions']:
            recommendations.append(
                f"⚠️ {len(il_analysis['high_risk_positions'])} positions have high impermanent loss risk"
            )
        
        if opportunity_analysis['better_opportunities']:
            recommendations.append(
                f"📈 Found {len(opportunity_analysis['better_opportunities'])} better yield opportunities"
            )
        
        if cost_benefit['recommended']:
            recommendations.append(
                f"✅ Rebalancing recommended: ${cost_benefit['net_benefit']:.0f} net benefit expected"
            )
        else:
            recommendations.append(
                f"⏳ Rebalancing not cost-effective: gas costs too high relative to benefits"
            )
        
        return recommendations
    
    async def _estimate_gas_cost(self, operation: str, amount: float) -> float:
        """Estimate gas cost for operation"""
        # Simplified gas cost estimation
        base_gas_costs = {
            'deposit': 150000,
            'withdraw': 120000,
            'swap': 180000,
            'migrate': 300000
        }
        
        gas_units = base_gas_costs.get(operation, 150000)
        gas_price = self.gas_price_cache.get('ethereum', {}).get('standard', 20)  # gwei
        
        # Convert to USD (simplified)
        eth_price = self.token_price_cache.get('ETH', 2000)
        gas_cost_eth = (gas_units * gas_price) / 1e9  # Convert gwei to ETH
        gas_cost_usd = gas_cost_eth * eth_price
        
        return gas_cost_usd
    
    async def _estimate_migration_cost(self, 
                                     from_position: PortfolioPosition,
                                     to_opportunity: YieldOpportunity) -> float:
        """Estimate cost to migrate between positions"""
        withdraw_cost = await self._estimate_gas_cost('withdraw', from_position.current_value)
        deposit_cost = await self._estimate_gas_cost('deposit', from_position.current_value)
        
        # Add slippage costs
        slippage_cost = from_position.current_value * self.strategy.max_slippage
        
        return withdraw_cost + deposit_cost + slippage_cost
    
    async def _estimate_token_volatility(self, tokens: List[str]) -> float:
        """Estimate token volatility for IL projection"""
        # Simplified volatility estimation
        volatility_estimates = {
            'ETH': 0.8,
            'BTC': 0.7,
            'USDC': 0.01,
            'DAI': 0.01,
            'USDT': 0.01
        }
        
        if len(tokens) == 1:
            return volatility_estimates.get(tokens[0], 1.0)
        
        # For pairs, use average volatility
        volatilities = [volatility_estimates.get(token, 1.0) for token in tokens]
        return np.mean(volatilities)
    
    async def _simulate_transaction(self, transaction: RebalanceTransaction) -> Dict[str, Any]:
        """Simulate transaction execution"""
        # Simulate success with some randomness
        success_probability = 0.95
        success = np.random.random() < success_probability
        
        if success:
            return {
                'success': True,
                'gas_cost': transaction.estimated_gas_cost,
                'actual_slippage': transaction.expected_slippage * np.random.uniform(0.5, 1.5),
                'benefit': transaction.expected_benefit,
                'transaction_hash': f"0x{''.join(np.random.choice(list('0123456789abcdef'), 64))}"
            }
        else:
            return {
                'success': False,
                'error': 'Simulation failed',
                'gas_cost': transaction.estimated_gas_cost * 0.1  # Partial gas cost on failure
            }
    
    async def _execute_transaction(self, transaction: RebalanceTransaction) -> Dict[str, Any]:
        """Execute actual transaction (placeholder for Web3 integration)"""
        # This would integrate with actual Web3 providers
        logger.info("Executing transaction", transaction_type=transaction.transaction_type)
        
        # Placeholder implementation
        return await self._simulate_transaction(transaction)
    
    def _transaction_to_dict(self, transaction: RebalanceTransaction) -> Dict[str, Any]:
        """Convert transaction to dictionary"""
        return {
            'type': transaction.transaction_type.value,
            'from_protocol': transaction.from_protocol,
            'to_protocol': transaction.to_protocol,
            'amount': f"${transaction.amount:,.2f}",
            'estimated_gas_cost': f"${transaction.estimated_gas_cost:.2f}",
            'expected_slippage': f"{transaction.expected_slippage:.2%}",
            'priority': transaction.priority,
            'reason': transaction.reason.value,
            'expected_benefit': f"${transaction.expected_benefit:.2f}",
            'chain': transaction.chain
        }

# Usage example
async def main():
    """Example usage of Portfolio Rebalancer"""
    # Mock current positions
    positions = [
        PortfolioPosition(
            protocol_name="Aave",
            pool_name="USDC",
            chain="ethereum",
            tokens=["USDC"],
            current_value=50000,
            target_value=40000,
            current_weight=0.5,
            target_weight=0.4,
            apy=0.05,
            risk_score=0.2,
            last_updated=datetime.utcnow()
        ),
        PortfolioPosition(
            protocol_name="Uniswap",
            pool_name="ETH-USDC",
            chain="ethereum",
            tokens=["ETH", "USDC"],
            current_value=30000,
            target_value=40000,
            current_weight=0.3,
            target_weight=0.4,
            apy=0.15,
            risk_score=0.6,
            last_updated=datetime.utcnow(),
            impermanent_loss=0.08
        )
    ]
    
    target_allocation = {
        "Aave": 0.4,
        "Uniswap": 0.4,
        "Compound": 0.2
    }
    
    async with PortfolioRebalancer() as rebalancer:
        # Analyze rebalancing
        analysis = await rebalancer.analyze_portfolio_rebalancing(
            positions, target_allocation, 100000
        )
        
        print("Rebalancing Analysis:")
        print(f"- Requires rebalancing: {analysis['portfolio_summary']['drift_detected']}")
        print(f"- Recommended transactions: {len(analysis['recommended_transactions'])}")
        
        # Detect arbitrage opportunities
        arbitrage = await rebalancer.detect_arbitrage_opportunities(positions)
        print(f"- Arbitrage opportunities: {len(arbitrage)}")

if __name__ == "__main__":
    asyncio.run(main())