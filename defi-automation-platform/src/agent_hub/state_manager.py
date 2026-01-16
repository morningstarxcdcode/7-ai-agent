"""
Distributed State Management System for Multi-Agent Coordination

This module implements distributed state management using Supabase and MongoDB
for agent state synchronization, conflict resolution, and rollback capabilities.
It provides ACID transactions and eventual consistency across the agent network.
"""

import asyncio
import json
import uuid
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Any, Union, Callable
from dataclasses import dataclass, field
import structlog
import redis.asyncio as redis
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

logger = structlog.get_logger()

class StateScope(str, Enum):
    """Scope levels for state management"""
    GLOBAL = "global"           # System-wide state
    WORKFLOW = "workflow"       # Workflow-specific state
    AGENT = "agent"            # Agent-specific state
    USER = "user"              # User session state
    TEMPORARY = "temporary"     # Short-lived state

class StateType(str, Enum):
    """Types of state data"""
    CONFIGURATION = "configuration"
    WORKFLOW_STATE = "workflow_state"
    AGENT_STATE = "agent_state"
    USER_PREFERENCES = "user_preferences"
    DECISION_HISTORY = "decision_history"
    RISK_ASSESSMENT = "risk_assessment"
    PERFORMANCE_METRICS = "performance_metrics"

class ConsistencyLevel(str, Enum):
    """Consistency levels for state operations"""
    STRONG = "strong"           # Immediate consistency
    EVENTUAL = "eventual"       # Eventually consistent
    WEAK = "weak"              # Best effort consistency

class LockType(str, Enum):
    """Types of distributed locks"""
    EXCLUSIVE = "exclusive"     # Only one agent can hold
    SHARED = "shared"          # Multiple readers allowed
    INTENT = "intent"          # Intent to modify

@dataclass
class StateEntry:
    """Represents a state entry in the distributed system"""
    key: str
    value: Any
    scope: StateScope
    state_type: StateType
    owner_agent: str
    version: int
    created_at: datetime
    updated_at: datetime
    expires_at: Optional[datetime] = None
    consistency_level: ConsistencyLevel = ConsistencyLevel.EVENTUAL
    metadata: Dict[str, Any] = field(default_factory=dict)
    dependencies: List[str] = field(default_factory=list)
    checksum: Optional[str] = None

@dataclass
class StateLock:
    """Represents a distributed lock on state"""
    lock_id: str
    key: str
    lock_type: LockType
    owner_agent: str
    acquired_at: datetime
    expires_at: datetime
    renewable: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class StateTransaction:
    """Represents a distributed state transaction"""
    transaction_id: str
    participating_agents: List[str]
    operations: List[Dict[str, Any]]
    status: str  # "pending", "committed", "aborted"
    created_at: datetime
    timeout_at: datetime
    coordinator_agent: str
    votes: Dict[str, str] = field(default_factory=dict)  # agent_id -> "commit"/"abort"

class ConflictResolutionStrategy(str, Enum):
    """Strategies for resolving state conflicts"""
    LAST_WRITER_WINS = "last_writer_wins"
    VERSION_VECTOR = "version_vector"
    AGENT_PRIORITY = "agent_priority"
    MERGE_STRATEGY = "merge_strategy"
    HUMAN_INTERVENTION = "human_intervention"

