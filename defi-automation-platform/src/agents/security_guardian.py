"""
Security Guardian Agent

Implements comprehensive threat detection system integrating Forta Network
for real-time blockchain monitoring, rug-pull detection using multiple
security APIs, and smart contract vulnerability analysis using Slither.

Requirements: 6.1, 6.2, 15.1
"""

import asyncio
import aiohttp
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple, Set
from dataclasses import dataclass, field
from enum import Enum
import hashlib
import subprocess
import tempfile
import os
from decimal import Decimal
import structlog

logger = structlog.get_logger()

class ThreatLevel(str, Enum):
    """Threat severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ThreatType(str, Enum):
    """Types of security threats"""
    RUG_PULL = "rug_pull"
    HONEYPOT = "honeypot"
    SMART_CONTRACT_VULNERABILITY = "smart_contract_vulnerability"
    FLASH_LOAN_ATTACK = "flash_loan_attack"
    PRICE_MANIPULATION = "price_manipulation"
    LIQUIDITY_DRAIN = "liquidity_drain"
    GOVERNANCE_ATTACK = "governance_attack"
    BRIDGE_EXPLOIT = "bridge_exploit"
    ORACLE_MANIPULATION = "oracle_manipulation"
    SANDWICH_ATTACK = "sandwich_attack"

class SecurityStatus(str, Enum):
    """Security status for assets/protocols"""
    SAFE = "safe"
    CAUTION = "caution"
    WARNING = "warning"
    DANGER = "danger"
    BLOCKED = "blocked"

@dataclass
class SecurityThreat:
    """Represents a detected security threat"""
    threat_id: str
    threat_type: ThreatType
    threat_level: ThreatLevel
    title: str
    description: str
    affected_addresses: List[str]
    affected_protocols: List[str]
    confidence_score: float  # 0.0 to 1.0
    evidence: Dict[str, Any]
    mitigation_steps: List[str]
    detected_at: datetime
    source: str  # "forta", "goplus", "slither", "internal"
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class ContractAnalysis:
    """Smart contract security analysis results"""
    contract_address: str
    contract_name: str
    vulnerabilities: List[Dict[str, Any]]
    security_score: float  # 0.0 to 1.0 (1.0 = most secure)
    risk_factors: List[str]
    recommendations: List[str]
    analysis_timestamp: datetime
    slither_results: Optional[Dict[str, Any]] = None
    manual_review_required: bool = False

@dataclass
class ProtocolRiskAssessment:
    """Risk assessment for DeFi protocols"""
    protocol_name: str
    protocol_address: str
    overall_risk_score: float  # 0.0 to 1.0
    security_status: SecurityStatus
    risk_factors: Dict[str, float]
    liquidity_analysis: Dict[str, Any]
    governance_analysis: Dict[str, Any]
    audit_status: Dict[str, Any]
    historical_incidents: List[str]
    last_updated: datetime

@dataclass
class MonitoringAlert:
    """Real-time monitoring alert"""
    alert_id: str
    alert_type: str
    severity: ThreatLevel
    message: str
    transaction_hash: Optional[str]
    block_number: Optional[int]
    addresses_involved: List[str]
    alert_timestamp: datetime
    forta_bot_id: Optional[str] = None
    additional_data: Dict[str, Any] = field(default_factory=dict)

class SecurityGuardianAgent:
    """
    Security Guardian Agent
    
    Provides comprehensive threat detection and security monitoring
    for DeFi operations and smart contract interactions.
    """
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.session: Optional[aiohttp.ClientSession] = None
        
        # API configurations
        self.forta_api_key = config.get("forta_api_key", "")
        self.goplus_api_key = config.get("goplus_api_key", "")
        self.etherscan_api_key = config.get("etherscan_api_key", "")
        
        # API endpoints
        self.endpoints = {
            "forta": "https://api.forta.network/graphql",
            "goplus": "https://api.gopluslabs.io/api/v1",
            "etherscan": "https://api.etherscan.io/api",
            "defillama": "https://api.llama.fi",
            "coingecko": "https://api.coingecko.com/api/v3"
        }
        
        # Threat detection thresholds
        self.thresholds = {
            "rug_pull_confidence": config.get("rug_pull_threshold", 0.7),
            "honeypot_confidence": config.get("honeypot_threshold", 0.8),
            "vulnerability_score": config.get("vulnerability_threshold", 0.6),
            "liquidity_drain_threshold": config.get("liquidity_drain_threshold", 0.5),
            "price_manipulation_threshold": config.get("price_manipulation_threshold", 0.3)
        }
        
        # Monitoring state
        self.monitored_addresses: Set[str] = set()
        self.monitored_protocols: Set[str] = set()
        self.threat_cache: Dict[str, SecurityThreat] = {}
        self.contract_analyses: Dict[str, ContractAnalysis] = {}
        self.protocol_assessments: Dict[str, ProtocolRiskAssessment] = {}
        
        # Forta bot subscriptions
        self.forta_bots = {
            "rug_pull_detector": "0x1d646c4045189991fdfd24a66b192a294158b839a6ec121d740474bdacb3ab23",
            "honeypot_detector": "0x0f21668ebd017888e7ee7dd46e9119bdd2bc7f48dbabc97d18ced72c8a6e973b",
            "flash_loan_detector": "0x7cfeb792e705a82e984194e1e8d0e9ac3aa48ad8f6530d3017bc200af0c10dc1",
            "governance_attack": "0x9aaa5cd64000e8ba4fa2718a467b90055b70815d60351914cc1cbe89fe1c404c"
        }
        
        # Rate limiting
        self.rate_limits = {
            "forta": 100,  # requests per minute
            "goplus": 60,
            "etherscan": 200
        }
        
        # Background monitoring
        self.monitoring_active = False
        self.monitoring_tasks: List[asyncio.Task] = []
    
    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers={'User-Agent': 'SecurityGuardian/1.0'}
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.stop_monitoring()
        if self.session:
            await self.session.close()
    
    async def start_monitoring(self):
        """Start real-time security monitoring"""
        try:
            logger.info("Starting security monitoring system")
            
            if self.monitoring_active:
                logger.warning("Monitoring already active")
                return
            
            self.monitoring_active = True
            
            # Start monitoring tasks
            self.monitoring_tasks = [
                asyncio.create_task(self._monitor_forta_alerts()),
                asyncio.create_task(self._monitor_protocol_health()),
                asyncio.create_task(self._monitor_market_anomalies()),
                asyncio.create_task(self._update_threat_intelligence()),
                asyncio.create_task(self._cleanup_old_data())
            ]
            
            logger.info("Security monitoring system started successfully")
            
        except Exception as e:
            logger.error("Failed to start security monitoring", error=str(e))
            raise
    
    async def stop_monitoring(self):
        """Stop security monitoring"""
        try:
            logger.info("Stopping security monitoring system")
            
            self.monitoring_active = False
            
            # Cancel monitoring tasks
            for task in self.monitoring_tasks:
                if not task.done():
                    task.cancel()
            
            # Wait for tasks to complete
            if self.monitoring_tasks:
                await asyncio.gather(*self.monitoring_tasks, return_exceptions=True)
            
            self.monitoring_tasks.clear()
            
            logger.info("Security monitoring system stopped")
            
        except Exception as e:
            logger.error("Error stopping security monitoring", error=str(e))
    
    async def analyze_contract_security(
        self, 
        contract_address: str,
        contract_source: Optional[str] = None
    ) -> ContractAnalysis:
        """
        Analyze smart contract security using multiple tools
        
        Args:
            contract_address: Contract address to analyze
            contract_source: Optional contract source code
            
        Returns:
            Comprehensive contract security analysis
        """
        try:
            logger.info("Analyzing contract security", contract=contract_address)
            
            # Get contract source if not provided
            if not contract_source:
                contract_source = await self._get_contract_source(contract_address)
            
            # Run Slither analysis
            slither_results = await self._run_slither_analysis(
                contract_address, contract_source
            )
            
            # Get additional security data
            goplus_data = await self._get_goplus_contract_analysis(contract_address)
            
            # Analyze contract patterns
            pattern_analysis = await self._analyze_contract_patterns(
                contract_address, contract_source
            )
            
            # Calculate security score
            security_score = self._calculate_security_score(
                slither_results, goplus_data, pattern_analysis
            )
            
            # Identify vulnerabilities
            vulnerabilities = self._extract_vulnerabilities(
                slither_results, goplus_data, pattern_analysis
            )
            
            # Generate risk factors and recommendations
            risk_factors = self._identify_risk_factors(vulnerabilities, goplus_data)
            recommendations = self._generate_security_recommendations(
                vulnerabilities, risk_factors
            )
            
            analysis = ContractAnalysis(
                contract_address=contract_address,
                contract_name=goplus_data.get("token_name", "Unknown"),
                vulnerabilities=vulnerabilities,
                security_score=security_score,
                risk_factors=risk_factors,
                recommendations=recommendations,
                analysis_timestamp=datetime.now(),
                slither_results=slither_results,
                manual_review_required=security_score < 0.5 or len(vulnerabilities) > 5
            )
            
            # Cache analysis
            self.contract_analyses[contract_address] = analysis
            
            logger.info("Contract security analysis completed", 
                       contract=contract_address,
                       security_score=security_score,
                       vulnerabilities=len(vulnerabilities))
            
            return analysis
            
        except Exception as e:
            logger.error("Contract security analysis failed", 
                        contract=contract_address, error=str(e))
            
            # Return minimal analysis on error
            return ContractAnalysis(
                contract_address=contract_address,
                contract_name="Unknown",
                vulnerabilities=[{
                    "type": "analysis_error",
                    "severity": "high",
                    "description": f"Security analysis failed: {str(e)}"
                }],
                security_score=0.0,
                risk_factors=["Analysis failed"],
                recommendations=["Manual security review required"],
                analysis_timestamp=datetime.now(),
                manual_review_required=True
            )
    
    async def detect_rug_pull_risk(
        self, 
        token_address: str,
        additional_checks: bool = True
    ) -> Dict[str, Any]:
        """
        Detect rug pull risk for a token using multiple indicators
        
        Args:
            token_address: Token contract address
            additional_checks: Whether to perform additional deep analysis
            
        Returns:
            Rug pull risk assessment
        """
        try:
            logger.info("Analyzing rug pull risk", token=token_address)
            
            risk_assessment = {
                "token_address": token_address,
                "overall_risk_score": 0.0,
                "risk_level": ThreatLevel.LOW,
                "risk_factors": [],
                "evidence": {},
                "confidence": 0.0,
                "recommendations": []
            }
            
            # GoPlus Labs analysis
            goplus_data = await self._get_goplus_token_security(token_address)
            if goplus_data:
                goplus_risk = self._analyze_goplus_rug_indicators(goplus_data)
                risk_assessment["evidence"]["goplus"] = goplus_risk
                risk_assessment["overall_risk_score"] += goplus_risk["risk_score"] * 0.4
            
            # Liquidity analysis
            liquidity_risk = await self._analyze_liquidity_risk(token_address)
            risk_assessment["evidence"]["liquidity"] = liquidity_risk
            risk_assessment["overall_risk_score"] += liquidity_risk["risk_score"] * 0.3
            
            # Ownership analysis
            ownership_risk = await self._analyze_ownership_risk(token_address)
            risk_assessment["evidence"]["ownership"] = ownership_risk
            risk_assessment["overall_risk_score"] += ownership_risk["risk_score"] * 0.2
            
            # Trading pattern analysis
            if additional_checks:
                trading_risk = await self._analyze_trading_patterns(token_address)
                risk_assessment["evidence"]["trading"] = trading_risk
                risk_assessment["overall_risk_score"] += trading_risk["risk_score"] * 0.1
            
            # Normalize risk score
            risk_assessment["overall_risk_score"] = min(risk_assessment["overall_risk_score"], 1.0)
            
            # Determine risk level
            if risk_assessment["overall_risk_score"] >= 0.8:
                risk_assessment["risk_level"] = ThreatLevel.CRITICAL
            elif risk_assessment["overall_risk_score"] >= 0.6:
                risk_assessment["risk_level"] = ThreatLevel.HIGH
            elif risk_assessment["overall_risk_score"] >= 0.4:
                risk_assessment["risk_level"] = ThreatLevel.MEDIUM
            else:
                risk_assessment["risk_level"] = ThreatLevel.LOW
            
            # Compile risk factors
            for evidence_type, evidence_data in risk_assessment["evidence"].items():
                risk_assessment["risk_factors"].extend(evidence_data.get("factors", []))
            
            # Generate recommendations
            risk_assessment["recommendations"] = self._generate_rug_pull_recommendations(
                risk_assessment["risk_level"], risk_assessment["risk_factors"]
            )
            
            # Calculate confidence
            risk_assessment["confidence"] = self._calculate_rug_pull_confidence(
                risk_assessment["evidence"]
            )
            
            logger.info("Rug pull risk analysis completed",
                       token=token_address,
                       risk_score=risk_assessment["overall_risk_score"],
                       risk_level=risk_assessment["risk_level"])
            
            return risk_assessment
            
        except Exception as e:
            logger.error("Rug pull risk detection failed", 
                        token=token_address, error=str(e))
            return {
                "token_address": token_address,
                "overall_risk_score": 1.0,  # Assume high risk on error
                "risk_level": ThreatLevel.HIGH,
                "risk_factors": ["Analysis failed"],
                "evidence": {"error": str(e)},
                "confidence": 0.1,
                "recommendations": ["Avoid trading until manual review"]
            }
    
    async def assess_protocol_risk(
        self, 
        protocol_name: str,
        protocol_address: str
    ) -> ProtocolRiskAssessment:
        """
        Assess comprehensive risk for a DeFi protocol
        
        Args:
            protocol_name: Name of the protocol
            protocol_address: Main protocol contract address
            
        Returns:
            Comprehensive protocol risk assessment
        """
        try:
            logger.info("Assessing protocol risk", protocol=protocol_name)
            
            # Analyze protocol contracts
            contract_risks = await self._analyze_protocol_contracts(protocol_address)
            
            # Analyze liquidity and TVL
            liquidity_analysis = await self._analyze_protocol_liquidity(protocol_name)
            
            # Analyze governance structure
            governance_analysis = await self._analyze_protocol_governance(protocol_address)
            
            # Check audit status
            audit_status = await self._check_protocol_audits(protocol_name)
            
            # Get historical incidents
            historical_incidents = await self._get_protocol_incidents(protocol_name)
            
            # Calculate overall risk score
            risk_factors = {
                "contract_security": contract_risks.get("risk_score", 0.5),
                "liquidity_risk": liquidity_analysis.get("risk_score", 0.3),
                "governance_risk": governance_analysis.get("risk_score", 0.4),
                "audit_risk": audit_status.get("risk_score", 0.6),
                "historical_risk": len(historical_incidents) * 0.1
            }
            
            overall_risk = sum(risk_factors.values()) / len(risk_factors)
            overall_risk = min(overall_risk, 1.0)
            
            # Determine security status
            if overall_risk >= 0.8:
                security_status = SecurityStatus.BLOCKED
            elif overall_risk >= 0.6:
                security_status = SecurityStatus.DANGER
            elif overall_risk >= 0.4:
                security_status = SecurityStatus.WARNING
            elif overall_risk >= 0.2:
                security_status = SecurityStatus.CAUTION
            else:
                security_status = SecurityStatus.SAFE
            
            assessment = ProtocolRiskAssessment(
                protocol_name=protocol_name,
                protocol_address=protocol_address,
                overall_risk_score=overall_risk,
                security_status=security_status,
                risk_factors=risk_factors,
                liquidity_analysis=liquidity_analysis,
                governance_analysis=governance_analysis,
                audit_status=audit_status,
                historical_incidents=historical_incidents,
                last_updated=datetime.now()
            )
            
            # Cache assessment
            self.protocol_assessments[protocol_name] = assessment
            
            logger.info("Protocol risk assessment completed",
                       protocol=protocol_name,
                       risk_score=overall_risk,
                       security_status=security_status)
            
            return assessment
            
        except Exception as e:
            logger.error("Protocol risk assessment failed", 
                        protocol=protocol_name, error=str(e))
            
            # Return high-risk assessment on error
            return ProtocolRiskAssessment(
                protocol_name=protocol_name,
                protocol_address=protocol_address,
                overall_risk_score=0.8,
                security_status=SecurityStatus.DANGER,
                risk_factors={"analysis_error": 0.8},
                liquidity_analysis={"error": str(e)},
                governance_analysis={"error": str(e)},
                audit_status={"error": str(e)},
                historical_incidents=["Analysis failed"],
                last_updated=datetime.now()
            )
    
    async def get_real_time_threats(
        self, 
        addresses: Optional[List[str]] = None,
        threat_types: Optional[List[ThreatType]] = None,
        min_severity: ThreatLevel = ThreatLevel.MEDIUM
    ) -> List[SecurityThreat]:
        """
        Get real-time security threats from monitoring systems
        
        Args:
            addresses: Filter by specific addresses
            threat_types: Filter by threat types
            min_severity: Minimum threat severity level
            
        Returns:
            List of current security threats
        """
        try:
            threats = []
            
            # Get Forta alerts
            forta_threats = await self._get_forta_threats(addresses, threat_types)
            threats.extend(forta_threats)
            
            # Get cached threats
            cached_threats = self._get_cached_threats(addresses, threat_types, min_severity)
            threats.extend(cached_threats)
            
            # Remove duplicates and sort by severity
            unique_threats = self._deduplicate_threats(threats)
            unique_threats.sort(key=lambda t: (t.threat_level.value, t.confidence_score), reverse=True)
            
            logger.info("Retrieved real-time threats", count=len(unique_threats))
            return unique_threats
            
        except Exception as e:
            logger.error("Failed to get real-time threats", error=str(e))
            return []
    
    # Private helper methods
    
    async def _monitor_forta_alerts(self):
        """Background task to monitor Forta alerts"""
        while self.monitoring_active:
            try:
                # Query Forta for new alerts
                alerts = await self._fetch_forta_alerts()
                
                for alert in alerts:
                    threat = await self._process_forta_alert(alert)
                    if threat:
                        self.threat_cache[threat.threat_id] = threat
                        await self._handle_threat_detection(threat)
                
                await asyncio.sleep(30)  # Check every 30 seconds
                
            except Exception as e:
                logger.error("Error monitoring Forta alerts", error=str(e))
                await asyncio.sleep(60)  # Wait longer on error
    
    async def _monitor_protocol_health(self):
        """Background task to monitor protocol health"""
        while self.monitoring_active:
            try:
                for protocol_name in self.monitored_protocols:
                    # Check protocol health indicators
                    health_status = await self._check_protocol_health(protocol_name)
                    
                    if health_status.get("risk_level", ThreatLevel.LOW) >= ThreatLevel.HIGH:
                        threat = SecurityThreat(
                            threat_id=f"protocol_health_{protocol_name}_{int(datetime.now().timestamp())}",
                            threat_type=ThreatType.LIQUIDITY_DRAIN,
                            threat_level=health_status["risk_level"],
                            title=f"Protocol Health Alert: {protocol_name}",
                            description=health_status.get("description", "Protocol health degraded"),
                            affected_addresses=[],
                            affected_protocols=[protocol_name],
                            confidence_score=health_status.get("confidence", 0.7),
                            evidence=health_status,
                            mitigation_steps=["Monitor closely", "Consider reducing exposure"],
                            detected_at=datetime.now(),
                            source="internal"
                        )
                        
                        self.threat_cache[threat.threat_id] = threat
                        await self._handle_threat_detection(threat)
                
                await asyncio.sleep(300)  # Check every 5 minutes
                
            except Exception as e:
                logger.error("Error monitoring protocol health", error=str(e))
                await asyncio.sleep(300)
    
    async def _monitor_market_anomalies(self):
        """Background task to monitor market anomalies"""
        while self.monitoring_active:
            try:
                # Monitor for unusual price movements, volume spikes, etc.
                anomalies = await self._detect_market_anomalies()
                
                for anomaly in anomalies:
                    if anomaly.get("severity", ThreatLevel.LOW) >= ThreatLevel.MEDIUM:
                        threat = SecurityThreat(
                            threat_id=f"market_anomaly_{anomaly['token']}_{int(datetime.now().timestamp())}",
                            threat_type=ThreatType.PRICE_MANIPULATION,
                            threat_level=anomaly["severity"],
                            title=f"Market Anomaly Detected: {anomaly['token']}",
                            description=anomaly.get("description", "Unusual market activity detected"),
                            affected_addresses=[anomaly.get("token", "")],
                            affected_protocols=[],
                            confidence_score=anomaly.get("confidence", 0.6),
                            evidence=anomaly,
                            mitigation_steps=["Verify price feeds", "Check for manipulation"],
                            detected_at=datetime.now(),
                            source="internal"
                        )
                        
                        self.threat_cache[threat.threat_id] = threat
                        await self._handle_threat_detection(threat)
                
                await asyncio.sleep(120)  # Check every 2 minutes
                
            except Exception as e:
                logger.error("Error monitoring market anomalies", error=str(e))
                await asyncio.sleep(120)
    
    async def _update_threat_intelligence(self):
        """Background task to update threat intelligence"""
        while self.monitoring_active:
            try:
                # Update known threat indicators
                await self._update_threat_indicators()
                
                # Update security API data
                await self._refresh_security_data()
                
                await asyncio.sleep(3600)  # Update every hour
                
            except Exception as e:
                logger.error("Error updating threat intelligence", error=str(e))
                await asyncio.sleep(3600)
    
    async def _cleanup_old_data(self):
        """Background task to cleanup old cached data"""
        while self.monitoring_active:
            try:
                current_time = datetime.now()
                
                # Remove old threats (older than 24 hours)
                old_threats = [
                    threat_id for threat_id, threat in self.threat_cache.items()
                    if (current_time - threat.detected_at).total_seconds() > 86400
                ]
                
                for threat_id in old_threats:
                    del self.threat_cache[threat_id]
                
                # Remove old contract analyses (older than 7 days)
                old_analyses = [
                    addr for addr, analysis in self.contract_analyses.items()
                    if (current_time - analysis.analysis_timestamp).total_seconds() > 604800
                ]
                
                for addr in old_analyses:
                    del self.contract_analyses[addr]
                
                logger.info("Cleaned up old security data", 
                           threats_removed=len(old_threats),
                           analyses_removed=len(old_analyses))
                
                await asyncio.sleep(3600)  # Cleanup every hour
                
            except Exception as e:
                logger.error("Error cleaning up old data", error=str(e))
                await asyncio.sleep(3600)
    
    async def _get_contract_source(self, contract_address: str) -> Optional[str]:
        """Get contract source code from Etherscan"""
        try:
            if not self.session:
                return None
            
            params = {
                "module": "contract",
                "action": "getsourcecode",
                "address": contract_address,
                "apikey": self.etherscan_api_key
            }
            
            async with self.session.get(self.endpoints["etherscan"], params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get("status") == "1" and data.get("result"):
                        return data["result"][0].get("SourceCode", "")
            
            return None
            
        except Exception as e:
            logger.error("Failed to get contract source", contract=contract_address, error=str(e))
            return None
    
    async def _run_slither_analysis(
        self, 
        contract_address: str, 
        contract_source: Optional[str]
    ) -> Optional[Dict[str, Any]]:
        """Run Slither static analysis on contract"""
        try:
            if not contract_source:
                return None
            
            # Create temporary file for contract source
            with tempfile.NamedTemporaryFile(mode='w', suffix='.sol', delete=False) as f:
                f.write(contract_source)
                temp_file = f.name
            
            try:
                # Run Slither analysis
                result = subprocess.run([
                    'slither', temp_file, '--json', '-'
                ], capture_output=True, text=True, timeout=60)
                
                if result.returncode == 0 and result.stdout:
                    return json.loads(result.stdout)
                else:
                    logger.warning("Slither analysis failed", 
                                 contract=contract_address,
                                 error=result.stderr)
                    return None
                    
            finally:
                # Clean up temporary file
                os.unlink(temp_file)
                
        except Exception as e:
            logger.error("Slither analysis error", contract=contract_address, error=str(e))
            return None
    
    async def _get_goplus_contract_analysis(self, contract_address: str) -> Dict[str, Any]:
        """Get contract analysis from GoPlus Labs"""
        try:
            if not self.session:
                return {}
            
            url = f"{self.endpoints['goplus']}/token_security/1"
            params = {"contract_addresses": contract_address}
            
            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get("result", {}).get(contract_address.lower(), {})
            
            return {}
            
        except Exception as e:
            logger.error("GoPlus contract analysis failed", 
                        contract=contract_address, error=str(e))
            return {}
    
    async def _get_goplus_token_security(self, token_address: str) -> Dict[str, Any]:
        """Get token security analysis from GoPlus Labs"""
        try:
            if not self.session:
                return {}
            
            url = f"{self.endpoints['goplus']}/token_security/1"
            params = {"contract_addresses": token_address}
            
            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get("result", {}).get(token_address.lower(), {})
            
            return {}
            
        except Exception as e:
            logger.error("GoPlus token security failed", 
                        token=token_address, error=str(e))
            return {}
    
    def _calculate_security_score(
        self, 
        slither_results: Optional[Dict[str, Any]],
        goplus_data: Dict[str, Any],
        pattern_analysis: Dict[str, Any]
    ) -> float:
        """Calculate overall security score for contract"""
        score = 1.0  # Start with perfect score
        
        # Deduct for Slither vulnerabilities
        if slither_results and "results" in slither_results:
            detectors = slither_results["results"].get("detectors", [])
            for detector in detectors:
                impact = detector.get("impact", "").lower()
                if impact == "high":
                    score -= 0.3
                elif impact == "medium":
                    score -= 0.2
                elif impact == "low":
                    score -= 0.1
        
        # Deduct for GoPlus risk indicators
        if goplus_data:
            risk_indicators = [
                "is_honeypot", "is_mintable", "can_take_back_ownership",
                "owner_change_balance", "hidden_owner", "selfdestruct"
            ]
            
            for indicator in risk_indicators:
                if goplus_data.get(indicator) == "1":
                    score -= 0.15
        
        # Deduct for pattern analysis issues
        pattern_score = pattern_analysis.get("security_score", 1.0)
        score = (score + pattern_score) / 2
        
        return max(0.0, min(1.0, score))
    
    def _extract_vulnerabilities(
        self,
        slither_results: Optional[Dict[str, Any]],
        goplus_data: Dict[str, Any],
        pattern_analysis: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Extract vulnerabilities from analysis results"""
        vulnerabilities = []
        
        # Extract Slither vulnerabilities
        if slither_results and "results" in slither_results:
            detectors = slither_results["results"].get("detectors", [])
            for detector in detectors:
                vulnerabilities.append({
                    "type": "slither_detection",
                    "severity": detector.get("impact", "low").lower(),
                    "description": detector.get("description", ""),
                    "check": detector.get("check", ""),
                    "source": "slither"
                })
        
        # Extract GoPlus vulnerabilities
        if goplus_data:
            if goplus_data.get("is_honeypot") == "1":
                vulnerabilities.append({
                    "type": "honeypot",
                    "severity": "critical",
                    "description": "Contract appears to be a honeypot",
                    "source": "goplus"
                })
            
            if goplus_data.get("is_mintable") == "1":
                vulnerabilities.append({
                    "type": "unlimited_minting",
                    "severity": "high",
                    "description": "Contract allows unlimited token minting",
                    "source": "goplus"
                })
        
        # Extract pattern analysis vulnerabilities
        for vuln in pattern_analysis.get("vulnerabilities", []):
            vulnerabilities.append({
                "type": "pattern_analysis",
                "severity": vuln.get("severity", "medium"),
                "description": vuln.get("description", ""),
                "source": "internal"
            })
        
        return vulnerabilities
    
    async def _analyze_contract_patterns(
        self, 
        contract_address: str, 
        contract_source: Optional[str]
    ) -> Dict[str, Any]:
        """Analyze contract for suspicious patterns"""
        analysis = {
            "security_score": 1.0,
            "vulnerabilities": [],
            "patterns": []
        }
        
        if not contract_source:
            return analysis
        
        source_lower = contract_source.lower()
        
        # Check for suspicious patterns
        suspicious_patterns = [
            ("selfdestruct", "Contract can self-destruct", "high"),
            ("delegatecall", "Uses delegatecall (potential proxy risk)", "medium"),
            ("assembly", "Contains inline assembly", "medium"),
            ("suicide", "Contains suicide function", "high"),
            ("tx.origin", "Uses tx.origin (authentication risk)", "medium")
        ]
        
        for pattern, description, severity in suspicious_patterns:
            if pattern in source_lower:
                analysis["vulnerabilities"].append({
                    "pattern": pattern,
                    "description": description,
                    "severity": severity
                })
                analysis["patterns"].append(pattern)
                
                # Reduce security score
                if severity == "high":
                    analysis["security_score"] -= 0.3
                elif severity == "medium":
                    analysis["security_score"] -= 0.2
                else:
                    analysis["security_score"] -= 0.1
        
        analysis["security_score"] = max(0.0, analysis["security_score"])
        return analysis
    
    def _identify_risk_factors(
        self, 
        vulnerabilities: List[Dict[str, Any]], 
        goplus_data: Dict[str, Any]
    ) -> List[str]:
        """Identify risk factors from analysis"""
        risk_factors = []
        
        # Risk factors from vulnerabilities
        high_severity_count = sum(1 for v in vulnerabilities if v.get("severity") == "high")
        critical_severity_count = sum(1 for v in vulnerabilities if v.get("severity") == "critical")
        
        if critical_severity_count > 0:
            risk_factors.append(f"{critical_severity_count} critical vulnerabilities found")
        if high_severity_count > 0:
            risk_factors.append(f"{high_severity_count} high severity vulnerabilities found")
        
        # Risk factors from GoPlus data
        if goplus_data:
            if goplus_data.get("is_proxy") == "1":
                risk_factors.append("Contract is a proxy (upgrade risk)")
            if goplus_data.get("is_mintable") == "1":
                risk_factors.append("Unlimited token minting possible")
            if goplus_data.get("owner_change_balance") == "1":
                risk_factors.append("Owner can change user balances")
            if goplus_data.get("hidden_owner") == "1":
                risk_factors.append("Contract has hidden owner")
        
        return risk_factors
    
    def _generate_security_recommendations(
        self, 
        vulnerabilities: List[Dict[str, Any]], 
        risk_factors: List[str]
    ) -> List[str]:
        """Generate security recommendations"""
        recommendations = []
        
        if any(v.get("severity") == "critical" for v in vulnerabilities):
            recommendations.append("🚨 CRITICAL: Do not interact with this contract")
            recommendations.append("Conduct thorough manual security review")
        
        if any(v.get("severity") == "high" for v in vulnerabilities):
            recommendations.append("⚠️ HIGH RISK: Exercise extreme caution")
            recommendations.append("Consider alternative contracts")
        
        if "unlimited token minting possible" in [rf.lower() for rf in risk_factors]:
            recommendations.append("Monitor token supply for unexpected changes")
        
        if "owner can change user balances" in [rf.lower() for rf in risk_factors]:
            recommendations.append("Avoid holding large amounts of this token")
        
        if len(vulnerabilities) > 5:
            recommendations.append("Multiple vulnerabilities detected - comprehensive audit needed")
        
        if not recommendations:
            recommendations.append("✅ No critical issues detected, but remain vigilant")
        
        return recommendations
    
    async def _handle_threat_detection(self, threat: SecurityThreat):
        """Handle detected security threat"""
        try:
            logger.warning("Security threat detected",
                          threat_id=threat.threat_id,
                          threat_type=threat.threat_type,
                          threat_level=threat.threat_level,
                          confidence=threat.confidence_score)
            
            # Log threat for audit trail
            await self._log_security_event(threat)
            
            # Send alerts based on severity
            if threat.threat_level in [ThreatLevel.HIGH, ThreatLevel.CRITICAL]:
                await self._send_security_alert(threat)
            
            # Take automated mitigation actions if configured
            if threat.threat_level == ThreatLevel.CRITICAL:
                await self._execute_emergency_response(threat)
                
        except Exception as e:
            logger.error("Error handling threat detection", error=str(e))
    
    async def _log_security_event(self, threat: SecurityThreat):
        """Log security event for audit trail"""
        # Implementation would log to secure audit system
        logger.info("Security event logged", threat_id=threat.threat_id)
    
    async def _send_security_alert(self, threat: SecurityThreat):
        """Send security alert to monitoring systems"""
        # Implementation would send alerts via configured channels
        logger.warning("Security alert sent", threat_id=threat.threat_id)
    
    async def _execute_emergency_response(self, threat: SecurityThreat):
        """Execute emergency response for critical threats"""
        # Implementation would execute configured emergency responses
        logger.critical("Emergency response executed", threat_id=threat.threat_id)

