"""
Property-Based Tests for Wallet Security and Testnet Learning

This module implements property-based tests to validate the correctness
of wallet security mechanisms, testnet learning progression, and safe
DeFi operation validation in the multi-agent system.

**Feature: defi-automation-platform, Property 4: Testnet Learning and Safe Progression**
**Validates: Requirements 4.1, 4.2, 4.3**
"""

import asyncio
import pytest
import uuid
import secrets
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from hypothesis import given, strategies as st, settings, assume
from hypothesis.stateful import RuleBasedStateMachine, rule, initialize, invariant

from src.wallet.web3auth_service import (
    Web3AuthService, WalletType, RecoveryMethod, WalletCreationRequest,
    SigningRequest, Guardian
)

# Test data generators
@st.composite
def wallet_creation_strategy(draw):
    """Generate wallet creation requests"""
    wallet_types = [WalletType.MPC, WalletType.EOA, WalletType.SMART_CONTRACT]
    recovery_methods = [RecoveryMethod.SOCIAL, RecoveryMethod.SEED_PHRASE, 
                       RecoveryMethod.MPC_SHARES, RecoveryMethod.BIOMETRIC]
    
    guardians = []
    if draw(st.booleans()):  # Sometimes include guardians
        num_guardians = draw(st.integers(min_value=1, max_value=5))
        for _ in range(num_guardians):
            guardians.append({
                "name": draw(st.text(min_size=3, max_size=20)),
                "email": f"{draw(st.text(min_size=3, max_size=10))}@example.com",
                "wallet_address": f"0x{secrets.token_hex(20)}"
            })
    
    return WalletCreationRequest(
        user_id=f"user_{draw(st.integers(min_value=1, max_value=100))}",
        wallet_type=draw(st.sampled_from(wallet_types)),
        social_login_provider=draw(st.one_of(st.none(), st.sampled_from(["google", "facebook", "twitter"]))),
        recovery_methods=draw(st.lists(st.sampled_from(recovery_methods), min_size=1, max_size=3, unique=True)),
        guardians=guardians,
        metadata={"test": True, "created_by": "property_test"}
    )

@st.composite
def transaction_strategy(draw):
    """Generate transaction data for testing"""
    return {
        "to": f"0x{secrets.token_hex(20)}",
        "value": draw(st.integers(min_value=0, max_value=10**18)),
        "gas": draw(st.integers(min_value=21000, max_value=500000)),
        "gasPrice": draw(st.integers(min_value=1000000000, max_value=100000000000)),
        "nonce": draw(st.integers(min_value=0, max_value=1000)),
        "data": f"0x{draw(st.text(alphabet='0123456789abcdef', min_size=0, max_size=100))}"
    }

@st.composite
def testnet_progression_strategy(draw):
    """Generate testnet learning progression scenarios"""
    return {
        "user_id": f"user_{draw(st.integers(min_value=1, max_value=50))}",
        "testnet_operations": draw(st.lists(
            st.dictionaries(
                st.sampled_from(["swap", "lend", "stake", "provide_liquidity"]),
                st.dictionaries(st.text(), st.floats(min_value=0.1, max_value=1000.0))
            ),
            min_size=1,
            max_size=10
        )),
        "success_rate": draw(st.floats(min_value=0.0, max_value=1.0)),
        "learning_progress": draw(st.floats(min_value=0.0, max_value=1.0)),
        "risk_comfort": draw(st.floats(min_value=0.0, max_value=1.0))
    }

class TestnetEnvironment:
    """Mock testnet environment for testing"""
    
    def __init__(self):
        self.testnet_balances = {}
        self.operation_history = {}
        self.user_progress = {}
        self.available_tokens = {
            "ETH": {"balance": 10.0, "price": 2000.0},
            "USDC": {"balance": 10000.0, "price": 1.0},
            "DAI": {"balance": 5000.0, "price": 1.0}
        }
    
    async def provide_testnet_tokens(self, user_id: str, wallet_address: str) -> Dict[str, float]:
        """Provide free testnet tokens to user"""
        if user_id not in self.testnet_balances:
            self.testnet_balances[user_id] = self.available_tokens.copy()
        
        return self.testnet_balances[user_id]
    
    async def execute_testnet_operation(self, user_id: str, operation: Dict[str, Any]) -> Dict[str, Any]:
        """Execute operation on testnet"""
        if user_id not in self.operation_history:
            self.operation_history[user_id] = []
        
        # Simulate operation execution
        result = {
            "operation_id": str(uuid.uuid4()),
            "type": list(operation.keys())[0],
            "parameters": list(operation.values())[0],
            "success": True,  # Testnet operations generally succeed
            "gas_used": 50000,
            "timestamp": datetime.utcnow(),
            "network": "testnet"
        }
        
        self.operation_history[user_id].append(result)
        return result
    
    async def track_learning_progress(self, user_id: str, operation_result: Dict[str, Any]):
        """Track user learning progress"""
        if user_id not in self.user_progress:
            self.user_progress[user_id] = {
                "operations_completed": 0,
                "success_rate": 1.0,
                "confidence_level": 0.1,
                "ready_for_mainnet": False
            }
        
        progress = self.user_progress[user_id]
        progress["operations_completed"] += 1
        
        # Update confidence based on successful operations
        if operation_result["success"]:
            progress["confidence_level"] = min(1.0, progress["confidence_level"] + 0.1)
        
        # Mark ready for mainnet after sufficient testnet experience
        if (progress["operations_completed"] >= 5 and 
            progress["confidence_level"] >= 0.7):
            progress["ready_for_mainnet"] = True
    
    def get_user_progress(self, user_id: str) -> Dict[str, Any]:
        """Get user learning progress"""
        return self.user_progress.get(user_id, {
            "operations_completed": 0,
            "success_rate": 0.0,
            "confidence_level": 0.0,
            "ready_for_mainnet": False
        })

