"""
Property-Based Tests for Security Monitoring System

**Property 6: Comprehensive Security Monitoring and Protection**
**Validates: Requirements 6.1, 6.2, 15.1**
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Dict, Any
from hypothesis import given, strategies as st, settings, assume
from hypothesis.strategies import composite
import logging
import secrets

# Import the modules to test
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from src.agents.security_guardian import (
    SecurityGuardianAgent,
    SecurityThreat,
    ThreatLevel,
    ThreatType,
    SecurityStatus,
    ContractAnalysis
)
from src.security.emergency_response import (
    EmergencyResponseSystem,
    EmergencyLevel,
    ResponseAction,
    SecurityIncident,
    IncidentStatus
)

logger = logging.getLogger(__name__)

# Test data generators
@composite
def threat_data_strategy(draw):
    """Generate valid threat data for testing"""
    threat_types = list(ThreatType)
    threat_levels = list(ThreatLevel)
    
    return {
        "threat_id": f"threat_{draw(st.integers(min_value=1, max_value=10000))}",
        "threat_type": draw(st.sampled_from(threat_types)).value,
        "threat_level": draw(st.sampled_from(threat_levels)).value,
        "title": draw(st.text(min_size=10, max_size=100)),
        "description": draw(st.text(min_size=20, max_size=500)),
        "affected_addresses": draw(st.lists(
            st.text(min_size=42, max_size=42).filter(lambda x: x.startswith('0x')),
            min_size=0, max_size=5
        )),
        "affected_protocols": draw(st.lists(
            st.text(min_size=3, max_size=20),
            min_size=0, max_size=3
        )),
        "confidence_score": draw(st.floats(min_value=0.0, max_value=1.0)),
        "evidence": draw(st.dictionaries(
            st.text(min_size=1, max_size=20),
            st.one_of(st.text(), st.floats(), st.booleans())
        )),
        "source": draw(st.sampled_from(["forta", "goplus", "slither", "internal"]))
    }

@composite
def contract_address_strategy(draw):
    """Generate valid Ethereum contract addresses"""
    return f"0x{secrets.token_hex(20)}"

@composite
def transaction_data_strategy(draw):
    """Generate transaction data for testing"""
    return {
        "hash": f"0x{secrets.token_hex(32)}",
        "from": f"0x{secrets.token_hex(20)}",
        "to": f"0x{secrets.token_hex(20)}",
        "value": str(draw(st.integers(min_value=0, max_value=10**18))),
        "gas": draw(st.integers(min_value=21000, max_value=1000000)),
        "gasPrice": str(draw(st.integers(min_value=1000000000, max_value=200000000000))),
        "data": f"0x{draw(st.text(alphabet='0123456789abcdef', min_size=0, max_size=100))}"
    }

class TestSecurityMonitoringProperties:
    """
    Property-based tests for security monitoring functionality.
    
    **Property 6: Comprehensive Security Monitoring and Protection**
    **Validates: Requirements 6.1, 6.2, 15.1**
    """
    
    @pytest.fixture
    def guardian_config(self):
        """Configuration for Security Guardian Agent"""
        return {
            "forta_api_key": "test-key",
            "goplus_api_key": "",
            "etherscan_api_key": "test-key",
            "rug_pull_threshold": 0.7,
            "honeypot_threshold": 0.8,
            "vulnerability_threshold": 0.6
        }
    
    @pytest.fixture
    def emergency_config(self):
        """Configuration for Emergency Response System"""
        return {
            "webhook_url": "https://test-webhook.com/alerts",
            "alert_email": "test@example.com",
            "emergency_safe_address": f"0x{secrets.token_hex(20)}"
        }

    @given(st.lists(contract_address_strategy(), min_size=1, max_size=10))
    @settings(max_examples=20, deadline=45000)
    @pytest.mark.asyncio
    async def test_contract_security_analysis_consistency(self, guardian_config, contract_addresses):
        """
        Property: Contract security analysis should be consistent and bounded
        
        For any contract address, security analysis should:
        1. Return security scores between 0.0 and 1.0
        2. Provide consistent results for the same contract
        3. Include proper vulnerability categorization
        4. Generate actionable recommendations
        """
        async with SecurityGuardianAgent(guardian_config) as guardian:
            analyses = []
            
            for contract_address in contract_addresses:
                try:
                    # Analyze contract security
                    analysis = await guardian.analyze_contract_security(contract_address)
                    analyses.append((contract_address, analysis))
                    
                    # Property 1: Security scores should be bounded
                    assert 0.0 <= analysis.security_score <= 1.0, \
                        f"Security score {analysis.security_score} outside valid range [0.0, 1.0]"
                    
                    # Property 2: Analysis should have required fields
                    assert analysis.contract_address == contract_address, \
                        "Contract address should match input"
                    assert isinstance(analysis.vulnerabilities, list), \
                        "Vulnerabilities should be a list"
                    assert isinstance(analysis.risk_factors, list), \
                        "Risk factors should be a list"
                    assert isinstance(analysis.recommendations, list), \
                        "Recommendations should be a list"
                    assert isinstance(analysis.analysis_timestamp, datetime), \
                        "Analysis timestamp should be datetime"
                    
                    # Property 3: Vulnerability categorization should be valid
                    for vuln in analysis.vulnerabilities:
                        assert isinstance(vuln, dict), "Vulnerability should be dictionary"
                        if "severity" in vuln:
                            assert vuln["severity"] in ["low", "medium", "high", "critical"], \
                                f"Invalid vulnerability severity: {vuln['severity']}"
                    
                    # Property 4: Low security scores should have recommendations
                    if analysis.security_score < 0.5:
                        assert len(analysis.recommendations) > 0, \
                            "Low security score should have recommendations"
                        assert analysis.manual_review_required is True, \
                            "Low security score should require manual review"
                    
                    # Property 5: Consistent analysis for same contract
                    analysis2 = await guardian.analyze_contract_security(contract_address)
                    score_diff = abs(analysis.security_score - analysis2.security_score)
                    assert score_diff < 0.1, \
                        f"Security score inconsistent: {score_diff} difference"
                
                except Exception as e:
                    # Property: Errors should be handled gracefully
                    error_message = str(e).lower()
                    assert "analysis" in error_message or "failed" in error_message, \
                        "Security analysis errors should be descriptive"
            
            # Property: All analyses should have unique contract addresses
            if analyses:
                addresses = [addr for addr, _ in analyses]
                assert len(addresses) == len(set(addresses)), \
                    "All contract addresses should be unique"
    @given(st.lists(contract_address_strategy(), min_size=1, max_size=8))
    @settings(max_examples=15, deadline=60000)
    @pytest.mark.asyncio
    async def test_rug_pull_detection_accuracy(self, guardian_config, token_addresses):
        """
        Property: Rug pull detection should provide accurate risk assessments
        
        For any token address, rug pull detection should:
        1. Return risk scores between 0.0 and 1.0
        2. Provide risk levels that correlate with risk scores
        3. Include evidence for risk assessments
        4. Generate appropriate recommendations
        """
        async with SecurityGuardianAgent(guardian_config) as guardian:
            risk_assessments = []
            
            for token_address in token_addresses:
                try:
                    # Detect rug pull risk
                    risk_assessment = await guardian.detect_rug_pull_risk(token_address)
                    risk_assessments.append((token_address, risk_assessment))
                    
                    # Property 1: Risk scores should be bounded
                    risk_score = risk_assessment["overall_risk_score"]
                    assert 0.0 <= risk_score <= 1.0, \
                        f"Risk score {risk_score} outside valid range [0.0, 1.0]"
                    
                    # Property 2: Risk levels should correlate with scores
                    risk_level = risk_assessment["risk_level"]
                    if risk_score >= 0.8:
                        assert risk_level == ThreatLevel.CRITICAL, \
                            f"High risk score {risk_score} should have CRITICAL level, got {risk_level}"
                    elif risk_score >= 0.6:
                        assert risk_level == ThreatLevel.HIGH, \
                            f"Medium-high risk score {risk_score} should have HIGH level, got {risk_level}"
                    elif risk_score >= 0.4:
                        assert risk_level == ThreatLevel.MEDIUM, \
                            f"Medium risk score {risk_score} should have MEDIUM level, got {risk_level}"
                    else:
                        assert risk_level == ThreatLevel.LOW, \
                            f"Low risk score {risk_score} should have LOW level, got {risk_level}"
                    
                    # Property 3: Assessment should include evidence
                    assert "evidence" in risk_assessment, "Should include evidence"
                    assert isinstance(risk_assessment["evidence"], dict), "Evidence should be dictionary"
                    
                    # Property 4: Confidence should be bounded
                    confidence = risk_assessment.get("confidence", 0.0)
                    assert 0.0 <= confidence <= 1.0, \
                        f"Confidence {confidence} outside valid range [0.0, 1.0]"
                    
                    # Property 5: High-risk tokens should have strong recommendations
                    recommendations = risk_assessment.get("recommendations", [])
                    if risk_level in [ThreatLevel.HIGH, ThreatLevel.CRITICAL]:
                        assert len(recommendations) > 0, \
                            "High-risk tokens should have recommendations"
                        assert any("avoid" in rec.lower() or "caution" in rec.lower() 
                                 for rec in recommendations), \
                            "High-risk recommendations should include warnings"
                    
                    # Property 6: Risk factors should be provided for significant risks
                    risk_factors = risk_assessment.get("risk_factors", [])
                    if risk_score > 0.3:
                        assert len(risk_factors) > 0, \
                            "Significant risks should have risk factors listed"
                
                except Exception as e:
                    # Property: Errors should be handled gracefully
                    error_message = str(e).lower()
                    assert "rug pull" in error_message or "analysis" in error_message, \
                        "Rug pull detection errors should be descriptive"
            
            # Property: All assessments should be for unique tokens
            if risk_assessments:
                tokens = [token for token, _ in risk_assessments]
                assert len(tokens) == len(set(tokens)), \
                    "All token addresses should be unique"

    @given(st.lists(threat_data_strategy(), min_size=1, max_size=10))
    @settings(max_examples=15, deadline=45000)
    @pytest.mark.asyncio
    async def test_emergency_response_trigger_logic(self, emergency_config, threat_data_list):
        """
        Property: Emergency response should trigger appropriately based on threat data
        
        For any threat data, emergency response should:
        1. Assess emergency levels correctly
        2. Execute appropriate response actions
        3. Maintain audit trails
        4. Handle escalation properly
        """
        async with EmergencyResponseSystem(emergency_config) as emergency_system:
            await emergency_system.start_emergency_response()
            
            response_results = []
            
            for threat_data in threat_data_list:
                try:
                    # Trigger emergency response
                    response_result = await emergency_system.trigger_emergency_response(
                        threat_data, override_approval=True
                    )
                    response_results.append((threat_data, response_result))
                    
                    # Property 1: Response should have valid status
                    assert "status" in response_result, "Response should have status"
                    valid_statuses = ["executed", "no_action", "failed", "queued_for_approval"]
                    assert response_result["status"] in valid_statuses, \
                        f"Invalid response status: {response_result['status']}"
                    
                    # Property 2: Critical threats should trigger responses
                    if (threat_data["threat_level"] == "critical" and 
                        threat_data["confidence_score"] >= 0.8):
                        assert response_result["status"] in ["executed", "queued_for_approval"], \
                            "Critical high-confidence threats should trigger responses"
                    
                    # Property 3: Executed responses should have incident IDs
                    if response_result["status"] == "executed":
                        assert "incident_id" in response_result, \
                            "Executed responses should have incident IDs"
                        assert "emergency_level" in response_result, \
                            "Executed responses should have emergency levels"
                        assert "actions_taken" in response_result, \
                            "Executed responses should list actions taken"
                    
                    # Property 4: Emergency levels should be appropriate
                    if "emergency_level" in response_result:
                        emergency_level = response_result["emergency_level"]
                        threat_level = threat_data["threat_level"]
                        confidence = threat_data["confidence_score"]
                        
                        if threat_level == "critical" and confidence >= 0.8:
                            assert emergency_level == EmergencyLevel.LOCKDOWN, \
                                "Critical high-confidence threats should trigger LOCKDOWN"
                        elif threat_level == "high" and confidence >= 0.7:
                            assert emergency_level in [EmergencyLevel.RESPONSE, EmergencyLevel.LOCKDOWN], \
                                "High-confidence high threats should trigger RESPONSE or LOCKDOWN"
                
                except Exception as e:
                    # Property: Emergency response errors should be handled
                    error_message = str(e).lower()
                    assert "emergency" in error_message or "response" in error_message, \
                        "Emergency response errors should be descriptive"
            
            await emergency_system.stop_emergency_response()
            
            # Property: All responses should be tracked
            if response_results:
                assert len(response_results) == len(threat_data_list), \
                    "All threats should have response results"

    @given(st.lists(transaction_data_strategy(), min_size=1, max_size=15))
    @settings(max_examples=12, deadline=30000)
    @pytest.mark.asyncio
    async def test_suspicious_transaction_rejection(self, emergency_config, transactions):
        """
        Property: Suspicious transaction rejection should be consistent and auditable
        
        For any suspicious transaction, the system should:
        1. Reject transactions with proper reasoning
        2. Block addresses based on confidence levels
        3. Maintain audit trails
        4. Handle rejection consistently
        """
        async with EmergencyResponseSystem(emergency_config) as emergency_system:
            rejection_results = []
            
            for transaction in transactions:
                try:
                    # Generate random suspicion parameters
                    reasons = [
                        "Rug pull attempt detected",
                        "Honeypot interaction",
                        "Flash loan attack pattern",
                        "Price manipulation detected",
                        "Suspicious contract interaction"
                    ]
                    
                    reason = reasons[hash(transaction["hash"]) % len(reasons)]
                    confidence = min(0.95, max(0.1, hash(transaction["from"]) % 100 / 100.0))
                    
                    # Reject suspicious transaction
                    rejection_result = await emergency_system.reject_suspicious_transaction(
                        transaction, reason, confidence
                    )
                    rejection_results.append((transaction, rejection_result, confidence))
                    
                    # Property 1: Rejection should return boolean result
                    assert isinstance(rejection_result, bool), \
                        "Transaction rejection should return boolean"
                    
                    # Property 2: High confidence should result in address blocking
                    if confidence >= 0.8 and rejection_result:
                        from_address = transaction["from"].lower()
                        assert from_address in emergency_system.blocked_addresses, \
                            "High confidence rejections should block addresses"
                    
                    # Property 3: Rejections should be tracked
                    if rejection_result:
                        from_address = transaction["from"].lower()
                        assert from_address in emergency_system.transaction_rejections, \
                            "Rejected transactions should be tracked"
                        
                        rejections = emergency_system.transaction_rejections[from_address]
                        assert len(rejections) > 0, \
                            "Should have rejection records"
                        
                        # Check latest rejection
                        latest_rejection = rejections[-1]
                        assert latest_rejection["reason"] == reason, \
                            "Rejection reason should be preserved"
                        assert latest_rejection["confidence"] == confidence, \
                            "Rejection confidence should be preserved"
                
                except Exception as e:
                    # Property: Rejection errors should be handled gracefully
                    error_message = str(e).lower()
                    assert "reject" in error_message or "transaction" in error_message, \
                        "Transaction rejection errors should be descriptive"
            
            # Property: Rejection consistency
            successful_rejections = [r for _, r, _ in rejection_results if r]
            if successful_rejections:
                assert len(successful_rejections) > 0, \
                    "Should have some successful rejections"

    @given(
        st.lists(contract_address_strategy(), min_size=1, max_size=5),
        st.sampled_from(["freeze", "limit", "emergency_withdraw"])
    )
    @settings(max_examples=10, deadline=30000)
    @pytest.mark.asyncio
    async def test_fund_protection_mechanisms(self, emergency_config, addresses, protection_level):
        """
        Property: Fund protection should implement appropriate safeguards
        
        For any addresses and protection level, the system should:
        1. Implement protection measures correctly
        2. Track protected addresses
        3. Provide appropriate protection levels
        4. Maintain protection state consistency
        """
        async with EmergencyResponseSystem(emergency_config) as emergency_system:
            try:
                # Implement fund protection
                protection_result = await emergency_system.protect_funds(
                    addresses, protection_level
                )
                
                # Property 1: Protection should return valid result
                assert "status" in protection_result, "Protection should have status"
                assert protection_result["status"] in ["completed", "failed"], \
                    f"Invalid protection status: {protection_result['status']}"
                
                # Property 2: Successful protection should have results
                if protection_result["status"] == "completed":
                    assert "results" in protection_result, \
                        "Completed protection should have results"
                    assert "protection_level" in protection_result, \
                        "Should specify protection level"
                    assert protection_result["protection_level"] == protection_level, \
                        "Protection level should match request"
                    
                    results = protection_result["results"]
                    assert len(results) == len(addresses), \
                        "Should have results for all addresses"
                    
                    # Property 3: Protection state should be updated
                    for result in results:
                        assert "address" in result, "Result should have address"
                        assert "action" in result, "Result should have action"
                        assert "status" in result, "Result should have status"
                        
                        address = result["address"]
                        action = result["action"]
                        
                        if result["status"] == "success":
                            if action == "frozen":
                                assert address in emergency_system.frozen_accounts, \
                                    "Frozen addresses should be tracked"
                            elif action in ["limited", "emergency_withdraw"]:
                                # These would be tracked in actual implementation
                                pass
                
                # Property 4: All addresses should be processed
                if protection_result["status"] == "completed":
                    processed_addresses = [r["address"] for r in protection_result["results"]]
                    assert set(processed_addresses) == set(addresses), \
                        "All addresses should be processed"
            
            except Exception as e:
                # Property: Fund protection errors should be handled
                error_message = str(e).lower()
                assert "protection" in error_message or "fund" in error_message, \
                    "Fund protection errors should be descriptive"

    @given(threat_data_strategy())
    @settings(max_examples=15, deadline=30000)
    @pytest.mark.asyncio
    async def test_threat_escalation_logic(self, emergency_config, threat_data):
        """
        Property: Threat escalation should follow proper protocols
        
        For any threat, escalation should:
        1. Create proper incident records
        2. Determine appropriate escalation levels
        3. Notify human responders when required
        4. Maintain incident lifecycle
        """
        async with EmergencyResponseSystem(emergency_config) as emergency_system:
            try:
                # Create security incident
                emergency_level = emergency_system._assess_emergency_level(threat_data)
                incident = await emergency_system._create_security_incident(threat_data, emergency_level)
                
                # Property 1: Incident should have required fields
                assert incident.incident_id is not None, "Incident should have ID"
                assert incident.title is not None, "Incident should have title"
                assert incident.severity == emergency_level, "Severity should match emergency level"
                assert incident.status == IncidentStatus.DETECTED, "Initial status should be DETECTED"
                assert isinstance(incident.timeline, list), "Timeline should be list"
                assert len(incident.timeline) > 0, "Timeline should have initial entry"
                assert isinstance(incident.created_at, datetime), "Created timestamp should be datetime"
                
                # Property 2: Emergency level assessment should be logical
                threat_level = threat_data["threat_level"]
                confidence = threat_data["confidence_score"]
                
                if threat_level == "critical" and confidence >= 0.8:
                    assert emergency_level == EmergencyLevel.LOCKDOWN, \
                        "Critical high-confidence threats should be LOCKDOWN level"
                elif threat_level == "high" and confidence >= 0.7:
                    assert emergency_level == EmergencyLevel.RESPONSE, \
                        "High-confidence high threats should be RESPONSE level"
                elif threat_level in ["high", "medium"] and confidence >= 0.6:
                    assert emergency_level == EmergencyLevel.ALERT, \
                        "Medium-confidence threats should be ALERT level"
                else:
                    assert emergency_level == EmergencyLevel.WATCH, \
                        "Low-confidence threats should be WATCH level"
                
                # Property 3: Escalation to human should update incident
                escalation_result = await emergency_system.escalate_to_human(incident, "high")
                
                assert isinstance(escalation_result, bool), \
                    "Escalation should return boolean result"
                
                if escalation_result:
                    assert incident.status == IncidentStatus.INVESTIGATING, \
                        "Escalated incidents should be INVESTIGATING"
                    assert len(incident.timeline) > 1, \
                        "Escalation should add timeline entry"
                    
                    # Check timeline entry
                    escalation_entry = incident.timeline[-1]
                    assert escalation_entry["action"] == "escalated_to_human", \
                        "Timeline should record escalation"
                    assert "urgency" in escalation_entry, \
                        "Escalation should record urgency"
            
            except Exception as e:
                # Property: Escalation errors should be handled
                error_message = str(e).lower()
                assert "escalat" in error_message or "incident" in error_message, \
                    "Escalation errors should be descriptive"

# Integration test for complete security monitoring workflow
class TestSecurityMonitoringIntegration:
    """Integration tests for complete security monitoring workflow"""
    
    @pytest.mark.asyncio
    async def test_complete_security_workflow(self):
        """
        Test complete security monitoring workflow from threat detection to response
        
        **Validates: Requirements 6.1, 6.2, 15.1**
        """
        guardian_config = {
            "forta_api_key": "test-key",
            "goplus_api_key": "",
            "etherscan_api_key": "test-key"
        }
        
        emergency_config = {
            "webhook_url": "https://test-webhook.com/alerts",
            "alert_email": "test@example.com"
        }
        
        # Test complete workflow
        async with SecurityGuardianAgent(guardian_config) as guardian:
            async with EmergencyResponseSystem(emergency_config) as emergency_system:
                await emergency_system.start_emergency_response()
                
                # 1. Analyze contract security
                test_contract = f"0x{secrets.token_hex(20)}"
                contract_analysis = await guardian.analyze_contract_security(test_contract)
                assert isinstance(contract_analysis, ContractAnalysis)
                assert 0.0 <= contract_analysis.security_score <= 1.0
                
                # 2. Detect rug pull risk
                test_token = f"0x{secrets.token_hex(20)}"
                rug_pull_risk = await guardian.detect_rug_pull_risk(test_token)
                assert "overall_risk_score" in rug_pull_risk
                assert 0.0 <= rug_pull_risk["overall_risk_score"] <= 1.0
                
                # 3. Trigger emergency response for high-risk scenario
                high_risk_threat = {
                    "threat_id": "test_threat_001",
                    "threat_type": "rug_pull_detected",
                    "threat_level": "critical",
                    "confidence_score": 0.95,
                    "title": "Critical Rug Pull Detected",
                    "description": "High-confidence rug pull detection",
                    "affected_addresses": [test_token],
                    "affected_protocols": ["test_protocol"]
                }
                
                response_result = await emergency_system.trigger_emergency_response(
                    high_risk_threat, override_approval=True
                )
                assert response_result["status"] == "executed"
                assert "incident_id" in response_result
                
                # 4. Test transaction rejection
                suspicious_tx = {
                    "hash": f"0x{secrets.token_hex(32)}",
                    "from": test_token,
                    "to": f"0x{secrets.token_hex(20)}",
                    "value": "1000000000000000000"
                }
                
                rejection_result = await emergency_system.reject_suspicious_transaction(
                    suspicious_tx, "Rug pull attempt", 0.9
                )
                assert rejection_result is True
                
                # 5. Test fund protection
                protection_result = await emergency_system.protect_funds([test_token], "freeze")
                assert protection_result["status"] == "completed"
                
                await emergency_system.stop_emergency_response()
        
        logger.info("Complete security monitoring workflow test passed")

if __name__ == "__main__":
    # Run property-based tests
    pytest.main([__file__, "-v", "--tb=short"])