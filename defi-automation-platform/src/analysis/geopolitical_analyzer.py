"""
Geopolitical Event Impact Analyzer

Analyzes geopolitical events and their potential impact on financial markets,
DeFi protocols, and prediction market opportunities.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import json
import re
from collections import defaultdict

logger = logging.getLogger(__name__)

class EventType(Enum):
    """Types of geopolitical events"""
    ELECTION = "election"
    MONETARY_POLICY = "monetary_policy"
    TRADE_POLICY = "trade_policy"
    MILITARY_CONFLICT = "military_conflict"
    SANCTIONS = "sanctions"
    REGULATORY_CHANGE = "regulatory_change"
    ECONOMIC_CRISIS = "economic_crisis"
    NATURAL_DISASTER = "natural_disaster"
    DIPLOMATIC_RELATIONS = "diplomatic_relations"
    SOCIAL_UNREST = "social_unrest"

class ImpactSeverity(Enum):
    """Severity levels for event impacts"""
    MINIMAL = "minimal"
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"

class MarketSector(Enum):
    """Market sectors that can be impacted"""
    CRYPTO = "crypto"
    DEFI = "defi"
    TRADITIONAL_FINANCE = "traditional_finance"
    COMMODITIES = "commodities"
    TECHNOLOGY = "technology"
    ENERGY = "energy"
    HEALTHCARE = "healthcare"
    DEFENSE = "defense"
    AGRICULTURE = "agriculture"
    REAL_ESTATE = "real_estate"

@dataclass
class EventImpactVector:
    """Impact vector for a specific sector"""
    sector: MarketSector
    direction: str  # "positive", "negative", "neutral"
    magnitude: float  # 0.0 to 1.0
    confidence: float  # 0.0 to 1.0
    timeframe: str  # "immediate", "short_term", "medium_term", "long_term"
    reasoning: str

@dataclass
class GeopoliticalImpactAssessment:
    """Comprehensive impact assessment for a geopolitical event"""
    event_id: str
    event_type: EventType
    severity: ImpactSeverity
    affected_regions: List[str]
    sector_impacts: List[EventImpactVector]
    overall_market_sentiment: float  # -1.0 to 1.0
    volatility_increase: float  # 0.0 to 1.0
    safe_haven_demand: float  # 0.0 to 1.0
    risk_off_probability: float  # 0.0 to 1.0
    prediction_opportunities: List[str]
    historical_precedents: List[str]
    assessment_confidence: float  # 0.0 to 1.0
    created_at: datetime

@dataclass
class HistoricalPrecedent:
    """Historical precedent for similar events"""
    event_description: str
    date: datetime
    market_reaction: Dict[str, float]
    duration_days: int
    recovery_time_days: int
    lessons_learned: List[str]

class GeopoliticalAnalyzer:
    """
    Analyzes geopolitical events and assesses their potential impact
    on various market sectors and investment opportunities.
    """
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        
        # Historical precedent database (simplified)
        self.historical_precedents = self._load_historical_precedents()
        
        # Event classification patterns
        self.event_patterns = self._initialize_event_patterns()
        
        # Sector correlation matrix
        self.sector_correlations = self._initialize_sector_correlations()
        
        # Impact assessment models
        self.impact_models = self._initialize_impact_models()
    
    async def analyze_event_impact(
        self, 
        event_title: str,
        event_description: str,
        event_timestamp: datetime,
        source_country: str = "Global"
    ) -> GeopoliticalImpactAssessment:
        """
        Analyze the potential impact of a geopolitical event
        
        Args:
            event_title: Title of the event
            event_description: Detailed description
            event_timestamp: When the event occurred
            source_country: Country where event originated
            
        Returns:
            Comprehensive impact assessment
        """
        try:
            logger.info(f"Analyzing geopolitical event: {event_title}")
            
            # Classify the event type
            event_type = self._classify_event_type(event_title, event_description)
            
            # Assess severity
            severity = self._assess_event_severity(event_title, event_description, event_type)
            
            # Identify affected regions
            affected_regions = self._identify_affected_regions(
                event_description, source_country, event_type
            )
            
            # Analyze sector impacts
            sector_impacts = await self._analyze_sector_impacts(
                event_type, severity, event_description, affected_regions
            )
            
            # Calculate overall market sentiment
            overall_sentiment = self._calculate_overall_sentiment(sector_impacts)
            
            # Assess volatility increase
            volatility_increase = self._assess_volatility_increase(event_type, severity)
            
            # Assess safe haven demand
            safe_haven_demand = self._assess_safe_haven_demand(event_type, severity)
            
            # Calculate risk-off probability
            risk_off_probability = self._calculate_risk_off_probability(
                event_type, severity, overall_sentiment
            )
            
            # Identify prediction market opportunities
            prediction_opportunities = self._identify_prediction_opportunities(
                event_type, event_description, affected_regions
            )
            
            # Find historical precedents
            historical_precedents = self._find_historical_precedents(event_type, severity)
            
            # Calculate assessment confidence
            assessment_confidence = self._calculate_assessment_confidence(
                event_type, severity, len(historical_precedents)
            )
            
            assessment = GeopoliticalImpactAssessment(
                event_id=f"geo_{hash(event_title)}_{int(event_timestamp.timestamp())}",
                event_type=event_type,
                severity=severity,
                affected_regions=affected_regions,
                sector_impacts=sector_impacts,
                overall_market_sentiment=overall_sentiment,
                volatility_increase=volatility_increase,
                safe_haven_demand=safe_haven_demand,
                risk_off_probability=risk_off_probability,
                prediction_opportunities=prediction_opportunities,
                historical_precedents=historical_precedents,
                assessment_confidence=assessment_confidence,
                created_at=datetime.now()
            )
            
            logger.info(f"Event impact assessment completed: {severity.value} severity")
            return assessment
            
        except Exception as e:
            logger.error(f"Error analyzing event impact: {e}")
            return self._create_default_assessment(event_title, event_timestamp)
    
    async def assess_market_correlation_impact(
        self, 
        assessment: GeopoliticalImpactAssessment
    ) -> Dict[str, float]:
        """
        Assess how the event will impact market correlations
        
        Args:
            assessment: Geopolitical impact assessment
            
        Returns:
            Dictionary of correlation changes by sector pair
        """
        try:
            correlation_impacts = {}
            
            # Analyze how event affects sector correlations
            for i, impact1 in enumerate(assessment.sector_impacts):
                for impact2 in assessment.sector_impacts[i+1:]:
                    sector_pair = f"{impact1.sector.value}_{impact2.sector.value}"
                    
                    # Calculate correlation change based on impact directions
                    if impact1.direction == impact2.direction:
                        # Same direction increases correlation
                        correlation_change = min(impact1.magnitude, impact2.magnitude) * 0.5
                    else:
                        # Opposite directions decrease correlation
                        correlation_change = -min(impact1.magnitude, impact2.magnitude) * 0.3
                    
                    # Adjust for event severity
                    severity_multiplier = {
                        ImpactSeverity.MINIMAL: 0.1,
                        ImpactSeverity.LOW: 0.3,
                        ImpactSeverity.MODERATE: 0.5,
                        ImpactSeverity.HIGH: 0.8,
                        ImpactSeverity.CRITICAL: 1.0
                    }[assessment.severity]
                    
                    correlation_impacts[sector_pair] = correlation_change * severity_multiplier
            
            logger.info(f"Calculated {len(correlation_impacts)} correlation impacts")
            return correlation_impacts
            
        except Exception as e:
            logger.error(f"Error assessing correlation impact: {e}")
            return {}
    
    async def generate_trading_implications(
        self, 
        assessment: GeopoliticalImpactAssessment
    ) -> Dict[str, Any]:
        """
        Generate specific trading implications from the assessment
        
        Args:
            assessment: Geopolitical impact assessment
            
        Returns:
            Dictionary of trading implications and recommendations
        """
        try:
            implications = {
                "immediate_actions": [],
                "short_term_strategies": [],
                "long_term_positioning": [],
                "risk_management": [],
                "opportunities": []
            }
            
            # Immediate actions based on severity
            if assessment.severity in [ImpactSeverity.HIGH, ImpactSeverity.CRITICAL]:
                implications["immediate_actions"].extend([
                    "Reduce position sizes to manage volatility",
                    "Increase cash reserves for opportunities",
                    "Monitor news flow closely for developments"
                ])
            
            # Safe haven recommendations
            if assessment.safe_haven_demand > 0.6:
                implications["immediate_actions"].append(
                    "Consider increasing allocation to safe haven assets (BTC, gold, USD)"
                )
            
            # Sector-specific strategies
            for impact in assessment.sector_impacts:
                if impact.magnitude > 0.5:  # Significant impact
                    if impact.direction == "positive":
                        implications["opportunities"].append(
                            f"Long {impact.sector.value} - {impact.reasoning}"
                        )
                    elif impact.direction == "negative":
                        implications["risk_management"].append(
                            f"Reduce {impact.sector.value} exposure - {impact.reasoning}"
                        )
            
            # Volatility strategies
            if assessment.volatility_increase > 0.7:
                implications["short_term_strategies"].extend([
                    "Consider volatility trading strategies",
                    "Use options for downside protection",
                    "Implement stop-loss orders"
                ])
            
            # Prediction market opportunities
            for opportunity in assessment.prediction_opportunities:
                implications["opportunities"].append(f"Prediction market: {opportunity}")
            
            # Long-term positioning based on historical precedents
            if assessment.historical_precedents:
                implications["long_term_positioning"].append(
                    "Review historical precedents for recovery patterns"
                )
            
            logger.info("Generated comprehensive trading implications")
            return implications
            
        except Exception as e:
            logger.error(f"Error generating trading implications: {e}")
            return {}
    
    # Private helper methods
    
    def _classify_event_type(self, title: str, description: str) -> EventType:
        """Classify the type of geopolitical event"""
        text = (title + " " + description).lower()
        
        # Check patterns for each event type
        for event_type, patterns in self.event_patterns.items():
            if any(pattern in text for pattern in patterns):
                return event_type
        
        return EventType.DIPLOMATIC_RELATIONS  # Default
    
    def _assess_event_severity(
        self, title: str, description: str, event_type: EventType
    ) -> ImpactSeverity:
        """Assess the severity of the event"""
        text = (title + " " + description).lower()
        
        # Critical severity indicators
        critical_indicators = ["war", "invasion", "nuclear", "crisis", "collapse", "emergency"]
        if any(indicator in text for indicator in critical_indicators):
            return ImpactSeverity.CRITICAL
        
        # High severity indicators
        high_indicators = ["sanctions", "conflict", "crash", "recession", "default"]
        if any(indicator in text for indicator in high_indicators):
            return ImpactSeverity.HIGH
        
        # Moderate severity indicators
        moderate_indicators = ["election", "policy", "rates", "inflation", "trade"]
        if any(indicator in text for indicator in moderate_indicators):
            return ImpactSeverity.MODERATE
        
        # Event type based severity
        type_severity = {
            EventType.MILITARY_CONFLICT: ImpactSeverity.CRITICAL,
            EventType.ECONOMIC_CRISIS: ImpactSeverity.HIGH,
            EventType.SANCTIONS: ImpactSeverity.HIGH,
            EventType.MONETARY_POLICY: ImpactSeverity.MODERATE,
            EventType.ELECTION: ImpactSeverity.MODERATE,
            EventType.TRADE_POLICY: ImpactSeverity.MODERATE,
            EventType.REGULATORY_CHANGE: ImpactSeverity.LOW,
            EventType.DIPLOMATIC_RELATIONS: ImpactSeverity.LOW,
        }
        
        return type_severity.get(event_type, ImpactSeverity.LOW)
    
    def _identify_affected_regions(
        self, description: str, source_country: str, event_type: EventType
    ) -> List[str]:
        """Identify regions affected by the event"""
        regions = [source_country] if source_country != "Global" else []
        
        # Global impact events
        global_events = [
            EventType.ECONOMIC_CRISIS,
            EventType.MONETARY_POLICY,
            EventType.NATURAL_DISASTER
        ]
        
        if event_type in global_events:
            regions.extend(["Global", "US", "Europe", "Asia"])
        
        # Extract regions from description
        region_keywords = {
            "US": ["america", "united states", "usa", "federal reserve", "fed"],
            "Europe": ["europe", "european", "eu", "ecb", "eurozone"],
            "Asia": ["asia", "china", "japan", "korea", "india"],
            "Middle East": ["middle east", "israel", "iran", "saudi", "oil"],
            "Africa": ["africa", "african"],
            "Latin America": ["latin america", "brazil", "mexico", "argentina"]
        }
        
        text = description.lower()
        for region, keywords in region_keywords.items():
            if any(keyword in text for keyword in keywords):
                if region not in regions:
                    regions.append(region)
        
        return regions if regions else ["Global"]
    
    async def _analyze_sector_impacts(
        self, 
        event_type: EventType, 
        severity: ImpactSeverity,
        description: str,
        affected_regions: List[str]
    ) -> List[EventImpactVector]:
        """Analyze impact on different market sectors"""
        impacts = []
        
        # Get base impact model for event type
        base_impacts = self.impact_models.get(event_type, {})
        
        # Severity multiplier
        severity_multiplier = {
            ImpactSeverity.MINIMAL: 0.2,
            ImpactSeverity.LOW: 0.4,
            ImpactSeverity.MODERATE: 0.6,
            ImpactSeverity.HIGH: 0.8,
            ImpactSeverity.CRITICAL: 1.0
        }[severity]
        
        for sector in MarketSector:
            base_impact = base_impacts.get(sector, {"direction": "neutral", "magnitude": 0.0})
            
            # Adjust magnitude based on severity
            magnitude = base_impact["magnitude"] * severity_multiplier
            
            # Adjust based on affected regions
            if "Global" in affected_regions or len(affected_regions) > 2:
                magnitude *= 1.2  # Global events have higher impact
            
            # Generate reasoning
            reasoning = self._generate_sector_reasoning(
                sector, event_type, base_impact["direction"], magnitude
            )
            
            # Calculate confidence based on historical data availability
            confidence = self._calculate_sector_confidence(sector, event_type)
            
            # Determine timeframe
            timeframe = self._determine_impact_timeframe(sector, event_type)
            
            if magnitude > 0.1:  # Only include significant impacts
                impacts.append(EventImpactVector(
                    sector=sector,
                    direction=base_impact["direction"],
                    magnitude=min(magnitude, 1.0),
                    confidence=confidence,
                    timeframe=timeframe,
                    reasoning=reasoning
                ))
        
        return impacts
    
    def _calculate_overall_sentiment(self, sector_impacts: List[EventImpactVector]) -> float:
        """Calculate overall market sentiment from sector impacts"""
        if not sector_impacts:
            return 0.0
        
        weighted_sentiment = 0.0
        total_weight = 0.0
        
        # Sector weights (importance in overall market)
        sector_weights = {
            MarketSector.TRADITIONAL_FINANCE: 0.3,
            MarketSector.TECHNOLOGY: 0.25,
            MarketSector.CRYPTO: 0.15,
            MarketSector.ENERGY: 0.1,
            MarketSector.COMMODITIES: 0.1,
            MarketSector.DEFI: 0.05,
            MarketSector.HEALTHCARE: 0.05
        }
        
        for impact in sector_impacts:
            weight = sector_weights.get(impact.sector, 0.01)
            
            # Convert direction to sentiment
            sentiment_value = {
                "positive": 1.0,
                "negative": -1.0,
                "neutral": 0.0
            }.get(impact.direction, 0.0)
            
            weighted_sentiment += sentiment_value * impact.magnitude * weight * impact.confidence
            total_weight += weight
        
        return weighted_sentiment / max(total_weight, 0.01)
    
    def _assess_volatility_increase(self, event_type: EventType, severity: ImpactSeverity) -> float:
        """Assess expected volatility increase"""
        base_volatility = {
            EventType.MILITARY_CONFLICT: 0.9,
            EventType.ECONOMIC_CRISIS: 0.8,
            EventType.SANCTIONS: 0.7,
            EventType.ELECTION: 0.4,
            EventType.MONETARY_POLICY: 0.6,
            EventType.TRADE_POLICY: 0.5,
            EventType.REGULATORY_CHANGE: 0.3,
            EventType.NATURAL_DISASTER: 0.6,
            EventType.DIPLOMATIC_RELATIONS: 0.2,
            EventType.SOCIAL_UNREST: 0.5
        }.get(event_type, 0.3)
        
        severity_multiplier = {
            ImpactSeverity.MINIMAL: 0.2,
            ImpactSeverity.LOW: 0.4,
            ImpactSeverity.MODERATE: 0.6,
            ImpactSeverity.HIGH: 0.8,
            ImpactSeverity.CRITICAL: 1.0
        }[severity]
        
        return min(base_volatility * severity_multiplier, 1.0)
    
    def _assess_safe_haven_demand(self, event_type: EventType, severity: ImpactSeverity) -> float:
        """Assess expected safe haven asset demand"""
        safe_haven_events = [
            EventType.MILITARY_CONFLICT,
            EventType.ECONOMIC_CRISIS,
            EventType.SANCTIONS,
            EventType.NATURAL_DISASTER
        ]
        
        if event_type in safe_haven_events:
            base_demand = 0.8
        else:
            base_demand = 0.3
        
        severity_multiplier = {
            ImpactSeverity.MINIMAL: 0.2,
            ImpactSeverity.LOW: 0.4,
            ImpactSeverity.MODERATE: 0.6,
            ImpactSeverity.HIGH: 0.8,
            ImpactSeverity.CRITICAL: 1.0
        }[severity]
        
        return min(base_demand * severity_multiplier, 1.0)
    
    def _calculate_risk_off_probability(
        self, event_type: EventType, severity: ImpactSeverity, sentiment: float
    ) -> float:
        """Calculate probability of risk-off market behavior"""
        # Base probability from event type
        risk_off_events = {
            EventType.MILITARY_CONFLICT: 0.9,
            EventType.ECONOMIC_CRISIS: 0.8,
            EventType.SANCTIONS: 0.6,
            EventType.NATURAL_DISASTER: 0.5,
            EventType.ELECTION: 0.3,
            EventType.MONETARY_POLICY: 0.4,
        }
        
        base_probability = risk_off_events.get(event_type, 0.2)
        
        # Adjust for severity
        severity_adjustment = {
            ImpactSeverity.MINIMAL: 0.2,
            ImpactSeverity.LOW: 0.4,
            ImpactSeverity.MODERATE: 0.6,
            ImpactSeverity.HIGH: 0.8,
            ImpactSeverity.CRITICAL: 1.0
        }[severity]
        
        # Adjust for sentiment (negative sentiment increases risk-off probability)
        sentiment_adjustment = max(0, -sentiment * 0.3)
        
        return min(base_probability * severity_adjustment + sentiment_adjustment, 1.0)
    
    def _identify_prediction_opportunities(
        self, event_type: EventType, description: str, regions: List[str]
    ) -> List[str]:
        """Identify potential prediction market opportunities"""
        opportunities = []
        
        # Event type specific opportunities
        type_opportunities = {
            EventType.ELECTION: [
                "Election outcome predictions",
                "Policy implementation timelines",
                "Market reaction magnitude"
            ],
            EventType.MONETARY_POLICY: [
                "Interest rate change predictions",
                "Inflation target achievement",
                "Currency movement direction"
            ],
            EventType.TRADE_POLICY: [
                "Trade deal completion",
                "Tariff implementation",
                "Economic impact magnitude"
            ],
            EventType.MILITARY_CONFLICT: [
                "Conflict duration predictions",
                "Diplomatic resolution timeline",
                "Commodity price movements"
            ],
            EventType.ECONOMIC_CRISIS: [
                "Recession duration",
                "Recovery timeline",
                "Policy response effectiveness"
            ]
        }
        
        opportunities.extend(type_opportunities.get(event_type, []))
        
        # Region specific opportunities
        if "US" in regions:
            opportunities.extend([
                "US market performance",
                "Federal Reserve response",
                "Dollar strength"
            ])
        
        if "Europe" in regions:
            opportunities.extend([
                "European market impact",
                "ECB policy response",
                "Euro stability"
            ])
        
        return opportunities
    
    def _find_historical_precedents(
        self, event_type: EventType, severity: ImpactSeverity
    ) -> List[str]:
        """Find historical precedents for similar events"""
        precedents = []
        
        # Filter precedents by event type and severity
        for precedent in self.historical_precedents:
            if (precedent["event_type"] == event_type and 
                precedent["severity"] == severity):
                precedents.append(precedent["description"])
        
        return precedents[:5]  # Return top 5 most relevant
    
    def _calculate_assessment_confidence(
        self, event_type: EventType, severity: ImpactSeverity, precedent_count: int
    ) -> float:
        """Calculate confidence in the assessment"""
        # Base confidence by event type (how well understood the impacts are)
        type_confidence = {
            EventType.MONETARY_POLICY: 0.8,
            EventType.ELECTION: 0.7,
            EventType.TRADE_POLICY: 0.6,
            EventType.ECONOMIC_CRISIS: 0.7,
            EventType.SANCTIONS: 0.6,
            EventType.MILITARY_CONFLICT: 0.5,
            EventType.NATURAL_DISASTER: 0.4,
            EventType.REGULATORY_CHANGE: 0.6,
            EventType.DIPLOMATIC_RELATIONS: 0.5,
            EventType.SOCIAL_UNREST: 0.4
        }.get(event_type, 0.5)
        
        # Adjust for historical precedents
        precedent_boost = min(precedent_count * 0.1, 0.3)
        
        # Adjust for severity (extreme events are harder to predict)
        severity_adjustment = {
            ImpactSeverity.MINIMAL: 1.0,
            ImpactSeverity.LOW: 0.9,
            ImpactSeverity.MODERATE: 0.8,
            ImpactSeverity.HIGH: 0.7,
            ImpactSeverity.CRITICAL: 0.6
        }[severity]
        
        return min((type_confidence + precedent_boost) * severity_adjustment, 1.0)
    
    def _generate_sector_reasoning(
        self, sector: MarketSector, event_type: EventType, direction: str, magnitude: float
    ) -> str:
        """Generate reasoning for sector impact"""
        reasoning_templates = {
            (MarketSector.CRYPTO, EventType.MONETARY_POLICY): 
                "Monetary policy changes affect crypto as alternative store of value",
            (MarketSector.ENERGY, EventType.MILITARY_CONFLICT): 
                "Military conflicts typically disrupt energy supply chains",
            (MarketSector.TRADITIONAL_FINANCE, EventType.ECONOMIC_CRISIS): 
                "Economic crises directly impact traditional financial institutions",
            (MarketSector.TECHNOLOGY, EventType.TRADE_POLICY): 
                "Trade policies affect global technology supply chains",
        }
        
        template = reasoning_templates.get((sector, event_type))
        if template:
            return f"{template} - {direction} impact expected ({magnitude:.1%} magnitude)"
        
        return f"{event_type.value} events typically have {direction} impact on {sector.value}"
    
    def _calculate_sector_confidence(self, sector: MarketSector, event_type: EventType) -> float:
        """Calculate confidence in sector impact assessment"""
        # Some sector-event combinations are better understood
        high_confidence_pairs = [
            (MarketSector.ENERGY, EventType.MILITARY_CONFLICT),
            (MarketSector.TRADITIONAL_FINANCE, EventType.MONETARY_POLICY),
            (MarketSector.COMMODITIES, EventType.NATURAL_DISASTER),
        ]
        
        if (sector, event_type) in high_confidence_pairs:
            return 0.9
        
        return 0.6  # Default confidence
    
    def _determine_impact_timeframe(self, sector: MarketSector, event_type: EventType) -> str:
        """Determine the timeframe of impact"""
        immediate_impact_events = [
            EventType.MILITARY_CONFLICT,
            EventType.NATURAL_DISASTER,
            EventType.ECONOMIC_CRISIS
        ]
        
        if event_type in immediate_impact_events:
            return "immediate"
        
        # Sector-specific timeframes
        fast_reaction_sectors = [MarketSector.CRYPTO, MarketSector.TRADITIONAL_FINANCE]
        if sector in fast_reaction_sectors:
            return "short_term"
        
        return "medium_term"
    
    def _create_default_assessment(
        self, event_title: str, event_timestamp: datetime
    ) -> GeopoliticalImpactAssessment:
        """Create a default assessment when analysis fails"""
        return GeopoliticalImpactAssessment(
            event_id=f"geo_default_{hash(event_title)}",
            event_type=EventType.DIPLOMATIC_RELATIONS,
            severity=ImpactSeverity.LOW,
            affected_regions=["Global"],
            sector_impacts=[],
            overall_market_sentiment=0.0,
            volatility_increase=0.1,
            safe_haven_demand=0.1,
            risk_off_probability=0.1,
            prediction_opportunities=[],
            historical_precedents=[],
            assessment_confidence=0.1,
            created_at=datetime.now()
        )
    
    def _load_historical_precedents(self) -> List[Dict[str, Any]]:
        """Load historical precedent database"""
        # Simplified historical precedents (would be loaded from database)
        return [
            {
                "event_type": EventType.MONETARY_POLICY,
                "severity": ImpactSeverity.HIGH,
                "description": "2008 Financial Crisis - Fed Rate Cuts",
                "market_reaction": {"crypto": 0.0, "traditional_finance": -0.8, "commodities": 0.3}
            },
            {
                "event_type": EventType.MILITARY_CONFLICT,
                "severity": ImpactSeverity.CRITICAL,
                "description": "Russia-Ukraine Conflict 2022",
                "market_reaction": {"crypto": -0.2, "energy": 0.6, "commodities": 0.4}
            },
            # Add more historical precedents...
        ]
    
    def _initialize_event_patterns(self) -> Dict[EventType, List[str]]:
        """Initialize event classification patterns"""
        return {
            EventType.ELECTION: ["election", "vote", "candidate", "campaign", "ballot"],
            EventType.MONETARY_POLICY: ["interest rate", "fed", "central bank", "monetary", "inflation"],
            EventType.TRADE_POLICY: ["trade", "tariff", "import", "export", "wto"],
            EventType.MILITARY_CONFLICT: ["war", "conflict", "military", "invasion", "attack"],
            EventType.SANCTIONS: ["sanctions", "embargo", "restrictions", "penalties"],
            EventType.REGULATORY_CHANGE: ["regulation", "law", "compliance", "rules", "policy"],
            EventType.ECONOMIC_CRISIS: ["crisis", "recession", "depression", "collapse", "bailout"],
            EventType.NATURAL_DISASTER: ["earthquake", "hurricane", "flood", "disaster", "emergency"],
            EventType.DIPLOMATIC_RELATIONS: ["diplomatic", "embassy", "ambassador", "treaty"],
            EventType.SOCIAL_UNREST: ["protest", "riot", "unrest", "demonstration", "strike"]
        }
    
    def _initialize_sector_correlations(self) -> Dict[str, float]:
        """Initialize sector correlation matrix"""
        # Simplified correlation matrix
        return {
            "crypto_traditional_finance": 0.3,
            "crypto_technology": 0.6,
            "energy_commodities": 0.8,
            "traditional_finance_real_estate": 0.5,
        }
    
    def _initialize_impact_models(self) -> Dict[EventType, Dict[MarketSector, Dict[str, Any]]]:
        """Initialize impact models for different event types"""
        return {
            EventType.MONETARY_POLICY: {
                MarketSector.CRYPTO: {"direction": "positive", "magnitude": 0.6},
                MarketSector.TRADITIONAL_FINANCE: {"direction": "negative", "magnitude": 0.4},
                MarketSector.REAL_ESTATE: {"direction": "negative", "magnitude": 0.5},
            },
            EventType.MILITARY_CONFLICT: {
                MarketSector.ENERGY: {"direction": "positive", "magnitude": 0.8},
                MarketSector.DEFENSE: {"direction": "positive", "magnitude": 0.7},
                MarketSector.CRYPTO: {"direction": "positive", "magnitude": 0.3},
                MarketSector.TRADITIONAL_FINANCE: {"direction": "negative", "magnitude": 0.6},
            },
            EventType.ECONOMIC_CRISIS: {
                MarketSector.TRADITIONAL_FINANCE: {"direction": "negative", "magnitude": 0.9},
                MarketSector.CRYPTO: {"direction": "negative", "magnitude": 0.5},
                MarketSector.COMMODITIES: {"direction": "positive", "magnitude": 0.4},
            },
            # Add more impact models...
        }

# Example usage
async def main():
    """Example usage of the Geopolitical Analyzer"""
    config = {}
    
    analyzer = GeopoliticalAnalyzer(config)
    
    # Analyze a sample event
    assessment = await analyzer.analyze_event_impact(
        event_title="Federal Reserve Raises Interest Rates by 0.75%",
        event_description="The Federal Reserve announced a significant interest rate hike to combat inflation, marking the largest increase in decades.",
        event_timestamp=datetime.now(),
        source_country="US"
    )
    
    print(f"Event Type: {assessment.event_type.value}")
    print(f"Severity: {assessment.severity.value}")
    print(f"Overall Sentiment: {assessment.overall_market_sentiment:.2f}")
    print(f"Volatility Increase: {assessment.volatility_increase:.2%}")
    print(f"Assessment Confidence: {assessment.assessment_confidence:.2%}")
    
    # Generate trading implications
    implications = await analyzer.generate_trading_implications(assessment)
    print(f"\nImmediate Actions: {implications['immediate_actions']}")
    print(f"Opportunities: {implications['opportunities']}")

if __name__ == "__main__":
    asyncio.run(main())