/**
 * Intent Router Agent Implementation
 * Central orchestrator that analyzes user intent and coordinates agent workflows
 */

import { BaseAgentImpl, BaseAgentConfig } from '../core/base-agent';
import { AgentType, IntentCategory, ComplexityLevel, RiskLevel, MessageType } from '../types/core';
import { 
  IntentRouterAgent, 
  IntentAnalysis, 
  AgentWorkflow, 
  ExecutionPlan, 
  ExecutionStatus,
  HealthStatus,
  WorkflowStep
} from '../types/agents';

export interface IntentRouterConfig extends BaseAgentConfig {
  maxWorkflowsPerAgent: number;
  defaultTimeoutMs: number;
  enableAdvancedNLP: boolean;
  confidenceThreshold: number;
}

export class IntentRouter extends BaseAgentImpl implements IntentRouterAgent {
  private activeWorkflows: Map<string, AgentWorkflow> = new Map();
  private executionPlans: Map<string, ExecutionPlan> = new Map();
  private intentPatterns: Map<IntentCategory, RegExp[]> = new Map();
  private agentCapabilities: Map<AgentType, string[]> = new Map();
  private routerConfig: IntentRouterConfig;

  constructor(config: Partial<IntentRouterConfig> = {}) {
    const fullConfig: IntentRouterConfig = {
      name: 'Intent Router Agent',
      type: AgentType.INTENT_ROUTER,
      version: '1.0.0',
      capabilities: [
        'intent_analysis',
        'workflow_orchestration',
        'agent_routing',
        'natural_language_processing',
        'conflict_resolution'
      ],
      maxConcurrentTasks: 10,
      timeoutMs: 30000,
      enableSandbox: false,
      maxWorkflowsPerAgent: 5,
      defaultTimeoutMs: 300000, // 5 minutes
      enableAdvancedNLP: true,
      confidenceThreshold: 0.7,
      ...config
    };

    super(fullConfig);
    this.routerConfig = fullConfig;
    this.initializeIntentPatterns();
    this.initializeAgentCapabilities();
  }

