"""
Prediction Market Integration

Integrates with major prediction market platforms including Polymarket, Augur,
and Gnosis to identify opportunities and analyze market efficiency.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import aiohttp
import json
from decimal import Decimal
import time
import hashlib

logger = logging.getLogger(__name__)

class MarketStatus(Enum):
    """Status of prediction markets"""
    ACTIVE = "active"
    CLOSED = "closed"
    RESOLVED = "resolved"
    SUSPENDED = "suspended"

class OutcomeType(Enum):
    """Types of market outcomes"""
    BINARY = "binary"  # Yes/No
    CATEGORICAL = "categorical"  # Multiple choices
    SCALAR = "scalar"  # Numeric range

@dataclass
class MarketOutcome:
    """Individual outcome in a prediction market"""
    outcome_id: str
    name: str
    description: str
    current_price: Decimal
    implied_probability: float
    volume_24h: Decimal
    liquidity: Decimal
    last_traded: datetime

@dataclass
class PredictionMarket:
    """Prediction market data structure"""
    market_id: str
    platform: str
    title: str
    description: str
    category: str
    creator: str
    creation_date: datetime
    end_date: datetime
    resolution_date: Optional[datetime]
    status: MarketStatus
    outcome_type: OutcomeType
    outcomes: List[MarketOutcome]
    total_volume: Decimal
    total_liquidity: Decimal
    fee_percentage: float
    minimum_bet: Decimal
    maximum_bet: Decimal
    tags: List[str]
    metadata: Dict[str, Any]

@dataclass
class MarketOpportunity:
    """Identified opportunity in prediction markets"""
    opportunity_id: str
    market: PredictionMarket
    recommended_outcome: str
    confidence_score: float  # 0.0 to 1.0
    expected_probability: float
    market_probability: float
    edge_percentage: float  # Expected edge over market
    kelly_fraction: float  # Optimal bet size using Kelly criterion
    expected_return: float
    risk_level: str  # "low", "medium", "high"
    reasoning: str
    supporting_data: Dict[str, Any]
    identified_at: datetime

@dataclass
class MarketAnalysis:
    """Analysis of market efficiency and patterns"""
    market_id: str
    efficiency_score: float  # 0.0 to 1.0 (1.0 = perfectly efficient)
    volatility: float
    trend_direction: str  # "bullish", "bearish", "sideways"
    momentum: float
    volume_trend: str
    liquidity_depth: float
    price_stability: float
    arbitrage_opportunities: List[str]
    correlation_with_events: float
    analysis_timestamp: datetime

class PredictionMarketIntegrator:
    """
    Integrates with multiple prediction market platforms to identify
    opportunities and analyze market efficiency.
    """
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.session: Optional[aiohttp.ClientSession] = None
        self.api_keys = config.get("api_keys", {})
        
        # Platform endpoints
        self.endpoints = {
            "polymarket": {
                "base": "https://gamma-api.polymarket.com",
                "markets": "/markets",
                "market_detail": "/markets/{market_id}",
                "trades": "/trades",
                "events": "/events"
            },
            "augur": {
                "base": "https://api.augur.net/v1",
                "markets": "/markets",
                "market_detail": "/markets/{market_id}",
                "orders": "/orders"
            },
            "gnosis": {
                "base": "https://api.gnosis.io/v1",
                "markets": "/markets",
                "positions": "/positions"
            }
        }
        
        # Rate limiters
        self.rate_limiters = {
            "polymarket": self._create_rate_limiter(60),  # 60 requests per minute
            "augur": self._create_rate_limiter(100),
            "gnosis": self._create_rate_limiter(50)
        }
        
        # Cache for market data
        self.cache = {}
        self.cache_ttl = config.get("cache_ttl", 300)  # 5 minutes
        
        # Analysis parameters
        self.min_liquidity = Decimal(config.get("min_liquidity", "1000"))
        self.min_volume = Decimal(config.get("min_volume", "100"))
        self.max_fee = config.get("max_fee", 0.05)  # 5%
        self.confidence_threshold = config.get("confidence_threshold", 0.6)
    
    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30)
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()
    
    async def get_active_markets(
        self, 
        platforms: Optional[List[str]] = None,
        categories: Optional[List[str]] = None,
        min_liquidity: Optional[Decimal] = None
    ) -> List[PredictionMarket]:
        """
        Get active prediction markets from specified platforms
        
        Args:
            platforms: List of platforms to query (None for all)
            categories: Filter by categories
            min_liquidity: Minimum liquidity requirement
            
        Returns:
            List of active prediction markets
        """
        try:
            if platforms is None:
                platforms = ["polymarket", "augur", "gnosis"]
            
            all_markets = []
            
            # Fetch from each platform
            for platform in platforms:
                try:
                    markets = await self._fetch_platform_markets(platform)
                    
                    # Apply filters
                    filtered_markets = self._filter_markets(
                        markets, categories, min_liquidity or self.min_liquidity
                    )
                    
                    all_markets.extend(filtered_markets)
                    
                except Exception as e:
                    logger.error(f"Error fetching markets from {platform}: {e}")
                    continue
            
            # Sort by liquidity and volume
            all_markets.sort(
                key=lambda m: (m.total_liquidity, m.total_volume), 
                reverse=True
            )
            
            logger.info(f"Retrieved {len(all_markets)} active markets")
            return all_markets
            
        except Exception as e:
            logger.error(f"Error getting active markets: {e}")
            return []
    
    async def identify_opportunities(
        self, 
        markets: Optional[List[PredictionMarket]] = None,
        external_data: Optional[Dict[str, Any]] = None
    ) -> List[MarketOpportunity]:
        """
        Identify opportunities in prediction markets
        
        Args:
            markets: List of markets to analyze (None to fetch all)
            external_data: External data for analysis (news, events, etc.)
            
        Returns:
            List of identified opportunities
        """
        try:
            if markets is None:
                markets = await self.get_active_markets()
            
            opportunities = []
            
            for market in markets:
                try:
                    # Analyze market for opportunities
                    market_analysis = await self._analyze_market_efficiency(market)
                    
                    # Check for mispriced outcomes
                    mispriced_outcomes = await self._identify_mispriced_outcomes(
                        market, market_analysis, external_data
                    )
                    
                    # Create opportunities for mispriced outcomes
                    for outcome_id, analysis in mispriced_outcomes.items():
                        opportunity = await self._create_opportunity(
                            market, outcome_id, analysis, market_analysis
                        )
                        
                        if opportunity and opportunity.confidence_score >= self.confidence_threshold:
                            opportunities.append(opportunity)
                
                except Exception as e:
                    logger.error(f"Error analyzing market {market.market_id}: {e}")
                    continue
            
            # Sort by confidence and expected return
            opportunities.sort(
                key=lambda o: (o.confidence_score, o.expected_return), 
                reverse=True
            )
            
            logger.info(f"Identified {len(opportunities)} market opportunities")
            return opportunities[:20]  # Return top 20
            
        except Exception as e:
            logger.error(f"Error identifying opportunities: {e}")
            return []
    
    async def analyze_market_correlation(
        self, 
        market: PredictionMarket,
        events: List[Dict[str, Any]],
        news_sentiment: List[Dict[str, Any]]
    ) -> Dict[str, float]:
        """
        Analyze correlation between market prices and external events
        
        Args:
            market: Prediction market to analyze
            events: List of relevant events
            news_sentiment: News sentiment data
            
        Returns:
            Correlation analysis results
        """
        try:
            correlations = {}
            
            # Analyze event correlation
            event_correlation = await self._calculate_event_correlation(market, events)
            correlations["events"] = event_correlation
            
            # Analyze sentiment correlation
            sentiment_correlation = await self._calculate_sentiment_correlation(
                market, news_sentiment
            )
            correlations["sentiment"] = sentiment_correlation
            
            # Analyze volume correlation
            volume_correlation = await self._calculate_volume_correlation(market)
            correlations["volume"] = volume_correlation
            
            # Overall correlation score
            correlations["overall"] = (
                event_correlation * 0.4 + 
                sentiment_correlation * 0.3 + 
                volume_correlation * 0.3
            )
            
            logger.info(f"Market correlation analysis completed: {correlations['overall']:.2f}")
            return correlations
            
        except Exception as e:
            logger.error(f"Error analyzing market correlation: {e}")
            return {"overall": 0.0}
    
    async def calculate_optimal_position_size(
        self, 
        opportunity: MarketOpportunity,
        bankroll: Decimal,
        risk_tolerance: float = 0.25
    ) -> Dict[str, Any]:
        """
        Calculate optimal position size using Kelly criterion and risk management
        
        Args:
            opportunity: Market opportunity
            bankroll: Available capital
            risk_tolerance: Risk tolerance (0.0 to 1.0)
            
        Returns:
            Position sizing recommendations
        """
        try:
            # Kelly criterion calculation
            kelly_fraction = opportunity.kelly_fraction
            
            # Apply risk tolerance adjustment
            adjusted_kelly = kelly_fraction * risk_tolerance
            
            # Calculate position sizes
            kelly_size = bankroll * Decimal(str(adjusted_kelly))
            conservative_size = bankroll * Decimal("0.01")  # 1% of bankroll
            aggressive_size = bankroll * Decimal("0.05")    # 5% of bankroll
            
            # Ensure within market limits
            min_bet = opportunity.market.minimum_bet
            max_bet = opportunity.market.maximum_bet
            
            recommended_size = max(min_bet, min(kelly_size, max_bet))
            
            # Calculate expected outcomes
            win_amount = recommended_size * Decimal(str(opportunity.expected_return))
            loss_amount = recommended_size
            
            position_info = {
                "recommended_size": float(recommended_size),
                "kelly_size": float(kelly_size),
                "conservative_size": float(conservative_size),
                "aggressive_size": float(aggressive_size),
                "kelly_fraction": kelly_fraction,
                "adjusted_kelly": adjusted_kelly,
                "expected_win": float(win_amount),
                "max_loss": float(loss_amount),
                "risk_reward_ratio": float(win_amount / loss_amount) if loss_amount > 0 else 0,
                "bankroll_percentage": float(recommended_size / bankroll * 100),
                "reasoning": self._generate_sizing_reasoning(
                    opportunity, kelly_fraction, adjusted_kelly
                )
            }
            
            logger.info(f"Optimal position size calculated: {recommended_size}")
            return position_info
            
        except Exception as e:
            logger.error(f"Error calculating position size: {e}")
            return {}
    
    async def track_market_performance(
        self, 
        market_ids: List[str],
        timeframe_hours: int = 24
    ) -> Dict[str, Dict[str, Any]]:
        """
        Track performance of specific markets over time
        
        Args:
            market_ids: List of market IDs to track
            timeframe_hours: Timeframe for performance tracking
            
        Returns:
            Performance data for each market
        """
        try:
            performance_data = {}
            
            for market_id in market_ids:
                try:
                    # Get current market data
                    current_data = await self._get_market_by_id(market_id)
                    
                    if not current_data:
                        continue
                    
                    # Get historical data
                    historical_data = await self._get_historical_market_data(
                        market_id, timeframe_hours
                    )
                    
                    # Calculate performance metrics
                    performance = self._calculate_performance_metrics(
                        current_data, historical_data
                    )
                    
                    performance_data[market_id] = performance
                    
                except Exception as e:
                    logger.error(f"Error tracking market {market_id}: {e}")
                    continue
            
            logger.info(f"Tracked performance for {len(performance_data)} markets")
            return performance_data
            
        except Exception as e:
            logger.error(f"Error tracking market performance: {e}")
            return {}
    
    # Private helper methods
    
    def _create_rate_limiter(self, requests_per_minute: int):
        """Create a rate limiter for API calls"""
        class RateLimiter:
            def __init__(self, rpm):
                self.rpm = rpm
                self.calls = []
            
            async def acquire(self):
                now = time.time()
                self.calls = [t for t in self.calls if now - t < 60]
                
                if len(self.calls) >= self.rpm:
                    sleep_time = 60 - (now - self.calls[0])
                    if sleep_time > 0:
                        await asyncio.sleep(sleep_time)
                
                self.calls.append(now)
        
        return RateLimiter(requests_per_minute)
    
    async def _fetch_platform_markets(self, platform: str) -> List[PredictionMarket]:
        """Fetch markets from a specific platform"""
        try:
            cache_key = f"markets_{platform}"
            
            # Check cache
            if self._is_cached(cache_key):
                return self.cache[cache_key]["data"]
            
            await self.rate_limiters[platform].acquire()
            
            if platform == "polymarket":
                markets = await self._fetch_polymarket_markets()
            elif platform == "augur":
                markets = await self._fetch_augur_markets()
            elif platform == "gnosis":
                markets = await self._fetch_gnosis_markets()
            else:
                logger.warning(f"Unknown platform: {platform}")
                return []
            
            # Cache results
            self._cache_data(cache_key, markets)
            
            return markets
            
        except Exception as e:
            logger.error(f"Error fetching markets from {platform}: {e}")
            return []
    
    async def _fetch_polymarket_markets(self) -> List[PredictionMarket]:
        """Fetch markets from Polymarket"""
        try:
            markets = []
            
            # Note: Using public Polymarket API endpoints
            url = f"{self.endpoints['polymarket']['base']}{self.endpoints['polymarket']['markets']}"
            
            params = {
                "limit": 100,
                "offset": 0,
                "active": True
            }
            
            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    for market_data in data.get("data", []):
                        market = self._parse_polymarket_data(market_data)
                        if market:
                            markets.append(market)
                else:
                    logger.error(f"Polymarket API error: {response.status}")
            
            logger.info(f"Fetched {len(markets)} markets from Polymarket")
            return markets
            
        except Exception as e:
            logger.error(f"Error fetching Polymarket markets: {e}")
            return []
    
    async def _fetch_augur_markets(self) -> List[PredictionMarket]:
        """Fetch markets from Augur"""
        try:
            markets = []
            
            # Note: Augur API implementation would go here
            # Using placeholder for now as Augur API structure varies
            
            logger.info(f"Fetched {len(markets)} markets from Augur")
            return markets
            
        except Exception as e:
            logger.error(f"Error fetching Augur markets: {e}")
            return []
    
    async def _fetch_gnosis_markets(self) -> List[PredictionMarket]:
        """Fetch markets from Gnosis"""
        try:
            markets = []
            
            # Note: Gnosis API implementation would go here
            # Using placeholder for now as Gnosis API structure varies
            
            logger.info(f"Fetched {len(markets)} markets from Gnosis")
            return markets
            
        except Exception as e:
            logger.error(f"Error fetching Gnosis markets: {e}")
            return []
    
    def _parse_polymarket_data(self, data: Dict[str, Any]) -> Optional[PredictionMarket]:
        """Parse Polymarket API data into PredictionMarket object"""
        try:
            # Parse outcomes
            outcomes = []
            for outcome_data in data.get("outcomes", []):
                outcome = MarketOutcome(
                    outcome_id=outcome_data.get("id", ""),
                    name=outcome_data.get("name", ""),
                    description=outcome_data.get("description", ""),
                    current_price=Decimal(str(outcome_data.get("price", "0"))),
                    implied_probability=float(outcome_data.get("price", 0)),
                    volume_24h=Decimal(str(outcome_data.get("volume24hr", "0"))),
                    liquidity=Decimal(str(outcome_data.get("liquidity", "0"))),
                    last_traded=datetime.now()  # Would parse from API
                )
                outcomes.append(outcome)
            
            # Create market object
            market = PredictionMarket(
                market_id=data.get("id", ""),
                platform="polymarket",
                title=data.get("question", ""),
                description=data.get("description", ""),
                category=data.get("category", ""),
                creator=data.get("creator", ""),
                creation_date=datetime.now(),  # Would parse from API
                end_date=datetime.now() + timedelta(days=30),  # Would parse from API
                resolution_date=None,
                status=MarketStatus.ACTIVE,
                outcome_type=OutcomeType.BINARY if len(outcomes) == 2 else OutcomeType.CATEGORICAL,
                outcomes=outcomes,
                total_volume=Decimal(str(data.get("volume", "0"))),
                total_liquidity=Decimal(str(data.get("liquidity", "0"))),
                fee_percentage=float(data.get("fee", 0.02)),
                minimum_bet=Decimal("1"),  # Default minimum
                maximum_bet=Decimal("10000"),  # Default maximum
                tags=data.get("tags", []),
                metadata=data
            )
            
            return market
            
        except Exception as e:
            logger.error(f"Error parsing Polymarket data: {e}")
            return None
    
    def _filter_markets(
        self, 
        markets: List[PredictionMarket],
        categories: Optional[List[str]],
        min_liquidity: Decimal
    ) -> List[PredictionMarket]:
        """Filter markets based on criteria"""
        filtered = []
        
        for market in markets:
            # Check liquidity
            if market.total_liquidity < min_liquidity:
                continue
            
            # Check volume
            if market.total_volume < self.min_volume:
                continue
            
            # Check fee
            if market.fee_percentage > self.max_fee:
                continue
            
            # Check categories
            if categories and market.category not in categories:
                continue
            
            # Check status
            if market.status != MarketStatus.ACTIVE:
                continue
            
            filtered.append(market)
        
        return filtered
    
    async def _analyze_market_efficiency(self, market: PredictionMarket) -> MarketAnalysis:
        """Analyze market efficiency and patterns"""
        try:
            # Calculate efficiency metrics
            efficiency_score = self._calculate_efficiency_score(market)
            volatility = self._calculate_volatility(market)
            trend_direction = self._determine_trend_direction(market)
            momentum = self._calculate_momentum(market)
            
            analysis = MarketAnalysis(
                market_id=market.market_id,
                efficiency_score=efficiency_score,
                volatility=volatility,
                trend_direction=trend_direction,
                momentum=momentum,
                volume_trend="increasing",  # Would calculate from historical data
                liquidity_depth=float(market.total_liquidity),
                price_stability=1.0 - volatility,
                arbitrage_opportunities=[],
                correlation_with_events=0.5,  # Would calculate from event data
                analysis_timestamp=datetime.now()
            )
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing market efficiency: {e}")
            return MarketAnalysis(
                market_id=market.market_id,
                efficiency_score=0.5,
                volatility=0.5,
                trend_direction="sideways",
                momentum=0.0,
                volume_trend="stable",
                liquidity_depth=0.0,
                price_stability=0.5,
                arbitrage_opportunities=[],
                correlation_with_events=0.0,
                analysis_timestamp=datetime.now()
            )
    
    async def _identify_mispriced_outcomes(
        self, 
        market: PredictionMarket,
        analysis: MarketAnalysis,
        external_data: Optional[Dict[str, Any]]
    ) -> Dict[str, Dict[str, Any]]:
        """Identify mispriced outcomes in the market"""
        mispriced = {}
        
        for outcome in market.outcomes:
            # Calculate fair value based on external data
            fair_probability = await self._calculate_fair_probability(
                outcome, market, external_data
            )
            
            # Compare with market probability
            market_probability = outcome.implied_probability
            edge = fair_probability - market_probability
            
            # Check if edge is significant
            if abs(edge) > 0.05:  # 5% edge threshold
                mispriced[outcome.outcome_id] = {
                    "fair_probability": fair_probability,
                    "market_probability": market_probability,
                    "edge": edge,
                    "confidence": self._calculate_confidence(edge, analysis),
                    "reasoning": self._generate_mispricing_reasoning(outcome, edge)
                }
        
        return mispriced
    
    async def _calculate_fair_probability(
        self, 
        outcome: MarketOutcome,
        market: PredictionMarket,
        external_data: Optional[Dict[str, Any]]
    ) -> float:
        """Calculate fair probability for an outcome"""
        # Simplified fair value calculation
        # In production, this would use sophisticated models
        
        base_probability = outcome.implied_probability
        
        # Adjust based on external data
        if external_data:
            # News sentiment adjustment
            sentiment = external_data.get("sentiment", 0.0)
            sentiment_adjustment = sentiment * 0.1
            
            # Event correlation adjustment
            event_correlation = external_data.get("event_correlation", 0.0)
            event_adjustment = event_correlation * 0.05
            
            base_probability += sentiment_adjustment + event_adjustment
        
        return max(0.01, min(0.99, base_probability))
    
    def _calculate_confidence(self, edge: float, analysis: MarketAnalysis) -> float:
        """Calculate confidence in the mispricing analysis"""
        # Base confidence from edge size
        edge_confidence = min(abs(edge) * 2, 1.0)
        
        # Adjust for market efficiency
        efficiency_adjustment = 1.0 - analysis.efficiency_score
        
        # Adjust for liquidity
        liquidity_adjustment = min(analysis.liquidity_depth / 10000, 0.2)
        
        confidence = edge_confidence * efficiency_adjustment + liquidity_adjustment
        
        return max(0.1, min(0.95, confidence))
    
    async def _create_opportunity(
        self, 
        market: PredictionMarket,
        outcome_id: str,
        analysis: Dict[str, Any],
        market_analysis: MarketAnalysis
    ) -> Optional[MarketOpportunity]:
        """Create a market opportunity from analysis"""
        try:
            # Find the outcome
            outcome = next(
                (o for o in market.outcomes if o.outcome_id == outcome_id), 
                None
            )
            
            if not outcome:
                return None
            
            # Calculate Kelly fraction
            edge = analysis["edge"]
            odds = 1 / outcome.implied_probability - 1
            kelly_fraction = edge / odds if odds > 0 else 0
            
            # Calculate expected return
            if edge > 0:  # Positive edge
                expected_return = edge * odds
            else:  # Negative edge
                expected_return = edge
            
            # Determine risk level
            risk_level = self._determine_risk_level(analysis["confidence"], market_analysis)
            
            opportunity = MarketOpportunity(
                opportunity_id=f"opp_{market.market_id}_{outcome_id}_{int(time.time())}",
                market=market,
                recommended_outcome=outcome.name,
                confidence_score=analysis["confidence"],
                expected_probability=analysis["fair_probability"],
                market_probability=analysis["market_probability"],
                edge_percentage=edge * 100,
                kelly_fraction=max(0, kelly_fraction),
                expected_return=expected_return,
                risk_level=risk_level,
                reasoning=analysis["reasoning"],
                supporting_data={
                    "market_analysis": asdict(market_analysis),
                    "outcome_analysis": analysis
                },
                identified_at=datetime.now()
            )
            
            return opportunity
            
        except Exception as e:
            logger.error(f"Error creating opportunity: {e}")
            return None
    
    def _calculate_efficiency_score(self, market: PredictionMarket) -> float:
        """Calculate market efficiency score"""
        # Simplified efficiency calculation
        # Higher liquidity and volume indicate more efficient markets
        
        liquidity_score = min(float(market.total_liquidity) / 100000, 1.0)
        volume_score = min(float(market.total_volume) / 50000, 1.0)
        
        # Number of outcomes (more outcomes can be less efficient)
        outcome_penalty = max(0, (len(market.outcomes) - 2) * 0.1)
        
        efficiency = (liquidity_score + volume_score) / 2 - outcome_penalty
        
        return max(0.1, min(0.95, efficiency))
    
    def _calculate_volatility(self, market: PredictionMarket) -> float:
        """Calculate market volatility"""
        # Simplified volatility calculation
        # Would use historical price data in production
        
        price_range = 0.0
        if market.outcomes:
            prices = [float(o.current_price) for o in market.outcomes]
            price_range = max(prices) - min(prices)
        
        return min(price_range, 1.0)
    
    def _determine_trend_direction(self, market: PredictionMarket) -> str:
        """Determine market trend direction"""
        # Simplified trend analysis
        # Would use historical data in production
        
        if market.outcomes:
            # Check if any outcome has very high probability
            max_prob = max(o.implied_probability for o in market.outcomes)
            if max_prob > 0.7:
                return "bullish"
            elif max_prob < 0.3:
                return "bearish"
        
        return "sideways"
    
    def _calculate_momentum(self, market: PredictionMarket) -> float:
        """Calculate market momentum"""
        # Simplified momentum calculation
        # Would use volume and price changes in production
        
        if market.total_volume > 0:
            return min(float(market.total_volume) / 10000, 1.0)
        
        return 0.0
    
    def _generate_mispricing_reasoning(self, outcome: MarketOutcome, edge: float) -> str:
        """Generate reasoning for mispricing"""
        if edge > 0:
            return f"Outcome '{outcome.name}' appears undervalued by {edge:.1%} based on external analysis"
        else:
            return f"Outcome '{outcome.name}' appears overvalued by {abs(edge):.1%} based on external analysis"
    
    def _determine_risk_level(self, confidence: float, analysis: MarketAnalysis) -> str:
        """Determine risk level for opportunity"""
        if confidence > 0.8 and analysis.efficiency_score < 0.6:
            return "low"
        elif confidence > 0.6:
            return "medium"
        else:
            return "high"
    
    def _generate_sizing_reasoning(
        self, opportunity: MarketOpportunity, kelly: float, adjusted_kelly: float
    ) -> str:
        """Generate reasoning for position sizing"""
        return f"Kelly criterion suggests {kelly:.1%}, adjusted to {adjusted_kelly:.1%} for risk management"
    
    async def _calculate_event_correlation(
        self, market: PredictionMarket, events: List[Dict[str, Any]]
    ) -> float:
        """Calculate correlation between market and events"""
        # Simplified correlation calculation
        return 0.5  # Placeholder
    
    async def _calculate_sentiment_correlation(
        self, market: PredictionMarket, sentiment_data: List[Dict[str, Any]]
    ) -> float:
        """Calculate correlation between market and sentiment"""
        # Simplified correlation calculation
        return 0.3  # Placeholder
    
    async def _calculate_volume_correlation(self, market: PredictionMarket) -> float:
        """Calculate volume correlation patterns"""
        # Simplified correlation calculation
        return 0.4  # Placeholder
    
    async def _get_market_by_id(self, market_id: str) -> Optional[PredictionMarket]:
        """Get market data by ID"""
        # Implementation would fetch specific market
        return None
    
    async def _get_historical_market_data(
        self, market_id: str, hours: int
    ) -> List[Dict[str, Any]]:
        """Get historical market data"""
        # Implementation would fetch historical data
        return []
    
    def _calculate_performance_metrics(
        self, current: PredictionMarket, historical: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Calculate performance metrics"""
        # Implementation would calculate various performance metrics
        return {
            "price_change": 0.0,
            "volume_change": 0.0,
            "volatility": 0.0
        }
    
    def _is_cached(self, key: str) -> bool:
        """Check if data is cached and valid"""
        if key not in self.cache:
            return False
        
        cached_time = self.cache[key]["timestamp"]
        return (datetime.now() - cached_time).total_seconds() < self.cache_ttl
    
    def _cache_data(self, key: str, data: Any):
        """Cache data with timestamp"""
        self.cache[key] = {
            "data": data,
            "timestamp": datetime.now()
        }

