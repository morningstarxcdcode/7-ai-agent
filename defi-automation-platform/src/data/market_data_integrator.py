"""
Market Data Integrator

Integrates with multiple market data APIs including CoinGecko, Glassnode,
and other free-tier services for comprehensive market analysis.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass
import aiohttp
import json
from decimal import Decimal
import time

logger = logging.getLogger(__name__)

@dataclass
class MarketDataPoint:
    """Single market data point"""
    timestamp: datetime
    symbol: str
    price: Decimal
    volume: Decimal
    market_cap: Optional[Decimal] = None
    change_24h: Optional[float] = None
    source: str = ""

@dataclass
class EconomicIndicator:
    """Economic indicator data point"""
    indicator_name: str
    value: float
    timestamp: datetime
    country: str
    category: str
    source: str
    previous_value: Optional[float] = None
    forecast: Optional[float] = None

@dataclass
class GeopoliticalEvent:
    """Geopolitical event data"""
    event_id: str
    title: str
    description: str
    timestamp: datetime
    country: str
    impact_level: str  # "low", "medium", "high", "critical"
    category: str
    source: str
    sentiment_score: Optional[float] = None

class RateLimiter:
    """Simple rate limiter for API calls"""
    
    def __init__(self, calls_per_minute: int):
        self.calls_per_minute = calls_per_minute
        self.calls = []
    
    async def acquire(self):
        """Acquire permission to make an API call"""
        now = time.time()
        
        # Remove calls older than 1 minute
        self.calls = [call_time for call_time in self.calls if now - call_time < 60]
        
        # Check if we can make a call
        if len(self.calls) >= self.calls_per_minute:
            sleep_time = 60 - (now - self.calls[0])
            if sleep_time > 0:
                await asyncio.sleep(sleep_time)
        
        self.calls.append(now)

class MarketDataIntegrator:
    """
    Integrates with multiple market data APIs to provide comprehensive
    market analysis data for the Prediction Market Analyst Agent.
    """
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.session: Optional[aiohttp.ClientSession] = None
        self.api_keys = config.get("api_keys", {})
        
        # Rate limiters for different APIs
        self.rate_limiters = {
            "coingecko": RateLimiter(50),  # 50 calls per minute for free tier
            "glassnode": RateLimiter(100),  # 100 calls per minute for free tier
            "news_api": RateLimiter(100),   # 100 calls per minute for free tier
            "economic_calendar": RateLimiter(60),  # Conservative limit
        }
        
        # API endpoints
        self.endpoints = {
            "coingecko": {
                "base": "https://api.coingecko.com/api/v3",
                "global": "/global",
                "markets": "/coins/markets",
                "trending": "/search/trending",
                "fear_greed": "/simple/price",
            },
            "glassnode": {
                "base": "https://api.glassnode.com/v1",
                "metrics": "/metrics",
            },
            "news_api": {
                "base": "https://newsapi.org/v2",
                "everything": "/everything",
                "top_headlines": "/top-headlines",
            },
            "economic_calendar": {
                "base": "https://api.tradingeconomics.com",
                "calendar": "/calendar",
                "indicators": "/indicators",
            },
            "fred": {
                "base": "https://api.stlouisfed.org/fred",
                "series": "/series/observations",
            }
        }
        
        # Cache for API responses
        self.cache = {}
        self.cache_ttl = config.get("cache_ttl", 300)  # 5 minutes default
    
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
    
    async def get_crypto_market_data(
        self, 
        symbols: Optional[List[str]] = None,
        limit: int = 100
    ) -> List[MarketDataPoint]:
        """
        Get cryptocurrency market data from CoinGecko
        
        Args:
            symbols: List of symbols to fetch (None for top coins)
            limit: Maximum number of coins to fetch
            
        Returns:
            List of market data points
        """
        try:
            cache_key = f"crypto_market_data_{limit}_{hash(str(symbols))}"
            
            # Check cache
            if self._is_cached(cache_key):
                return self.cache[cache_key]["data"]
            
            await self.rate_limiters["coingecko"].acquire()
            
            params = {
                "vs_currency": "usd",
                "order": "market_cap_desc",
                "per_page": limit,
                "page": 1,
                "sparkline": False,
                "price_change_percentage": "24h"
            }
            
            if symbols:
                params["ids"] = ",".join(symbols)
            
            url = f"{self.endpoints['coingecko']['base']}{self.endpoints['coingecko']['markets']}"
            
            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    market_data = []
                    for coin in data:
                        market_data.append(MarketDataPoint(
                            timestamp=datetime.now(),
                            symbol=coin["symbol"].upper(),
                            price=Decimal(str(coin["current_price"])),
                            volume=Decimal(str(coin["total_volume"])),
                            market_cap=Decimal(str(coin["market_cap"])) if coin["market_cap"] else None,
                            change_24h=coin.get("price_change_percentage_24h"),
                            source="coingecko"
                        ))
                    
                    # Cache the result
                    self._cache_data(cache_key, market_data)
                    
                    logger.info(f"Fetched {len(market_data)} crypto market data points")
                    return market_data
                else:
                    logger.error(f"CoinGecko API error: {response.status}")
                    return []
                    
        except Exception as e:
            logger.error(f"Error fetching crypto market data: {e}")
            return []
    
    async def get_global_crypto_metrics(self) -> Dict[str, Any]:
        """
        Get global cryptocurrency metrics from CoinGecko
        
        Returns:
            Dictionary of global crypto metrics
        """
        try:
            cache_key = "global_crypto_metrics"
            
            # Check cache
            if self._is_cached(cache_key):
                return self.cache[cache_key]["data"]
            
            await self.rate_limiters["coingecko"].acquire()
            
            url = f"{self.endpoints['coingecko']['base']}{self.endpoints['coingecko']['global']}"
            
            async with self.session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    metrics = {
                        "total_market_cap_usd": data["data"]["total_market_cap"]["usd"],
                        "total_volume_usd": data["data"]["total_volume"]["usd"],
                        "market_cap_change_24h": data["data"]["market_cap_change_percentage_24h_usd"],
                        "bitcoin_dominance": data["data"]["market_cap_percentage"]["btc"],
                        "ethereum_dominance": data["data"]["market_cap_percentage"]["eth"],
                        "active_cryptocurrencies": data["data"]["active_cryptocurrencies"],
                        "markets": data["data"]["markets"],
                        "defi_volume_24h": data["data"].get("defi_volume_24h", 0),
                        "defi_dominance": data["data"].get("defi_dominance", 0),
                    }
                    
                    # Cache the result
                    self._cache_data(cache_key, metrics)
                    
                    logger.info("Fetched global crypto metrics")
                    return metrics
                else:
                    logger.error(f"CoinGecko global API error: {response.status}")
                    return {}
                    
        except Exception as e:
            logger.error(f"Error fetching global crypto metrics: {e}")
            return {}
    
    async def get_trending_searches(self) -> List[Dict[str, Any]]:
        """
        Get trending cryptocurrency searches from CoinGecko
        
        Returns:
            List of trending search data
        """
        try:
            cache_key = "trending_searches"
            
            # Check cache
            if self._is_cached(cache_key):
                return self.cache[cache_key]["data"]
            
            await self.rate_limiters["coingecko"].acquire()
            
            url = f"{self.endpoints['coingecko']['base']}{self.endpoints['coingecko']['trending']}"
            
            async with self.session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    trending = []
                    for coin in data["coins"]:
                        trending.append({
                            "id": coin["item"]["id"],
                            "name": coin["item"]["name"],
                            "symbol": coin["item"]["symbol"],
                            "market_cap_rank": coin["item"]["market_cap_rank"],
                            "score": coin["item"]["score"],
                        })
                    
                    # Cache the result
                    self._cache_data(cache_key, trending)
                    
                    logger.info(f"Fetched {len(trending)} trending searches")
                    return trending
                else:
                    logger.error(f"CoinGecko trending API error: {response.status}")
                    return []
                    
        except Exception as e:
            logger.error(f"Error fetching trending searches: {e}")
            return []
    
    async def get_on_chain_metrics(self, asset: str = "BTC") -> Dict[str, Any]:
        """
        Get on-chain metrics from Glassnode (free tier)
        
        Args:
            asset: Asset symbol (BTC, ETH, etc.)
            
        Returns:
            Dictionary of on-chain metrics
        """
        try:
            if not self.api_keys.get("glassnode"):
                logger.warning("Glassnode API key not configured")
                return {}
            
            cache_key = f"on_chain_metrics_{asset}"
            
            # Check cache
            if self._is_cached(cache_key):
                return self.cache[cache_key]["data"]
            
            await self.rate_limiters["glassnode"].acquire()
            
            # Free tier metrics
            metrics_to_fetch = [
                "addresses/active_count",
                "transactions/count",
                "market/price_usd_close",
                "market/marketcap_usd",
            ]
            
            metrics = {}
            base_url = self.endpoints["glassnode"]["base"]
            
            for metric in metrics_to_fetch:
                try:
                    url = f"{base_url}{self.endpoints['glassnode']['metrics']}/{metric}"
                    params = {
                        "a": asset,
                        "api_key": self.api_keys["glassnode"],
                        "s": int((datetime.now() - timedelta(days=1)).timestamp()),
                        "u": int(datetime.now().timestamp()),
                    }
                    
                    async with self.session.get(url, params=params) as response:
                        if response.status == 200:
                            data = await response.json()
                            if data:
                                metrics[metric.replace("/", "_")] = data[-1]["v"]  # Latest value
                        
                        # Rate limiting
                        await asyncio.sleep(0.1)
                        
                except Exception as e:
                    logger.error(f"Error fetching {metric}: {e}")
                    continue
            
            # Cache the result
            self._cache_data(cache_key, metrics)
            
            logger.info(f"Fetched {len(metrics)} on-chain metrics for {asset}")
            return metrics
            
        except Exception as e:
            logger.error(f"Error fetching on-chain metrics: {e}")
            return {}
    
    async def get_economic_indicators(self, indicators: List[str]) -> List[EconomicIndicator]:
        """
        Get economic indicators from FRED API (free)
        
        Args:
            indicators: List of FRED series IDs
            
        Returns:
            List of economic indicators
        """
        try:
            if not self.api_keys.get("fred"):
                logger.warning("FRED API key not configured")
                return []
            
            cache_key = f"economic_indicators_{hash(str(indicators))}"
            
            # Check cache
            if self._is_cached(cache_key):
                return self.cache[cache_key]["data"]
            
            economic_data = []
            base_url = self.endpoints["fred"]["base"]
            
            for series_id in indicators:
                try:
                    url = f"{base_url}{self.endpoints['fred']['series']}"
                    params = {
                        "series_id": series_id,
                        "api_key": self.api_keys["fred"],
                        "file_type": "json",
                        "limit": 1,
                        "sort_order": "desc",
                    }
                    
                    async with self.session.get(url, params=params) as response:
                        if response.status == 200:
                            data = await response.json()
                            
                            if data["observations"]:
                                obs = data["observations"][0]
                                if obs["value"] != ".":  # Valid data point
                                    economic_data.append(EconomicIndicator(
                                        indicator_name=series_id,
                                        value=float(obs["value"]),
                                        timestamp=datetime.strptime(obs["date"], "%Y-%m-%d"),
                                        country="US",
                                        category="economic",
                                        source="fred"
                                    ))
                    
                    # Rate limiting
                    await asyncio.sleep(0.1)
                    
                except Exception as e:
                    logger.error(f"Error fetching indicator {series_id}: {e}")
                    continue
            
            # Cache the result
            self._cache_data(cache_key, economic_data)
            
            logger.info(f"Fetched {len(economic_data)} economic indicators")
            return economic_data
            
        except Exception as e:
            logger.error(f"Error fetching economic indicators: {e}")
            return []
    
    async def get_news_sentiment(
        self, 
        keywords: List[str], 
        days_back: int = 7
    ) -> List[Dict[str, Any]]:
        """
        Get news articles and sentiment for given keywords
        
        Args:
            keywords: List of keywords to search for
            days_back: Number of days to look back
            
        Returns:
            List of news articles with sentiment
        """
        try:
            if not self.api_keys.get("news_api"):
                logger.warning("News API key not configured")
                return []
            
            cache_key = f"news_sentiment_{hash(str(keywords))}_{days_back}"
            
            # Check cache
            if self._is_cached(cache_key):
                return self.cache[cache_key]["data"]
            
            await self.rate_limiters["news_api"].acquire()
            
            from_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")
            
            url = f"{self.endpoints['news_api']['base']}{self.endpoints['news_api']['everything']}"
            params = {
                "q": " OR ".join(keywords),
                "from": from_date,
                "sortBy": "relevancy",
                "language": "en",
                "apiKey": self.api_keys["news_api"],
                "pageSize": 50,
            }
            
            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    articles = []
                    for article in data.get("articles", []):
                        # Simple sentiment analysis (would use proper NLP in production)
                        sentiment_score = self._analyze_sentiment(
                            article.get("title", "") + " " + article.get("description", "")
                        )
                        
                        articles.append({
                            "title": article["title"],
                            "description": article["description"],
                            "url": article["url"],
                            "published_at": article["publishedAt"],
                            "source": article["source"]["name"],
                            "sentiment_score": sentiment_score,
                        })
                    
                    # Cache the result
                    self._cache_data(cache_key, articles)
                    
                    logger.info(f"Fetched {len(articles)} news articles")
                    return articles
                else:
                    logger.error(f"News API error: {response.status}")
                    return []
                    
        except Exception as e:
            logger.error(f"Error fetching news sentiment: {e}")
            return []
    
    async def get_geopolitical_events(self, days_back: int = 30) -> List[GeopoliticalEvent]:
        """
        Get geopolitical events from news sources
        
        Args:
            days_back: Number of days to look back
            
        Returns:
            List of geopolitical events
        """
        try:
            # Keywords for geopolitical events
            geopolitical_keywords = [
                "election", "war", "sanctions", "trade war", "central bank",
                "federal reserve", "ECB", "inflation", "recession", "GDP",
                "unemployment", "interest rates", "monetary policy"
            ]
            
            news_articles = await self.get_news_sentiment(geopolitical_keywords, days_back)
            
            events = []
            for article in news_articles:
                # Classify as geopolitical event based on keywords and sentiment
                if self._is_geopolitical_event(article):
                    impact_level = self._assess_impact_level(article)
                    
                    event = GeopoliticalEvent(
                        event_id=f"geo_{hash(article['url'])}",
                        title=article["title"],
                        description=article["description"] or "",
                        timestamp=datetime.fromisoformat(article["published_at"].replace("Z", "+00:00")),
                        country=self._extract_country(article),
                        impact_level=impact_level,
                        category="geopolitical",
                        source=article["source"],
                        sentiment_score=article["sentiment_score"]
                    )
                    events.append(event)
            
            logger.info(f"Identified {len(events)} geopolitical events")
            return events
            
        except Exception as e:
            logger.error(f"Error fetching geopolitical events: {e}")
            return []
    
    # Private helper methods
    
    def _is_cached(self, key: str) -> bool:
        """Check if data is cached and still valid"""
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
    
    def _analyze_sentiment(self, text: str) -> float:
        """
        Simple sentiment analysis
        
        Args:
            text: Text to analyze
            
        Returns:
            Sentiment score (-1.0 to 1.0)
        """
        # Simple keyword-based sentiment (would use proper NLP in production)
        positive_words = ["good", "great", "excellent", "positive", "bullish", "growth", "up", "rise"]
        negative_words = ["bad", "terrible", "negative", "bearish", "decline", "down", "fall", "crash"]
        
        text_lower = text.lower()
        
        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)
        
        total_words = len(text.split())
        if total_words == 0:
            return 0.0
        
        sentiment = (positive_count - negative_count) / max(total_words, 1)
        return max(-1.0, min(1.0, sentiment * 10))  # Scale and clamp
    
    def _is_geopolitical_event(self, article: Dict[str, Any]) -> bool:
        """Determine if an article represents a geopolitical event"""
        geopolitical_indicators = [
            "election", "government", "policy", "central bank", "federal reserve",
            "sanctions", "trade", "war", "conflict", "diplomatic"
        ]
        
        text = (article.get("title", "") + " " + article.get("description", "")).lower()
        
        return any(indicator in text for indicator in geopolitical_indicators)
    
    def _assess_impact_level(self, article: Dict[str, Any]) -> str:
        """Assess the impact level of a geopolitical event"""
        high_impact_keywords = ["war", "crisis", "crash", "emergency", "sanctions"]
        medium_impact_keywords = ["election", "policy", "rates", "inflation"]
        
        text = (article.get("title", "") + " " + article.get("description", "")).lower()
        
        if any(keyword in text for keyword in high_impact_keywords):
            return "high"
        elif any(keyword in text for keyword in medium_impact_keywords):
            return "medium"
        else:
            return "low"
    
    def _extract_country(self, article: Dict[str, Any]) -> str:
        """Extract country from article (simplified)"""
        countries = ["US", "USA", "China", "Europe", "UK", "Japan", "Germany", "France"]
        text = article.get("title", "") + " " + article.get("description", "")
        
        for country in countries:
            if country.lower() in text.lower():
                return country
        
        return "Global"

# Example usage
async def main():
    """Example usage of the Market Data Integrator"""
    config = {
        "api_keys": {
            "coingecko": "",  # Free tier, no key needed
            "glassnode": "",  # Free tier key
            "news_api": "",   # Free tier key
            "fred": "",       # Free API key
        },
        "cache_ttl": 300
    }
    
    async with MarketDataIntegrator(config) as integrator:
        # Get crypto market data
        market_data = await integrator.get_crypto_market_data(limit=10)
        print(f"Fetched {len(market_data)} market data points")
        
        # Get global metrics
        global_metrics = await integrator.get_global_crypto_metrics()
        print(f"Global market cap: ${global_metrics.get('total_market_cap_usd', 0):,.0f}")
        
        # Get trending searches
        trending = await integrator.get_trending_searches()
        print(f"Top trending: {[t['name'] for t in trending[:3]]}")
        
        # Get economic indicators
        indicators = await integrator.get_economic_indicators(["GDP", "UNRATE", "CPIAUCSL"])
        print(f"Fetched {len(indicators)} economic indicators")
        
        # Get news sentiment
        news = await integrator.get_news_sentiment(["bitcoin", "ethereum", "crypto"], days_back=3)
        print(f"Analyzed {len(news)} news articles")
        
        # Get geopolitical events
        events = await integrator.get_geopolitical_events(days_back=7)
        print(f"Identified {len(events)} geopolitical events")

if __name__ == "__main__":
    asyncio.run(main())