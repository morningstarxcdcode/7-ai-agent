"""
DeFi Strategist Agent

Implements yield farming analysis engine with DeFiLlama API integration,
protocol data analysis, TVL information processing, yield opportunity
scanning, and risk-adjusted return calculations.

Requirements: 5.1, 5.2
"""

import asyncio
import aiohttp
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
import structlog
import numpy as np
from decimal import Decimal, ROUND_HALF_UP

logger = structlog.get_logger()

class RiskLevel(str, Enum):
    """Risk levels for DeFi strategies"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    EXTREME = "extreme"

class ProtocolCategory(str, Enum):
    """Categories of DeFi protocols"""
    LENDING = "lending"
    DEX = "dex"
    YIELD_FARMING = "yield_farming"
    LIQUID_STAKING = "liquid_staking"
    DERIVATIVES = "derivatives"
    INSURANCE = "insurance"
    BRIDGE = "bridge"

@dataclass
class YieldOpportunity:
    """Represents a yield farming opportunity"""
    protocol_name: str
    pool_name: str
    apy: float
    tvl: float
    risk_score: float
    risk_level: RiskLevel
    category: ProtocolCategory
    tokens: List[str]
    chain: str
    minimum_deposit: float
    lock_period: Optional[int] = None  # days
    impermanent_loss_risk: float = 0.0
    smart_contract_risk: float = 0.0
    liquidity_risk: float = 0.0
    protocol_risk: float = 0.0
    market_risk: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class ProtocolData:
    """Protocol information from DeFiLlama"""
    id: str
    name: str
    symbol: str
    chains: List[str]
    tvl: float
    change_1d: float
    change_7d: float
    change_1m: float
    mcap: Optional[float] = None
    category: Optional[str] = None
    audit_links: List[str] = field(default_factory=list)
    governance_token: Optional[str] = None
    treasury: Optional[float] = None

@dataclass
class PoolData:
    """Pool-specific data"""
    pool_id: str
    protocol: str
    chain: str
    project: str
    symbol: str
    tvl_usd: float
    apy: float
    apy_base: float
    apy_reward: float
    reward_tokens: List[str]
    underlying_tokens: List[str]
    il_risk: float
    exposure: str
    predictions: Dict[str, float] = field(default_factory=dict)

class DeFiStrategistAgent:
    """
    DeFi Strategist Agent for yield farming analysis and optimization
    
    Integrates with DeFiLlama API for protocol data and TVL information,
    implements yield opportunity scanning across 50+ protocols, and
    creates risk-adjusted return calculations with strategy optimization.
    """
    
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.base_url = "https://api.llama.fi"
        self.yields_url = "https://yields.llama.fi"
        
        # Cache for protocol data
        self.protocol_cache: Dict[str, ProtocolData] = {}
        self.pools_cache: Dict[str, List[PoolData]] = {}
        self.cache_expiry = timedelta(minutes=15)
        self.last_cache_update = datetime.min
        
        # Risk assessment parameters
        self.risk_weights = {
            'tvl_weight': 0.25,
            'protocol_age_weight': 0.20,
            'audit_weight': 0.20,
            'governance_weight': 0.15,
            'liquidity_weight': 0.20
        }
        
        # Minimum thresholds
        self.min_tvl = 1_000_000  # $1M minimum TVL
        self.min_apy = 0.05  # 5% minimum APY
        self.max_risk_score = 0.8  # Maximum acceptable risk score
        
        # Protocol categories and their base risk scores
        self.category_risk_scores = {
            ProtocolCategory.LENDING: 0.3,
            ProtocolCategory.DEX: 0.4,
            ProtocolCategory.YIELD_FARMING: 0.6,
            ProtocolCategory.LIQUID_STAKING: 0.2,
            ProtocolCategory.DERIVATIVES: 0.8,
            ProtocolCategory.INSURANCE: 0.3,
            ProtocolCategory.BRIDGE: 0.7
        }
    
    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers={'User-Agent': 'DeFi-Strategist-Agent/1.0'}
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()
    
    async def analyze_yield_opportunities(self, 
                                        chains: Optional[List[str]] = None,
                                        min_tvl: Optional[float] = None,
                                        min_apy: Optional[float] = None,
                                        max_risk: Optional[RiskLevel] = None,
                                        categories: Optional[List[ProtocolCategory]] = None) -> List[YieldOpportunity]:
        """
        Analyze yield farming opportunities across protocols
        
        Args:
            chains: List of blockchain networks to analyze
            min_tvl: Minimum TVL threshold
            min_apy: Minimum APY threshold
            max_risk: Maximum acceptable risk level
            categories: Protocol categories to include
            
        Returns:
            List of yield opportunities sorted by risk-adjusted returns
        """
        try:
            logger.info("Starting yield opportunity analysis",
                       chains=chains, min_tvl=min_tvl, min_apy=min_apy)
            
            # Update cache if needed
            await self._update_cache()
            
            # Get pool data
            pools = await self._get_yield_pools(chains)
            
            # Filter pools based on criteria
            filtered_pools = self._filter_pools(
                pools, min_tvl or self.min_tvl, min_apy or self.min_apy
            )
            
            # Convert to yield opportunities with risk analysis
            opportunities = []
            for pool in filtered_pools:
                try:
                    opportunity = await self._create_yield_opportunity(pool)
                    
                    # Apply risk and category filters
                    if max_risk and opportunity.risk_level.value > max_risk.value:
                        continue
                    
                    if categories and opportunity.category not in categories:
                        continue
                    
                    opportunities.append(opportunity)
                    
                except Exception as e:
                    logger.warning("Failed to process pool", pool_id=pool.pool_id, error=str(e))
                    continue
            
            # Sort by risk-adjusted returns
            opportunities.sort(key=lambda x: self._calculate_risk_adjusted_return(x), reverse=True)
            
            logger.info("Yield opportunity analysis completed", 
                       total_opportunities=len(opportunities))
            
            return opportunities[:50]  # Return top 50 opportunities
            
        except Exception as e:
            logger.error("Yield opportunity analysis failed", error=str(e))
            return []
    
    async def get_protocol_analysis(self, protocol_name: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed analysis for a specific protocol
        
        Args:
            protocol_name: Name of the protocol to analyze
            
        Returns:
            Detailed protocol analysis including risks and opportunities
        """
        try:
            await self._update_cache()
            
            # Find protocol in cache
            protocol = None
            for cached_protocol in self.protocol_cache.values():
                if cached_protocol.name.lower() == protocol_name.lower():
                    protocol = cached_protocol
                    break
            
            if not protocol:
                logger.warning("Protocol not found", protocol_name=protocol_name)
                return None
            
            # Get protocol pools
            pools = await self._get_protocol_pools(protocol.name)
            
            # Calculate protocol metrics
            total_tvl = sum(pool.tvl_usd for pool in pools)
            avg_apy = np.mean([pool.apy for pool in pools]) if pools else 0
            max_apy = max([pool.apy for pool in pools]) if pools else 0
            
            # Risk assessment
            risk_score = await self._calculate_protocol_risk(protocol, pools)
            
            # Generate opportunities
            opportunities = []
            for pool in pools:
                opportunity = await self._create_yield_opportunity(pool)
                opportunities.append(opportunity)
            
            return {
                'protocol': {
                    'name': protocol.name,
                    'tvl': protocol.tvl,
                    'chains': protocol.chains,
                    'category': protocol.category,
                    'change_1d': protocol.change_1d,
                    'change_7d': protocol.change_7d,
                    'change_1m': protocol.change_1m
                },
                'metrics': {
                    'total_pools': len(pools),
                    'total_tvl': total_tvl,
                    'average_apy': avg_apy,
                    'maximum_apy': max_apy,
                    'risk_score': risk_score
                },
                'opportunities': [self._opportunity_to_dict(opp) for opp in opportunities[:10]],
                'risk_analysis': await self._generate_risk_analysis(protocol, pools),
                'recommendations': await self._generate_recommendations(protocol, opportunities)
            }
            
        except Exception as e:
            logger.error("Protocol analysis failed", protocol_name=protocol_name, error=str(e))
            return None
    
    async def optimize_portfolio_allocation(self, 
                                          portfolio_value: float,
                                          risk_tolerance: RiskLevel,
                                          preferred_chains: Optional[List[str]] = None,
                                          excluded_protocols: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Optimize portfolio allocation across yield opportunities
        
        Args:
            portfolio_value: Total portfolio value in USD
            risk_tolerance: User's risk tolerance level
            preferred_chains: Preferred blockchain networks
            excluded_protocols: Protocols to exclude
            
        Returns:
            Optimized portfolio allocation with expected returns and risks
        """
        try:
            logger.info("Starting portfolio optimization",
                       portfolio_value=portfolio_value,
                       risk_tolerance=risk_tolerance)
            
            # Get yield opportunities
            opportunities = await self.analyze_yield_opportunities(
                chains=preferred_chains,
                max_risk=risk_tolerance
            )
            
            # Filter out excluded protocols
            if excluded_protocols:
                opportunities = [
                    opp for opp in opportunities 
                    if opp.protocol_name.lower() not in [p.lower() for p in excluded_protocols]
                ]
            
            if not opportunities:
                return {
                    'error': 'No suitable opportunities found',
                    'recommendations': []
                }
            
            # Portfolio optimization using Modern Portfolio Theory principles
            allocation = await self._optimize_allocation(opportunities, portfolio_value, risk_tolerance)
            
            # Calculate portfolio metrics
            expected_return = sum(
                alloc['weight'] * alloc['opportunity'].apy 
                for alloc in allocation
            )
            
            portfolio_risk = self._calculate_portfolio_risk(allocation)
            
            # Generate allocation recommendations
            recommendations = []
            for alloc in allocation:
                if alloc['weight'] > 0.01:  # Only include allocations > 1%
                    recommendations.append({
                        'protocol': alloc['opportunity'].protocol_name,
                        'pool': alloc['opportunity'].pool_name,
                        'allocation_percentage': alloc['weight'] * 100,
                        'allocation_amount': alloc['weight'] * portfolio_value,
                        'expected_apy': alloc['opportunity'].apy,
                        'risk_level': alloc['opportunity'].risk_level.value,
                        'chain': alloc['opportunity'].chain,
                        'tokens': alloc['opportunity'].tokens
                    })
            
            return {
                'portfolio_metrics': {
                    'total_value': portfolio_value,
                    'expected_annual_return': expected_return,
                    'expected_annual_yield': portfolio_value * expected_return,
                    'portfolio_risk_score': portfolio_risk,
                    'risk_tolerance': risk_tolerance.value,
                    'diversification_score': len(recommendations) / len(opportunities)
                },
                'allocation': recommendations,
                'risk_analysis': {
                    'concentration_risk': self._calculate_concentration_risk(allocation),
                    'protocol_risk': self._calculate_protocol_diversification(allocation),
                    'chain_risk': self._calculate_chain_diversification(allocation),
                    'impermanent_loss_exposure': sum(
                        alloc['weight'] * alloc['opportunity'].impermanent_loss_risk
                        for alloc in allocation
                    )
                },
                'rebalancing_schedule': self._generate_rebalancing_schedule(allocation)
            }
            
        except Exception as e:
            logger.error("Portfolio optimization failed", error=str(e))
            return {'error': f'Portfolio optimization failed: {str(e)}'}
    
    async def _update_cache(self):
        """Update protocol and pool data cache"""
        if datetime.now() - self.last_cache_update < self.cache_expiry:
            return
        
        try:
            # Update protocol data
            protocols = await self._fetch_protocols()
            self.protocol_cache = {p.id: p for p in protocols}
            
            # Update pools data for major chains
            major_chains = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche']
            for chain in major_chains:
                pools = await self._fetch_pools(chain)
                self.pools_cache[chain] = pools
            
            self.last_cache_update = datetime.now()
            logger.info("Cache updated successfully", protocols=len(protocols))
            
        except Exception as e:
            logger.error("Cache update failed", error=str(e))
    
    async def _fetch_protocols(self) -> List[ProtocolData]:
        """Fetch protocol data from DeFiLlama"""
        try:
            async with self.session.get(f"{self.base_url}/protocols") as response:
                if response.status == 200:
                    data = await response.json()
                    protocols = []
                    
                    for item in data:
                        protocol = ProtocolData(
                            id=item.get('id', ''),
                            name=item.get('name', ''),
                            symbol=item.get('symbol', ''),
                            chains=item.get('chains', []),
                            tvl=float(item.get('tvl', 0)),
                            change_1d=float(item.get('change_1d', 0)),
                            change_7d=float(item.get('change_7d', 0)),
                            change_1m=float(item.get('change_1m', 0)),
                            mcap=item.get('mcap'),
                            category=item.get('category')
                        )
                        protocols.append(protocol)
                    
                    return protocols
                else:
                    logger.error("Failed to fetch protocols", status=response.status)
                    return []
                    
        except Exception as e:
            logger.error("Protocol fetch failed", error=str(e))
            return []
    
    async def _fetch_pools(self, chain: Optional[str] = None) -> List[PoolData]:
        """Fetch pool data from DeFiLlama Yields"""
        try:
            url = f"{self.yields_url}/pools"
            if chain:
                url += f"?chain={chain}"
            
            async with self.session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    pools = []
                    
                    for item in data.get('data', []):
                        pool = PoolData(
                            pool_id=item.get('pool', ''),
                            protocol=item.get('project', ''),
                            chain=item.get('chain', ''),
                            project=item.get('project', ''),
                            symbol=item.get('symbol', ''),
                            tvl_usd=float(item.get('tvlUsd', 0)),
                            apy=float(item.get('apy', 0)),
                            apy_base=float(item.get('apyBase', 0)),
                            apy_reward=float(item.get('apyReward', 0)),
                            reward_tokens=item.get('rewardTokens', []),
                            underlying_tokens=item.get('underlyingTokens', []),
                            il_risk=float(item.get('ilRisk', 0)),
                            exposure=item.get('exposure', ''),
                            predictions=item.get('predictions', {})
                        )
                        pools.append(pool)
                    
                    return pools
                else:
                    logger.error("Failed to fetch pools", status=response.status)
                    return []
                    
        except Exception as e:
            logger.error("Pool fetch failed", error=str(e))
            return []
    
    async def _get_yield_pools(self, chains: Optional[List[str]] = None) -> List[PoolData]:
        """Get yield pools from cache or API"""
        all_pools = []
        
        if chains:
            for chain in chains:
                if chain in self.pools_cache:
                    all_pools.extend(self.pools_cache[chain])
                else:
                    # Fetch from API if not in cache
                    pools = await self._fetch_pools(chain)
                    all_pools.extend(pools)
                    self.pools_cache[chain] = pools
        else:
            # Get all cached pools
            for pools in self.pools_cache.values():
                all_pools.extend(pools)
        
        return all_pools
    
    async def _get_protocol_pools(self, protocol_name: str) -> List[PoolData]:
        """Get pools for a specific protocol"""
        all_pools = []
        for pools in self.pools_cache.values():
            protocol_pools = [
                pool for pool in pools 
                if pool.protocol.lower() == protocol_name.lower()
            ]
            all_pools.extend(protocol_pools)
        
        return all_pools
    
    def _filter_pools(self, pools: List[PoolData], min_tvl: float, min_apy: float) -> List[PoolData]:
        """Filter pools based on criteria"""
        return [
            pool for pool in pools
            if pool.tvl_usd >= min_tvl 
            and pool.apy >= min_apy
            and pool.apy <= 10.0  # Filter out unrealistic APYs
            and len(pool.underlying_tokens) > 0
        ]
    
    async def _create_yield_opportunity(self, pool: PoolData) -> YieldOpportunity:
        """Create yield opportunity from pool data"""
        # Calculate risk scores
        risk_scores = await self._calculate_pool_risks(pool)
        overall_risk = np.mean(list(risk_scores.values()))
        
        # Determine risk level
        if overall_risk <= 0.3:
            risk_level = RiskLevel.LOW
        elif overall_risk <= 0.5:
            risk_level = RiskLevel.MEDIUM
        elif overall_risk <= 0.7:
            risk_level = RiskLevel.HIGH
        else:
            risk_level = RiskLevel.EXTREME
        
        # Determine category
        category = self._determine_protocol_category(pool.protocol, pool.exposure)
        
        return YieldOpportunity(
            protocol_name=pool.protocol,
            pool_name=pool.symbol,
            apy=pool.apy / 100,  # Convert percentage to decimal
            tvl=pool.tvl_usd,
            risk_score=overall_risk,
            risk_level=risk_level,
            category=category,
            tokens=pool.underlying_tokens,
            chain=pool.chain,
            minimum_deposit=1000.0,  # Default minimum
            impermanent_loss_risk=risk_scores.get('impermanent_loss', 0),
            smart_contract_risk=risk_scores.get('smart_contract', 0),
            liquidity_risk=risk_scores.get('liquidity', 0),
            protocol_risk=risk_scores.get('protocol', 0),
            market_risk=risk_scores.get('market', 0),
            metadata={
                'pool_id': pool.pool_id,
                'apy_base': pool.apy_base,
                'apy_reward': pool.apy_reward,
                'reward_tokens': pool.reward_tokens,
                'exposure': pool.exposure,
                'predictions': pool.predictions
            }
        )
    
    async def _calculate_pool_risks(self, pool: PoolData) -> Dict[str, float]:
        """Calculate various risk scores for a pool"""
        risks = {}
        
        # Impermanent loss risk
        if pool.il_risk > 0:
            risks['impermanent_loss'] = min(pool.il_risk / 100, 1.0)
        else:
            # Estimate based on token composition
            if len(pool.underlying_tokens) > 1:
                risks['impermanent_loss'] = 0.3  # Default for multi-token pools
            else:
                risks['impermanent_loss'] = 0.0  # Single token pools
        
        # Liquidity risk based on TVL
        if pool.tvl_usd > 100_000_000:  # > $100M
            risks['liquidity'] = 0.1
        elif pool.tvl_usd > 10_000_000:  # > $10M
            risks['liquidity'] = 0.3
        elif pool.tvl_usd > 1_000_000:  # > $1M
            risks['liquidity'] = 0.5
        else:
            risks['liquidity'] = 0.8
        
        # Smart contract risk (protocol-based)
        protocol_risk = await self._get_protocol_risk_score(pool.protocol)
        risks['smart_contract'] = protocol_risk
        
        # Protocol risk
        risks['protocol'] = protocol_risk
        
        # Market risk based on APY
        if pool.apy > 100:  # > 100% APY is very risky
            risks['market'] = 0.9
        elif pool.apy > 50:  # > 50% APY is risky
            risks['market'] = 0.7
        elif pool.apy > 20:  # > 20% APY is moderate risk
            risks['market'] = 0.5
        else:
            risks['market'] = 0.3
        
        return risks
    
    async def _get_protocol_risk_score(self, protocol_name: str) -> float:
        """Get risk score for a protocol"""
        # Find protocol in cache
        for protocol in self.protocol_cache.values():
            if protocol.name.lower() == protocol_name.lower():
                # Calculate risk based on TVL, age, and category
                tvl_score = min(protocol.tvl / 1_000_000_000, 1.0)  # Normalize to $1B
                risk_score = 1.0 - (tvl_score * 0.5)  # Higher TVL = lower risk
                
                # Adjust for volatility
                if abs(protocol.change_7d) > 20:
                    risk_score += 0.2
                
                return min(risk_score, 1.0)
        
        # Default risk for unknown protocols
        return 0.7
    
    def _determine_protocol_category(self, protocol_name: str, exposure: str) -> ProtocolCategory:
        """Determine protocol category"""
        protocol_lower = protocol_name.lower()
        exposure_lower = exposure.lower()
        
        if any(keyword in protocol_lower for keyword in ['aave', 'compound', 'maker']):
            return ProtocolCategory.LENDING
        elif any(keyword in protocol_lower for keyword in ['uniswap', 'sushiswap', 'curve']):
            return ProtocolCategory.DEX
        elif any(keyword in exposure_lower for keyword in ['staking', 'validator']):
            return ProtocolCategory.LIQUID_STAKING
        elif any(keyword in exposure_lower for keyword in ['derivative', 'option', 'future']):
            return ProtocolCategory.DERIVATIVES
        elif any(keyword in protocol_lower for keyword in ['bridge', 'hop', 'synapse']):
            return ProtocolCategory.BRIDGE
        else:
            return ProtocolCategory.YIELD_FARMING
    
    def _calculate_risk_adjusted_return(self, opportunity: YieldOpportunity) -> float:
        """Calculate risk-adjusted return (Sharpe-like ratio)"""
        # Simple risk-adjusted return calculation
        risk_penalty = opportunity.risk_score * 0.5
        return opportunity.apy - risk_penalty
    
    async def _optimize_allocation(self, opportunities: List[YieldOpportunity], 
                                 portfolio_value: float, 
                                 risk_tolerance: RiskLevel) -> List[Dict[str, Any]]:
        """Optimize portfolio allocation using simplified MPT"""
        if not opportunities:
            return []
        
        # Risk tolerance mapping
        risk_multipliers = {
            RiskLevel.LOW: 0.3,
            RiskLevel.MEDIUM: 0.6,
            RiskLevel.HIGH: 0.8,
            RiskLevel.EXTREME: 1.0
        }
        
        max_risk = risk_multipliers[risk_tolerance]
        
        # Filter opportunities by risk tolerance
        suitable_opportunities = [
            opp for opp in opportunities 
            if opp.risk_score <= max_risk
        ]
        
        if not suitable_opportunities:
            suitable_opportunities = opportunities[:5]  # Take top 5 if none suitable
        
        # Simple equal-weight allocation with risk adjustment
        base_weight = 1.0 / len(suitable_opportunities)
        allocations = []
        
        total_weight = 0
        for opp in suitable_opportunities:
            # Adjust weight based on risk-adjusted return
            risk_adj_return = self._calculate_risk_adjusted_return(opp)
            weight_multiplier = max(0.1, risk_adj_return / 0.2)  # Normalize
            
            weight = base_weight * weight_multiplier
            total_weight += weight
            
            allocations.append({
                'opportunity': opp,
                'weight': weight
            })
        
        # Normalize weights
        for alloc in allocations:
            alloc['weight'] = alloc['weight'] / total_weight
        
        return allocations
    
    def _calculate_portfolio_risk(self, allocation: List[Dict[str, Any]]) -> float:
        """Calculate overall portfolio risk"""
        weighted_risk = sum(
            alloc['weight'] * alloc['opportunity'].risk_score
            for alloc in allocation
        )
        return weighted_risk
    
    def _calculate_concentration_risk(self, allocation: List[Dict[str, Any]]) -> float:
        """Calculate concentration risk (Herfindahl index)"""
        weights = [alloc['weight'] for alloc in allocation]
        hhi = sum(w**2 for w in weights)
        return hhi
    
    def _calculate_protocol_diversification(self, allocation: List[Dict[str, Any]]) -> float:
        """Calculate protocol diversification score"""
        protocols = set(alloc['opportunity'].protocol_name for alloc in allocation)
        return len(protocols) / len(allocation) if allocation else 0
    
    def _calculate_chain_diversification(self, allocation: List[Dict[str, Any]]) -> float:
        """Calculate chain diversification score"""
        chains = set(alloc['opportunity'].chain for alloc in allocation)
        return len(chains) / len(allocation) if allocation else 0
    
    def _generate_rebalancing_schedule(self, allocation: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate rebalancing schedule recommendations"""
        return {
            'frequency': 'monthly',
            'triggers': [
                'allocation_drift_threshold: 5%',
                'significant_apy_changes: >20%',
                'risk_level_changes',
                'new_opportunities_available'
            ],
            'next_review_date': (datetime.now() + timedelta(days=30)).isoformat()
        }
    
    async def _calculate_protocol_risk(self, protocol: ProtocolData, pools: List[PoolData]) -> float:
        """Calculate overall protocol risk score"""
        # Base risk from TVL
        tvl_risk = max(0, 1 - (protocol.tvl / 1_000_000_000))  # Normalize to $1B
        
        # Volatility risk
        volatility = abs(protocol.change_7d) / 100
        volatility_risk = min(volatility, 1.0)
        
        # Pool concentration risk
        if pools:
            pool_tvls = [pool.tvl_usd for pool in pools]
            concentration = max(pool_tvls) / sum(pool_tvls) if sum(pool_tvls) > 0 else 1
        else:
            concentration = 1.0
        
        # Combine risks
        overall_risk = (tvl_risk * 0.4 + volatility_risk * 0.3 + concentration * 0.3)
        return min(overall_risk, 1.0)
    
    async def _generate_risk_analysis(self, protocol: ProtocolData, pools: List[PoolData]) -> Dict[str, Any]:
        """Generate detailed risk analysis"""
        return {
            'tvl_risk': 'Low' if protocol.tvl > 1_000_000_000 else 'Medium' if protocol.tvl > 100_000_000 else 'High',
            'volatility_7d': f"{protocol.change_7d:.2f}%",
            'pool_count': len(pools),
            'chain_diversification': len(set(pool.chain for pool in pools)),
            'audit_status': 'Unknown',  # Would integrate with audit APIs
            'governance_token': protocol.governance_token or 'Unknown'
        }
    
    async def _generate_recommendations(self, protocol: ProtocolData, opportunities: List[YieldOpportunity]) -> List[str]:
        """Generate investment recommendations"""
        recommendations = []
        
        if protocol.tvl > 1_000_000_000:
            recommendations.append("✅ High TVL indicates strong protocol adoption")
        else:
            recommendations.append("⚠️ Lower TVL - consider smaller position sizes")
        
        if protocol.change_7d > 10:
            recommendations.append("📈 Strong recent growth - monitor for sustainability")
        elif protocol.change_7d < -10:
            recommendations.append("📉 Recent decline - potential buying opportunity or red flag")
        
        high_yield_opps = [opp for opp in opportunities if opp.apy > 0.2]
        if high_yield_opps:
            recommendations.append(f"🎯 {len(high_yield_opps)} high-yield opportunities available")
        
        return recommendations
    
    def _opportunity_to_dict(self, opportunity: YieldOpportunity) -> Dict[str, Any]:
        """Convert opportunity to dictionary"""
        return {
            'protocol_name': opportunity.protocol_name,
            'pool_name': opportunity.pool_name,
            'apy': f"{opportunity.apy * 100:.2f}%",
            'tvl': f"${opportunity.tvl:,.0f}",
            'risk_level': opportunity.risk_level.value,
            'risk_score': f"{opportunity.risk_score:.2f}",
            'category': opportunity.category.value,
            'chain': opportunity.chain,
            'tokens': opportunity.tokens,
            'impermanent_loss_risk': f"{opportunity.impermanent_loss_risk:.1%}"
        }

# Usage example and testing
async def main():
    """Example usage of DeFi Strategist Agent"""
    async with DeFiStrategistAgent() as strategist:
        # Analyze yield opportunities
        opportunities = await strategist.analyze_yield_opportunities(
            chains=['ethereum', 'polygon'],
            min_tvl=5_000_000,
            min_apy=0.05
        )
        
        print(f"Found {len(opportunities)} yield opportunities")
        for opp in opportunities[:5]:
            print(f"- {opp.protocol_name}: {opp.apy:.1%} APY, Risk: {opp.risk_level.value}")
        
        # Optimize portfolio
        allocation = await strategist.optimize_portfolio_allocation(
            portfolio_value=100_000,
            risk_tolerance=RiskLevel.MEDIUM,
            preferred_chains=['ethereum', 'polygon']
        )
        
        print("\nOptimized allocation:")
        for rec in allocation.get('allocation', [])[:3]:
            print(f"- {rec['protocol']}: {rec['allocation_percentage']:.1f}% ({rec['expected_apy']:.1%} APY)")

if __name__ == "__main__":
    asyncio.run(main())