# Example usage
async def main():
    """Example usage of the Prediction Market Integrator"""
    config = {
        "api_keys": {},
        "min_liquidity": "5000",
        "min_volume": "1000",
        "max_fee": 0.03,
        "confidence_threshold": 0.7,
        "cache_ttl": 300
    }
    
    async with PredictionMarketIntegrator(config) as integrator:
        # Get active markets
        markets = await integrator.get_active_markets(
            platforms=["polymarket"],
            categories=["politics", "crypto", "sports"]
        )
        print(f"Found {len(markets)} active markets")
        
        # Identify opportunities
        opportunities = await integrator.identify_opportunities(markets)
        print(f"Identified {len(opportunities)} opportunities")
        
        # Analyze top opportunity
        if opportunities:
            top_opportunity = opportunities[0]
            print(f"Top opportunity: {top_opportunity.market.title}")
            print(f"Confidence: {top_opportunity.confidence_score:.1%}")
            print(f"Expected return: {top_opportunity.expected_return:.1%}")
            
            # Calculate position size
            position_info = await integrator.calculate_optimal_position_size(
                top_opportunity, Decimal("10000"), risk_tolerance=0.25
            )
            print(f"Recommended position: ${position_info.get('recommended_size', 0):.2f}")

if __name__ == "__main__":
    asyncio.run(main())