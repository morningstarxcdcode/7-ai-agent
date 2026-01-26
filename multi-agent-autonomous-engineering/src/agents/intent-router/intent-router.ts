/**
 * Intent Router Agent Implementation
 * Central orchestrator that analyzes user intent and coordinates agent workflows
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { BaseAgentImpl, BaseAgentConfig } from '../../core/base-agent';
import { 
  AgentType, 
  AgentId,
  RiskLevel,
  Priority 
} from '../../types/core';
import {
  IntentRouterAgent,
  IntentAnalysis,
  AgentWorkflow,
  ExecutionPlan,
  ExecutionStatus,
  ExecutionSchedule,
  ExecutionDependency,
  ExecutionError,
  IntentCategory,
  ComplexityLevel,
  WorkflowStep
} from '../../types/agents';
import { MessageType } from '../../types/core';

// Intent classification patterns
const INTENT_PATTERNS: Record<IntentCategory, RegExp[]> = {
  [IntentCategory.CODE_GENERATION]: [
    /\b(generate|create|write|implement|build|code|develop)\b.*\b(code|function|class|module|api|service)\b/i,
    /\b(write|create)\s+(me\s+)?(a\s+)?(new\s+)?(code|function|script|program)\b/i,
    /\bcode\s+that\b/i
  ],
  [IntentCategory.TESTING]: [
    /\b(test|testing|unit\s+test|integration\s+test|e2e)\b/i,
    /\b(create|generate|write)\s+(tests?|specs?)\b/i,
    /\b(verify|validate|check)\s+(code|implementation)\b/i
  ],
  [IntentCategory.SECURITY_VALIDATION]: [
    /\b(security|audit|vulnerability|penetration|defi\s+safety)\b/i,
    /\b(check|scan|analyze)\s+(for\s+)?(security|vulnerabilities|risks?)\b/i,
    /\b(rug\s+pull|honeypot|slippage|mev)\b/i
  ],
  [IntentCategory.RESEARCH]: [
    /\b(research|investigate|study|analyze|explore)\b/i,
    /\b(find\s+out|learn\s+about|understand)\b/i,
    /\b(documentation|docs|api\s+reference)\b/i
  ],
  [IntentCategory.SYSTEM_DESIGN]: [
    /\b(design|architect|architecture|system\s+design|ux|ui)\b/i,
    /\b(plan|blueprint|spec|specification)\b/i,
    /\b(diagram|flow|wireframe)\b/i
  ],
  [IntentCategory.REFACTORING]: [
    /\b(refactor|restructure|reorganize|optimize|improve)\b.*\b(code|implementation)\b/i,
    /\b(clean\s+up|simplify|modernize)\b/i
  ],
  [IntentCategory.DEBUGGING]: [
    /\b(debug|fix|bug|error|issue|problem)\b/i,
    /\b(troubleshoot|diagnose|find\s+the\s+cause)\b/i,
    /\b(not\s+working|broken|failing)\b/i
  ],
  [IntentCategory.DEPLOYMENT]: [
    /\b(deploy|deployment|release|publish|ship)\b/i,
    /\b(production|staging|ci\/cd|pipeline)\b/i
  ],
  [IntentCategory.DEFI_OPERATION]: [
    /\b(swap|trade|stake|lend|borrow|yield|liquidity)\b/i,
    /\b(defi|blockchain|smart\s+contract|token)\b/i,
    /\b(ethereum|polygon|arbitrum|optimism|solana)\b/i
  ]
};

// Agent mapping for intents
const INTENT_TO_AGENTS: Record<IntentCategory, AgentType[]> = {
  [IntentCategory.CODE_GENERATION]: [AgentType.CODE_ENGINEER, AgentType.PRODUCT_ARCHITECT],
  [IntentCategory.TESTING]: [AgentType.TEST_AGENT, AgentType.CODE_ENGINEER],
  [IntentCategory.SECURITY_VALIDATION]: [AgentType.SECURITY_VALIDATOR, AgentType.AUDIT_AGENT],
  [IntentCategory.RESEARCH]: [AgentType.RESEARCH_AGENT],
  [IntentCategory.SYSTEM_DESIGN]: [AgentType.PRODUCT_ARCHITECT],
  [IntentCategory.REFACTORING]: [AgentType.CODE_ENGINEER, AgentType.TEST_AGENT],
  [IntentCategory.DEBUGGING]: [AgentType.TEST_AGENT, AgentType.CODE_ENGINEER],
  [IntentCategory.DEPLOYMENT]: [AgentType.AUDIT_AGENT, AgentType.SECURITY_VALIDATOR],
  [IntentCategory.DEFI_OPERATION]: [AgentType.SECURITY_VALIDATOR, AgentType.RESEARCH_AGENT]
};

// Complexity indicators
const COMPLEXITY_INDICATORS = {
  high: [
    /\b(complex|sophisticated|advanced|enterprise|production)\b/i,
    /\b(multiple|several|many|all)\s+(components?|services?|agents?)\b/i,
    /\b(integration|coordinate|orchestrate)\b/i
  ],
  medium: [
    /\b(moderate|standard|typical|normal)\b/i,
    /\b(few|some|couple)\s+(components?|services?)\b/i
  ],
  low: [
    /\b(simple|basic|quick|easy|straightforward)\b/i,
    /\b(single|one|just)\s+(component?|file|function)\b/i
  ]
};

export interface IntentRouterConfig extends BaseAgentConfig {
  confidenceThreshold: number;
  maxWorkflowSteps: number;
  defaultTimeoutMs: number;
  enableAuditLogging: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  input: string;
  analysis: IntentAnalysis;
  workflow?: AgentWorkflow;
  reasoning: string;
  agentId: AgentId;
}

export class IntentRouterAgentImpl extends BaseAgentImpl implements IntentRouterAgent {
  private routerConfig: IntentRouterConfig;
  private auditLog: AuditLogEntry[] = [];
  private activeWorkflows: Map<string, ExecutionPlan> = new Map();
  private registeredAgents: Map<AgentType, AgentId> = new Map();

  constructor(config: Partial<IntentRouterConfig> = {}) {
    const fullConfig: IntentRouterConfig = {
      id: config.id || uuidv4(),
      name: config.name || 'Intent Router Agent',
      type: AgentType.INTENT_ROUTER,
      version: config.version || '1.0.0',
      capabilities: [
        'intent_analysis',
        'agent_routing',
        'workflow_orchestration',
        'conflict_resolution',
        'audit_logging'
      ],
      maxConcurrentTasks: config.maxConcurrentTasks || 10,
      timeoutMs: config.timeoutMs || 30000,
      enableSandbox: config.enableSandbox ?? false,
      confidenceThreshold: config.confidenceThreshold || 0.7,
      maxWorkflowSteps: config.maxWorkflowSteps || 20,
      defaultTimeoutMs: config.defaultTimeoutMs || 60000,
      enableAuditLogging: config.enableAuditLogging ?? true
    };

    super(fullConfig);
    this.routerConfig = fullConfig;
  }

  protected async onInitialize(): Promise<void> {
    // Initialize intent patterns and agent registry
    this.emit('intent-router-initialized');
  }

  protected async onShutdown(): Promise<void> {
    // Clean up active workflows
    for (const [workflowId, plan] of this.activeWorkflows) {
      this.emit('workflow-cancelled', { workflowId, reason: 'agent_shutdown' });
    }
    this.activeWorkflows.clear();
  }

  protected async onHealthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; message?: string; lastCheck: Date }> {
    return {
      status: this.activeWorkflows.size > this.routerConfig.maxWorkflowSteps ? 'degraded' : 'healthy',
      message: `Active workflows: ${this.activeWorkflows.size}`,
      lastCheck: new Date()
    };
  }

  protected async handleRequest(message: any): Promise<any> {
    const { action, payload } = message;
    
    switch (action) {
      case 'analyze_intent':
        return this.analyzeIntent(payload.input);
      case 'route_to_agents':
        return this.routeToAgents(payload.intent);
      case 'orchestrate_workflow':
        return this.orchestrateWorkflow(payload.workflow);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  protected async handleEvent(message: any): Promise<void> {
    this.emit('event-received', message);
  }

  protected async handleError(message: any): Promise<void> {
    this.emit('error-received', message);
  }

  protected override createSandbox() {
    // Intent router operates in a restricted sandbox
    return undefined as any; // Simplified for base implementation
  }

  /**
   * Analyze user intent from natural language input
   * Requirement 1.1: Analyze request and identify primary intent category
   */
  public async analyzeIntent(userInput: string): Promise<IntentAnalysis> {
    if (!userInput || userInput.trim().length === 0) {
      throw new Error('User input cannot be empty');
    }

    const normalizedInput = userInput.toLowerCase().trim();
    
    // Classify primary intent
    const intentScores = this.calculateIntentScores(normalizedInput);
    const primaryIntent = this.determinePrimaryIntent(intentScores);
    const secondaryIntents = this.determineSecondaryIntents(intentScores, primaryIntent);
    
    // Determine complexity
    const complexity = this.assessComplexity(normalizedInput);
    
    // Get required agents
    const requiredAgents = this.determineRequiredAgents(primaryIntent, secondaryIntents, complexity);
    
    // Assess risk level
    const riskLevel = this.assessRiskLevel(primaryIntent, normalizedInput);
    
    // Calculate confidence
    const confidence = intentScores[primaryIntent] || 0;
    
    // Generate reasoning
    const reasoning = this.generateReasoning(
      userInput, 
      primaryIntent, 
      secondaryIntents, 
      confidence
    );

    // Extract parameters
    const parameters = this.extractParameters(normalizedInput, primaryIntent);

    const analysis: IntentAnalysis = {
      primaryIntent,
      secondaryIntents,
      complexity,
      requiredAgents,
      estimatedDuration: this.estimateDuration(complexity, requiredAgents.length),
      riskLevel,
      confidence,
      reasoning,
      parameters
    };

    // Audit logging
    if (this.routerConfig.enableAuditLogging) {
      this.logAuditEntry('intent_analysis', userInput, analysis, reasoning);
    }

    this.emit('intent-analyzed', analysis);
    return analysis;
  }

  /**
   * Route to appropriate agents based on intent analysis
   * Requirement 1.2: Orchestrate agent sequence and dependencies
   */
  public async routeToAgents(intent: IntentAnalysis): Promise<AgentWorkflow> {
    const workflowId = uuidv4();
    
    // Build workflow steps based on required agents
    const steps = this.buildWorkflowSteps(intent);
    
    // Determine dependencies between steps
    const dependencies = this.calculateDependencies(steps, intent);
    
    // Calculate parallel execution opportunities
    const parallelGroups = this.identifyParallelGroups(steps, dependencies);

    const workflow: AgentWorkflow = {
      id: workflowId,
      name: `Workflow for ${intent.primaryIntent}`,
      steps,
      dependencies,
      parallelGroups,
      intent,
      createdAt: new Date(),
      status: 'pending'
    };

    // Audit logging
    if (this.routerConfig.enableAuditLogging) {
      const reasoning = `Routed to ${intent.requiredAgents.length} agents: ${intent.requiredAgents.join(', ')}`;
      this.logAuditEntry('agent_routing', JSON.stringify(intent), intent, reasoning, workflow);
    }

    this.emit('workflow-created', workflow);
    return workflow;
  }

  /**
   * Orchestrate workflow execution
   * Requirement 1.2: Implement coordination and conflict resolution
   */
  public async orchestrateWorkflow(workflow: AgentWorkflow): Promise<ExecutionPlan> {
    const planId = uuidv4();
    
    // Create execution schedule
    const schedule = this.createExecutionSchedule(workflow);
    
    // Map dependencies
    const dependencies = this.mapExecutionDependencies(workflow);
    
    // Calculate estimated completion
    const estimatedCompletion = this.calculateEstimatedCompletion(schedule);

    const plan: ExecutionPlan = {
      id: planId,
      workflow,
      schedule,
      dependencies,
      estimatedCompletion
    };

    this.activeWorkflows.set(planId, plan);
    
    // Audit logging
    if (this.routerConfig.enableAuditLogging) {
      const reasoning = `Created execution plan with ${schedule.length} scheduled steps`;
      this.logAuditEntry('workflow_orchestration', JSON.stringify(workflow), workflow.intent, reasoning);
    }

    this.emit('execution-plan-created', plan);
    return plan;
  }

  /**
   * Monitor execution progress
   */
  public async monitorExecution(plan: ExecutionPlan): Promise<ExecutionStatus> {
    const status: ExecutionStatus = {
      planId: plan.id,
      status: 'running',
      progress: 0,
      completedSteps: [],
      failedSteps: [],
      errors: []
    };

    // In a real implementation, this would track actual execution
    // For now, return initial status
    return status;
  }

  /**
   * Request clarification for ambiguous intents
   * Requirement 1.3: Request clarification before proceeding
   */
  public async requestClarification(
    userInput: string, 
    intent: IntentAnalysis
  ): Promise<string[]> {
    const clarificationQuestions: string[] = [];

    if (intent.confidence < this.routerConfig.confidenceThreshold) {
      clarificationQuestions.push(
        `I'm not entirely sure what you'd like me to do. Could you clarify if you want me to ${this.intentToAction(intent.primaryIntent)}?`
      );
    }

    if (intent.secondaryIntents.length > 2) {
      clarificationQuestions.push(
        `Your request seems to involve multiple tasks. Which would you like me to focus on first: ${intent.secondaryIntents.slice(0, 3).map(i => this.intentToAction(i)).join(', ')}?`
      );
    }

    if (intent.riskLevel === RiskLevel.HIGH || intent.riskLevel === RiskLevel.CRITICAL) {
      clarificationQuestions.push(
        `This operation involves ${intent.riskLevel} risk. Are you sure you want to proceed?`
      );
    }

    // Audit logging for clarification request
    if (this.routerConfig.enableAuditLogging && clarificationQuestions.length > 0) {
      this.logAuditEntry(
        'clarification_requested',
        userInput,
        intent,
        `Requested clarification due to: confidence=${intent.confidence}, risk=${intent.riskLevel}`
      );
    }

    return clarificationQuestions;
  }

  /**
   * Register an agent for routing
   */
  public registerAgent(agentType: AgentType, agentId: AgentId): void {
    this.registeredAgents.set(agentType, agentId);
    this.emit('agent-registered', { agentType, agentId });
  }

  /**
   * Get audit log
   */
  public getAuditLog(): AuditLogEntry[] {
    return [...this.auditLog];
  }

  // Private helper methods

  private calculateIntentScores(input: string): Record<IntentCategory, number> {
    const scores: Record<IntentCategory, number> = {} as Record<IntentCategory, number>;

    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      let score = 0;
      let matches = 0;

      for (const pattern of patterns) {
        if (pattern.test(input)) {
          matches++;
          score += 1 / patterns.length;
        }
      }

      scores[intent as IntentCategory] = score;
    }

    return scores;
  }

  private determinePrimaryIntent(scores: Record<IntentCategory, number>): IntentCategory {
    let maxScore = 0;
    let primaryIntent = IntentCategory.CODE_GENERATION; // Default

    for (const [intent, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        primaryIntent = intent as IntentCategory;
      }
    }

    return primaryIntent;
  }

  private determineSecondaryIntents(
    scores: Record<IntentCategory, number>,
    primaryIntent: IntentCategory
  ): IntentCategory[] {
    return Object.entries(scores)
      .filter(([intent, score]) => intent !== primaryIntent && score > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([intent]) => intent as IntentCategory);
  }

  private assessComplexity(input: string): ComplexityLevel {
    for (const pattern of COMPLEXITY_INDICATORS.high) {
      if (pattern.test(input)) return ComplexityLevel.HIGH;
    }
    for (const pattern of COMPLEXITY_INDICATORS.medium) {
      if (pattern.test(input)) return ComplexityLevel.MEDIUM;
    }
    for (const pattern of COMPLEXITY_INDICATORS.low) {
      if (pattern.test(input)) return ComplexityLevel.LOW;
    }
    return ComplexityLevel.MEDIUM; // Default
  }

  private determineRequiredAgents(
    primaryIntent: IntentCategory,
    secondaryIntents: IntentCategory[],
    complexity: ComplexityLevel
  ): AgentType[] {
    const agents = new Set<AgentType>();

    // Add primary intent agents
    const primaryAgents = INTENT_TO_AGENTS[primaryIntent] || [];
    primaryAgents.forEach(agent => agents.add(agent));

    // Add secondary intent agents for complex tasks
    if (complexity === ComplexityLevel.HIGH || complexity === ComplexityLevel.MEDIUM) {
      for (const secondaryIntent of secondaryIntents.slice(0, 2)) {
        const secondaryAgents = INTENT_TO_AGENTS[secondaryIntent] || [];
        secondaryAgents.forEach(agent => agents.add(agent));
      }
    }

    // Always include audit agent for traceability
    agents.add(AgentType.AUDIT_AGENT);

    return Array.from(agents);
  }

  private assessRiskLevel(intent: IntentCategory, input: string): RiskLevel {
    // High risk for DeFi operations
    if (intent === IntentCategory.DEFI_OPERATION) {
      if (/\b(mainnet|production|real\s+money|live)\b/i.test(input)) {
        return RiskLevel.CRITICAL;
      }
      return RiskLevel.HIGH;
    }

    // High risk for deployment
    if (intent === IntentCategory.DEPLOYMENT) {
      if (/\b(production|prod)\b/i.test(input)) {
        return RiskLevel.HIGH;
      }
      return RiskLevel.MEDIUM;
    }

    // Security validation is medium risk
    if (intent === IntentCategory.SECURITY_VALIDATION) {
      return RiskLevel.MEDIUM;
    }

    // Code generation and refactoring
    if (intent === IntentCategory.CODE_GENERATION || intent === IntentCategory.REFACTORING) {
      return RiskLevel.LOW;
    }

    return RiskLevel.LOW;
  }

  private estimateDuration(complexity: ComplexityLevel, agentCount: number): number {
    const baseTime: Record<ComplexityLevel, number> = {
      [ComplexityLevel.LOW]: 5000,
      [ComplexityLevel.MEDIUM]: 15000,
      [ComplexityLevel.HIGH]: 30000,
      [ComplexityLevel.CRITICAL]: 60000
    };

    return baseTime[complexity] * Math.max(1, agentCount * 0.5);
  }

  private generateReasoning(
    input: string,
    primaryIntent: IntentCategory,
    secondaryIntents: IntentCategory[],
    confidence: number
  ): string {
    let reasoning = `Analyzed input and identified primary intent as "${primaryIntent}" with ${(confidence * 100).toFixed(1)}% confidence. `;
    
    if (secondaryIntents.length > 0) {
      reasoning += `Secondary intents detected: ${secondaryIntents.join(', ')}. `;
    }
    
    reasoning += `Routing to appropriate agents for execution.`;
    
    return reasoning;
  }

  private extractParameters(input: string, intent: IntentCategory): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // Extract numbers
    const numbers = input.match(/\d+(\.\d+)?/g);
    if (numbers) {
      params.numbers = numbers.map(Number);
    }

    // Extract quoted strings
    const quotes = input.match(/"[^"]+"|'[^']+'/g);
    if (quotes) {
      params.quotedStrings = quotes.map(q => q.slice(1, -1));
    }

    // Extract file extensions
    const extensions = input.match(/\.\w{1,10}\b/g);
    if (extensions) {
      params.fileExtensions = extensions;
    }

    // Extract programming languages
    const languages = input.match(/\b(typescript|javascript|python|rust|go|java|c\+\+|solidity)\b/gi);
    if (languages) {
      params.languages = languages.map(l => l.toLowerCase());
    }

    return params;
  }

  private buildWorkflowSteps(intent: IntentAnalysis): WorkflowStep[] {
    const steps: WorkflowStep[] = [];
    let stepOrder = 0;

    for (const agentType of intent.requiredAgents) {
      const step: WorkflowStep = {
        id: uuidv4(),
        agentType,
        action: this.determineAction(agentType, intent.primaryIntent),
        order: stepOrder++,
        timeout: this.routerConfig.defaultTimeoutMs,
        required: agentType !== AgentType.AUDIT_AGENT,
        parameters: intent.parameters
      };
      steps.push(step);
    }

    return steps;
  }

  private determineAction(agentType: AgentType, intent: IntentCategory): string {
    const actionMap: Record<AgentType, Record<IntentCategory, string>> = {
      [AgentType.INTENT_ROUTER]: {
        [IntentCategory.CODE_GENERATION]: 'route_request',
        [IntentCategory.TESTING]: 'route_request',
        [IntentCategory.SECURITY_VALIDATION]: 'route_request',
        [IntentCategory.RESEARCH]: 'route_request',
        [IntentCategory.SYSTEM_DESIGN]: 'route_request',
        [IntentCategory.REFACTORING]: 'route_request',
        [IntentCategory.DEBUGGING]: 'route_request',
        [IntentCategory.DEPLOYMENT]: 'route_request',
        [IntentCategory.DEFI_OPERATION]: 'route_request'
      },
      [AgentType.PRODUCT_ARCHITECT]: {
        [IntentCategory.CODE_GENERATION]: 'design_architecture',
        [IntentCategory.SYSTEM_DESIGN]: 'create_design',
        [IntentCategory.REFACTORING]: 'analyze_structure',
        [IntentCategory.TESTING]: 'design_test_architecture',
        [IntentCategory.SECURITY_VALIDATION]: 'review_security_design',
        [IntentCategory.RESEARCH]: 'design_research_plan',
        [IntentCategory.DEBUGGING]: 'analyze_architecture',
        [IntentCategory.DEPLOYMENT]: 'design_deployment',
        [IntentCategory.DEFI_OPERATION]: 'design_defi_workflow'
      },
      [AgentType.CODE_ENGINEER]: {
        [IntentCategory.CODE_GENERATION]: 'generate_code',
        [IntentCategory.REFACTORING]: 'refactor_code',
        [IntentCategory.DEBUGGING]: 'fix_bugs',
        [IntentCategory.TESTING]: 'implement_tests',
        [IntentCategory.SYSTEM_DESIGN]: 'implement_design',
        [IntentCategory.SECURITY_VALIDATION]: 'implement_security',
        [IntentCategory.RESEARCH]: 'implement_prototype',
        [IntentCategory.DEPLOYMENT]: 'prepare_deployment',
        [IntentCategory.DEFI_OPERATION]: 'implement_contract'
      },
      [AgentType.TEST_AGENT]: {
        [IntentCategory.TESTING]: 'run_tests',
        [IntentCategory.CODE_GENERATION]: 'generate_tests',
        [IntentCategory.DEBUGGING]: 'diagnose_issues',
        [IntentCategory.REFACTORING]: 'validate_refactoring',
        [IntentCategory.SYSTEM_DESIGN]: 'test_design',
        [IntentCategory.SECURITY_VALIDATION]: 'security_tests',
        [IntentCategory.RESEARCH]: 'test_findings',
        [IntentCategory.DEPLOYMENT]: 'test_deployment',
        [IntentCategory.DEFI_OPERATION]: 'test_contract'
      },
      [AgentType.SECURITY_VALIDATOR]: {
        [IntentCategory.SECURITY_VALIDATION]: 'validate_security',
        [IntentCategory.DEFI_OPERATION]: 'validate_defi_safety',
        [IntentCategory.CODE_GENERATION]: 'security_review',
        [IntentCategory.DEPLOYMENT]: 'validate_deployment',
        [IntentCategory.TESTING]: 'security_scan',
        [IntentCategory.SYSTEM_DESIGN]: 'security_review',
        [IntentCategory.RESEARCH]: 'security_research',
        [IntentCategory.REFACTORING]: 'security_review',
        [IntentCategory.DEBUGGING]: 'vulnerability_scan'
      },
      [AgentType.RESEARCH_AGENT]: {
        [IntentCategory.RESEARCH]: 'conduct_research',
        [IntentCategory.DEFI_OPERATION]: 'research_protocols',
        [IntentCategory.CODE_GENERATION]: 'research_best_practices',
        [IntentCategory.SECURITY_VALIDATION]: 'research_vulnerabilities',
        [IntentCategory.SYSTEM_DESIGN]: 'research_patterns',
        [IntentCategory.TESTING]: 'research_testing',
        [IntentCategory.REFACTORING]: 'research_improvements',
        [IntentCategory.DEBUGGING]: 'research_solutions',
        [IntentCategory.DEPLOYMENT]: 'research_deployment'
      },
      [AgentType.AUDIT_AGENT]: {
        [IntentCategory.CODE_GENERATION]: 'log_generation',
        [IntentCategory.TESTING]: 'log_testing',
        [IntentCategory.SECURITY_VALIDATION]: 'log_security',
        [IntentCategory.RESEARCH]: 'log_research',
        [IntentCategory.SYSTEM_DESIGN]: 'log_design',
        [IntentCategory.REFACTORING]: 'log_refactoring',
        [IntentCategory.DEBUGGING]: 'log_debugging',
        [IntentCategory.DEPLOYMENT]: 'log_deployment',
        [IntentCategory.DEFI_OPERATION]: 'log_defi_operation'
      }
    };

    return actionMap[agentType]?.[intent] || 'execute_action';
  }

  private calculateDependencies(
    steps: WorkflowStep[],
    intent: IntentAnalysis
  ): Array<{ stepId: string; dependsOn: string[] }> {
    const dependencies: Array<{ stepId: string; dependsOn: string[] }> = [];

    // Build dependency graph based on agent types
    const stepsByAgent = new Map<AgentType, WorkflowStep[]>();
    for (const step of steps) {
      const existing = stepsByAgent.get(step.agentType) || [];
      existing.push(step);
      stepsByAgent.set(step.agentType, existing);
    }

    for (const step of steps) {
      const deps: string[] = [];

      // Code engineer depends on product architect
      if (step.agentType === AgentType.CODE_ENGINEER) {
        const architectSteps = stepsByAgent.get(AgentType.PRODUCT_ARCHITECT) || [];
        deps.push(...architectSteps.map(s => s.id));
      }

      // Test agent depends on code engineer
      if (step.agentType === AgentType.TEST_AGENT) {
        const codeSteps = stepsByAgent.get(AgentType.CODE_ENGINEER) || [];
        deps.push(...codeSteps.map(s => s.id));
      }

      // Audit agent depends on all other steps
      if (step.agentType === AgentType.AUDIT_AGENT) {
        deps.push(...steps.filter(s => s.agentType !== AgentType.AUDIT_AGENT).map(s => s.id));
      }

      dependencies.push({ stepId: step.id, dependsOn: deps });
    }

    return dependencies;
  }

  private identifyParallelGroups(
    steps: WorkflowStep[],
    dependencies: Array<{ stepId: string; dependsOn: string[] }>
  ): string[][] {
    const groups: string[][] = [];
    const processed = new Set<string>();

    while (processed.size < steps.length) {
      const currentGroup: string[] = [];

      for (const step of steps) {
        if (processed.has(step.id)) continue;

        const deps = dependencies.find(d => d.stepId === step.id)?.dependsOn || [];
        const allDepsProcessed = deps.every(d => processed.has(d));

        if (allDepsProcessed) {
          currentGroup.push(step.id);
        }
      }

      if (currentGroup.length === 0) break; // Prevent infinite loop

      groups.push(currentGroup);
      currentGroup.forEach(id => processed.add(id));
    }

    return groups;
  }

  private createExecutionSchedule(workflow: AgentWorkflow): ExecutionSchedule[] {
    const schedule: ExecutionSchedule[] = [];
    let currentTime = new Date();

    for (const group of workflow.parallelGroups) {
      const groupStart = new Date(currentTime);
      let maxDuration = 0;

      for (const stepId of group) {
        const step = workflow.steps.find(s => s.id === stepId);
        if (!step) continue;

        const agentId = this.registeredAgents.get(step.agentType) || step.agentType;

        schedule.push({
          stepId,
          agentId,
          scheduledStart: new Date(groupStart),
          estimatedDuration: step.timeout,
          priority: step.required ? 1 : 0
        });

        maxDuration = Math.max(maxDuration, step.timeout);
      }

      currentTime = new Date(currentTime.getTime() + maxDuration);
    }

    return schedule;
  }

  private mapExecutionDependencies(workflow: AgentWorkflow): ExecutionDependency[] {
    return workflow.dependencies.map(dep => ({
      stepId: dep.stepId,
      dependsOn: dep.dependsOn,
      type: 'blocking' as const
    }));
  }

  private calculateEstimatedCompletion(schedule: ExecutionSchedule[]): Date {
    if (schedule.length === 0) return new Date();

    const lastScheduled = schedule.reduce((latest, current) => {
      const endTime = current.scheduledStart.getTime() + current.estimatedDuration;
      return endTime > latest ? endTime : latest;
    }, 0);

    return new Date(lastScheduled);
  }

  private logAuditEntry(
    action: string,
    input: string,
    analysis: IntentAnalysis,
    reasoning: string,
    workflow?: AgentWorkflow
  ): void {
    const entry: AuditLogEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      action,
      input,
      analysis,
      workflow,
      reasoning,
      agentId: this.id
    };

    this.auditLog.push(entry);
    this.emit('audit-log-entry', entry);
  }

  private intentToAction(intent: IntentCategory): string {
    const actionMap: Record<IntentCategory, string> = {
      [IntentCategory.CODE_GENERATION]: 'generate code',
      [IntentCategory.TESTING]: 'create tests',
      [IntentCategory.SECURITY_VALIDATION]: 'validate security',
      [IntentCategory.RESEARCH]: 'conduct research',
      [IntentCategory.SYSTEM_DESIGN]: 'design systems',
      [IntentCategory.REFACTORING]: 'refactor code',
      [IntentCategory.DEBUGGING]: 'debug issues',
      [IntentCategory.DEPLOYMENT]: 'deploy applications',
      [IntentCategory.DEFI_OPERATION]: 'perform DeFi operations'
    };

    return actionMap[intent] || 'perform the requested action';
  }
}

// Factory function
export function createIntentRouterAgent(config?: Partial<IntentRouterConfig>): IntentRouterAgentImpl {
  return new IntentRouterAgentImpl(config);
}
