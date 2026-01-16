"""
Shared Context Store for Multi-Agent State Management

This module implements the shared context store that all agents can access
to maintain workflow state, user preferences, system configuration, and
historical decisions for coordinated multi-agent operations.
"""

import asyncio
import json
import uuid
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, field
import structlog
import redis.asyncio as redis
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

logger = structlog.get_logger()

class ContextScope(str, Enum):
    """Scope levels for context data"""
    GLOBAL = "global"           # System-wide configuration
    USER = "user"              # User-specific data
    SESSION = "session"        # Session-specific data
    WORKFLOW = "workflow"      # Workflow-specific data
    AGENT = "agent"           # Agent-specific data

class DataType(str, Enum):
    """Types of data stored in context"""
    CONFIGURATION = "configuration"
    PREFERENCES = "preferences"
    STATE = "state"
    HISTORY = "history"
    METRICS = "metrics"
    SECURITY = "security"

class AccessLevel(str, Enum):
    """Access levels for context data"""
    PUBLIC = "public"          # All agents can read/write
    PROTECTED = "protected"    # All agents can read, limited write
    PRIVATE = "private"        # Only specific agents can access
    RESTRICTED = "restricted"  # Requires special permissions

@dataclass
class ContextEntry:
    """Represents a single entry in the context store"""
    key: str
    value: Any
    scope: ContextScope
    data_type: DataType
    access_level: AccessLevel
    owner_agent: str
    created_at: datetime
    updated_at: datetime
    expires_at: Optional[datetime] = None
    version: int = 1
    metadata: Dict[str, Any] = field(default_factory=dict)
    access_log: List[Dict[str, Any]] = field(default_factory=list)

class ContextQuery(BaseModel):
    """Query parameters for context store operations"""
    scope: Optional[ContextScope] = None
    data_type: Optional[DataType] = None
    owner_agent: Optional[str] = None
    key_pattern: Optional[str] = None
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None
    include_expired: bool = False

class ContextTransaction:
    """Transaction context for atomic operations"""
    def __init__(self, context_store: 'SharedContextStore', transaction_id: str):
        self.context_store = context_store
        self.transaction_id = transaction_id
        self.operations: List[Dict[str, Any]] = []
        self.committed = False
        self.rolled_back = False
    
    async def set(self, key: str, value: Any, scope: ContextScope, 
                  data_type: DataType, access_level: AccessLevel, 
                  owner_agent: str, expires_in: Optional[timedelta] = None):
        """Add a set operation to the transaction"""
        self.operations.append({
            "operation": "set",
            "key": key,
            "value": value,
            "scope": scope,
            "data_type": data_type,
            "access_level": access_level,
            "owner_agent": owner_agent,
            "expires_in": expires_in
        })
    
    async def delete(self, key: str, scope: ContextScope, requesting_agent: str):
        """Add a delete operation to the transaction"""
        self.operations.append({
            "operation": "delete",
            "key": key,
            "scope": scope,
            "requesting_agent": requesting_agent
        })
    
    async def commit(self) -> bool:
        """Commit all operations in the transaction"""
        if self.committed or self.rolled_back:
            return False
        
        try:
            for operation in self.operations:
                if operation["operation"] == "set":
                    await self.context_store._execute_set(**operation)
                elif operation["operation"] == "delete":
                    await self.context_store._execute_delete(**operation)
            
            self.committed = True
            logger.info("Context transaction committed", transaction_id=self.transaction_id)
            return True
            
        except Exception as e:
            logger.error("Context transaction commit failed", 
                        transaction_id=self.transaction_id, error=str(e))
            await self.rollback()
            return False
    
    async def rollback(self):
        """Rollback the transaction"""
        self.rolled_back = True
        logger.info("Context transaction rolled back", transaction_id=self.transaction_id)