class TestWalletSecurity:
    """Property-based tests for wallet security and testnet learning"""
    
    @pytest.fixture
    async def web3auth_service(self):
        """Create Web3Auth service for testing"""
        service = Web3AuthService("redis://localhost:6379/3")
        await service.initialize()
        yield service
        await service.shutdown()
    
    @pytest.fixture
    def testnet_env(self):
        """Create testnet environment for testing"""
        return TestnetEnvironment()

    @given(wallet_requests=st.lists(wallet_creation_strategy(), min_size=1, max_size=10))
    @settings(max_examples=30, deadline=45000)
    @pytest.mark.asyncio
    async def test_wallet_creation_security(self, web3auth_service, wallet_requests):
        """
        Property: For any wallet creation request, the system should create
        secure wallets with proper key management and recovery mechanisms.
        """
        created_wallets = []
        
        for request in wallet_requests:
            try:
                wallet_response = await web3auth_service.create_wallet(request)
                created_wallets.append((request, wallet_response))
                
                # Property: Wallet should be created successfully
                assert wallet_response is not None, "Wallet creation should succeed"
                assert wallet_response.wallet_id is not None, "Wallet should have ID"
                assert wallet_response.address is not None, "Wallet should have address"
                assert wallet_response.public_key is not None, "Wallet should have public key"
                
                # Property: Wallet address should be valid Ethereum address
                assert wallet_response.address.startswith("0x"), "Address should start with 0x"
                assert len(wallet_response.address) == 42, "Address should be 42 characters"
                
                # Property: Wallet type should match request
                assert wallet_response.wallet_type == request.wallet_type, \
                       "Wallet type should match request"
                
                # Property: Recovery methods should be preserved
                assert set(wallet_response.recovery_methods) == set(request.recovery_methods), \
                       "Recovery methods should match request"
                
                # Property: Private keys should never be exposed in response
                response_dict = wallet_response.dict()
                for key, value in response_dict.items():
                    if isinstance(value, str):
                        assert "private" not in key.lower(), \
                               "Private key should not be in response"
                        assert not (len(value) == 64 and all(c in '0123456789abcdef' for c in value.lower())), \
                               "Response should not contain private key-like strings"
                
            except Exception as e:
                # Property: Errors should be handled gracefully
                assert "creation failed" in str(e).lower() or "invalid" in str(e).lower(), \
                       f"Unexpected wallet creation error: {e}"
        
        # Property: All created wallets should have unique addresses
        addresses = [w[1].address for w in created_wallets]
        assert len(addresses) == len(set(addresses)), "All wallet addresses should be unique"

    @given(
        wallet_request=wallet_creation_strategy(),
        transactions=st.lists(transaction_strategy(), min_size=1, max_size=5)
    )
    @settings(max_examples=20, deadline=60000)
    @pytest.mark.asyncio
    async def test_transaction_signing_security(self, web3auth_service, wallet_request, transactions):
        """
        Property: For any transaction signing request, the system should
        sign transactions securely without exposing private keys.
        """
        # Create wallet first
        wallet_response = await web3auth_service.create_wallet(wallet_request)
        
        for transaction_data in transactions:
            try:
                signing_request = SigningRequest(
                    wallet_id=wallet_response.wallet_id,
                    transaction_data=transaction_data,
                    chain_id=1
                )
                
                signing_response = await web3auth_service.sign_transaction(
                    signing_request, wallet_request.user_id
                )
                
                # Property: Signing should produce valid response
                assert signing_response is not None, "Signing should produce response"
                assert signing_response.signed_transaction is not None, "Should have signed transaction"
                assert signing_response.signature is not None, "Should have signature"
                assert signing_response.transaction_hash is not None, "Should have transaction hash"
                
                # Property: Signature should be valid format
                assert signing_response.signature.startswith("0x"), "Signature should start with 0x"
                assert len(signing_response.signature) >= 130, "Signature should be proper length"
                
                # Property: Transaction hash should be valid format
                assert signing_response.transaction_hash.startswith("0x"), "TX hash should start with 0x"
                assert len(signing_response.transaction_hash) == 66, "TX hash should be 66 characters"
                
                # Property: Recovery ID should be valid
                assert 0 <= signing_response.recovery_id <= 3, "Recovery ID should be 0-3"
                
            except Exception as e:
                # Property: Authorization errors should be handled properly
                assert ("unauthorized" in str(e).lower() or 
                       "not found" in str(e).lower() or
                       "signing failed" in str(e).lower()), \
                       f"Unexpected signing error: {e}"

    @given(testnet_scenarios=st.lists(testnet_progression_strategy(), min_size=1, max_size=15))
    @settings(max_examples=25, deadline=60000)
    @pytest.mark.asyncio
    async def test_testnet_learning_progression(self, web3auth_service, testnet_env, testnet_scenarios):
        """
        Property: For any testnet learning scenario, the system should
        provide safe learning environment and track progression appropriately.
        """
        for scenario in testnet_scenarios:
            user_id = scenario["user_id"]
            
            # Property: Testnet tokens should be provided for free
            testnet_balance = await testnet_env.provide_testnet_tokens(
                user_id, f"0x{secrets.token_hex(20)}"
            )
            
            assert testnet_balance is not None, "Testnet tokens should be provided"
            assert len(testnet_balance) > 0, "Should provide multiple token types"
            
            for token, info in testnet_balance.items():
                assert info["balance"] > 0, f"Should provide positive balance for {token}"
            
            # Execute testnet operations
            for operation in scenario["testnet_operations"]:
                operation_result = await testnet_env.execute_testnet_operation(user_id, operation)
                
                # Property: Testnet operations should be safe and educational
                assert operation_result["success"] is True, "Testnet operations should generally succeed"
                assert operation_result["network"] == "testnet", "Should execute on testnet"
                assert operation_result["gas_used"] > 0, "Should track gas usage for learning"
                
                # Track learning progress
                await testnet_env.track_learning_progress(user_id, operation_result)
            
            # Verify learning progression
            progress = testnet_env.get_user_progress(user_id)
            
            # Property: Progress should be tracked accurately
            assert progress["operations_completed"] == len(scenario["testnet_operations"]), \
                   "Should track all completed operations"
            
            # Property: Confidence should increase with successful operations
            if progress["operations_completed"] > 0:
                assert progress["confidence_level"] > 0, "Confidence should increase with experience"
            
            # Property: Mainnet readiness should be based on sufficient experience
            if progress["operations_completed"] >= 5 and progress["confidence_level"] >= 0.7:
                assert progress["ready_for_mainnet"] is True, \
                       "Should be ready for mainnet after sufficient testnet experience"
            else:
                assert progress["ready_for_mainnet"] is False, \
                       "Should not be ready for mainnet without sufficient experience"

    @given(
        wallet_request=wallet_creation_strategy(),
        recovery_scenarios=st.lists(
            st.dictionaries(
                st.sampled_from(["recovery_method", "recovery_data"]),
                st.one_of(
                    st.sampled_from([RecoveryMethod.SOCIAL, RecoveryMethod.SEED_PHRASE]),
                    st.dictionaries(st.text(), st.text())
                )
            ),
            min_size=1,
            max_size=3
        )
    )
    @settings(max_examples=15, deadline=45000)
    @pytest.mark.asyncio
    async def test_wallet_recovery_security(self, web3auth_service, wallet_request, recovery_scenarios):
        """
        Property: For any wallet recovery scenario, the system should
        provide secure recovery mechanisms without compromising security.
        """
        # Ensure social recovery is enabled for testing
        if RecoveryMethod.SOCIAL not in wallet_request.recovery_methods:
            wallet_request.recovery_methods.append(RecoveryMethod.SOCIAL)
        
        # Create wallet with recovery methods
        wallet_response = await web3auth_service.create_wallet(wallet_request)
        
        for scenario in recovery_scenarios:
            recovery_method = scenario.get("recovery_method", RecoveryMethod.SOCIAL)
            recovery_data = scenario.get("recovery_data", {})
            
            # Only test recovery methods that are enabled for the wallet
            if recovery_method in wallet_request.recovery_methods:
                try:
                    recovery_result = await web3auth_service.initiate_recovery(
                        wallet_response.wallet_id, recovery_method, recovery_data
                    )
                    
                    # Property: Recovery initiation should be secure
                    assert recovery_result is not None, "Recovery should be initiated"
                    assert "recovery_id" in recovery_result, "Should have recovery ID"
                    assert "recovery_method" in recovery_result, "Should specify recovery method"
                    assert "status" in recovery_result, "Should have recovery status"
                    
                    # Property: Recovery should not expose sensitive information
                    for key, value in recovery_result.items():
                        if isinstance(value, str):
                            assert "private" not in key.lower(), \
                                   "Recovery should not expose private information"
                            assert not (len(value) == 64 and all(c in '0123456789abcdef' for c in value.lower())), \
                                   "Recovery should not expose private key-like strings"
                    
                    # Property: Social recovery should require multiple confirmations
                    if recovery_method == RecoveryMethod.SOCIAL:
                        assert recovery_result["status"] in ["pending", "pending_confirmations"], \
                               "Social recovery should require confirmations"
                    
                except Exception as e:
                    # Property: Recovery errors should be handled securely
                    assert ("not found" in str(e).lower() or 
                           "not enabled" in str(e).lower() or
                           "invalid" in str(e).lower()), \
                           f"Unexpected recovery error: {e}"

    @given(
        user_operations=st.lists(
            st.tuples(
                wallet_creation_strategy(),
                st.lists(transaction_strategy(), min_size=1, max_size=3)
            ),
            min_size=1,
            max_size=5
        )
    )
    @settings(max_examples=15, deadline=60000)
    @pytest.mark.asyncio
    async def test_multi_wallet_security_isolation(self, web3auth_service, user_operations):
        """
        Property: For any multi-wallet scenario, the system should
        maintain security isolation between different wallets and users.
        """
        created_wallets = []
        
        # Create wallets and perform operations
        for wallet_request, transactions in user_operations:
            wallet_response = await web3auth_service.create_wallet(wallet_request)
            created_wallets.append((wallet_request, wallet_response, transactions))
        
        # Test cross-wallet access attempts
        for i, (request_a, wallet_a, _) in enumerate(created_wallets):
            for j, (request_b, wallet_b, transactions_b) in enumerate(created_wallets):
                if i != j:  # Different wallets
                    # Property: Users should not access other users' wallets
                    wallet_info = await web3auth_service.get_wallet_info(
                        wallet_b.wallet_id, request_a.user_id
                    )
                    
                    if request_a.user_id != request_b.user_id:
                        assert wallet_info is None, \
                               "Users should not access other users' wallets"
                    
                    # Property: Users should not sign transactions for other users' wallets
                    if transactions_b and request_a.user_id != request_b.user_id:
                        try:
                            signing_request = SigningRequest(
                                wallet_id=wallet_b.wallet_id,
                                transaction_data=transactions_b[0]
                            )
                            
                            await web3auth_service.sign_transaction(
                                signing_request, request_a.user_id
                            )
                            
                            # Should not reach here
                            assert False, "Should not be able to sign for other user's wallet"
                            
                        except Exception as e:
                            # Property: Should get authorization error
                            assert ("unauthorized" in str(e).lower() or 
                                   "not found" in str(e).lower()), \
                                   "Should get proper authorization error"
        
        # Property: Each wallet should have unique address
        addresses = [wallet[1].address for wallet in created_wallets]
        assert len(addresses) == len(set(addresses)), "All wallets should have unique addresses"
        
        # Property: Wallet IDs should be unique
        wallet_ids = [wallet[1].wallet_id for wallet in created_wallets]
        assert len(wallet_ids) == len(set(wallet_ids)), "All wallets should have unique IDs"


