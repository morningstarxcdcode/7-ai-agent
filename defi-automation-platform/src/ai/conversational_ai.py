"""
Conversational AI System using Google Gemini API

This module implements natural language understanding for financial requests,
intent recognition and entity extraction for DeFi operations, and response
generation with simple, non-technical explanations.
"""

import asyncio
import json
import re
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union, Tuple
from dataclasses import dataclass, field
from enum import Enum
import os
import structlog
import google.generativeai as genai
from pydantic import BaseModel, Field, validator

from .tracing import setup_tracing

logger = structlog.get_logger()

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

class IntentCategory(str, Enum):
    """Categories of user intents"""
    DEFI_OPERATION = "defi_operation"
    PORTFOLIO_MANAGEMENT = "portfolio_management"
    MARKET_ANALYSIS = "market_analysis"
    SECURITY_INQUIRY = "security_inquiry"
    LEARNING_REQUEST = "learning_request"
    WALLET_OPERATION = "wallet_operation"
    PRODUCTIVITY_TASK = "productivity_task"
    GENERAL_INQUIRY = "general_inquiry"
    EMERGENCY_HELP = "emergency_help"

class EntityType(str, Enum):
    """Types of entities that can be extracted"""
    TOKEN_SYMBOL = "token_symbol"
    AMOUNT = "amount"
    PROTOCOL_NAME = "protocol_name"
    WALLET_ADDRESS = "wallet_address"
    PERCENTAGE = "percentage"
    TIME_PERIOD = "time_period"
    RISK_LEVEL = "risk_level"
    STRATEGY_TYPE = "strategy_type"

class ConfidenceLevel(str, Enum):
    """Confidence levels for AI predictions"""
    HIGH = "high"      # > 0.8
    MEDIUM = "medium"  # 0.5 - 0.8
    LOW = "low"        # < 0.5

@dataclass
class ExtractedEntity:
    """Represents an extracted entity from user input"""
    entity_type: EntityType
    value: str
    confidence: float
    start_position: int
    end_position: int
    normalized_value: Optional[Any] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class IntentAnalysis:
    """Results of intent analysis"""
    primary_intent: IntentCategory
    confidence: float
    secondary_intents: List[Tuple[IntentCategory, float]] = field(default_factory=list)
    entities: List[ExtractedEntity] = field(default_factory=list)
    context: Dict[str, Any] = field(default_factory=dict)
    requires_clarification: bool = False
    clarification_questions: List[str] = field(default_factory=list)

class ConversationRequest(BaseModel):
    """Request model for conversation processing"""
    user_id: str
    message: str
    conversation_id: Optional[str] = None
    context: Dict[str, Any] = Field(default_factory=dict)
    user_preferences: Dict[str, Any] = Field(default_factory=dict)