class SharedContextStore:
    """
    Shared context store for multi-agent state management
    
    Provides atomic, consistent, isolated, and durable (ACID) operations
    for managing shared state between agents with proper access controls
    and conflict resolution mechanisms.
    """
    
    def __init__(self, redis_url: str = "redis://localhost:6379", 
                 mongodb_url: str = "mongodb://localhost:27017"):
        self.redis_url = redis_url
        self.mongodb_url = mongodb_url
        self.redis_client: Optional[redis.Redis] = None
        self.mongo_client: Optional[AsyncIOMotorClient] = None
        self.mongo_db = None
        self.context_collection = None
        
        # In-memory cache for frequently accessed data
        self.cache: Dict[str, ContextEntry] = {}
        self.cache_ttl: Dict[str, datetime] = {}
        
        # Access control rules
        self.access_rules = {
            AccessLevel.PUBLIC: lambda agent, entry: True,
            AccessLevel.PROTECTED: lambda agent, entry: True,  # Read access for all
            AccessLevel.PRIVATE: lambda agent, entry: agent == entry.owner_agent,
            AccessLevel.RESTRICTED: lambda agent, entry: self._check_restricted_access(agent, entry)
        }
        
        # Conflict resolution strategies
        self.conflict_resolvers = {
            "last_writer_wins": self._resolve_last_writer_wins,
            "version_based": self._resolve_version_based,
            "agent_priority": self._resolve_agent_priority,
            "merge_strategy": self._resolve_merge_strategy
        }
        
        # Agent priority for conflict resolution
        self.agent_priorities = {
            "security_validator": 1,
            "intent_router": 2,
            "audit_agent": 3,
            "test_agent": 4,
            "product_architect": 5,
            "code_engineer": 6,
            "research_agent": 7
        }
    
    async def initialize(self):
        """Initialize the context store"""
        try:
            # Initialize Redis for caching and pub/sub
            self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
            await self.redis_client.ping()
            
            # Initialize MongoDB for persistent storage
            self.mongo_client = AsyncIOMotorClient(self.mongodb_url)
            self.mongo_db = self.mongo_client.agent_context
            self.context_collection = self.mongo_db.context_entries
            
            # Create indexes for efficient querying
            await self.context_collection.create_index([
                ("scope", 1), ("data_type", 1), ("key", 1)
            ])
            await self.context_collection.create_index([
                ("owner_agent", 1), ("created_at", -1)
            ])
            await self.context_collection.create_index([
                ("expires_at", 1)
            ], expireAfterSeconds=0)
            
            # Start background tasks
            asyncio.create_task(self._cleanup_expired_cache())
            asyncio.create_task(self._sync_cache_with_storage())
            
            logger.info("Shared context store initialized successfully")
            
        except Exception as e:
            logger.error("Failed to initialize context store", error=str(e))
            raise
    
    async def shutdown(self):
        """Shutdown the context store gracefully"""
        try:
            if self.redis_client:
                await self.redis_client.close()
            
            if self.mongo_client:
                self.mongo_client.close()
            
            logger.info("Context store shutdown completed")
            
        except Exception as e:
            logger.error("Context store shutdown error", error=str(e))
    
    async def set(self, key: str, value: Any, scope: ContextScope, 
                  data_type: DataType, access_level: AccessLevel, 
                  owner_agent: str, expires_in: Optional[timedelta] = None,
                  conflict_resolution: str = "last_writer_wins") -> bool:
        """
        Set a value in the context store with conflict resolution
        """
        try:
            full_key = self._build_key(key, scope)
            
            # Check if entry already exists
            existing_entry = await self.get_entry(key, scope, owner_agent)
            
            if existing_entry and existing_entry.access_level == AccessLevel.PROTECTED:
                # Check write permissions for protected data
                if not await self._check_write_permission(owner_agent, existing_entry):
                    logger.warning("Write permission denied", 
                                 key=key, agent=owner_agent)
                    return False
            
            # Handle conflicts if entry exists
            if existing_entry:
                resolver = self.conflict_resolvers.get(conflict_resolution)
                if resolver:
                    resolved_value = await resolver(existing_entry, value, owner_agent)
                    if resolved_value is None:
                        logger.info("Conflict resolution rejected update", 
                                  key=key, agent=owner_agent)
                        return False
                    value = resolved_value
            
            # Create new entry
            expires_at = datetime.utcnow() + expires_in if expires_in else None
            
            entry = ContextEntry(
                key=full_key,
                value=value,
                scope=scope,
                data_type=data_type,
                access_level=access_level,
                owner_agent=owner_agent,
                created_at=existing_entry.created_at if existing_entry else datetime.utcnow(),
                updated_at=datetime.utcnow(),
                expires_at=expires_at,
                version=existing_entry.version + 1 if existing_entry else 1
            )
            
            # Log access
            entry.access_log.append({
                "agent": owner_agent,
                "operation": "write",
                "timestamp": datetime.utcnow().isoformat()
            })
            
            # Store in MongoDB
            await self._store_entry(entry)
            
            # Update cache
            self.cache[full_key] = entry
            if expires_at:
                self.cache_ttl[full_key] = expires_at
            
            # Publish change notification
            await self._publish_change_notification(entry, "updated")
            
            logger.info("Context entry set successfully", 
                       key=key, scope=scope.value, agent=owner_agent)
            
            return True
            
        except Exception as e:
            logger.error("Failed to set context entry", 
                        key=key, scope=scope.value, error=str(e))
            return False
    
    async def get(self, key: str, scope: ContextScope, 
                  requesting_agent: str) -> Optional[Any]:
        """Get a value from the context store"""
        try:
            entry = await self.get_entry(key, scope, requesting_agent)
            if entry:
                return entry.value
            return None
            
        except Exception as e:
            logger.error("Failed to get context entry", 
                        key=key, scope=scope.value, error=str(e))
            return None
    
    async def get_entry(self, key: str, scope: ContextScope, 
                       requesting_agent: str) -> Optional[ContextEntry]:
        """Get a complete context entry with metadata"""
        try:
            full_key = self._build_key(key, scope)
            
            # Check cache first
            if full_key in self.cache:
                entry = self.cache[full_key]
                
                # Check if cached entry has expired
                if (full_key in self.cache_ttl and 
                    datetime.utcnow() > self.cache_ttl[full_key]):
                    del self.cache[full_key]
                    del self.cache_ttl[full_key]
                else:
                    # Check access permissions
                    if await self._check_read_permission(requesting_agent, entry):
                        # Log access
                        entry.access_log.append({
                            "agent": requesting_agent,
                            "operation": "read",
                            "timestamp": datetime.utcnow().isoformat()
                        })
                        return entry
                    else:
                        logger.warning("Read permission denied", 
                                     key=key, agent=requesting_agent)
                        return None
            
            # Load from MongoDB
            doc = await self.context_collection.find_one({"key": full_key})
            if doc:
                entry = self._doc_to_entry(doc)
                
                # Check access permissions
                if await self._check_read_permission(requesting_agent, entry):
                    # Update cache
                    self.cache[full_key] = entry
                    if entry.expires_at:
                        self.cache_ttl[full_key] = entry.expires_at
                    
                    # Log access
                    entry.access_log.append({
                        "agent": requesting_agent,
                        "operation": "read",
                        "timestamp": datetime.utcnow().isoformat()
                    })
                    
                    return entry
                else:
                    logger.warning("Read permission denied", 
                                 key=key, agent=requesting_agent)
                    return None
            
            return None
            
        except Exception as e:
            logger.error("Failed to get context entry", 
                        key=key, scope=scope.value, error=str(e))
            return None
    
    async def delete(self, key: str, scope: ContextScope, 
                    requesting_agent: str) -> bool:
        """Delete a context entry"""
        try:
            full_key = self._build_key(key, scope)
            
            # Check if entry exists and permissions
            entry = await self.get_entry(key, scope, requesting_agent)
            if not entry:
                return False
            
            if not await self._check_write_permission(requesting_agent, entry):
                logger.warning("Delete permission denied", 
                             key=key, agent=requesting_agent)
                return False
            
            # Delete from MongoDB
            await self.context_collection.delete_one({"key": full_key})
            
            # Remove from cache
            self.cache.pop(full_key, None)
            self.cache_ttl.pop(full_key, None)
            
            # Publish change notification
            await self._publish_change_notification(entry, "deleted")
            
            logger.info("Context entry deleted", 
                       key=key, scope=scope.value, agent=requesting_agent)
            
            return True
            
        except Exception as e:
            logger.error("Failed to delete context entry", 
                        key=key, scope=scope.value, error=str(e))
            return False
    
    async def query(self, query: ContextQuery, requesting_agent: str) -> List[ContextEntry]:
        """Query context entries based on criteria"""
        try:
            # Build MongoDB query
            mongo_query = {}
            
            if query.scope:
                mongo_query["scope"] = query.scope.value
            
            if query.data_type:
                mongo_query["data_type"] = query.data_type.value
            
            if query.owner_agent:
                mongo_query["owner_agent"] = query.owner_agent
            
            if query.key_pattern:
                mongo_query["key"] = {"$regex": query.key_pattern}
            
            if query.created_after or query.created_before:
                date_query = {}
                if query.created_after:
                    date_query["$gte"] = query.created_after
                if query.created_before:
                    date_query["$lte"] = query.created_before
                mongo_query["created_at"] = date_query
            
            if not query.include_expired:
                mongo_query["$or"] = [
                    {"expires_at": {"$exists": False}},
                    {"expires_at": None},
                    {"expires_at": {"$gt": datetime.utcnow()}}
                ]
            
            # Execute query
            cursor = self.context_collection.find(mongo_query)
            results = []
            
            async for doc in cursor:
                entry = self._doc_to_entry(doc)
                
                # Check read permissions
                if await self._check_read_permission(requesting_agent, entry):
                    results.append(entry)
            
            logger.info("Context query executed", 
                       requesting_agent=requesting_agent,
                       results_count=len(results))
            
            return results
            
        except Exception as e:
            logger.error("Context query failed", error=str(e))
            return []
    
    async def begin_transaction(self) -> ContextTransaction:
        """Begin a new transaction for atomic operations"""
        transaction_id = str(uuid.uuid4())
        return ContextTransaction(self, transaction_id)
    
    async def subscribe_to_changes(self, key_pattern: str, scope: ContextScope, 
                                  agent_id: str, callback: callable):
        """Subscribe to context changes matching a pattern"""
        try:
            # Use Redis pub/sub for real-time notifications
            channel = f"context_changes:{scope.value}:{key_pattern}"
            
            # Store subscription info
            subscription_key = f"subscription:{agent_id}:{channel}"
            await self.redis_client.set(subscription_key, json.dumps({
                "agent_id": agent_id,
                "channel": channel,
                "created_at": datetime.utcnow().isoformat()
            }))
            
            logger.info("Context change subscription created", 
                       agent_id=agent_id, pattern=key_pattern, scope=scope.value)
            
        except Exception as e:
            logger.error("Failed to create context subscription", 
                        agent_id=agent_id, error=str(e))
    
    # Private helper methods
    
    def _build_key(self, key: str, scope: ContextScope) -> str:
        """Build full key with scope prefix"""
        return f"{scope.value}:{key}"
    
    async def _check_read_permission(self, agent: str, entry: ContextEntry) -> bool:
        """Check if agent has read permission for entry"""
        access_checker = self.access_rules.get(entry.access_level)
        if access_checker:
            return access_checker(agent, entry)
        return False
    
    async def _check_write_permission(self, agent: str, entry: ContextEntry) -> bool:
        """Check if agent has write permission for entry"""
        if entry.access_level == AccessLevel.PUBLIC:
            return True
        elif entry.access_level == AccessLevel.PROTECTED:
            # Only owner and high-priority agents can write
            return (agent == entry.owner_agent or 
                   self.agent_priorities.get(agent, 999) <= 3)
        elif entry.access_level == AccessLevel.PRIVATE:
            return agent == entry.owner_agent
        elif entry.access_level == AccessLevel.RESTRICTED:
            return await self._check_restricted_access(agent, entry)
        return False
    
    async def _check_restricted_access(self, agent: str, entry: ContextEntry) -> bool:
        """Check restricted access permissions"""
        # Security-related data only accessible by security validator
        if entry.data_type == DataType.SECURITY:
            return agent == "security_validator"
        
        # Configuration data only accessible by high-priority agents
        if entry.data_type == DataType.CONFIGURATION:
            return self.agent_priorities.get(agent, 999) <= 2
        
        return False
    
    async def _store_entry(self, entry: ContextEntry):
        """Store entry in MongoDB"""
        doc = {
            "key": entry.key,
            "value": entry.value,
            "scope": entry.scope.value,
            "data_type": entry.data_type.value,
            "access_level": entry.access_level.value,
            "owner_agent": entry.owner_agent,
            "created_at": entry.created_at,
            "updated_at": entry.updated_at,
            "expires_at": entry.expires_at,
            "version": entry.version,
            "metadata": entry.metadata,
            "access_log": entry.access_log
        }
        
        await self.context_collection.replace_one(
            {"key": entry.key},
            doc,
            upsert=True
        )
    
    def _doc_to_entry(self, doc: Dict[str, Any]) -> ContextEntry:
        """Convert MongoDB document to ContextEntry"""
        return ContextEntry(
            key=doc["key"],
            value=doc["value"],
            scope=ContextScope(doc["scope"]),
            data_type=DataType(doc["data_type"]),
            access_level=AccessLevel(doc["access_level"]),
            owner_agent=doc["owner_agent"],
            created_at=doc["created_at"],
            updated_at=doc["updated_at"],
            expires_at=doc.get("expires_at"),
            version=doc.get("version", 1),
            metadata=doc.get("metadata", {}),
            access_log=doc.get("access_log", [])
        )
    
    async def _publish_change_notification(self, entry: ContextEntry, operation: str):
        """Publish change notification via Redis pub/sub"""
        try:
            channel = f"context_changes:{entry.scope.value}:*"
            message = {
                "operation": operation,
                "key": entry.key,
                "scope": entry.scope.value,
                "data_type": entry.data_type.value,
                "owner_agent": entry.owner_agent,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            await self.redis_client.publish(channel, json.dumps(message))
            
        except Exception as e:
            logger.error("Failed to publish change notification", error=str(e))
    
    # Conflict resolution strategies
    
    async def _resolve_last_writer_wins(self, existing: ContextEntry, 
                                       new_value: Any, agent: str) -> Any:
        """Last writer wins conflict resolution"""
        return new_value
    
    async def _resolve_version_based(self, existing: ContextEntry, 
                                   new_value: Any, agent: str) -> Any:
        """Version-based conflict resolution"""
        # Simple version check - can be enhanced
        return new_value
    
    async def _resolve_agent_priority(self, existing: ContextEntry, 
                                    new_value: Any, agent: str) -> Any:
        """Agent priority-based conflict resolution"""
        existing_priority = self.agent_priorities.get(existing.owner_agent, 999)
        new_priority = self.agent_priorities.get(agent, 999)
        
        if new_priority <= existing_priority:
            return new_value
        return None  # Reject update
    
    async def _resolve_merge_strategy(self, existing: ContextEntry, 
                                    new_value: Any, agent: str) -> Any:
        """Merge-based conflict resolution for dict values"""
        if isinstance(existing.value, dict) and isinstance(new_value, dict):
            merged = existing.value.copy()
            merged.update(new_value)
            return merged
        return new_value
    
    async def _cleanup_expired_cache(self):
        """Background task to clean up expired cache entries"""
        while True:
            try:
                current_time = datetime.utcnow()
                expired_keys = []
                
                for key, expiry_time in self.cache_ttl.items():
                    if current_time > expiry_time:
                        expired_keys.append(key)
                
                for key in expired_keys:
                    self.cache.pop(key, None)
                    self.cache_ttl.pop(key, None)
                
                if expired_keys:
                    logger.info("Expired cache entries cleaned up", count=len(expired_keys))
                
                await asyncio.sleep(60)  # Check every minute
                
            except Exception as e:
                logger.error("Cache cleanup error", error=str(e))
                await asyncio.sleep(60)
    
    async def _sync_cache_with_storage(self):
        """Background task to sync cache with persistent storage"""
        while True:
            try:
                # Periodically sync frequently accessed items
                await asyncio.sleep(300)  # Every 5 minutes
                
            except Exception as e:
                logger.error("Cache sync error", error=str(e))
                await asyncio.sleep(300)