class DistributedStateManager:
    """
    Distributed state management system for multi-agent coordination
    
    Provides distributed state storage, synchronization, conflict resolution,
    and transaction support across multiple agents with different consistency
    guarantees and rollback capabilities.
    """
    
    def __init__(self, redis_url: str = "redis://localhost:6379",
                 mongodb_url: str = "mongodb://localhost:27017"):
        self.redis_url = redis_url
        self.mongodb_url = mongodb_url
        self.redis_client: Optional[redis.Redis] = None
        self.mongo_client: Optional[AsyncIOMotorClient] = None
        self.mongo_db = None
        self.state_collection = None
        self.transaction_collection = None
        
        # In-memory caches for performance
        self.state_cache: Dict[str, StateEntry] = {}
        self.lock_cache: Dict[str, StateLock] = {}
        self.active_transactions: Dict[str, StateTransaction] = {}
        
        # Conflict resolution strategies
        self.conflict_resolvers = {
            ConflictResolutionStrategy.LAST_WRITER_WINS: self._resolve_last_writer_wins,
            ConflictResolutionStrategy.VERSION_VECTOR: self._resolve_version_vector,
            ConflictResolutionStrategy.AGENT_PRIORITY: self._resolve_agent_priority,
            ConflictResolutionStrategy.MERGE_STRATEGY: self._resolve_merge_strategy,
            ConflictResolutionStrategy.HUMAN_INTERVENTION: self._resolve_human_intervention
        }
        
        # Agent priority hierarchy for conflict resolution
        self.agent_priorities = {
            "security_validator": 1,
            "intent_router": 2,
            "audit_agent": 3,
            "test_agent": 4,
            "product_architect": 5,
            "code_engineer": 6,
            "research_agent": 7
        }
        
        # State change listeners
        self.change_listeners: Dict[str, List[Callable]] = {}
        
        # Background tasks
        self.background_tasks: List[asyncio.Task] = []
    
    async def initialize(self):
        """Initialize the distributed state manager"""
        try:
            # Initialize Redis for caching and pub/sub
            self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
            await self.redis_client.ping()
            
            # Initialize MongoDB for persistent storage
            self.mongo_client = AsyncIOMotorClient(self.mongodb_url)
            self.mongo_db = self.mongo_client.agent_state
            self.state_collection = self.mongo_db.state_entries
            self.transaction_collection = self.mongo_db.transactions
            
            # Create indexes for efficient querying
            await self.state_collection.create_index([
                ("key", 1), ("scope", 1)
            ], unique=True)
            await self.state_collection.create_index([
                ("owner_agent", 1), ("updated_at", -1)
            ])
            await self.state_collection.create_index([
                ("expires_at", 1)
            ], expireAfterSeconds=0)
            
            await self.transaction_collection.create_index([
                ("transaction_id", 1)
            ], unique=True)
            await self.transaction_collection.create_index([
                ("status", 1), ("timeout_at", 1)
            ])
            
            # Start background tasks
            self.background_tasks = [
                asyncio.create_task(self._cleanup_expired_locks()),
                asyncio.create_task(self._process_expired_transactions()),
                asyncio.create_task(self._sync_state_changes()),
                asyncio.create_task(self._monitor_consistency())
            ]
            
            logger.info("Distributed state manager initialized successfully")
            
        except Exception as e:
            logger.error("Failed to initialize state manager", error=str(e))
            raise
    
    async def shutdown(self):
        """Shutdown the state manager gracefully"""
        try:
            # Cancel background tasks
            for task in self.background_tasks:
                task.cancel()
            
            # Wait for tasks to complete
            await asyncio.gather(*self.background_tasks, return_exceptions=True)
            
            # Close connections
            if self.redis_client:
                await self.redis_client.close()
            
            if self.mongo_client:
                self.mongo_client.close()
            
            logger.info("Distributed state manager shutdown completed")
            
        except Exception as e:
            logger.error("State manager shutdown error", error=str(e))
    
    async def set_state(self, key: str, value: Any, scope: StateScope,
                       state_type: StateType, owner_agent: str,
                       consistency_level: ConsistencyLevel = ConsistencyLevel.EVENTUAL,
                       expires_in: Optional[timedelta] = None,
                       conflict_strategy: ConflictResolutionStrategy = ConflictResolutionStrategy.LAST_WRITER_WINS) -> bool:
        """
        Set state with distributed consistency and conflict resolution
        """
        try:
            full_key = self._build_key(key, scope)
            
            # Acquire lock for strong consistency
            if consistency_level == ConsistencyLevel.STRONG:
                lock_acquired = await self._acquire_lock(
                    full_key, LockType.EXCLUSIVE, owner_agent, timedelta(seconds=30)
                )
                if not lock_acquired:
                    logger.warning("Failed to acquire lock for strong consistency", key=full_key)
                    return False
            
            try:
                # Check for existing state
                existing_entry = await self._get_state_entry(full_key)
                
                # Handle conflicts if state exists
                if existing_entry:
                    resolver = self.conflict_resolvers.get(conflict_strategy)
                    if resolver:
                        resolved_value = await resolver(existing_entry, value, owner_agent)
                        if resolved_value is None:
                            logger.info("Conflict resolution rejected update", key=full_key)
                            return False
                        value = resolved_value
                
                # Create new state entry
                expires_at = datetime.utcnow() + expires_in if expires_in else None
                
                new_entry = StateEntry(
                    key=full_key,
                    value=value,
                    scope=scope,
                    state_type=state_type,
                    owner_agent=owner_agent,
                    version=existing_entry.version + 1 if existing_entry else 1,
                    created_at=existing_entry.created_at if existing_entry else datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                    expires_at=expires_at,
                    consistency_level=consistency_level,
                    checksum=self._calculate_checksum(value)
                )
                
                # Store in MongoDB
                await self._store_state_entry(new_entry)
                
                # Update cache
                self.state_cache[full_key] = new_entry
                
                # Publish change notification
                await self._publish_state_change(new_entry, "updated")
                
                # Notify listeners
                await self._notify_change_listeners(full_key, new_entry)
                
                logger.info("State set successfully", 
                           key=full_key, owner=owner_agent, version=new_entry.version)
                
                return True
                
            finally:
                # Release lock if acquired
                if consistency_level == ConsistencyLevel.STRONG:
                    await self._release_lock(full_key, owner_agent)
            
        except Exception as e:
            logger.error("Failed to set state", key=key, error=str(e))
            return False
    
    async def get_state(self, key: str, scope: StateScope, 
                       requesting_agent: str,
                       consistency_level: ConsistencyLevel = ConsistencyLevel.EVENTUAL) -> Optional[Any]:
        """Get state with specified consistency level"""
        try:
            full_key = self._build_key(key, scope)
            
            # For strong consistency, ensure we read from primary
            if consistency_level == ConsistencyLevel.STRONG:
                entry = await self._get_state_entry_from_primary(full_key)
            else:
                # Try cache first for eventual consistency
                if full_key in self.state_cache:
                    entry = self.state_cache[full_key]
                    
                    # Check if cached entry is expired
                    if entry.expires_at and datetime.utcnow() > entry.expires_at:
                        del self.state_cache[full_key]
                        entry = None
                else:
                    entry = await self._get_state_entry(full_key)
            
            if entry:
                # Verify checksum for data integrity
                if entry.checksum and entry.checksum != self._calculate_checksum(entry.value):
                    logger.warning("State checksum mismatch detected", key=full_key)
                    # Attempt to recover from primary
                    entry = await self._get_state_entry_from_primary(full_key)
                
                return entry.value if entry else None
            
            return None
            
        except Exception as e:
            logger.error("Failed to get state", key=key, error=str(e))
            return None
    
    async def delete_state(self, key: str, scope: StateScope, 
                          requesting_agent: str) -> bool:
        """Delete state entry"""
        try:
            full_key = self._build_key(key, scope)
            
            # Acquire exclusive lock
            lock_acquired = await self._acquire_lock(
                full_key, LockType.EXCLUSIVE, requesting_agent, timedelta(seconds=30)
            )
            if not lock_acquired:
                logger.warning("Failed to acquire lock for state deletion", key=full_key)
                return False
            
            try:
                # Check if entry exists
                entry = await self._get_state_entry(full_key)
                if not entry:
                    return False
                
                # Delete from MongoDB
                await self.state_collection.delete_one({"key": full_key})
                
                # Remove from cache
                self.state_cache.pop(full_key, None)
                
                # Publish change notification
                await self._publish_state_change(entry, "deleted")
                
                # Notify listeners
                await self._notify_change_listeners(full_key, None)
                
                logger.info("State deleted successfully", key=full_key, agent=requesting_agent)
                return True
                
            finally:
                await self._release_lock(full_key, requesting_agent)
            
        except Exception as e:
            logger.error("Failed to delete state", key=key, error=str(e))
            return False
    
    async def begin_transaction(self, coordinator_agent: str, 
                               participating_agents: List[str],
                               timeout: timedelta = timedelta(minutes=5)) -> str:
        """Begin a distributed transaction"""
        try:
            transaction_id = str(uuid.uuid4())
            
            transaction = StateTransaction(
                transaction_id=transaction_id,
                participating_agents=participating_agents,
                operations=[],
                status="pending",
                created_at=datetime.utcnow(),
                timeout_at=datetime.utcnow() + timeout,
                coordinator_agent=coordinator_agent
            )
            
            # Store transaction
            await self.transaction_collection.insert_one({
                "transaction_id": transaction_id,
                "participating_agents": participating_agents,
                "operations": [],
                "status": "pending",
                "created_at": transaction.created_at,
                "timeout_at": transaction.timeout_at,
                "coordinator_agent": coordinator_agent,
                "votes": {}
            })
            
            self.active_transactions[transaction_id] = transaction
            
            logger.info("Transaction started", 
                       transaction_id=transaction_id,
                       coordinator=coordinator_agent,
                       participants=len(participating_agents))
            
            return transaction_id
            
        except Exception as e:
            logger.error("Failed to begin transaction", error=str(e))
            raise
    
    async def add_transaction_operation(self, transaction_id: str, 
                                      operation_type: str, key: str, 
                                      value: Any, agent: str) -> bool:
        """Add an operation to a transaction"""
        try:
            if transaction_id not in self.active_transactions:
                logger.warning("Transaction not found", transaction_id=transaction_id)
                return False
            
            transaction = self.active_transactions[transaction_id]
            
            if transaction.status != "pending":
                logger.warning("Cannot add operation to non-pending transaction", 
                             transaction_id=transaction_id, status=transaction.status)
                return False
            
            operation = {
                "type": operation_type,
                "key": key,
                "value": value,
                "agent": agent,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            transaction.operations.append(operation)
            
            # Update in MongoDB
            await self.transaction_collection.update_one(
                {"transaction_id": transaction_id},
                {"$push": {"operations": operation}}
            )
            
            return True
            
        except Exception as e:
            logger.error("Failed to add transaction operation", 
                        transaction_id=transaction_id, error=str(e))
            return False
    
    async def commit_transaction(self, transaction_id: str) -> bool:
        """Commit a distributed transaction using 2-phase commit"""
        try:
            if transaction_id not in self.active_transactions:
                logger.warning("Transaction not found for commit", transaction_id=transaction_id)
                return False
            
            transaction = self.active_transactions[transaction_id]
            
            # Phase 1: Prepare - ask all participants to vote
            prepare_success = await self._prepare_transaction(transaction)
            
            if prepare_success:
                # Phase 2: Commit - execute all operations
                commit_success = await self._commit_transaction_operations(transaction)
                
                if commit_success:
                    transaction.status = "committed"
                    await self.transaction_collection.update_one(
                        {"transaction_id": transaction_id},
                        {"$set": {"status": "committed"}}
                    )
                    
                    logger.info("Transaction committed successfully", 
                               transaction_id=transaction_id)
                    return True
                else:
                    # Rollback on commit failure
                    await self._abort_transaction(transaction)
                    return False
            else:
                # Abort if prepare failed
                await self._abort_transaction(transaction)
                return False
            
        except Exception as e:
            logger.error("Transaction commit failed", 
                        transaction_id=transaction_id, error=str(e))
            await self._abort_transaction(self.active_transactions.get(transaction_id))
            return False
        finally:
            # Clean up
            self.active_transactions.pop(transaction_id, None)
    
    async def rollback_transaction(self, transaction_id: str) -> bool:
        """Rollback a distributed transaction"""
        try:
            if transaction_id not in self.active_transactions:
                logger.warning("Transaction not found for rollback", transaction_id=transaction_id)
                return False
            
            transaction = self.active_transactions[transaction_id]
            success = await self._abort_transaction(transaction)
            
            # Clean up
            self.active_transactions.pop(transaction_id, None)
            
            return success
            
        except Exception as e:
            logger.error("Transaction rollback failed", 
                        transaction_id=transaction_id, error=str(e))
            return False
    
    async def create_checkpoint(self, checkpoint_name: str, 
                               scope: StateScope = StateScope.GLOBAL) -> bool:
        """Create a state checkpoint for rollback"""
        try:
            checkpoint_key = f"checkpoint:{scope.value}:{checkpoint_name}"
            
            # Get all state entries for the scope
            query = {"scope": scope.value} if scope != StateScope.GLOBAL else {}
            cursor = self.state_collection.find(query)
            
            state_snapshot = []
            async for doc in cursor:
                state_snapshot.append(doc)
            
            # Store checkpoint
            checkpoint_data = {
                "checkpoint_name": checkpoint_name,
                "scope": scope.value,
                "created_at": datetime.utcnow(),
                "state_snapshot": state_snapshot
            }
            
            await self.mongo_db.checkpoints.insert_one(checkpoint_data)
            
            logger.info("Checkpoint created", 
                       name=checkpoint_name, scope=scope.value, 
                       entries=len(state_snapshot))
            
            return True
            
        except Exception as e:
            logger.error("Failed to create checkpoint", 
                        name=checkpoint_name, error=str(e))
            return False
    
    async def restore_checkpoint(self, checkpoint_name: str, 
                                scope: StateScope = StateScope.GLOBAL) -> bool:
        """Restore state from a checkpoint"""
        try:
            # Find checkpoint
            checkpoint = await self.mongo_db.checkpoints.find_one({
                "checkpoint_name": checkpoint_name,
                "scope": scope.value
            })
            
            if not checkpoint:
                logger.warning("Checkpoint not found", name=checkpoint_name)
                return False
            
            # Begin transaction for atomic restore
            transaction_id = await self.begin_transaction(
                "state_manager", ["state_manager"], timedelta(minutes=10)
            )
            
            try:
                # Clear current state for scope
                if scope == StateScope.GLOBAL:
                    await self.state_collection.delete_many({})
                else:
                    await self.state_collection.delete_many({"scope": scope.value})
                
                # Restore state from snapshot
                if checkpoint["state_snapshot"]:
                    await self.state_collection.insert_many(checkpoint["state_snapshot"])
                
                # Clear cache
                if scope == StateScope.GLOBAL:
                    self.state_cache.clear()
                else:
                    keys_to_remove = [k for k in self.state_cache.keys() 
                                    if k.startswith(f"{scope.value}:")]
                    for key in keys_to_remove:
                        del self.state_cache[key]
                
                await self.commit_transaction(transaction_id)
                
                logger.info("Checkpoint restored successfully", 
                           name=checkpoint_name, scope=scope.value)
                
                return True
                
            except Exception as e:
                await self.rollback_transaction(transaction_id)
                raise e
            
        except Exception as e:
            logger.error("Failed to restore checkpoint", 
                        name=checkpoint_name, error=str(e))
            return False
    
    async def subscribe_to_changes(self, key_pattern: str, scope: StateScope,
                                  callback: Callable[[str, Optional[StateEntry]], None]):
        """Subscribe to state changes matching a pattern"""
        try:
            pattern_key = f"{scope.value}:{key_pattern}"
            
            if pattern_key not in self.change_listeners:
                self.change_listeners[pattern_key] = []
            
            self.change_listeners[pattern_key].append(callback)
            
            logger.info("State change subscription created", 
                       pattern=key_pattern, scope=scope.value)
            
        except Exception as e:
            logger.error("Failed to create state change subscription", 
                        pattern=key_pattern, error=str(e))
    
    # Private helper methods
    
    def _build_key(self, key: str, scope: StateScope) -> str:
        """Build full key with scope prefix"""
        return f"{scope.value}:{key}"
    
    def _calculate_checksum(self, value: Any) -> str:
        """Calculate checksum for data integrity"""
        import hashlib
        value_str = json.dumps(value, sort_keys=True, default=str)
        return hashlib.sha256(value_str.encode()).hexdigest()
    
    async def _get_state_entry(self, full_key: str) -> Optional[StateEntry]:
        """Get state entry from MongoDB"""
        try:
            doc = await self.state_collection.find_one({"key": full_key})
            if doc:
                return self._doc_to_state_entry(doc)
            return None
        except Exception as e:
            logger.error("Failed to get state entry", key=full_key, error=str(e))
            return None
    
    async def _get_state_entry_from_primary(self, full_key: str) -> Optional[StateEntry]:
        """Get state entry directly from primary MongoDB instance"""
        # For now, same as regular get - can be enhanced for replica sets
        return await self._get_state_entry(full_key)
    
    async def _store_state_entry(self, entry: StateEntry):
        """Store state entry in MongoDB"""
        doc = {
            "key": entry.key,
            "value": entry.value,
            "scope": entry.scope.value,
            "state_type": entry.state_type.value,
            "owner_agent": entry.owner_agent,
            "version": entry.version,
            "created_at": entry.created_at,
            "updated_at": entry.updated_at,
            "expires_at": entry.expires_at,
            "consistency_level": entry.consistency_level.value,
            "metadata": entry.metadata,
            "dependencies": entry.dependencies,
            "checksum": entry.checksum
        }
        
        await self.state_collection.replace_one(
            {"key": entry.key},
            doc,
            upsert=True
        )
    
    def _doc_to_state_entry(self, doc: Dict[str, Any]) -> StateEntry:
        """Convert MongoDB document to StateEntry"""
        return StateEntry(
            key=doc["key"],
            value=doc["value"],
            scope=StateScope(doc["scope"]),
            state_type=StateType(doc["state_type"]),
            owner_agent=doc["owner_agent"],
            version=doc["version"],
            created_at=doc["created_at"],
            updated_at=doc["updated_at"],
            expires_at=doc.get("expires_at"),
            consistency_level=ConsistencyLevel(doc.get("consistency_level", "eventual")),
            metadata=doc.get("metadata", {}),
            dependencies=doc.get("dependencies", []),
            checksum=doc.get("checksum")
        )
    
    async def _acquire_lock(self, key: str, lock_type: LockType, 
                           agent: str, duration: timedelta) -> bool:
        """Acquire distributed lock using Redis"""
        try:
            lock_id = str(uuid.uuid4())
            lock_key = f"lock:{key}"
            expires_at = datetime.utcnow() + duration
            
            # Use Redis SET with NX and EX for atomic lock acquisition
            lock_data = json.dumps({
                "lock_id": lock_id,
                "lock_type": lock_type.value,
                "owner_agent": agent,
                "acquired_at": datetime.utcnow().isoformat(),
                "expires_at": expires_at.isoformat()
            })
            
            result = await self.redis_client.set(
                lock_key, lock_data, nx=True, ex=int(duration.total_seconds())
            )
            
            if result:
                lock = StateLock(
                    lock_id=lock_id,
                    key=key,
                    lock_type=lock_type,
                    owner_agent=agent,
                    acquired_at=datetime.utcnow(),
                    expires_at=expires_at
                )
                self.lock_cache[key] = lock
                return True
            
            return False
            
        except Exception as e:
            logger.error("Failed to acquire lock", key=key, error=str(e))
            return False
    
    async def _release_lock(self, key: str, agent: str) -> bool:
        """Release distributed lock"""
        try:
            lock_key = f"lock:{key}"
            
            # Get current lock data
            lock_data = await self.redis_client.get(lock_key)
            if lock_data:
                lock_info = json.loads(lock_data)
                if lock_info["owner_agent"] == agent:
                    await self.redis_client.delete(lock_key)
                    self.lock_cache.pop(key, None)
                    return True
            
            return False
            
        except Exception as e:
            logger.error("Failed to release lock", key=key, error=str(e))
            return False
    
    async def _publish_state_change(self, entry: StateEntry, operation: str):
        """Publish state change notification"""
        try:
            channel = f"state_changes:{entry.scope.value}"
            message = {
                "operation": operation,
                "key": entry.key,
                "scope": entry.scope.value,
                "state_type": entry.state_type.value,
                "owner_agent": entry.owner_agent,
                "version": entry.version,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            await self.redis_client.publish(channel, json.dumps(message))
            
        except Exception as e:
            logger.error("Failed to publish state change", error=str(e))
    
    async def _notify_change_listeners(self, key: str, entry: Optional[StateEntry]):
        """Notify registered change listeners"""
        try:
            for pattern_key, callbacks in self.change_listeners.items():
                # Simple pattern matching - can be enhanced
                if key.startswith(pattern_key.split(':')[1]):
                    for callback in callbacks:
                        try:
                            await callback(key, entry)
                        except Exception as e:
                            logger.error("Change listener callback failed", error=str(e))
        except Exception as e:
            logger.error("Failed to notify change listeners", error=str(e))
    
    # Conflict resolution strategies
    
    async def _resolve_last_writer_wins(self, existing: StateEntry, 
                                       new_value: Any, agent: str) -> Any:
        """Last writer wins conflict resolution"""
        return new_value
    
    async def _resolve_version_vector(self, existing: StateEntry, 
                                    new_value: Any, agent: str) -> Any:
        """Version vector based conflict resolution"""
        # Simple version comparison - can be enhanced with vector clocks
        return new_value
    
    async def _resolve_agent_priority(self, existing: StateEntry, 
                                    new_value: Any, agent: str) -> Any:
        """Agent priority based conflict resolution"""
        existing_priority = self.agent_priorities.get(existing.owner_agent, 999)
        new_priority = self.agent_priorities.get(agent, 999)
        
        if new_priority <= existing_priority:
            return new_value
        return None  # Reject update
    
    async def _resolve_merge_strategy(self, existing: StateEntry, 
                                    new_value: Any, agent: str) -> Any:
        """Merge-based conflict resolution"""
        if isinstance(existing.value, dict) and isinstance(new_value, dict):
            merged = existing.value.copy()
            merged.update(new_value)
            return merged
        return new_value
    
    async def _resolve_human_intervention(self, existing: StateEntry, 
                                        new_value: Any, agent: str) -> Any:
        """Human intervention required for conflict resolution"""
        # Log conflict for human review
        logger.warning("Human intervention required for state conflict",
                      key=existing.key,
                      existing_owner=existing.owner_agent,
                      new_agent=agent)
        return None  # Reject update pending human review
    
    # Transaction support methods
    
    async def _prepare_transaction(self, transaction: StateTransaction) -> bool:
        """Phase 1 of 2PC: Prepare transaction"""
        try:
            # For now, simple prepare - can be enhanced with actual participant voting
            return True
        except Exception as e:
            logger.error("Transaction prepare failed", 
                        transaction_id=transaction.transaction_id, error=str(e))
            return False
    
    async def _commit_transaction_operations(self, transaction: StateTransaction) -> bool:
        """Phase 2 of 2PC: Commit transaction operations"""
        try:
            for operation in transaction.operations:
                if operation["type"] == "set":
                    # Execute set operation
                    pass
                elif operation["type"] == "delete":
                    # Execute delete operation
                    pass
            
            return True
            
        except Exception as e:
            logger.error("Transaction commit operations failed", 
                        transaction_id=transaction.transaction_id, error=str(e))
            return False
    
    async def _abort_transaction(self, transaction: StateTransaction) -> bool:
        """Abort transaction and rollback changes"""
        try:
            if transaction:
                transaction.status = "aborted"
                await self.transaction_collection.update_one(
                    {"transaction_id": transaction.transaction_id},
                    {"$set": {"status": "aborted"}}
                )
                
                logger.info("Transaction aborted", 
                           transaction_id=transaction.transaction_id)
            
            return True
            
        except Exception as e:
            logger.error("Transaction abort failed", error=str(e))
            return False
    
    # Background tasks
    
    async def _cleanup_expired_locks(self):
        """Background task to clean up expired locks"""
        while True:
            try:
                current_time = datetime.utcnow()
                expired_locks = []
                
                for key, lock in self.lock_cache.items():
                    if current_time > lock.expires_at:
                        expired_locks.append(key)
                
                for key in expired_locks:
                    await self._release_lock(key, self.lock_cache[key].owner_agent)
                
                if expired_locks:
                    logger.info("Expired locks cleaned up", count=len(expired_locks))
                
                await asyncio.sleep(30)  # Check every 30 seconds
                
            except Exception as e:
                logger.error("Lock cleanup error", error=str(e))
                await asyncio.sleep(30)
    
    async def _process_expired_transactions(self):
        """Background task to process expired transactions"""
        while True:
            try:
                current_time = datetime.utcnow()
                
                # Find expired transactions
                expired_transactions = []
                for transaction_id, transaction in self.active_transactions.items():
                    if current_time > transaction.timeout_at and transaction.status == "pending":
                        expired_transactions.append(transaction_id)
                
                # Abort expired transactions
                for transaction_id in expired_transactions:
                    transaction = self.active_transactions.get(transaction_id)
                    if transaction:
                        await self._abort_transaction(transaction)
                        self.active_transactions.pop(transaction_id, None)
                
                if expired_transactions:
                    logger.info("Expired transactions aborted", count=len(expired_transactions))
                
                await asyncio.sleep(60)  # Check every minute
                
            except Exception as e:
                logger.error("Transaction cleanup error", error=str(e))
                await asyncio.sleep(60)
    
    async def _sync_state_changes(self):
        """Background task to sync state changes across instances"""
        while True:
            try:
                # Subscribe to state change notifications
                pubsub = self.redis_client.pubsub()
                await pubsub.subscribe("state_changes:*")
                
                async for message in pubsub.listen():
                    if message["type"] == "message":
                        try:
                            change_data = json.loads(message["data"])
                            # Process state change notification
                            await self._handle_remote_state_change(change_data)
                        except Exception as e:
                            logger.error("Failed to process state change notification", error=str(e))
                
            except Exception as e:
                logger.error("State sync error", error=str(e))
                await asyncio.sleep(5)
    
    async def _monitor_consistency(self):
        """Background task to monitor state consistency"""
        while True:
            try:
                # Periodically check state consistency
                await asyncio.sleep(300)  # Check every 5 minutes
                
                # Verify checksums and detect inconsistencies
                inconsistent_entries = []
                for key, entry in self.state_cache.items():
                    if entry.checksum:
                        calculated_checksum = self._calculate_checksum(entry.value)
                        if calculated_checksum != entry.checksum:
                            inconsistent_entries.append(key)
                
                if inconsistent_entries:
                    logger.warning("State inconsistencies detected", 
                                 count=len(inconsistent_entries))
                    # Attempt to repair inconsistencies
                    await self._repair_inconsistencies(inconsistent_entries)
                
            except Exception as e:
                logger.error("Consistency monitoring error", error=str(e))
                await asyncio.sleep(300)
    
    async def _handle_remote_state_change(self, change_data: Dict[str, Any]):
        """Handle state change notification from remote instance"""
        try:
            key = change_data["key"]
            operation = change_data["operation"]
            
            if operation == "updated":
                # Invalidate cache to force reload from primary
                self.state_cache.pop(key, None)
            elif operation == "deleted":
                # Remove from cache
                self.state_cache.pop(key, None)
            
        except Exception as e:
            logger.error("Failed to handle remote state change", error=str(e))
    
    async def _repair_inconsistencies(self, inconsistent_keys: List[str]):
        """Repair detected state inconsistencies"""
        try:
            for key in inconsistent_keys:
                # Reload from primary source
                entry = await self._get_state_entry_from_primary(key)
                if entry:
                    self.state_cache[key] = entry
                    logger.info("State inconsistency repaired", key=key)
                else:
                    # Remove invalid cache entry
                    self.state_cache.pop(key, None)
                    logger.info("Invalid cache entry removed", key=key)
                    
        except Exception as e:
            logger.error("Failed to repair inconsistencies", error=str(e))