/**
 * Agent Orchestrator
 * Central coordination hub that wires all agents together
 * 
 * Requirements: Task 16 - Integration Wiring
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  AgentType,
  AgentMessage,
  AgentConfig,
  AgentWorkflow,
  WorkflowStep,
  IntentCategory
} from '../types/agents';
import { MessageBus } from '../core/message-bus';
import { BaseAgentImpl } from '../core/base-agent';
import { createIntentRouterAgent, IntentRouterAgentImpl } from '../agents/intent-router/intent-router';
import { createProductArchitectAgent, ProductArchitectAgentImpl } from '../agents/product-architect/product-architect';
import { createCodeEngineerAgent, CodeEngineerAgentImpl } from '../agents/code-engineer/code-engineer';
import { createTestAutoFixAgent, TestAutoFixAgentImpl } from '../agents/test-agent/test-agent';
import { createSecurityValidatorAgent, SecurityValidatorAgentImpl } from '../agents/security-validator/security-validator';
import { createResearchAgent, ResearchAgentImpl } from '../agents/research-agent/research-agent';
import { createAuditAgent, AuditAgentImpl } from '../agents/audit-agent/audit-agent';
import { AgentHookSystem, createAgentHookSystem } from '../hooks/agent-hooks';
import { SteeringSystem, createSteeringSystem } from '../steering/steering-system';
import { DeFiSafetyModule, createDeFiSafetyModule } from '../defi/defi-safety';
import { MultiPlatformIntegration, createMultiPlatformIntegration } from '../integrations/platform-integration';

// Workflow execution types
export interface WorkflowExecution {
  id: string;
  workflow: AgentWorkflow;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentStep: number;
  results: Map<string, unknown>;
  errors: string[];
  startedAt: Date;
  completedAt?: Date;
  metadata: Record<string, unknown>;
}

export interface OrchestratorConfig {
  enableDeFi: boolean;
  enableMultiPlatform: boolean;
  maxConcurrentWorkflows: number;
  defaultTimeout: number;
  autoRetry: boolean;
  retryAttempts: number;
  humanApprovalRequired: boolean;
  auditEnabled: boolean;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  enableDeFi: true,
  enableMultiPlatform: true,
  maxConcurrentWorkflows: 5,
  defaultTimeout: 300000, // 5 minutes
  autoRetry: true,
  retryAttempts: 3,
  humanApprovalRequired: false,
  auditEnabled: true
};

export class AgentOrchestrator extends EventEmitter {
  private config: OrchestratorConfig;
  private messageBus: MessageBus;
  private agents: Map<AgentType, BaseAgentImpl> = new Map();
  private workflows: Map<string, WorkflowExecution> = new Map();
  private hookSystem: AgentHookSystem;
  private steeringSystem: SteeringSystem;
  private defiSafety?: DeFiSafetyModule;
  private platformIntegration?: MultiPlatformIntegration;
  private initialized = false;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.messageBus = new MessageBus();
    this.hookSystem = createAgentHookSystem();
    this.steeringSystem = createSteeringSystem();

    if (this.config.enableDeFi) {
      this.defiSafety = createDeFiSafetyModule();
    }

    if (this.config.enableMultiPlatform) {
      this.platformIntegration = createMultiPlatformIntegration();
    }
  }

  /**
   * Initialize the orchestrator and all agents
   */
  async initialize(): Promise<void> {
    this.emit('initializing');

    // Create all agents
    const intentRouter = createIntentRouterAgent();
    const productArchitect = createProductArchitectAgent();
    const codeEngineer = createCodeEngineerAgent();
    const testAgent = createTestAutoFixAgent();
    const securityValidator = createSecurityValidatorAgent();
    const researchAgent = createResearchAgent();
    const auditAgent = createAuditAgent();

    // Register agents
    this.agents.set(AgentType.INTENT_ROUTER, intentRouter as BaseAgentImpl);
    this.agents.set(AgentType.PRODUCT_ARCHITECT, productArchitect as BaseAgentImpl);
    this.agents.set(AgentType.CODE_ENGINEER, codeEngineer as BaseAgentImpl);
    this.agents.set(AgentType.TEST_AGENT, testAgent as BaseAgentImpl);
    this.agents.set(AgentType.SECURITY_VALIDATOR, securityValidator as BaseAgentImpl);
    this.agents.set(AgentType.RESEARCH_AGENT, researchAgent as BaseAgentImpl);
    this.agents.set(AgentType.AUDIT_AGENT, auditAgent as BaseAgentImpl);

    // Initialize all agents
    for (const [type, agent] of this.agents) {
      await agent.initialize();
      this.steeringSystem.registerAgent(String(type), type);
      this.emit('agent-initialized', { type });
    }

    // Set up message bus subscriptions
    this.setupMessageRouting();

    // Set up hooks
    this.setupHooks();

    // Initialize platform integration if enabled
    if (this.platformIntegration) {
      await this.platformIntegration.initialize();
    }

    this.initialized = true;
    this.emit('initialized', { agentCount: this.agents.size });
  }

  /**
   * Shutdown the orchestrator
   */
  async shutdown(): Promise<void> {
    this.emit('shutting-down');

    // Shutdown all agents
    for (const [type, agent] of this.agents) {
      await agent.shutdown();
      this.emit('agent-shutdown', { type });
    }

    // Shutdown platform integration
    if (this.platformIntegration) {
      await this.platformIntegration.shutdown();
    }

    this.agents.clear();
    this.workflows.clear();
    this.initialized = false;
    this.emit('shutdown');
  }

  /**
   * Process a user request
   */
  async processRequest(request: string, context?: Record<string, unknown>): Promise<{
    workflowId: string;
    intent: IntentCategory;
    workflow: AgentWorkflow;
  }> {
    if (!this.initialized) {
      throw new Error('Orchestrator not initialized');
    }

    // Get intent router
    const intentRouter = this.agents.get(AgentType.INTENT_ROUTER) as IntentRouterAgentImpl;
    if (!intentRouter) {
      throw new Error('Intent router not available');
    }

    // Analyze intent
    const intentAnalysis = await intentRouter.analyzeIntent(request, context);

    // Route to agents and create workflow
    const routingResult = await intentRouter.routeToAgents(request, context);

    // Start workflow execution
    const execution = await this.startWorkflow(routingResult.workflow);

    this.emit('request-processed', {
      request,
      intent: intentAnalysis.category,
      workflowId: execution.id
    });

    return {
      workflowId: execution.id,
      intent: intentAnalysis.category,
      workflow: routingResult.workflow
    };
  }

  /**
   * Start executing a workflow
   */
  async startWorkflow(workflow: AgentWorkflow): Promise<WorkflowExecution> {
    // Check concurrent workflow limit
    const runningWorkflows = Array.from(this.workflows.values())
      .filter(w => w.status === 'running').length;
    
    if (runningWorkflows >= this.config.maxConcurrentWorkflows) {
      throw new Error('Maximum concurrent workflows reached');
    }

    const execution: WorkflowExecution = {
      id: uuidv4(),
      workflow,
      status: 'pending',
      currentStep: 0,
      results: new Map(),
      errors: [],
      startedAt: new Date(),
      metadata: {}
    };

    this.workflows.set(execution.id, execution);
    this.emit('workflow-created', { workflowId: execution.id, workflow });

    // Start execution asynchronously
    this.executeWorkflow(execution).catch(error => {
      execution.status = 'failed';
      execution.errors.push(error.message);
      this.emit('workflow-failed', { workflowId: execution.id, error: error.message });
    });

    return execution;
  }

  /**
   * Execute workflow steps
   */
  private async executeWorkflow(execution: WorkflowExecution): Promise<void> {
    execution.status = 'running';
    this.emit('workflow-started', { workflowId: execution.id });

    const { workflow } = execution;

    // Execute steps in order, respecting parallel groups
    let currentGroup = 0;
    const groupedSteps = this.groupStepsByParallelGroup(workflow.steps);

    for (const [group, steps] of groupedSteps) {
      if (execution.status !== 'running') break;

      execution.currentStep = group;
      this.emit('workflow-step-group-started', { workflowId: execution.id, group, steps: steps.length });

      // Execute steps in parallel within group
      const stepPromises = steps.map(step => this.executeStep(execution, step));
      const results = await Promise.allSettled(stepPromises);

      // Check results
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const step = steps[i];

        if (result.status === 'fulfilled') {
          execution.results.set(step.id, result.value);
        } else {
          execution.errors.push(`Step ${step.id} failed: ${result.reason}`);
          
          if (step.required) {
            execution.status = 'failed';
            this.emit('workflow-failed', { 
              workflowId: execution.id, 
              error: `Required step ${step.id} failed` 
            });
            return;
          }
        }
      }

      currentGroup++;
    }

    if (execution.status === 'running') {
      execution.status = 'completed';
      execution.completedAt = new Date();
      this.emit('workflow-completed', { 
        workflowId: execution.id, 
        results: Object.fromEntries(execution.results) 
      });
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(execution: WorkflowExecution, step: WorkflowStep): Promise<unknown> {
    const agent = this.agents.get(step.agentType);
    if (!agent) {
      throw new Error(`Agent ${step.agentType} not available`);
    }

    // Check steering system for agent status
    const agentId = String(step.agentType);
    const agentState = this.steeringSystem.getAgentState(agentId);
    if (agentState?.status === 'paused') {
      throw new Error(`Agent ${step.agentType} is paused`);
    }
    if (agentState?.status === 'stopped') {
      throw new Error(`Agent ${step.agentType} is stopped`);
    }

    // Execute pre-action hooks
    await this.hookSystem.executeHooks('pre-action', {
      agentType: step.agentType,
      action: step.action,
      parameters: step.parameters
    });

    // Request approval if required
    if (this.config.humanApprovalRequired) {
      const approved = await this.hookSystem.requestApproval(
        `Execute ${step.action} on ${step.agentType}`,
        step.parameters,
        30000
      );
      if (!approved) {
        throw new Error('Human approval denied');
      }
    }

    this.emit('step-started', { 
      workflowId: execution.id, 
      stepId: step.id, 
      agentType: step.agentType 
    });

    try {
      // Execute the step based on agent type
      const result = await this.dispatchToAgent(step);

      // Execute post-action hooks
      await this.hookSystem.executeHooks('post-action', {
        agentType: step.agentType,
        action: step.action,
        result
      });

      this.emit('step-completed', { 
        workflowId: execution.id, 
        stepId: step.id, 
        result 
      });

      return result;
    } catch (error) {
      this.emit('step-failed', { 
        workflowId: execution.id, 
        stepId: step.id, 
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Dispatch action to appropriate agent
   */
  private async dispatchToAgent(step: WorkflowStep): Promise<unknown> {
    const { agentType, action, parameters } = step;

    switch (agentType) {
      case AgentType.PRODUCT_ARCHITECT: {
        const agent = this.agents.get(agentType) as ProductArchitectAgentImpl;
        switch (action) {
          case 'generateArchitecture':
            return agent.generateArchitecture(
              parameters?.requirements as string || '',
              parameters?.type as string || 'microservices'
            );
          case 'createUXFlows':
            return agent.createUXFlows(parameters?.requirements as string || '');
          case 'specifyComponents':
            return agent.specifyComponents(parameters as any);
          default:
            throw new Error(`Unknown action ${action} for ${agentType}`);
        }
      }

      case AgentType.CODE_ENGINEER: {
        const agent = this.agents.get(agentType) as CodeEngineerAgentImpl;
        switch (action) {
          case 'generateCode':
            return agent.generateCode(parameters as any);
          case 'refactorCode':
            return agent.refactorCode(
              parameters?.code as string || '',
              parameters?.language as string || 'typescript',
              parameters?.instructions as string || ''
            );
          default:
            throw new Error(`Unknown action ${action} for ${agentType}`);
        }
      }

      case AgentType.TEST_AGENT: {
        const agent = this.agents.get(agentType) as TestAutoFixAgentImpl;
        switch (action) {
          case 'generateTests':
            return agent.generateTests(
              parameters?.code as string || '',
              parameters?.language as string || 'typescript',
              parameters?.testTypes as string[] || ['unit']
            );
          case 'runTests':
            return agent.runTests(parameters?.testFile as string || '');
          default:
            throw new Error(`Unknown action ${action} for ${agentType}`);
        }
      }

      case AgentType.SECURITY_VALIDATOR: {
        const agent = this.agents.get(agentType) as SecurityValidatorAgentImpl;
        switch (action) {
          case 'scanVulnerabilities':
            return agent.scanVulnerabilities(
              parameters?.code as string || '',
              parameters?.language as string || 'typescript'
            );
          case 'checkCompliance':
            return agent.checkCompliance(
              parameters?.code as string || '',
              parameters?.framework as string || 'OWASP'
            );
          default:
            throw new Error(`Unknown action ${action} for ${agentType}`);
        }
      }

      case AgentType.RESEARCH_AGENT: {
        const agent = this.agents.get(agentType) as ResearchAgentImpl;
        switch (action) {
          case 'research':
            return agent.research(parameters?.topic as string || '');
          case 'getBestPractices':
            return agent.getBestPractices(
              parameters?.domain as string || '',
              parameters?.context as Record<string, unknown>
            );
          default:
            throw new Error(`Unknown action ${action} for ${agentType}`);
        }
      }

      case AgentType.AUDIT_AGENT: {
        const agent = this.agents.get(agentType) as AuditAgentImpl;
        switch (action) {
          case 'generateAuditReport':
            return agent.generateAuditReport(
              parameters?.startDate as Date || new Date(Date.now() - 86400000),
              parameters?.endDate as Date || new Date()
            );
          default:
            throw new Error(`Unknown action ${action} for ${agentType}`);
        }
      }

      default:
        throw new Error(`Unknown agent type: ${agentType}`);
    }
  }

  /**
   * Group workflow steps by parallel execution group
   */
  private groupStepsByParallelGroup(steps: WorkflowStep[]): Map<number, WorkflowStep[]> {
    const groups = new Map<number, WorkflowStep[]>();
    
    for (const step of steps) {
      const group = step.order;
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)!.push(step);
    }

    return new Map([...groups.entries()].sort((a, b) => a[0] - b[0]));
  }

  /**
   * Set up message routing between agents
   */
  private setupMessageRouting(): void {
    // Subscribe each agent to their messages
    for (const [type, agent] of this.agents) {
      this.messageBus.subscribe(type, async (message: AgentMessage) => {
        await agent.handleMessage(message);
      });
    }

    // Set up cross-agent communication
    this.messageBus.on('message', (message: AgentMessage) => {
      this.emit('agent-message', message);
    });
  }

  /**
   * Set up default hooks
   */
  private setupHooks(): void {
    // Add logging hook
    this.hookSystem.onPreAction(async (context) => {
      this.emit('hook-pre-action', context);
      return { continue: true };
    });

    this.hookSystem.onPostAction(async (context) => {
      this.emit('hook-post-action', context);
      return { continue: true };
    });

    // Add security check hook
    this.hookSystem.onSecurityCheck(async (context) => {
      const securityAgent = this.agents.get(AgentType.SECURITY_VALIDATOR) as SecurityValidatorAgentImpl;
      if (securityAgent && context.code) {
        const vulnerabilities = await securityAgent.scanVulnerabilities(
          context.code as string,
          context.language as string || 'typescript'
        );
        
        const hasCritical = vulnerabilities.some(v => v.severity === 'critical');
        return { 
          continue: !hasCritical,
          reason: hasCritical ? 'Critical security vulnerabilities detected' : undefined
        };
      }
      return { continue: true };
    });

    // Add DeFi safety hook if enabled
    if (this.defiSafety) {
      this.hookSystem.registerHook({
        id: 'defi-safety-check',
        name: 'DeFi Safety Check',
        type: 'pre-action',
        priority: 100,
        enabled: true,
        handler: async (context) => {
          if (context.isDeFi && context.value) {
            const mevResult = this.defiSafety!.analyzeMEVRisk({
              transactionType: context.transactionType || 'swap',
              value: BigInt(context.value as string)
            });

            if (mevResult.riskLevel === 'critical') {
              return { 
                continue: false, 
                reason: 'Critical MEV risk detected'
              };
            }
          }
          return { continue: true };
        }
      });
    }
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus(workflowId: string): WorkflowExecution | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Pause a workflow
   */
  async pauseWorkflow(workflowId: string): Promise<void> {
    const execution = this.workflows.get(workflowId);
    if (execution && execution.status === 'running') {
      execution.status = 'paused';
      this.emit('workflow-paused', { workflowId });
    }
  }

  /**
   * Resume a workflow
   */
  async resumeWorkflow(workflowId: string): Promise<void> {
    const execution = this.workflows.get(workflowId);
    if (execution && execution.status === 'paused') {
      execution.status = 'running';
      this.emit('workflow-resumed', { workflowId });
      // Continue execution from current step
      this.executeWorkflow(execution).catch(error => {
        execution.status = 'failed';
        execution.errors.push(error.message);
      });
    }
  }

  /**
   * Cancel a workflow
   */
  async cancelWorkflow(workflowId: string): Promise<void> {
    const execution = this.workflows.get(workflowId);
    if (execution && (execution.status === 'running' || execution.status === 'paused')) {
      execution.status = 'cancelled';
      execution.completedAt = new Date();
      this.emit('workflow-cancelled', { workflowId });
    }
  }

  /**
   * Get agent by type
   */
  getAgent<T extends BaseAgentImpl>(type: AgentType): T | undefined {
    return this.agents.get(type) as T;
  }

  /**
   * Get all agent types
   */
  getAgentTypes(): AgentType[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Get DeFi safety module
   */
  getDeFiSafety(): DeFiSafetyModule | undefined {
    return this.defiSafety;
  }

  /**
   * Get platform integration
   */
  getPlatformIntegration(): MultiPlatformIntegration | undefined {
    return this.platformIntegration;
  }

  /**
   * Get steering system
   */
  getSteeringSystem(): SteeringSystem {
    return this.steeringSystem;
  }

  /**
   * Get hook system
   */
  getHookSystem(): AgentHookSystem {
    return this.hookSystem;
  }

  /**
   * Send message to agent
   */
  async sendMessage(to: AgentType, message: Omit<AgentMessage, 'id' | 'timestamp' | 'to'>): Promise<void> {
    const fullMessage: AgentMessage = {
      ...message,
      id: uuidv4(),
      timestamp: new Date(),
      to
    };

    await this.messageBus.publish(to, fullMessage);
  }

  /**
   * Direct agent interaction
   */
  async interactWithAgent<T>(
    agentType: AgentType,
    action: string,
    params: Record<string, unknown>
  ): Promise<T> {
    const step: WorkflowStep = {
      id: uuidv4(),
      agentType,
      action,
      parameters: params,
      order: 0,
      timeout: this.config.defaultTimeout,
      required: true
    };

    return await this.dispatchToAgent(step) as T;
  }
}

// Factory function
export function createAgentOrchestrator(config?: Partial<OrchestratorConfig>): AgentOrchestrator {
  return new AgentOrchestrator(config);
}