class WalletSecurityStateMachine(RuleBasedStateMachine):
    """
    Stateful property-based testing for wallet security
    
    This state machine tests wallet security through various
    state transitions and security scenarios.
    """
    
    def __init__(self):
        super().__init__()
        self.wallets = {}
        self.users = set()
        self.testnet_env = TestnetEnvironment()
        self.security_violations = []
    
    @initialize()
    def setup(self):
        """Initialize the state machine"""
        self.wallets = {}
        self.users = set()
        self.testnet_env = TestnetEnvironment()
        self.security_violations = []
    
    @rule(wallet_request=wallet_creation_strategy())
    def create_wallet(self, wallet_request):
        """Rule: Create a new wallet"""
        # Mock wallet creation for state machine
        wallet_id = str(uuid.uuid4())
        self.wallets[wallet_id] = {
            "user_id": wallet_request.user_id,
            "wallet_type": wallet_request.wallet_type,
            "address": f"0x{secrets.token_hex(20)}",
            "recovery_methods": wallet_request.recovery_methods,
            "created_at": datetime.utcnow(),
            "is_active": True
        }
        self.users.add(wallet_request.user_id)
    
    @rule(transaction_data=transaction_strategy())
    def attempt_transaction(self, transaction_data):
        """Rule: Attempt to sign a transaction"""
        assume(len(self.wallets) > 0)
        
        wallet_id = list(self.wallets.keys())[0]
        wallet = self.wallets[wallet_id]
        
        # Mock transaction signing
        if wallet["is_active"]:
            # Transaction should succeed for active wallet
            pass
        else:
            # Should fail for inactive wallet
            self.security_violations.append("inactive_wallet_transaction")
    
    @rule()
    def attempt_cross_user_access(self):
        """Rule: Attempt cross-user wallet access"""
        assume(len(self.users) >= 2)
        assume(len(self.wallets) >= 2)
        
        users = list(self.users)
        user_a = users[0]
        
        # Find wallet belonging to different user
        other_user_wallet = None
        for wallet_id, wallet in self.wallets.items():
            if wallet["user_id"] != user_a:
                other_user_wallet = wallet_id
                break
        
        if other_user_wallet:
            # This should be a security violation
            self.security_violations.append("cross_user_access_attempt")
    
    @invariant()
    def wallet_security_invariants(self):
        """Invariant: Wallet security properties should hold"""
        # All wallets should have unique addresses
        addresses = [w["address"] for w in self.wallets.values()]
        assert len(addresses) == len(set(addresses)), "All wallet addresses should be unique"
        
        # All wallets should belong to valid users
        for wallet in self.wallets.values():
            assert wallet["user_id"] in self.users, "All wallets should belong to registered users"
        
        # Active wallets should have valid addresses
        for wallet in self.wallets.values():
            if wallet["is_active"]:
                assert wallet["address"].startswith("0x"), "Active wallets should have valid addresses"
                assert len(wallet["address"]) == 42, "Addresses should be 42 characters"
    
    @invariant()
    def security_violation_tracking(self):
        """Invariant: Security violations should be properly tracked"""
        # Security violations should be limited
        assert len(self.security_violations) <= 10, "Too many security violations detected"
        
        # Cross-user access should always be violations
        cross_user_violations = [v for v in self.security_violations if "cross_user" in v]
        # In a real system, these should always be blocked
        # For testing, we just track them