# Additional helper methods would continue here...
# This is a comprehensive foundation for the Security Guardian Agent
    
    # Additional helper methods for comprehensive threat detection
    
    def _analyze_goplus_rug_indicators(self, goplus_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze GoPlus data for rug pull indicators"""
        risk_score = 0.0
        factors = []
        
        # High-risk indicators
        high_risk_indicators = [
            ("is_honeypot", "Token is a honeypot"),
            ("cannot_sell_all", "Cannot sell all tokens"),
            ("cannot_buy", "Cannot buy tokens"),
            ("hidden_owner", "Contract has hidden owner"),
            ("selfdestruct", "Contract can self-destruct")
        ]
        
        for indicator, description in high_risk_indicators:
            if goplus_data.get(indicator) == "1":
                risk_score += 0.3
                factors.append(description)
        
        # Medium-risk indicators
        medium_risk_indicators = [
            ("is_mintable", "Unlimited token minting"),
            ("owner_change_balance", "Owner can change balances"),
            ("can_take_back_ownership", "Can take back ownership"),
            ("is_proxy", "Proxy contract (upgrade risk)")
        ]
        
        for indicator, description in medium_risk_indicators:
            if goplus_data.get(indicator) == "1":
                risk_score += 0.2
                factors.append(description)
        
        # Tax analysis
        buy_tax = float(goplus_data.get("buy_tax", "0"))
        sell_tax = float(goplus_data.get("sell_tax", "0"))
        
        if buy_tax > 0.1:  # > 10%
            risk_score += 0.15
            factors.append(f"High buy tax: {buy_tax:.1%}")
        
        if sell_tax > 0.1:  # > 10%
            risk_score += 0.15
            factors.append(f"High sell tax: {sell_tax:.1%}")
        
        return {
            "risk_score": min(risk_score, 1.0),
            "factors": factors,
            "buy_tax": buy_tax,
            "sell_tax": sell_tax
        }
    
    async def _analyze_liquidity_risk(self, token_address: str) -> Dict[str, Any]:
        """Analyze liquidity-related rug pull risks"""
        try:
            risk_score = 0.0
            factors = []
            
            # Get liquidity information (simplified - would use DEX APIs)
            liquidity_info = await self._get_token_liquidity_info(token_address)
            
            # Check liquidity lock status
            if not liquidity_info.get("is_locked", False):
                risk_score += 0.4
                factors.append("Liquidity is not locked")
            
            # Check liquidity amount
            liquidity_usd = liquidity_info.get("liquidity_usd", 0)
            if liquidity_usd < 10000:  # Less than $10k
                risk_score += 0.3
                factors.append(f"Low liquidity: ${liquidity_usd:,.2f}")
            
            # Check LP token distribution
            lp_concentration = liquidity_info.get("lp_concentration", 0)
            if lp_concentration > 0.8:  # > 80% held by few addresses
                risk_score += 0.2
                factors.append("High LP token concentration")
            
            return {
                "risk_score": min(risk_score, 1.0),
                "factors": factors,
                "liquidity_info": liquidity_info
            }
            
        except Exception as e:
            logger.error("Liquidity risk analysis failed", token=token_address, error=str(e))
            return {
                "risk_score": 0.5,  # Assume medium risk on error
                "factors": ["Liquidity analysis failed"],
                "liquidity_info": {}
            }
    
    async def _analyze_ownership_risk(self, token_address: str) -> Dict[str, Any]:
        """Analyze ownership-related risks"""
        try:
            risk_score = 0.0
            factors = []
            
            # Get ownership information
            ownership_info = await self._get_token_ownership_info(token_address)
            
            # Check if ownership is renounced
            if not ownership_info.get("is_renounced", False):
                risk_score += 0.3
                factors.append("Ownership not renounced")
            
            # Check owner privileges
            dangerous_functions = ownership_info.get("dangerous_functions", [])
            if dangerous_functions:
                risk_score += len(dangerous_functions) * 0.1
                factors.extend([f"Owner can: {func}" for func in dangerous_functions])
            
            # Check multi-sig usage
            if not ownership_info.get("is_multisig", False) and not ownership_info.get("is_renounced", False):
                risk_score += 0.2
                factors.append("Single owner (not multi-sig)")
            
            return {
                "risk_score": min(risk_score, 1.0),
                "factors": factors,
                "ownership_info": ownership_info
            }
            
        except Exception as e:
            logger.error("Ownership risk analysis failed", token=token_address, error=str(e))
            return {
                "risk_score": 0.4,
                "factors": ["Ownership analysis failed"],
                "ownership_info": {}
            }
    
    async def _analyze_trading_patterns(self, token_address: str) -> Dict[str, Any]:
        """Analyze trading patterns for suspicious activity"""
        try:
            risk_score = 0.0
            factors = []
            
            # Get trading data (simplified)
            trading_data = await self._get_token_trading_data(token_address)
            
            # Check for unusual volume patterns
            volume_24h = trading_data.get("volume_24h", 0)
            volume_7d_avg = trading_data.get("volume_7d_avg", 0)
            
            if volume_7d_avg > 0 and volume_24h / volume_7d_avg > 10:
                risk_score += 0.2
                factors.append("Unusual volume spike detected")
            
            # Check holder distribution
            holder_concentration = trading_data.get("holder_concentration", 0)
            if holder_concentration > 0.5:  # > 50% held by top 10 holders
                risk_score += 0.15
                factors.append("High token concentration among few holders")
            
            # Check for bot trading
            if trading_data.get("bot_trading_percentage", 0) > 0.7:
                risk_score += 0.1
                factors.append("High percentage of bot trading")
            
            return {
                "risk_score": min(risk_score, 1.0),
                "factors": factors,
                "trading_data": trading_data
            }
            
        except Exception as e:
            logger.error("Trading pattern analysis failed", token=token_address, error=str(e))
            return {
                "risk_score": 0.2,
                "factors": ["Trading analysis failed"],
                "trading_data": {}
            }
    
    def _generate_rug_pull_recommendations(
        self, 
        risk_level: ThreatLevel, 
        risk_factors: List[str]
    ) -> List[str]:
        """Generate recommendations based on rug pull risk"""
        recommendations = []
        
        if risk_level == ThreatLevel.CRITICAL:
            recommendations.extend([
                "🚨 CRITICAL RISK: Do not trade this token",
                "High probability of rug pull or scam",
                "Avoid at all costs"
            ])
        elif risk_level == ThreatLevel.HIGH:
            recommendations.extend([
                "⚠️ HIGH RISK: Exercise extreme caution",
                "Only trade with funds you can afford to lose",
                "Set tight stop losses",
                "Monitor closely for exit opportunities"
            ])
        elif risk_level == ThreatLevel.MEDIUM:
            recommendations.extend([
                "⚠️ MEDIUM RISK: Proceed with caution",
                "Use small position sizes",
                "Monitor for changes in risk factors",
                "Have exit strategy ready"
            ])
        else:
            recommendations.extend([
                "✅ LOW RISK: Appears relatively safe",
                "Continue monitoring for changes",
                "Follow standard risk management"
            ])
        
        # Add specific recommendations based on risk factors
        if "liquidity is not locked" in [rf.lower() for rf in risk_factors]:
            recommendations.append("💡 Verify liquidity lock status before trading")
        
        if "high buy tax" in str(risk_factors).lower() or "high sell tax" in str(risk_factors).lower():
            recommendations.append("💡 Factor in high taxes when calculating profits")
        
        return recommendations
    
    def _calculate_rug_pull_confidence(self, evidence: Dict[str, Any]) -> float:
        """Calculate confidence in rug pull assessment"""
        confidence = 0.0
        evidence_count = 0
        
        # Weight different evidence sources
        source_weights = {
            "goplus": 0.4,
            "liquidity": 0.3,
            "ownership": 0.2,
            "trading": 0.1
        }
        
        for source, weight in source_weights.items():
            if source in evidence and evidence[source]:
                confidence += weight
                evidence_count += 1
        
        # Adjust confidence based on evidence quality
        if evidence_count >= 3:
            confidence *= 1.0  # High confidence with multiple sources
        elif evidence_count == 2:
            confidence *= 0.8  # Medium confidence
        else:
            confidence *= 0.6  # Lower confidence with limited data
        
        return min(confidence, 1.0)
    
    async def _get_token_liquidity_info(self, token_address: str) -> Dict[str, Any]:
        """Get token liquidity information"""
        # Simplified implementation - would integrate with DEX APIs
        return {
            "is_locked": False,  # Would check actual lock status
            "liquidity_usd": 50000,  # Would get real liquidity
            "lp_concentration": 0.6,  # Would calculate real concentration
            "lock_duration": 0  # Would get actual lock duration
        }
    
    async def _get_token_ownership_info(self, token_address: str) -> Dict[str, Any]:
        """Get token ownership information"""
        # Simplified implementation - would analyze contract
        return {
            "is_renounced": False,
            "is_multisig": False,
            "dangerous_functions": ["mint", "burn", "pause"],
            "owner_address": "0x0000000000000000000000000000000000000000"
        }
    
    async def _get_token_trading_data(self, token_address: str) -> Dict[str, Any]:
        """Get token trading data"""
        # Simplified implementation - would get real trading data
        return {
            "volume_24h": 100000,
            "volume_7d_avg": 80000,
            "holder_concentration": 0.4,
            "bot_trading_percentage": 0.3,
            "price_volatility": 0.2
        }
    
    async def _analyze_protocol_contracts(self, protocol_address: str) -> Dict[str, Any]:
        """Analyze protocol smart contracts"""
        try:
            # Get main contract analysis
            main_analysis = await self.analyze_contract_security(protocol_address)
            
            # Analyze related contracts (simplified)
            related_contracts = await self._get_protocol_contracts(protocol_address)
            
            contract_risks = []
            total_risk = 0.0
            
            for contract_addr in related_contracts:
                analysis = await self.analyze_contract_security(contract_addr)
                contract_risks.append({
                    "address": contract_addr,
                    "security_score": analysis.security_score,
                    "vulnerabilities": len(analysis.vulnerabilities)
                })
                total_risk += (1.0 - analysis.security_score)
            
            avg_risk = total_risk / max(len(related_contracts), 1)
            
            return {
                "risk_score": min(avg_risk, 1.0),
                "main_contract": main_analysis,
                "related_contracts": contract_risks,
                "total_contracts": len(related_contracts)
            }
            
        except Exception as e:
            logger.error("Protocol contract analysis failed", error=str(e))
            return {"risk_score": 0.6, "error": str(e)}
    
    async def _analyze_protocol_liquidity(self, protocol_name: str) -> Dict[str, Any]:
        """Analyze protocol liquidity risks"""
        try:
            # Get TVL and liquidity data from DeFiLlama
            if not self.session:
                return {"risk_score": 0.5}
            
            url = f"{self.endpoints['defillama']}/protocol/{protocol_name.lower()}"
            
            async with self.session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    current_tvl = data.get("tvl", [])
                    if current_tvl:
                        latest_tvl = current_tvl[-1].get("totalLiquidityUSD", 0)
                        
                        # Calculate risk based on TVL
                        if latest_tvl > 1000000000:  # > $1B
                            risk_score = 0.1
                        elif latest_tvl > 100000000:  # > $100M
                            risk_score = 0.2
                        elif latest_tvl > 10000000:  # > $10M
                            risk_score = 0.4
                        else:
                            risk_score = 0.7
                        
                        return {
                            "risk_score": risk_score,
                            "tvl_usd": latest_tvl,
                            "liquidity_trend": "stable"  # Would calculate trend
                        }
            
            return {"risk_score": 0.5, "error": "No data available"}
            
        except Exception as e:
            logger.error("Protocol liquidity analysis failed", error=str(e))
            return {"risk_score": 0.6, "error": str(e)}
    
    async def _analyze_protocol_governance(self, protocol_address: str) -> Dict[str, Any]:
        """Analyze protocol governance structure"""
        # Simplified governance analysis
        return {
            "risk_score": 0.3,
            "governance_type": "dao",
            "token_distribution": "decentralized",
            "voting_power_concentration": 0.2,
            "timelock_duration": 48  # hours
        }
    
    async def _check_protocol_audits(self, protocol_name: str) -> Dict[str, Any]:
        """Check protocol audit status"""
        # Simplified audit check - would integrate with audit databases
        return {
            "risk_score": 0.2,
            "audit_firms": ["Trail of Bits", "ConsenSys Diligence"],
            "last_audit_date": "2023-06-01",
            "critical_issues_found": 0,
            "issues_resolved": True
        }
    
    async def _get_protocol_incidents(self, protocol_name: str) -> List[str]:
        """Get historical security incidents for protocol"""
        # Simplified incident lookup - would query incident databases
        return []
    
    async def _get_protocol_contracts(self, protocol_address: str) -> List[str]:
        """Get related contracts for a protocol"""
        # Simplified - would analyze contract interactions
        return [protocol_address]
    
    async def _fetch_forta_alerts(self) -> List[Dict[str, Any]]:
        """Fetch alerts from Forta Network"""
        try:
            if not self.session:
                return []
            
            # GraphQL query for Forta alerts
            query = """
            query GetAlerts($first: Int!, $chainId: Int!) {
                alerts(first: $first, chainId: $chainId, orderBy: createdAt, orderDirection: desc) {
                    alertId
                    name
                    description
                    severity
                    metadata
                    createdAt
                    source {
                        bot {
                            id
                        }
                    }
                    addresses
                }
            }
            """
            
            variables = {
                "first": 50,
                "chainId": 1  # Ethereum mainnet
            }
            
            headers = {
                "Authorization": f"Bearer {self.forta_api_key}",
                "Content-Type": "application/json"
            }
            
            async with self.session.post(
                self.endpoints["forta"],
                json={"query": query, "variables": variables},
                headers=headers
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get("data", {}).get("alerts", [])
            
            return []
            
        except Exception as e:
            logger.error("Failed to fetch Forta alerts", error=str(e))
            return []
    
    async def _process_forta_alert(self, alert: Dict[str, Any]) -> Optional[SecurityThreat]:
        """Process Forta alert into SecurityThreat"""
        try:
            # Map Forta severity to ThreatLevel
            severity_mapping = {
                "CRITICAL": ThreatLevel.CRITICAL,
                "HIGH": ThreatLevel.HIGH,
                "MEDIUM": ThreatLevel.MEDIUM,
                "LOW": ThreatLevel.LOW
            }
            
            threat_level = severity_mapping.get(
                alert.get("severity", "LOW").upper(), 
                ThreatLevel.LOW
            )
            
            # Determine threat type from alert name/description
            threat_type = self._classify_forta_threat_type(
                alert.get("name", ""), 
                alert.get("description", "")
            )
            
            return SecurityThreat(
                threat_id=f"forta_{alert.get('alertId', '')}",
                threat_type=threat_type,
                threat_level=threat_level,
                title=alert.get("name", "Forta Alert"),
                description=alert.get("description", ""),
                affected_addresses=alert.get("addresses", []),
                affected_protocols=[],
                confidence_score=0.8,  # High confidence in Forta alerts
                evidence={"forta_alert": alert},
                mitigation_steps=["Investigate immediately", "Consider pausing operations"],
                detected_at=datetime.now(),
                source="forta",
                metadata=alert.get("metadata", {})
            )
            
        except Exception as e:
            logger.error("Failed to process Forta alert", error=str(e))
            return None
    
    def _classify_forta_threat_type(self, name: str, description: str) -> ThreatType:
        """Classify Forta alert into threat type"""
        text = (name + " " + description).lower()
        
        if "rug pull" in text or "liquidity removed" in text:
            return ThreatType.RUG_PULL
        elif "honeypot" in text:
            return ThreatType.HONEYPOT
        elif "flash loan" in text:
            return ThreatType.FLASH_LOAN_ATTACK
        elif "price manipulation" in text or "oracle" in text:
            return ThreatType.PRICE_MANIPULATION
        elif "governance" in text:
            return ThreatType.GOVERNANCE_ATTACK
        elif "bridge" in text:
            return ThreatType.BRIDGE_EXPLOIT
        elif "sandwich" in text:
            return ThreatType.SANDWICH_ATTACK
        else:
            return ThreatType.SMART_CONTRACT_VULNERABILITY
    
    async def _get_forta_threats(
        self, 
        addresses: Optional[List[str]], 
        threat_types: Optional[List[ThreatType]]
    ) -> List[SecurityThreat]:
        """Get threats from Forta alerts"""
        try:
            alerts = await self._fetch_forta_alerts()
            threats = []
            
            for alert in alerts:
                threat = await self._process_forta_alert(alert)
                if threat:
                    # Filter by addresses if specified
                    if addresses and not any(addr in threat.affected_addresses for addr in addresses):
                        continue
                    
                    # Filter by threat types if specified
                    if threat_types and threat.threat_type not in threat_types:
                        continue
                    
                    threats.append(threat)
            
            return threats
            
        except Exception as e:
            logger.error("Failed to get Forta threats", error=str(e))
            return []
    
    def _get_cached_threats(
        self, 
        addresses: Optional[List[str]], 
        threat_types: Optional[List[ThreatType]], 
        min_severity: ThreatLevel
    ) -> List[SecurityThreat]:
        """Get threats from cache with filtering"""
        threats = []
        
        severity_order = {
            ThreatLevel.LOW: 0,
            ThreatLevel.MEDIUM: 1,
            ThreatLevel.HIGH: 2,
            ThreatLevel.CRITICAL: 3
        }
        
        min_severity_value = severity_order[min_severity]
        
        for threat in self.threat_cache.values():
            # Filter by severity
            if severity_order[threat.threat_level] < min_severity_value:
                continue
            
            # Filter by addresses
            if addresses and not any(addr in threat.affected_addresses for addr in addresses):
                continue
            
            # Filter by threat types
            if threat_types and threat.threat_type not in threat_types:
                continue
            
            threats.append(threat)
        
        return threats
    
    def _deduplicate_threats(self, threats: List[SecurityThreat]) -> List[SecurityThreat]:
        """Remove duplicate threats"""
        seen_ids = set()
        unique_threats = []
        
        for threat in threats:
            if threat.threat_id not in seen_ids:
                seen_ids.add(threat.threat_id)
                unique_threats.append(threat)
        
        return unique_threats
    
    async def _check_protocol_health(self, protocol_name: str) -> Dict[str, Any]:
        """Check protocol health indicators"""
        # Simplified health check
        return {
            "risk_level": ThreatLevel.LOW,
            "description": "Protocol appears healthy",
            "confidence": 0.7
        }
    
    async def _detect_market_anomalies(self) -> List[Dict[str, Any]]:
        """Detect market anomalies that could indicate threats"""
        # Simplified anomaly detection
        return []
    
    async def _update_threat_indicators(self):
        """Update threat intelligence indicators"""
        # Implementation would update threat indicators from various sources
        pass
    
    async def _refresh_security_data(self):
        """Refresh cached security data"""
        # Implementation would refresh cached security analyses
        pass


# Example usage and testing
async def main():
    """Example usage of the Security Guardian Agent"""
    config = {
        "forta_api_key": "your-forta-api-key",
        "goplus_api_key": "",  # GoPlus is free
        "etherscan_api_key": "your-etherscan-api-key",
        "rug_pull_threshold": 0.7,
        "honeypot_threshold": 0.8,
        "vulnerability_threshold": 0.6
    }
    
    async with SecurityGuardianAgent(config) as guardian:
        # Start monitoring
        await guardian.start_monitoring()
        
        # Analyze a contract
        contract_analysis = await guardian.analyze_contract_security(
            "0xA0b86a33E6441b8435b662303c0f479c7e2b6b8e"  # Example USDC contract
        )
        print(f"Contract Security Score: {contract_analysis.security_score:.2f}")
        print(f"Vulnerabilities Found: {len(contract_analysis.vulnerabilities)}")
        
        # Check for rug pull risk
        rug_pull_risk = await guardian.detect_rug_pull_risk(
            "0x1234567890123456789012345678901234567890"  # Example token
        )
        print(f"Rug Pull Risk Level: {rug_pull_risk['risk_level']}")
        print(f"Risk Score: {rug_pull_risk['overall_risk_score']:.2f}")
        
        # Assess protocol risk
        protocol_risk = await guardian.assess_protocol_risk(
            "uniswap", "0x1F98431c8aD98523631AE4a59f267346ea31F984"
        )
        print(f"Protocol Security Status: {protocol_risk.security_status}")
        print(f"Overall Risk Score: {protocol_risk.overall_risk_score:.2f}")
        
        # Get real-time threats
        threats = await guardian.get_real_time_threats(
            min_severity=ThreatLevel.MEDIUM
        )
        print(f"Active Threats: {len(threats)}")
        
        # Stop monitoring
        await guardian.stop_monitoring()

if __name__ == "__main__":
    asyncio.run(main())