  /**
   * Analyze user intent and classify the request
   */
  public async analyzeIntent(userInput: string): Promise<IntentAnalysis> {
    const startTime = Date.now();
    
    try {
      // Normalize input
      const normalizedInput = this.normalizeInput(userInput);
      
      // Extract keywords and phrases
      const keywords = this.extractKeywords(normalizedInput);
      const phrases = this.extractPhrases(normalizedInput);
      
      // Classify primary intent
      const primaryIntent = this.classifyPrimaryIntent(normalizedInput, keywords, phrases);
      
      // Identify secondary intents
      const secondaryIntents = this.identifySecondaryIntents(normalizedInput, keywords, phrases, primaryIntent);
      
      // Assess complexity
      const complexity = this.assessComplexity(userInput, primaryIntent, secondaryIntents);
      
      // Determine required agents
      const requiredAgents = this.determineRequiredAgents(primaryIntent, secondaryIntents, complexity);
      
      // Estimate duration
      const estimatedDuration = this.estimateDuration(complexity, requiredAgents.length);
      
      // Assess risk level
      const riskLevel = this.assessRiskLevel(primaryIntent, secondaryIntents, userInput);
      
      // Calculate confidence
      const confidence = this.calculateConfidence(primaryIntent, keywords, phrases);
      
      // Generate reasoning
      const reasoning = this.generateReasoning(
        primaryIntent, 
        secondaryIntents, 
        requiredAgents, 
        complexity, 
        riskLevel,
        keywords
      );

      const analysis: IntentAnalysis = {
        primaryIntent,
        secondaryIntents,
        complexity,
        requiredAgents,
        estimatedDuration,
        riskLevel,
        confidence,
        reasoning,
        parameters: this.extractParameters(userInput, primaryIntent)
      };

      // Log the analysis for audit purposes
      await this.logIntentAnalysis(userInput, analysis, Date.now() - startTime);
      
      return analysis;

    } catch (error) {
      throw new Error(`Intent analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Route intent to appropriate agents and create workflow
   */
  public async routeToAgents(intent: IntentAnalysis): Promise<AgentWorkflow> {
    try {
      // Check if intent is ambiguous and requires clarification
      if (intent.confidence < this.routerConfig.confidenceThreshold) {
        throw new Error(`Intent is ambiguous (confidence: ${intent.confidence}). Please provide more specific details.`);
      }

      // Create workflow ID
      const workflowId = this.generateWorkflowId();
      
      // Create workflow steps
      const steps = this.createWorkflowSteps(intent);
      
      // Determine dependencies
      const dependencies = this.determineDependencies(steps);
      
      // Create parallel groups for concurrent execution
      const parallelGroups = this.createParallelGroups(steps, dependencies);
      
      // Create workflow
      const workflow: AgentWorkflow = {
        id: workflowId,
        name: `Workflow for ${intent.primaryIntent}`,
        initiatingAgent: this.id,
        participatingAgents: intent.requiredAgents.map(type => this.getAgentIdByType(type)),
        steps,
        status: 'pending',
        dependencies,
        parallelGroups,
        intent,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store workflow
      this.activeWorkflows.set(workflowId, workflow);
      
      // Log workflow creation
      await this.logWorkflowCreation(workflow);
      
      return workflow;

    } catch (error) {
      throw new Error(`Agent routing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Orchestrate workflow execution
   */
  public async orchestrateWorkflow(workflow: AgentWorkflow): Promise<ExecutionPlan> {
    try {
      // Use the workflow orchestrator for execution
      const { getWorkflowOrchestrator } = await import('../core/workflow-orchestrator');
      const orchestrator = getWorkflowOrchestrator();
      
      // Delegate to workflow orchestrator
      const executionPlan = await orchestrator.orchestrateWorkflow(workflow);
      
      // Store execution plan locally for monitoring
      this.executionPlans.set(executionPlan.id, executionPlan);
      
      return executionPlan;

    } catch (error) {
      throw new Error(`Workflow orchestration failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Monitor workflow execution status
   */
  public async monitorExecution(plan: ExecutionPlan): Promise<ExecutionStatus> {
    try {
      // Use the workflow orchestrator for monitoring
      const { getWorkflowOrchestrator } = await import('../core/workflow-orchestrator');
      const orchestrator = getWorkflowOrchestrator();
      
      // Delegate to workflow orchestrator
      const executionStatus = await orchestrator.monitorExecution(plan.id);
      
      return executionStatus;

    } catch (error) {
      throw new Error(`Execution monitoring failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Protected methods for base agent implementation
  protected async onInitialize(): Promise<void> {
    // Initialize any additional resources
    this.emit('intent-router-initialized');
  }

  protected async onShutdown(): Promise<void> {
    // Clean up active workflows
    this.activeWorkflows.clear();
    this.executionPlans.clear();
  }

  protected async onHealthCheck(): Promise<HealthStatus> {
    const activeWorkflowCount = this.activeWorkflows.size;
    const activePlanCount = this.executionPlans.size;
    
    if (activeWorkflowCount > this.routerConfig.maxWorkflowsPerAgent * 2) {
      return {
        status: 'degraded',
        message: `High workflow load: ${activeWorkflowCount} active workflows`,
        lastCheck: new Date()
      };
    }
    
    return {
      status: 'healthy',
      message: `${activeWorkflowCount} workflows, ${activePlanCount} plans active`,
      lastCheck: new Date()
    };
  }

  protected async handleRequest(message: Record<string, unknown>): Promise<unknown> {
    const action = message['action'] as string;
    const payload = message['payload'] as Record<string, unknown>;
    
    switch (action) {
      case 'analyze_intent':
        return this.analyzeIntent(payload['userInput'] as string);
      
      case 'route_to_agents':
        return this.routeToAgents(payload['intent'] as IntentAnalysis);
      
      case 'orchestrate_workflow':
        return this.orchestrateWorkflow(payload['workflow'] as AgentWorkflow);
      
      case 'monitor_execution':
        return this.monitorExecution(payload['plan'] as ExecutionPlan);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  protected async handleEvent(message: Record<string, unknown>): Promise<void> {
    const eventType = message['action'] as string;
    
    switch (eventType) {
      case 'workflow_step_completed':
        await this.handleStepCompleted(message['payload'] as Record<string, unknown>);
        break;
      
      case 'workflow_step_failed':
        await this.handleStepFailed(message['payload'] as Record<string, unknown>);
        break;
      
      default:
        // Ignore unknown events
        break;
    }
  }

  protected async handleError(message: Record<string, unknown>): Promise<void> {
    const error = message['payload'] as { error: string; originalMessageId: string };
    this.emit('message-error', error);
  }

  // Private helper methods
  private initializeIntentPatterns(): void {
    this.intentPatterns.set(IntentCategory.CODE_GENERATION, [
      /\b(generate|create|write|build|implement|code|develop)\b.*\b(function|class|module|component|service|api)\b/i,
      /\b(build|create|make)\b.*\b(app|application|system|program|software)\b/i,
      /\bwrite\b.*\bcode\b/i,
      /\bimplement\b.*\b(feature|functionality|logic)\b/i
    ]);

    this.intentPatterns.set(IntentCategory.TESTING, [
      /\b(test|testing|unit test|integration test|property test)\b/i,
      /\b(write|create|generate)\b.*\btests?\b/i,
      /\b(debug|fix|troubleshoot)\b/i,
      /\btest coverage\b/i
    ]);

    this.intentPatterns.set(IntentCategory.SECURITY_VALIDATION, [
      /\b(security|secure|validate|audit|vulnerability|defi|transaction)\b/i,
      /\b(rug pull|honeypot|slippage|mev|sandwich attack)\b/i,
      /\b(smart contract|blockchain|crypto|token)\b/i,
      /\bsecurity scan\b/i
    ]);

    this.intentPatterns.set(IntentCategory.RESEARCH, [
      /\b(research|investigate|analyze|study|explore|find|search)\b/i,
      /\b(api|integration|library|framework|documentation)\b/i,
      /\b(market data|price|oracle|chainlink)\b/i,
      /\bwhat is\b|\bhow to\b|\bwhy\b/i
    ]);

    this.intentPatterns.set(IntentCategory.SYSTEM_DESIGN, [
      /\b(design|architecture|system|structure|blueprint)\b/i,
      /\b(ux|user experience|user interface|ui|flow)\b/i,
      /\b(component|module|service|microservice)\b/i,
      /\b(scalability|performance|deployment)\b/i
    ]);

    this.intentPatterns.set(IntentCategory.DEFI_OPERATION, [
      /\b(swap|trade|exchange|liquidity|yield|farming|staking)\b/i,
      /\b(defi|decentralized finance|dex|uniswap|sushiswap)\b/i,
      /\b(token|coin|cryptocurrency|eth|ethereum)\b/i,
      /\b(wallet|metamask|web3)\b/i
    ]);

    this.intentPatterns.set(IntentCategory.REFACTORING, [
      /\b(refactor|refactoring|improve|optimize|clean up|restructure)\b/i,
      /\b(code quality|maintainability|readability)\b/i,
      /\b(performance|efficiency|optimization)\b/i
    ]);

    this.intentPatterns.set(IntentCategory.DEBUGGING, [
      /\b(debug|debugging|fix|error|bug|issue|problem)\b/i,
      /\b(troubleshoot|diagnose|resolve)\b/i,
      /\b(not working|failing|broken)\b/i
    ]);

    this.intentPatterns.set(IntentCategory.DEPLOYMENT, [
      /\b(deploy|deployment|release|publish|production)\b/i,
      /\b(ci\/cd|continuous integration|continuous deployment)\b/i,
      /\b(docker|kubernetes|aws|cloud)\b/i
    ]);
  }

  private initializeAgentCapabilities(): void {
    this.agentCapabilities.set(AgentType.INTENT_ROUTER, [
      'intent_analysis', 'workflow_orchestration', 'agent_routing'
    ]);
    
    this.agentCapabilities.set(AgentType.PRODUCT_ARCHITECT, [
      'system_design', 'architecture_generation', 'ux_design', 'component_specification'
    ]);
    
    this.agentCapabilities.set(AgentType.CODE_ENGINEER, [
      'code_generation', 'refactoring', 'optimization', 'standards_enforcement'
    ]);
    
    this.agentCapabilities.set(AgentType.TEST_AGENT, [
      'test_generation', 'debugging', 'auto_fix', 'coverage_analysis'
    ]);
    
    this.agentCapabilities.set(AgentType.SECURITY_VALIDATOR, [
      'security_validation', 'defi_safety', 'transaction_simulation', 'risk_assessment'
    ]);
    
    this.agentCapabilities.set(AgentType.RESEARCH_AGENT, [
      'research', 'api_integration', 'information_gathering', 'citation_management'
    ]);
    
    this.agentCapabilities.set(AgentType.AUDIT_AGENT, [
      'audit_logging', 'compliance_monitoring', 'performance_tracking', 'reporting'
    ]);
  }

  private normalizeInput(input: string): string {
    return input.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  private extractKeywords(input: string): string[] {
    // Simple keyword extraction - in production, use more sophisticated NLP
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must']);
    
    return input
      .split(/\W+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 20); // Limit to top 20 keywords
  }

  private extractPhrases(input: string): string[] {
    // Extract common phrases and technical terms
    const extractedPhrases: string[] = [];
    const phrasePatterns = [
      /\b\w+\s+\w+\s+\w+\b/g, // 3-word phrases
      /\b\w+\s+\w+\b/g // 2-word phrases
    ];
    
    for (const pattern of phrasePatterns) {
      const matches = input.match(pattern) || [];
      extractedPhrases.push(...matches.slice(0, 10)); // Limit phrases
    }
    
    return extractedPhrases;
  }

  private classifyPrimaryIntent(input: string, keywords: string[], _phrases: string[]): IntentCategory {
    const scores = new Map<IntentCategory, number>();
    
    // Initialize scores
    for (const category of Object.values(IntentCategory)) {
      scores.set(category, 0);
    }
    
    // Score based on pattern matching
    for (const [category, patterns] of this.intentPatterns) {
      for (const pattern of patterns) {
        if (pattern.test(input)) {
          scores.set(category, (scores.get(category) || 0) + 2);
        }
      }
    }
    
    // Score based on keywords
    for (const keyword of keywords) {
      for (const [category, patterns] of this.intentPatterns) {
        for (const pattern of patterns) {
          if (pattern.test(keyword)) {
            scores.set(category, (scores.get(category) || 0) + 1);
          }
        }
      }
    }
    
    // Find highest scoring category
    let maxScore = 0;
    let primaryIntent = IntentCategory.RESEARCH; // Default fallback
    
    for (const [category, score] of scores) {
      if (score > maxScore) {
        maxScore = score;
        primaryIntent = category;
      }
    }
    
    return primaryIntent;
  }

  private identifySecondaryIntents(
    input: string, 
    _keywords: string[], 
    _phrases: string[], 
    primaryIntent: IntentCategory
  ): IntentCategory[] {
    const scores = new Map<IntentCategory, number>();
    
    // Score all categories except primary
    for (const category of Object.values(IntentCategory)) {
      if (category !== primaryIntent) {
        scores.set(category, 0);
      }
    }
    
    // Score based on patterns
    for (const [category, patterns] of this.intentPatterns) {
      if (category !== primaryIntent) {
        for (const pattern of patterns) {
          if (pattern.test(input)) {
            scores.set(category, (scores.get(category) || 0) + 1);
          }
        }
      }
    }
    
    // Return categories with score > 0, sorted by score
    return Array.from(scores.entries())
      .filter(([_, score]) => score > 0)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 3) // Max 3 secondary intents
      .map(([category, _]) => category);
  }

  private assessComplexity(
    input: string, 
    primaryIntent: IntentCategory, 
    secondaryIntents: IntentCategory[]
  ): ComplexityLevel {
    let complexityScore = 0;
    
    // Base complexity by intent type
    const intentComplexity = {
      [IntentCategory.RESEARCH]: 1,
      [IntentCategory.SYSTEM_DESIGN]: 3,
      [IntentCategory.CODE_GENERATION]: 2,
      [IntentCategory.TESTING]: 2,
      [IntentCategory.SECURITY_VALIDATION]: 3,
      [IntentCategory.DEFI_OPERATION]: 4,
      [IntentCategory.REFACTORING]: 2,
      [IntentCategory.DEBUGGING]: 2,
      [IntentCategory.DEPLOYMENT]: 3
    };
    
    complexityScore += intentComplexity[primaryIntent] || 1;
    complexityScore += secondaryIntents.length;
    
    // Complexity indicators in input
    const complexityIndicators = [
      /\bmultiple\b|\bseveral\b|\bmany\b/i,
      /\bcomplex\b|\bcomplicated\b|\badvanced\b/i,
      /\bintegration\b|\bintegrate\b/i,
      /\bmicroservice\b|\bdistributed\b/i,
      /\bscalable\b|\bscalability\b/i,
      /\bproduction\b|\benterprise\b/i
    ];
    
    for (const indicator of complexityIndicators) {
      if (indicator.test(input)) {
        complexityScore += 1;
      }
    }
    
    // Map score to complexity level
    if (complexityScore <= 2) return ComplexityLevel.LOW;
    if (complexityScore <= 4) return ComplexityLevel.MEDIUM;
    if (complexityScore <= 6) return ComplexityLevel.HIGH;
    return ComplexityLevel.CRITICAL;
  }

  private determineRequiredAgents(
    primaryIntent: IntentCategory,
    secondaryIntents: IntentCategory[],
    complexity: ComplexityLevel
  ): AgentType[] {
    const requiredAgents = new Set<AgentType>();
    
    // Always include Intent Router for coordination
    requiredAgents.add(AgentType.INTENT_ROUTER);
    
    // Map intents to required agents
    const intentAgentMap = {
      [IntentCategory.CODE_GENERATION]: [AgentType.CODE_ENGINEER, AgentType.TEST_AGENT],
      [IntentCategory.TESTING]: [AgentType.TEST_AGENT],
      [IntentCategory.SECURITY_VALIDATION]: [AgentType.SECURITY_VALIDATOR],
      [IntentCategory.RESEARCH]: [AgentType.RESEARCH_AGENT],
      [IntentCategory.SYSTEM_DESIGN]: [AgentType.PRODUCT_ARCHITECT],
      [IntentCategory.DEFI_OPERATION]: [AgentType.SECURITY_VALIDATOR, AgentType.RESEARCH_AGENT],
      [IntentCategory.REFACTORING]: [AgentType.CODE_ENGINEER, AgentType.TEST_AGENT],
      [IntentCategory.DEBUGGING]: [AgentType.TEST_AGENT, AgentType.CODE_ENGINEER],
      [IntentCategory.DEPLOYMENT]: [AgentType.CODE_ENGINEER, AgentType.SECURITY_VALIDATOR]
    };
    
    // Add agents for primary intent
    const primaryAgents = intentAgentMap[primaryIntent] || [];
    primaryAgents.forEach(agent => requiredAgents.add(agent));
    
    // Add agents for secondary intents
    for (const intent of secondaryIntents) {
      const agents = intentAgentMap[intent] || [];
      agents.forEach(agent => requiredAgents.add(agent));
    }
    
    // Always include Audit Agent for logging
    requiredAgents.add(AgentType.AUDIT_AGENT);
    
    // For high complexity, include additional agents
    if (complexity === ComplexityLevel.HIGH || complexity === ComplexityLevel.CRITICAL) {
      if (primaryIntent === IntentCategory.CODE_GENERATION || primaryIntent === IntentCategory.SYSTEM_DESIGN) {
        requiredAgents.add(AgentType.PRODUCT_ARCHITECT);
        requiredAgents.add(AgentType.SECURITY_VALIDATOR);
      }
    }
    
    return Array.from(requiredAgents);
  }

  private estimateDuration(complexity: ComplexityLevel, agentCount: number): number {
    const baseTime = {
      [ComplexityLevel.LOW]: 30000, // 30 seconds
      [ComplexityLevel.MEDIUM]: 120000, // 2 minutes
      [ComplexityLevel.HIGH]: 300000, // 5 minutes
      [ComplexityLevel.CRITICAL]: 600000 // 10 minutes
    };
    
    const base = baseTime[complexity];
    const agentMultiplier = Math.max(1, agentCount - 2) * 0.5; // Additional time for coordination
    
    return Math.round(base * (1 + agentMultiplier));
  }

  private assessRiskLevel(
    primaryIntent: IntentCategory,
    secondaryIntents: IntentCategory[],
    input: string
  ): RiskLevel {
    let riskScore = 0;
    
    // Base risk by intent
    const intentRisk = {
      [IntentCategory.RESEARCH]: 0,
      [IntentCategory.SYSTEM_DESIGN]: 1,
      [IntentCategory.CODE_GENERATION]: 2,
      [IntentCategory.TESTING]: 1,
      [IntentCategory.SECURITY_VALIDATION]: 2,
      [IntentCategory.DEFI_OPERATION]: 4,
      [IntentCategory.REFACTORING]: 2,
      [IntentCategory.DEBUGGING]: 1,
      [IntentCategory.DEPLOYMENT]: 3
    };
    
    riskScore += intentRisk[primaryIntent] || 0;
    
    // Add risk for secondary intents
    for (const intent of secondaryIntents) {
      riskScore += (intentRisk[intent] || 0) * 0.5;
    }
    
    // Risk indicators in input
    const riskIndicators = [
      /\bproduction\b|\blive\b|\bmainnet\b/i,
      /\bmoney\b|\bfunds\b|\bfinancial\b/i,
      /\bdelete\b|\bremove\b|\bdrop\b/i,
      /\bprivate key\b|\bseed phrase\b/i,
      /\btransaction\b|\btransfer\b|\bsend\b/i
    ];
    
    for (const indicator of riskIndicators) {
      if (indicator.test(input)) {
        riskScore += 2;
      }
    }
    
    // Map score to risk level
    if (riskScore <= 1) return RiskLevel.LOW;
    if (riskScore <= 3) return RiskLevel.MEDIUM;
    if (riskScore <= 5) return RiskLevel.HIGH;
    return RiskLevel.CRITICAL;
  }

  private calculateConfidence(
    primaryIntent: IntentCategory,
    keywords: string[],
    phrases: string[]
  ): number {
    let confidence = 0.5; // Base confidence
    
    // Check pattern matches
    const patterns = this.intentPatterns.get(primaryIntent) || [];
    let patternMatches = 0;
    
    for (const pattern of patterns) {
      for (const keyword of keywords) {
        if (pattern.test(keyword)) {
          patternMatches++;
        }
      }
      for (const phrase of phrases) {
        if (pattern.test(phrase)) {
          patternMatches++;
        }
      }
    }
    
    // Increase confidence based on pattern matches
    confidence += Math.min(0.4, patternMatches * 0.1);
    
    // Decrease confidence if input is very short or very long
    const inputLength = keywords.length;
    if (inputLength < 3) {
      confidence -= 0.2;
    } else if (inputLength > 20) {
      confidence -= 0.1;
    }
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private generateReasoning(
    primaryIntent: IntentCategory,
    secondaryIntents: IntentCategory[],
    requiredAgents: AgentType[],
    complexity: ComplexityLevel,
    riskLevel: RiskLevel,
    keywords: string[]
  ): string {
    const reasons = [];
    
    reasons.push(`Primary intent identified as ${primaryIntent} based on keyword analysis`);
    
    if (secondaryIntents.length > 0) {
      reasons.push(`Secondary intents detected: ${secondaryIntents.join(', ')}`);
    }
    
    reasons.push(`Complexity assessed as ${complexity} requiring ${requiredAgents.length} agents`);
    reasons.push(`Risk level determined as ${riskLevel}`);
    
    if (keywords.length > 0) {
      reasons.push(`Key terms identified: ${keywords.slice(0, 5).join(', ')}`);
    }
    
    return reasons.join('. ') + '.';
  }

  private extractParameters(input: string, primaryIntent: IntentCategory): Record<string, unknown> {
    const parameters: Record<string, unknown> = {};
    
    // Extract common parameters based on intent type
    switch (primaryIntent) {
      case IntentCategory.CODE_GENERATION:
        parameters['language'] = this.extractLanguage(input);
        parameters['framework'] = this.extractFramework(input);
        break;
      
      case IntentCategory.DEFI_OPERATION:
        parameters['tokens'] = this.extractTokens(input);
        parameters['amount'] = this.extractAmount(input);
        break;
      
      case IntentCategory.SECURITY_VALIDATION:
        parameters['contractAddress'] = this.extractContractAddress(input);
        break;
    }
    
    return parameters;
  }

  private extractLanguage(input: string): string | null {
    const languages = ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'solidity'];
    for (const lang of languages) {
      if (input.toLowerCase().includes(lang)) {
        return lang;
      }
    }
    return null;
  }

  private extractFramework(input: string): string | null {
    const frameworks = ['react', 'vue', 'angular', 'express', 'fastapi', 'django', 'spring'];
    for (const framework of frameworks) {
      if (input.toLowerCase().includes(framework)) {
        return framework;
      }
    }
    return null;
  }

  private extractTokens(input: string): string[] {
    const tokenPattern = /\b(eth|btc|usdc|usdt|dai|weth|uni|link|aave)\b/gi;
    return input.match(tokenPattern) || [];
  }

  private extractAmount(input: string): number | null {
    const amountPattern = /\b(\d+(?:\.\d+)?)\s*(eth|btc|usdc|usdt|dai|weth|uni|link|aave)?\b/i;
    const match = input.match(amountPattern);
    return match && match[1] ? parseFloat(match[1]) : null;
  }

  private extractContractAddress(input: string): string | null {
    const addressPattern = /\b0x[a-fA-F0-9]{40}\b/;
    const match = input.match(addressPattern);
    return match ? match[0] : null;
  }

  private createWorkflowSteps(intent: IntentAnalysis): WorkflowStep[] {
    const steps: WorkflowStep[] = [];
    let order = 1;
    
    // Create steps based on required agents
    for (const agentType of intent.requiredAgents) {
      if (agentType === AgentType.INTENT_ROUTER) continue; // Skip self
      
      const step: WorkflowStep = {
        id: `step_${order}`,
        agentType,
        action: this.getActionForAgent(agentType, intent.primaryIntent),
        order,
        timeout: this.getTimeoutForAgent(agentType, intent.complexity),
        required: this.isAgentRequired(agentType, intent.primaryIntent),
        parameters: this.getParametersForAgent(agentType, intent)
      };
      
      steps.push(step);
      order++;
    }
    
    return steps;
  }

  private getActionForAgent(agentType: AgentType, primaryIntent: IntentCategory): string {
    const actionMap: Record<string, Record<string, string>> = {
      [AgentType.PRODUCT_ARCHITECT]: {
        [IntentCategory.SYSTEM_DESIGN]: 'generate_architecture',
        [IntentCategory.CODE_GENERATION]: 'create_specifications',
        'default': 'analyze_requirements'
      },
      [AgentType.CODE_ENGINEER]: {
        [IntentCategory.CODE_GENERATION]: 'generate_code',
        [IntentCategory.REFACTORING]: 'refactor_code',
        [IntentCategory.DEBUGGING]: 'fix_code',
        'default': 'analyze_code'
      },
      [AgentType.TEST_AGENT]: {
        [IntentCategory.TESTING]: 'generate_tests',
        [IntentCategory.DEBUGGING]: 'debug_issues',
        'default': 'validate_code'
      },
      [AgentType.SECURITY_VALIDATOR]: {
        [IntentCategory.SECURITY_VALIDATION]: 'validate_security',
        [IntentCategory.DEFI_OPERATION]: 'validate_defi_transaction',
        'default': 'security_scan'
      },
      [AgentType.RESEARCH_AGENT]: {
        [IntentCategory.RESEARCH]: 'conduct_research',
        'default': 'gather_information'
      },
      [AgentType.AUDIT_AGENT]: {
        'default': 'log_audit'
      },
      [AgentType.INTENT_ROUTER]: {
        'default': 'coordinate'
      }
    };
    
    const agentActions = actionMap[agentType];
    if (!agentActions) return 'process_request';
    
    return agentActions[primaryIntent] || agentActions['default'] || 'process_request';
  }

  private getTimeoutForAgent(agentType: AgentType, complexity: ComplexityLevel): number {
    const baseTimeouts: Record<string, number> = {
      [AgentType.PRODUCT_ARCHITECT]: 120000, // 2 minutes
      [AgentType.CODE_ENGINEER]: 300000, // 5 minutes
      [AgentType.TEST_AGENT]: 180000, // 3 minutes
      [AgentType.SECURITY_VALIDATOR]: 60000, // 1 minute
      [AgentType.RESEARCH_AGENT]: 90000, // 1.5 minutes
      [AgentType.AUDIT_AGENT]: 30000, // 30 seconds
      [AgentType.INTENT_ROUTER]: 60000 // 1 minute
    };
    
    const complexityMultiplier = {
      [ComplexityLevel.LOW]: 1,
      [ComplexityLevel.MEDIUM]: 1.5,
      [ComplexityLevel.HIGH]: 2,
      [ComplexityLevel.CRITICAL]: 3
    };
    
    const baseTimeout = baseTimeouts[agentType] || 60000;
    return Math.round(baseTimeout * complexityMultiplier[complexity]);
  }

  private isAgentRequired(agentType: AgentType, primaryIntent: IntentCategory): boolean {
    const requiredAgents = {
      [IntentCategory.CODE_GENERATION]: [AgentType.CODE_ENGINEER],
      [IntentCategory.TESTING]: [AgentType.TEST_AGENT],
      [IntentCategory.SECURITY_VALIDATION]: [AgentType.SECURITY_VALIDATOR],
      [IntentCategory.RESEARCH]: [AgentType.RESEARCH_AGENT],
      [IntentCategory.SYSTEM_DESIGN]: [AgentType.PRODUCT_ARCHITECT],
      [IntentCategory.DEFI_OPERATION]: [AgentType.SECURITY_VALIDATOR],
      [IntentCategory.REFACTORING]: [AgentType.CODE_ENGINEER],
      [IntentCategory.DEBUGGING]: [AgentType.TEST_AGENT],
      [IntentCategory.DEPLOYMENT]: [AgentType.CODE_ENGINEER]
    };
    
    const required = requiredAgents[primaryIntent] || [];
    return required.includes(agentType) || agentType === AgentType.AUDIT_AGENT;
  }

  private getParametersForAgent(agentType: AgentType, intent: IntentAnalysis): Record<string, unknown> {
    const parameters: Record<string, unknown> = {
      intent: intent.primaryIntent,
      complexity: intent.complexity,
      riskLevel: intent.riskLevel,
      ...intent.parameters
    };
    
    // Add agent-specific parameters
    switch (agentType) {
      case AgentType.SECURITY_VALIDATOR:
        if (intent.riskLevel === RiskLevel.HIGH || intent.riskLevel === RiskLevel.CRITICAL) {
          parameters['requireApproval'] = true;
        }
        break;
      
      case AgentType.TEST_AGENT:
        parameters['coverageTarget'] = intent.complexity === ComplexityLevel.HIGH ? 90 : 80;
        break;
    }
    
    return parameters;
  }

  private determineDependencies(steps: WorkflowStep[]): Array<{ stepId: string; dependsOn: string[] }> {
    const dependencies: Array<{ stepId: string; dependsOn: string[] }> = [];
    
    // Define dependency rules
    const dependencyRules: Record<string, AgentType[]> = {
      [AgentType.CODE_ENGINEER]: [AgentType.PRODUCT_ARCHITECT],
      [AgentType.TEST_AGENT]: [AgentType.CODE_ENGINEER],
      [AgentType.SECURITY_VALIDATOR]: [AgentType.CODE_ENGINEER],
      [AgentType.AUDIT_AGENT]: [], // Can run in parallel with others
      [AgentType.INTENT_ROUTER]: [],
      [AgentType.PRODUCT_ARCHITECT]: [],
      [AgentType.RESEARCH_AGENT]: []
    };
    
    for (const step of steps) {
      const dependsOnTypes = dependencyRules[step.agentType] || [];
      const dependsOn = steps
        .filter(s => dependsOnTypes.includes(s.agentType))
        .map(s => s.id);
      
      if (dependsOn.length > 0) {
        dependencies.push({ stepId: step.id, dependsOn });
      }
    }
    
    return dependencies;
  }

  private createParallelGroups(steps: WorkflowStep[], dependencies: Array<{ stepId: string; dependsOn: string[] }>): string[][] {
    const groups: string[][] = [];
    const processed = new Set<string>();
    
    // Group steps that can run in parallel
    while (processed.size < steps.length) {
      const currentGroup: string[] = [];
      
      for (const step of steps) {
        if (processed.has(step.id)) continue;
        
        // Check if all dependencies are satisfied
        const stepDeps = dependencies.find(d => d.stepId === step.id);
        const canRun = !stepDeps || stepDeps.dependsOn.every(dep => processed.has(dep));
        
        if (canRun) {
          currentGroup.push(step.id);
          processed.add(step.id);
        }
      }
      
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      } else {
        // Prevent infinite loop
        break;
      }
    }
    
    return groups;
  }

  private generateWorkflowId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private getAgentIdByType(agentType: AgentType): string {
    // In a real implementation, this would query the agent registry
    return `${agentType}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private async logIntentAnalysis(input: string, analysis: IntentAnalysis, processingTime: number): Promise<void> {
    // Send audit log to Audit Agent
    await this.sendMessage(
      this.getAgentIdByType(AgentType.AUDIT_AGENT),
      MessageType.EVENT,
      {
        event: 'intent_analyzed',
        input,
        analysis,
        processingTime,
        timestamp: new Date().toISOString()
      },
      { action: 'log_intent_analysis' }
    );
  }

  private async logWorkflowCreation(workflow: AgentWorkflow): Promise<void> {
    // Send audit log to Audit Agent
    await this.sendMessage(
      this.getAgentIdByType(AgentType.AUDIT_AGENT),
      MessageType.EVENT,
      {
        event: 'workflow_created',
        workflow: {
          id: workflow.id,
          name: workflow.name,
          participatingAgents: workflow.participatingAgents,
          stepCount: workflow.steps.length,
          intent: workflow.intent.primaryIntent
        },
        timestamp: new Date().toISOString()
      },
      { action: 'log_workflow_creation' }
    );
  }

  private async handleStepCompleted(payload: Record<string, unknown>): Promise<void> {
    const { workflowId, stepId } = payload;
    const workflow = this.activeWorkflows.get(workflowId as string);
    
    if (workflow) {
      const step = workflow.steps.find(s => s.id === stepId);
      if (step) {
        step.status = 'completed';
        workflow.updatedAt = new Date();
      }
    }
  }

  private async handleStepFailed(payload: Record<string, unknown>): Promise<void> {
    const { workflowId, stepId, error } = payload;
    const workflow = this.activeWorkflows.get(workflowId as string);
    
    if (workflow) {
      const step = workflow.steps.find(s => s.id === stepId);
      if (step) {
        step.status = 'failed';
        step.errorMessage = error as string;
        workflow.updatedAt = new Date();
      }
    }
  }
}