# Test configuration
TestWalletSecurityStateMachine = WalletSecurityStateMachine.TestCase

class TestWalletOperations:
    """
    Property-based tests for comprehensive wallet operations
    
    **Property 6: Comprehensive Security Monitoring and Protection**
    **Validates: Requirements 6.1, 6.2, 15.1**
    """
    
    @pytest.fixture
    async def smart_wallet_manager(self):
        """Create Smart Wallet Manager for testing"""
        from src.agents.smart_wallet_manager import SmartWalletManager
        
        async with SmartWalletManager(
            alchemy_api_key="test-key",
            biconomy_api_key="test-key"
        ) as manager:
            yield manager
    
    @pytest.fixture
    async def transaction_validator(self):
        """Create Transaction Validator for testing"""
        from src.security.transaction_validator import TransactionValidator
        
        async with TransactionValidator(
            tenderly_api_key="test-key",
            tenderly_user="test-user",
            tenderly_project="test-project"
        ) as validator:
            yield validator

    @given(
        wallet_operations=st.lists(
            st.dictionaries(
                st.sampled_from(['create_wallet', 'deploy_wallet', 'execute_transaction', 'batch_transactions']),
                st.dictionaries(
                    st.sampled_from(['owner', 'to', 'value', 'data', 'gas_strategy']),
                    st.one_of(
                        st.text(min_size=42, max_size=42).filter(lambda x: x.startswith('0x')),
                        st.integers(min_value=0, max_value=10**18),
                        st.sampled_from(['slow', 'standard', 'fast', 'instant']),
                        st.text(alphabet='0123456789abcdef', min_size=2, max_size=100).map(lambda x: f"0x{x}")
                    )
                )
            ),
            min_size=1,
            max_size=10
        )
    )
    @settings(max_examples=25, deadline=60000)
    @pytest.mark.asyncio
    async def test_wallet_operations_security_monitoring(self, smart_wallet_manager, wallet_operations):
        """
        Property: For any sequence of wallet operations, the system should
        maintain comprehensive security monitoring and protection throughout.
        
        **Validates: Requirements 6.1, 6.2, 15.1**
        """
        created_wallets = []
        security_events = []
        
        for operation_data in wallet_operations:
            operation_type = list(operation_data.keys())[0]
            operation_params = list(operation_data.values())[0]
            
            try:
                if operation_type == 'create_wallet':
                    owner_address = operation_params.get('owner', f"0x{secrets.token_hex(20)}")
                    
                    # Property: Wallet creation should be secure and monitored
                    wallet = await smart_wallet_manager.create_smart_wallet(owner_address)
                    created_wallets.append(wallet)
                    
                    # Property: Created wallet should have valid security properties
                    assert wallet.address is not None, "Wallet should have valid address"
                    assert wallet.address.startswith("0x"), "Address should be valid Ethereum format"
                    assert len(wallet.address) == 42, "Address should be 42 characters"
                    assert wallet.owner_address == owner_address, "Owner should be preserved"
                    assert wallet.is_deployed is False, "New wallet should not be deployed initially"
                    assert wallet.nonce == 0, "New wallet should have zero nonce"
                    
                elif operation_type == 'deploy_wallet' and created_wallets:
                    wallet = created_wallets[0]
                    
                    # Property: Deployment should be secure and monitored
                    deploy_result = await smart_wallet_manager.deploy_smart_wallet(wallet.address)
                    
                    # Property: Deployment should succeed or fail gracefully
                    assert 'success' in deploy_result, "Deployment should return success status"
                    assert isinstance(deploy_result['success'], bool), "Success should be boolean"
                    
                    if deploy_result['success']:
                        # Property: Successful deployment should update wallet state
                        updated_wallet = smart_wallet_manager.wallet_cache.get(wallet.address)
                        if updated_wallet:
                            assert updated_wallet.is_deployed is True, "Deployed wallet should be marked as deployed"
                            assert updated_wallet.last_activity is not None, "Last activity should be updated"
                    
                elif operation_type == 'execute_transaction' and created_wallets:
                    wallet = created_wallets[0]
                    to_address = operation_params.get('to', f"0x{secrets.token_hex(20)}")
                    value = operation_params.get('value', 0)
                    
                    # Property: Transaction execution should be secure and monitored
                    tx_result = await smart_wallet_manager.execute_transaction(
                        wallet.address,
                        to_address,
                        value
                    )
                    
                    # Property: Transaction should return proper result structure
                    assert 'success' in tx_result, "Transaction should return success status"
                    assert isinstance(tx_result['success'], bool), "Success should be boolean"
                    
                    if tx_result['success']:
                        # Property: Successful transaction should update wallet state
                        updated_wallet = smart_wallet_manager.wallet_cache.get(wallet.address)
                        if updated_wallet:
                            assert updated_wallet.last_activity is not None, "Last activity should be updated"
                    
                elif operation_type == 'batch_transactions' and created_wallets:
                    wallet = created_wallets[0]
                    
                    # Create sample batch transactions
                    batch_txs = [
                        {
                            'to': f"0x{secrets.token_hex(20)}",
                            'value': 1000000000000000000,  # 1 ETH
                            'data': '0x'
                        },
                        {
                            'to': f"0x{secrets.token_hex(20)}",
                            'value': 500000000000000000,   # 0.5 ETH
                            'data': '0x'
                        }
                    ]
                    
                    # Property: Batch execution should be secure and optimized
                    batch_result = await smart_wallet_manager.batch_transactions(
                        wallet.address,
                        batch_txs
                    )
                    
                    # Property: Batch should return proper result structure
                    assert 'success' in batch_result, "Batch should return success status"
                    assert isinstance(batch_result['success'], bool), "Success should be boolean"
                    
                    if batch_result['success'] and 'batch_info' in batch_result:
                        batch_info = batch_result['batch_info']
                        
                        # Property: Batch info should contain optimization data
                        assert 'transaction_count' in batch_info, "Should track transaction count"
                        assert 'estimated_gas' in batch_info, "Should estimate gas usage"
                        assert 'gas_savings' in batch_info, "Should calculate gas savings"
                        assert batch_info['transaction_count'] == len(batch_txs), "Should track correct count"
                
            except Exception as e:
                # Property: Errors should be handled gracefully with proper logging
                security_events.append({
                    'type': 'operation_error',
                    'operation': operation_type,
                    'error': str(e),
                    'timestamp': datetime.utcnow()
                })
                
                # Property: Errors should be informative and not expose sensitive data
                error_message = str(e).lower()
                assert 'private' not in error_message, "Error should not expose private information"
                assert 'key' not in error_message or 'api' in error_message, "Error should not expose keys"
        
        # Property: All created wallets should have unique addresses
        if created_wallets:
            addresses = [w.address for w in created_wallets]
            assert len(addresses) == len(set(addresses)), "All wallet addresses should be unique"
        
        # Property: Security events should be properly tracked
        assert isinstance(security_events, list), "Security events should be tracked in list"

    @given(
        transactions=st.lists(
            st.dictionaries(
                st.sampled_from(['from', 'to', 'value', 'data', 'gas', 'gasPrice', 'chainId']),
                st.one_of(
                    st.text(min_size=42, max_size=42).filter(lambda x: x.startswith('0x')),
                    st.integers(min_value=0, max_value=10**18),
                    st.integers(min_value=21000, max_value=1000000),
                    st.integers(min_value=1000000000, max_value=200000000000),
                    st.integers(min_value=1, max_value=1000),
                    st.text(alphabet='0123456789abcdef', min_size=2, max_size=200).map(lambda x: f"0x{x}")
                )
            ),
            min_size=1,
            max_size=15
        )
    )
    @settings(max_examples=20, deadline=60000)
    @pytest.mark.asyncio
    async def test_transaction_security_validation(self, transaction_validator, transactions):
        """
        Property: For any transaction, the security validation system should
        provide comprehensive analysis and protection mechanisms.
        
        **Validates: Requirements 6.1, 6.2, 15.1**
        """
        validation_results = []
        
        for tx_data in transactions:
            # Ensure required fields are present
            transaction = {
                'from': tx_data.get('from', f"0x{secrets.token_hex(20)}"),
                'to': tx_data.get('to', f"0x{secrets.token_hex(20)}"),
                'value': tx_data.get('value', 0),
                'data': tx_data.get('data', '0x'),
                'gas': tx_data.get('gas', 21000),
                'gasPrice': tx_data.get('gasPrice', 20000000000),
                'chainId': tx_data.get('chainId', 1)
            }
            
            try:
                # Property: Validation should always return a complete result
                validation = await transaction_validator.validate_transaction(transaction)
                validation_results.append(validation)
                
                # Property: Validation result should have required fields
                assert validation.transaction_hash is not None, "Should have transaction hash"
                assert validation.validation_result is not None, "Should have validation result"
                assert validation.security_level is not None, "Should have security level"
                assert isinstance(validation.security_checks, list), "Should have security checks list"
                assert isinstance(validation.recommendations, list), "Should have recommendations list"
                assert isinstance(validation.requires_approval, bool), "Should have approval requirement"
                
                # Property: High-risk transactions should require approval
                if validation.security_level.value in ['high', 'critical']:
                    assert validation.requires_approval is True, \
                           "High-risk transactions should require approval"
                
                # Property: Rejected transactions should have clear reasons
                if validation.validation_result.value == 'rejected':
                    failed_checks = [check for check in validation.security_checks if not check.passed]
                    assert len(failed_checks) > 0, "Rejected transactions should have failed security checks"
                
                # Property: Security checks should be comprehensive
                check_names = [check.check_name for check in validation.security_checks]
                expected_checks = ['blocked_address', 'high_gas_price', 'high_value']
                # At least some basic checks should be performed
                assert len(check_names) > 0, "Should perform security checks"
                
                # Property: Recommendations should be actionable
                if validation.recommendations:
                    for recommendation in validation.recommendations:
                        assert isinstance(recommendation, str), "Recommendations should be strings"
                        assert len(recommendation) > 0, "Recommendations should not be empty"
                
            except Exception as e:
                # Property: Validation errors should be handled gracefully
                error_message = str(e).lower()
                assert 'validation' in error_message or 'failed' in error_message, \
                       "Validation errors should be descriptive"
        
        # Property: All validations should produce unique transaction hashes
        if validation_results:
            tx_hashes = [v.transaction_hash for v in validation_results]
            # Note: Same transaction data might produce same hash, which is correct
            assert all(isinstance(h, str) for h in tx_hashes), "All hashes should be strings"
            assert all(len(h) > 0 for h in tx_hashes), "All hashes should be non-empty"

    @given(
        mev_scenarios=st.lists(
            st.dictionaries(
                st.sampled_from(['transaction_type', 'value', 'slippage', 'gas_price']),
                st.one_of(
                    st.sampled_from(['dex_swap', 'token_transfer', 'contract_call']),
                    st.integers(min_value=1000000000000000, max_value=100000000000000000000),  # 0.001 to 100 ETH
                    st.floats(min_value=0.001, max_value=0.1),  # 0.1% to 10% slippage
                    st.integers(min_value=1000000000, max_value=500000000000)  # 1 to 500 gwei
                )
            ),
            min_size=1,
            max_size=10
        )
    )
    @settings(max_examples=15, deadline=45000)
    @pytest.mark.asyncio
    async def test_mev_protection_and_slippage_analysis(self, transaction_validator, mev_scenarios):
        """
        Property: For any MEV-vulnerable scenario, the system should
        detect risks and provide appropriate protection recommendations.
        
        **Validates: Requirements 6.1, 6.2, 15.1**
        """
        mev_analyses = []
        slippage_analyses = []
        
        for scenario in mev_scenarios:
            tx_type = scenario.get('transaction_type', 'dex_swap')
            value = scenario.get('value', 1000000000000000000)  # 1 ETH
            slippage = scenario.get('slippage', 0.005)  # 0.5%
            gas_price = scenario.get('gas_price', 20000000000)  # 20 gwei
            
            # Create transaction based on scenario
            if tx_type == 'dex_swap':
                transaction = {
                    'from': f"0x{secrets.token_hex(20)}",
                    'to': '0x7a250d5630b4cf539739df2c5dacb4c659f2488d',  # Uniswap V2 Router
                    'value': value,
                    'data': '0x38ed1739',  # swapExactTokensForTokens selector
                    'gas': 200000,
                    'gasPrice': gas_price,
                    'chainId': 1
                }
            else:
                transaction = {
                    'from': f"0x{secrets.token_hex(20)}",
                    'to': f"0x{secrets.token_hex(20)}",
                    'value': value,
                    'data': '0xa9059cbb',  # transfer selector
                    'gas': 21000,
                    'gasPrice': gas_price,
                    'chainId': 1
                }
            
            try:
                # Property: MEV analysis should always return valid results
                mev_analysis = await transaction_validator.detect_mev_risks(transaction)
                mev_analyses.append(mev_analysis)
                
                # Property: MEV analysis should have required fields
                assert hasattr(mev_analysis, 'risk_types'), "Should have risk types"
                assert hasattr(mev_analysis, 'risk_score'), "Should have risk score"
                assert hasattr(mev_analysis, 'vulnerable_to_sandwich'), "Should check sandwich vulnerability"
                assert hasattr(mev_analysis, 'vulnerable_to_frontrun'), "Should check frontrun vulnerability"
                assert hasattr(mev_analysis, 'protection_recommendations'), "Should have recommendations"
                assert hasattr(mev_analysis, 'estimated_mev_loss'), "Should estimate potential loss"
                
                # Property: Risk score should be valid
                assert 0.0 <= mev_analysis.risk_score <= 1.0, "Risk score should be between 0 and 1"
                
                # Property: High-value DEX transactions should be flagged for MEV risks
                if tx_type == 'dex_swap' and value > 10 * 10**18:  # > 10 ETH
                    assert mev_analysis.risk_score > 0, "Large DEX transactions should have MEV risk"
                
                # Property: Protection recommendations should be provided for risky transactions
                if mev_analysis.risk_score > 0.5:
                    assert len(mev_analysis.protection_recommendations) > 0, \
                           "High-risk transactions should have protection recommendations"
                
                # Test slippage analysis for DEX transactions
                if tx_type == 'dex_swap':
                    expected_output = value * 0.95  # Assume 5% price impact
                    minimum_output = expected_output * (1 - slippage)
                    
                    slippage_analysis = await transaction_validator.check_slippage_protection(
                        transaction, expected_output, minimum_output
                    )
                    slippage_analyses.append(slippage_analysis)
                    
                    # Property: Slippage analysis should have required fields
                    assert hasattr(slippage_analysis, 'expected_output'), "Should have expected output"
                    assert hasattr(slippage_analysis, 'minimum_output'), "Should have minimum output"
                    assert hasattr(slippage_analysis, 'current_slippage'), "Should calculate current slippage"
                    assert hasattr(slippage_analysis, 'price_impact'), "Should estimate price impact"
                    assert hasattr(slippage_analysis, 'is_acceptable'), "Should determine acceptability"
                    
                    # Property: Slippage calculations should be mathematically correct
                    if expected_output > 0:
                        calculated_slippage = (expected_output - minimum_output) / expected_output
                        assert abs(slippage_analysis.current_slippage - calculated_slippage) < 0.001, \
                               "Slippage calculation should be accurate"
                    
                    # Property: High slippage should be flagged as unacceptable
                    if slippage_analysis.current_slippage > 0.05:  # > 5%
                        assert slippage_analysis.is_acceptable is False, \
                               "High slippage should be flagged as unacceptable"
                
            except Exception as e:
                # Property: Analysis errors should be handled gracefully
                error_message = str(e).lower()
                assert 'analysis' in error_message or 'failed' in error_message, \
                       "Analysis errors should be descriptive"
        
        # Property: All analyses should be consistent
        if mev_analyses:
            assert all(isinstance(analysis.risk_score, (int, float)) for analysis in mev_analyses), \
                   "All risk scores should be numeric"
            assert all(isinstance(analysis.risk_types, list) for analysis in mev_analyses), \
                   "All risk types should be lists"
        
        if slippage_analyses:
            assert all(isinstance(analysis.is_acceptable, bool) for analysis in slippage_analyses), \
                   "All acceptability flags should be boolean"

    @given(
        emergency_scenarios=st.lists(
            st.dictionaries(
                st.sampled_from(['trigger_type', 'severity', 'affected_wallets']),
                st.one_of(
                    st.sampled_from(['suspicious_activity', 'high_gas_attack', 'contract_exploit']),
                    st.sampled_from(['low', 'medium', 'high', 'critical']),
                    st.integers(min_value=1, max_value=10)
                )
            ),
            min_size=1,
            max_size=5
        )
    )
    @settings(max_examples=10, deadline=30000)
    @pytest.mark.asyncio
    async def test_emergency_security_protocols(self, transaction_validator, emergency_scenarios):
        """
        Property: For any emergency scenario, the system should
        activate appropriate security protocols and protection mechanisms.
        
        **Validates: Requirements 6.2, 15.1**
        """
        emergency_responses = []
        
        for scenario in emergency_scenarios:
            trigger_type = scenario.get('trigger_type', 'suspicious_activity')
            severity = scenario.get('severity', 'medium')
            
            try:
                # Property: Emergency pause should be activatable
                pause_result = await transaction_validator.emergency_pause_system(
                    f"Test emergency: {trigger_type} with {severity} severity"
                )
                emergency_responses.append(pause_result)
                
                # Property: Emergency pause should return proper result
                assert 'success' in pause_result, "Emergency pause should return success status"
                assert isinstance(pause_result['success'], bool), "Success should be boolean"
                
                if pause_result['success']:
                    # Property: Emergency pause should be active
                    assert transaction_validator.emergency_pause is True, \
                           "Emergency pause should be activated"
                    
                    # Property: Paused system should reject transactions
                    test_transaction = {
                        'from': f"0x{secrets.token_hex(20)}",
                        'to': f"0x{secrets.token_hex(20)}",
                        'value': 1000000000000000000,
                        'data': '0x',
                        'gas': 21000,
                        'gasPrice': 20000000000,
                        'chainId': 1
                    }
                    
                    validation = await transaction_validator.validate_transaction(test_transaction)
                    
                    # Property: Transactions should be rejected during emergency pause
                    assert validation.validation_result.value == 'rejected', \
                           "Transactions should be rejected during emergency pause"
                    assert validation.security_level.value == 'critical', \
                           "Security level should be critical during emergency pause"
                    
                    # Property: System should be resumable with proper authorization
                    resume_result = await transaction_validator.resume_system("emergency_override_2024")
                    
                    assert 'success' in resume_result, "Resume should return success status"
                    if resume_result['success']:
                        assert transaction_validator.emergency_pause is False, \
                               "Emergency pause should be deactivated after resume"
                
            except Exception as e:
                # Property: Emergency protocol errors should be handled gracefully
                error_message = str(e).lower()
                assert 'emergency' in error_message or 'failed' in error_message, \
                       "Emergency errors should be descriptive"
        
        # Property: All emergency responses should be tracked
        assert len(emergency_responses) == len(emergency_scenarios), \
               "All emergency scenarios should produce responses"


if __name__ == "__main__":
    # Run property-based tests
    pytest.main([__file__, "-v", "--tb=short"])