class ConversationResponse(BaseModel):
    """Response model for conversation processing"""
    response_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conversation_id: str
    message: str
    intent_analysis: Dict[str, Any]
    suggested_actions: List[Dict[str, Any]] = Field(default_factory=list)
    requires_approval: bool = False
    risk_warnings: List[str] = Field(default_factory=list)
    educational_content: Optional[str] = None
    follow_up_questions: List[str] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ConversationalAI:
    """
    Conversational AI system for DeFi automation
    
    Provides natural language understanding, intent recognition,
    entity extraction, and response generation for financial
    operations with educational content and risk awareness.
    """
    
    def __init__(self):
        setup_tracing(service_name="defi-automation-platform.ai")
        self.model = genai.GenerativeModel('gemini-pro')
        self.conversation_history: Dict[str, List[Dict[str, Any]]] = {}
        
        # Intent classification patterns
        self.intent_patterns = {
            IntentCategory.DEFI_OPERATION: [
                r'\b(swap|trade|exchange|buy|sell)\b',
                r'\b(lend|borrow|stake|farm|yield)\b',
                r'\b(liquidity|pool|provide)\b',
                r'\b(defi|decentralized finance)\b'
            ],
            IntentCategory.PORTFOLIO_MANAGEMENT: [
                r'\b(portfolio|balance|holdings)\b',
                r'\b(rebalance|allocate|diversify)\b',
                r'\b(profit|loss|performance)\b',
                r'\b(investment|invest)\b'
            ],
            IntentCategory.MARKET_ANALYSIS: [
                r'\b(market|price|trend|analysis)\b',
                r'\b(predict|forecast|outlook)\b',
                r'\b(bull|bear|bullish|bearish)\b',
                r'\b(chart|technical|fundamental)\b'
            ],
            IntentCategory.SECURITY_INQUIRY: [
                r'\b(safe|secure|security|risk)\b',
                r'\b(scam|rug|hack|exploit)\b',
                r'\b(audit|verify|check)\b',
                r'\b(protect|protection)\b'
            ],
            IntentCategory.LEARNING_REQUEST: [
                r'\b(learn|teach|explain|understand)\b',
                r'\b(how|what|why|when)\b',
                r'\b(tutorial|guide|help)\b',
                r'\b(beginner|new|start)\b'
            ],
            IntentCategory.WALLET_OPERATION: [
                r'\b(wallet|address|send|receive)\b',
                r'\b(transfer|transaction|gas)\b',
                r'\b(connect|disconnect)\b',
                r'\b(backup|recovery|seed)\b'
            ],
            IntentCategory.PRODUCTIVITY_TASK: [
                r'\b(email|calendar|schedule|remind)\b',
                r'\b(automate|automatic|task)\b',
                r'\b(bill|payment|expense)\b',
                r'\b(organize|manage)\b'
            ],
            IntentCategory.EMERGENCY_HELP: [
                r'\b(emergency|urgent|help|stuck)\b',
                r'\b(problem|issue|error|failed)\b',
                r'\b(lost|missing|wrong)\b',
                r'\b(panic|worried|concerned)\b'
            ]
        }
        
        # Entity extraction patterns
        self.entity_patterns = {
            EntityType.TOKEN_SYMBOL: r'\b([A-Z]{2,10})\b',
            EntityType.AMOUNT: r'\b(\d+(?:\.\d+)?)\s*(?:tokens?|coins?|dollars?|\$)?\b',
            EntityType.PERCENTAGE: r'\b(\d+(?:\.\d+)?)\s*%\b',
            EntityType.WALLET_ADDRESS: r'\b(0x[a-fA-F0-9]{40})\b',
            EntityType.TIME_PERIOD: r'\b(\d+)\s*(day|week|month|year)s?\b'
        }
        
        # Risk assessment keywords
        self.high_risk_keywords = [
            'all in', 'everything', 'life savings', 'mortgage', 'loan',
            'leverage', 'margin', 'borrow to invest', 'maximum risk'
        ]
        
        self.medium_risk_keywords = [
            'most of', 'majority', 'large amount', 'significant',
            'aggressive', 'high yield', 'new protocol'
        ]
        
        # Educational content templates
        self.educational_templates = {
            'swap': "Token swapping exchanges one cryptocurrency for another. Always check slippage tolerance and fees before confirming.",
            'yield_farming': "Yield farming involves providing liquidity to earn rewards. Higher yields often mean higher risks.",
            'staking': "Staking locks your tokens to support network security and earn rewards. Consider the lock-up period.",
            'liquidity_pool': "Liquidity pools enable decentralized trading. You earn fees but face impermanent loss risk."
        }
    
    async def process_conversation(self, request: ConversationRequest) -> ConversationResponse:
        """
        Process a conversation request and generate appropriate response
        
        Args:
            request: Conversation request with user message and context
            
        Returns:
            Conversation response with intent analysis and suggestions
        """
        try:
            conversation_id = request.conversation_id or str(uuid.uuid4())
            
            # Add to conversation history
            if conversation_id not in self.conversation_history:
                self.conversation_history[conversation_id] = []
            
            self.conversation_history[conversation_id].append({
                "role": "user",
                "content": request.message,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            # Analyze user intent
            intent_analysis = await self._analyze_intent(request.message, request.context)
            
            # Generate response based on intent
            response_message = await self._generate_response(
                request, intent_analysis, conversation_id
            )
            
            # Extract suggested actions
            suggested_actions = await self._extract_suggested_actions(
                intent_analysis, request.user_preferences
            )
            
            # Assess risks and generate warnings
            risk_warnings = await self._assess_risks(intent_analysis, request.message)
            
            # Generate educational content
            educational_content = await self._generate_educational_content(intent_analysis)
            
            # Generate follow-up questions
            follow_up_questions = await self._generate_follow_up_questions(intent_analysis)
            
            # Determine if approval is required
            requires_approval = await self._requires_approval(intent_analysis)
            
            # Create response
            response = ConversationResponse(
                conversation_id=conversation_id,
                message=response_message,
                intent_analysis=intent_analysis.__dict__,
                suggested_actions=suggested_actions,
                requires_approval=requires_approval,
                risk_warnings=risk_warnings,
                educational_content=educational_content,
                follow_up_questions=follow_up_questions
            )
            
            # Add to conversation history
            self.conversation_history[conversation_id].append({
                "role": "assistant",
                "content": response_message,
                "timestamp": datetime.utcnow().isoformat(),
                "intent": intent_analysis.primary_intent,
                "confidence": intent_analysis.confidence
            })
            
            logger.info("Conversation processed successfully",
                       conversation_id=conversation_id,
                       intent=intent_analysis.primary_intent,
                       confidence=intent_analysis.confidence)
            
            return response
            
        except Exception as e:
            logger.error("Conversation processing failed", error=str(e))
            
            # Return error response
            return ConversationResponse(
                conversation_id=request.conversation_id or str(uuid.uuid4()),
                message="I'm sorry, I encountered an error processing your request. Please try again or rephrase your question.",
                intent_analysis={"error": str(e)},
                risk_warnings=["System error occurred - please verify any actions manually"]
            )
    
    async def _analyze_intent(self, message: str, context: Dict[str, Any]) -> IntentAnalysis:
        """Analyze user intent from message"""
        try:
            message_lower = message.lower()
            
            # Calculate intent scores using pattern matching
            intent_scores = {}
            for intent, patterns in self.intent_patterns.items():
                score = 0
                for pattern in patterns:
                    matches = len(re.findall(pattern, message_lower))
                    score += matches
                
                if score > 0:
                    intent_scores[intent] = score / len(patterns)
            
            # Use Gemini for more sophisticated analysis if patterns are insufficient
            if not intent_scores or max(intent_scores.values()) < 0.3:
                gemini_analysis = await self._gemini_intent_analysis(message, context)
                if gemini_analysis:
                    intent_scores.update(gemini_analysis)
            
            # Determine primary intent
            if intent_scores:
                primary_intent = max(intent_scores.keys(), key=lambda k: intent_scores[k])
                confidence = min(intent_scores[primary_intent], 1.0)
            else:
                primary_intent = IntentCategory.GENERAL_INQUIRY
                confidence = 0.5
            
            # Extract secondary intents
            secondary_intents = [
                (intent, score) for intent, score in intent_scores.items()
                if intent != primary_intent and score > 0.2
            ]
            secondary_intents.sort(key=lambda x: x[1], reverse=True)
            
            # Extract entities
            entities = await self._extract_entities(message)
            
            # Check if clarification is needed
            requires_clarification = confidence < 0.6 or len(entities) == 0
            clarification_questions = []
            
            if requires_clarification:
                clarification_questions = await self._generate_clarification_questions(
                    primary_intent, entities, message
                )
            
            return IntentAnalysis(
                primary_intent=primary_intent,
                confidence=confidence,
                secondary_intents=secondary_intents,
                entities=entities,
                context=context,
                requires_clarification=requires_clarification,
                clarification_questions=clarification_questions
            )
            
        except Exception as e:
            logger.error("Intent analysis failed", error=str(e))
            return IntentAnalysis(
                primary_intent=IntentCategory.GENERAL_INQUIRY,
                confidence=0.3,
                context=context
            )
    
    async def _gemini_intent_analysis(self, message: str, context: Dict[str, Any]) -> Optional[Dict[IntentCategory, float]]:
        """Use Gemini for sophisticated intent analysis"""
        try:
            prompt = f"""
            Analyze the following user message for DeFi and financial intent:
            
            Message: "{message}"
            Context: {json.dumps(context, default=str)}
            
            Classify the intent into one of these categories with confidence scores (0-1):
            - defi_operation: Swapping, lending, staking, yield farming
            - portfolio_management: Managing investments, rebalancing
            - market_analysis: Price predictions, market trends
            - security_inquiry: Safety questions, risk assessment
            - learning_request: Educational questions, tutorials
            - wallet_operation: Wallet management, transactions
            - productivity_task: Automation, scheduling, tasks
            - general_inquiry: General questions
            - emergency_help: Urgent help requests
            
            Return only a JSON object with intent categories and confidence scores.
            """
            
            response = await self.model.generate_content_async(prompt)
            
            # Parse JSON response
            try:
                result = json.loads(response.text)
                return {IntentCategory(k): v for k, v in result.items() if k in [e.value for e in IntentCategory]}
            except (json.JSONDecodeError, ValueError):
                return None
                
        except Exception as e:
            logger.error("Gemini intent analysis failed", error=str(e))
            return None
    
    async def _extract_entities(self, message: str) -> List[ExtractedEntity]:
        """Extract entities from user message"""
        try:
            entities = []
            
            for entity_type, pattern in self.entity_patterns.items():
                matches = re.finditer(pattern, message, re.IGNORECASE)
                
                for match in matches:
                    entity = ExtractedEntity(
                        entity_type=entity_type,
                        value=match.group(1) if match.groups() else match.group(0),
                        confidence=0.8,  # Pattern-based extraction has high confidence
                        start_position=match.start(),
                        end_position=match.end()
                    )
                    
                    # Normalize entity values
                    entity.normalized_value = await self._normalize_entity_value(entity)
                    entities.append(entity)
            
            return entities
            
        except Exception as e:
            logger.error("Entity extraction failed", error=str(e))
            return []
    
    async def _normalize_entity_value(self, entity: ExtractedEntity) -> Any:
        """Normalize extracted entity values"""
        try:
            if entity.entity_type == EntityType.AMOUNT:
                return float(entity.value)
            elif entity.entity_type == EntityType.PERCENTAGE:
                return float(entity.value) / 100.0
            elif entity.entity_type == EntityType.TOKEN_SYMBOL:
                return entity.value.upper()
            else:
                return entity.value
                
        except (ValueError, TypeError):
            return entity.value
    
    async def _generate_response(self, request: ConversationRequest, 
                               intent_analysis: IntentAnalysis, 
                               conversation_id: str) -> str:
        """Generate appropriate response based on intent analysis"""
        try:
            # Get conversation history for context
            history = self.conversation_history.get(conversation_id, [])
            recent_history = history[-5:] if len(history) > 5 else history
            
            # Create context-aware prompt
            prompt = f"""
            You are a helpful DeFi assistant that explains complex financial concepts in simple terms.
            
            User message: "{request.message}"
            Intent: {intent_analysis.primary_intent}
            Confidence: {intent_analysis.confidence}
            Entities: {[e.value for e in intent_analysis.entities]}
            
            Recent conversation:
            {json.dumps(recent_history, default=str)}
            
            Guidelines:
            1. Use simple, non-technical language
            2. Explain any DeFi terms you use
            3. Always mention risks when relevant
            4. Provide actionable advice
            5. Ask clarifying questions if needed
            6. Be encouraging but cautious
            
            Generate a helpful response:
            """
            
            response = await self.model.generate_content_async(prompt)
            return response.text.strip()
            
        except Exception as e:
            logger.error("Response generation failed", error=str(e))
            return "I understand you're interested in DeFi operations. Could you provide more specific details about what you'd like to do?"
    
    async def _extract_suggested_actions(self, intent_analysis: IntentAnalysis, 
                                       user_preferences: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract suggested actions based on intent analysis"""
        try:
            actions = []
            
            if intent_analysis.primary_intent == IntentCategory.DEFI_OPERATION:
                # Extract token symbols and amounts for swap suggestions
                tokens = [e.normalized_value for e in intent_analysis.entities 
                         if e.entity_type == EntityType.TOKEN_SYMBOL]
                amounts = [e.normalized_value for e in intent_analysis.entities 
                          if e.entity_type == EntityType.AMOUNT]
                
                if len(tokens) >= 2 and amounts:
                    actions.append({
                        "type": "token_swap",
                        "from_token": tokens[0],
                        "to_token": tokens[1],
                        "amount": amounts[0],
                        "requires_approval": True
                    })
                
            elif intent_analysis.primary_intent == IntentCategory.PORTFOLIO_MANAGEMENT:
                actions.append({
                    "type": "portfolio_analysis",
                    "description": "Analyze current portfolio performance",
                    "requires_approval": False
                })
                
            elif intent_analysis.primary_intent == IntentCategory.LEARNING_REQUEST:
                actions.append({
                    "type": "educational_content",
                    "description": "Provide educational resources",
                    "requires_approval": False
                })
            
            return actions
            
        except Exception as e:
            logger.error("Action extraction failed", error=str(e))
            return []
    
    async def _assess_risks(self, intent_analysis: IntentAnalysis, message: str) -> List[str]:
        """Assess risks based on intent and message content"""
        try:
            warnings = []
            message_lower = message.lower()
            
            # Check for high-risk keywords
            for keyword in self.high_risk_keywords:
                if keyword in message_lower:
                    warnings.append(f"⚠️ HIGH RISK: Investing {keyword} is extremely risky. Never invest more than you can afford to lose.")
            
            # Check for medium-risk keywords
            for keyword in self.medium_risk_keywords:
                if keyword in message_lower:
                    warnings.append(f"⚠️ MEDIUM RISK: {keyword.title()} investments carry significant risk. Please research thoroughly.")
            
            # Intent-specific warnings
            if intent_analysis.primary_intent == IntentCategory.DEFI_OPERATION:
                warnings.append("💡 Remember: All DeFi operations carry smart contract risks. Start with small amounts.")
            
            # Check for new user indicators
            learning_indicators = ['new', 'beginner', 'first time', 'never done']
            if any(indicator in message_lower for indicator in learning_indicators):
                warnings.append("🎓 New to DeFi? Consider starting with testnet tokens to practice safely.")
            
            return warnings
            
        except Exception as e:
            logger.error("Risk assessment failed", error=str(e))
            return ["⚠️ Please exercise caution with all financial operations."]
    
    async def _generate_educational_content(self, intent_analysis: IntentAnalysis) -> Optional[str]:
        """Generate educational content based on intent"""
        try:
            if intent_analysis.primary_intent == IntentCategory.LEARNING_REQUEST:
                # Extract key concepts from entities
                concepts = []
                for entity in intent_analysis.entities:
                    if entity.entity_type == EntityType.TOKEN_SYMBOL:
                        concepts.append('tokens')
                    elif entity.entity_type == EntityType.PROTOCOL_NAME:
                        concepts.append('protocols')
                
                # Return relevant educational content
                if 'swap' in intent_analysis.context.get('keywords', []):
                    return self.educational_templates.get('swap')
                elif 'yield' in intent_analysis.context.get('keywords', []):
                    return self.educational_templates.get('yield_farming')
                elif 'stake' in intent_analysis.context.get('keywords', []):
                    return self.educational_templates.get('staking')
                elif 'liquidity' in intent_analysis.context.get('keywords', []):
                    return self.educational_templates.get('liquidity_pool')
            
            return None
            
        except Exception as e:
            logger.error("Educational content generation failed", error=str(e))
            return None
    
    async def _generate_follow_up_questions(self, intent_analysis: IntentAnalysis) -> List[str]:
        """Generate follow-up questions to gather more information"""
        try:
            questions = []
            
            if intent_analysis.requires_clarification:
                return intent_analysis.clarification_questions
            
            # Intent-specific follow-up questions
            if intent_analysis.primary_intent == IntentCategory.DEFI_OPERATION:
                if not any(e.entity_type == EntityType.AMOUNT for e in intent_analysis.entities):
                    questions.append("How much would you like to invest or trade?")
                
                if not any(e.entity_type == EntityType.RISK_LEVEL for e in intent_analysis.entities):
                    questions.append("What's your risk tolerance: conservative, moderate, or aggressive?")
            
            elif intent_analysis.primary_intent == IntentCategory.PORTFOLIO_MANAGEMENT:
                questions.append("Would you like to see your current portfolio performance?")
                questions.append("Are you interested in rebalancing recommendations?")
            
            elif intent_analysis.primary_intent == IntentCategory.LEARNING_REQUEST:
                questions.append("Would you like to start with a beginner tutorial?")
                questions.append("Are you interested in hands-on practice with testnet tokens?")
            
            return questions[:2]  # Limit to 2 questions to avoid overwhelming
            
        except Exception as e:
            logger.error("Follow-up question generation failed", error=str(e))
            return []
    
    async def _generate_clarification_questions(self, intent: IntentCategory, 
                                              entities: List[ExtractedEntity], 
                                              message: str) -> List[str]:
        """Generate clarification questions for ambiguous requests"""
        try:
            questions = []
            
            if intent == IntentCategory.DEFI_OPERATION:
                if not entities:
                    questions.append("Which tokens would you like to work with?")
                    questions.append("What type of DeFi operation are you interested in? (swap, lend, stake, etc.)")
                
                token_entities = [e for e in entities if e.entity_type == EntityType.TOKEN_SYMBOL]
                if len(token_entities) == 1:
                    questions.append(f"What would you like to do with {token_entities[0].value}?")
            
            elif intent == IntentCategory.PORTFOLIO_MANAGEMENT:
                questions.append("Are you looking to check your portfolio balance or make changes?")
            
            elif intent == IntentCategory.GENERAL_INQUIRY:
                questions.append("Could you provide more details about what you'd like to accomplish?")
                questions.append("Are you interested in DeFi operations, portfolio management, or learning about crypto?")
            
            return questions
            
        except Exception as e:
            logger.error("Clarification question generation failed", error=str(e))
            return ["Could you please provide more details about what you'd like to do?"]
    
    async def _requires_approval(self, intent_analysis: IntentAnalysis) -> bool:
        """Determine if the operation requires user approval"""
        try:
            # Operations that always require approval
            high_risk_intents = [
                IntentCategory.DEFI_OPERATION,
                IntentCategory.WALLET_OPERATION
            ]
            
            if intent_analysis.primary_intent in high_risk_intents:
                return True
            
            # Check for high-value operations
            amounts = [e.normalized_value for e in intent_analysis.entities 
                      if e.entity_type == EntityType.AMOUNT]
            
            if amounts and any(amount > 1000 for amount in amounts):  # > $1000
                return True
            
            return False
            
        except Exception as e:
            logger.error("Approval requirement check failed", error=str(e))
            return True  # Default to requiring approval for safety
    
    async def get_conversation_history(self, conversation_id: str) -> List[Dict[str, Any]]:
        """Get conversation history for a specific conversation"""
        return self.conversation_history.get(conversation_id, [])
    
    async def clear_conversation_history(self, conversation_id: str) -> bool:
        """Clear conversation history for a specific conversation"""
        try:
            if conversation_id in self.conversation_history:
                del self.conversation_history[conversation_id]
                return True
            return False
        except Exception as e:
            logger.error("Failed to clear conversation history", error=str(e))
            return False
    
    async def get_conversation_summary(self, conversation_id: str) -> Optional[str]:
        """Generate a summary of the conversation"""
        try:
            history = self.conversation_history.get(conversation_id, [])
            if not history:
                return None
            
            # Create summary prompt
            prompt = f"""
            Summarize this conversation between a user and DeFi assistant:
            
            {json.dumps(history, default=str)}
            
            Provide a brief summary focusing on:
            1. Main topics discussed
            2. Key decisions or actions taken
            3. Any pending items or follow-ups needed
            
            Keep it concise and user-friendly.
            """
            
            response = await self.model.generate_content_async(prompt)
            return response.text.strip()
            
        except Exception as e:
            logger.error("Conversation summary generation failed", error=str(e))
            return None