/**
 * Workflow Integration Tests
 * Tests the complete workflow orchestration system integration
 */

import { IntentRouter } from '../../src/agents/intent-router';
import { getWorkflowOrchestrator, resetWorkflowOrchestrator } from '../../src/core/workflow-orchestrator';
import { getContextStore, resetContextStore } from '../../src/core/context-store';
import { getMessageBus, resetMessageBus } from '../../src/core/message-bus';
import { AgentRegistry, BaseAgentImpl } from '../../src/core/base-agent';
import { AgentType, IntentCategory, ComplexityLevel, RiskLevel } from '../../src/types/core';
import { HealthStatus } from '../../src/types/agents';

// Mock agent for testing
class TestAgent extends BaseAgentImpl {
  constructor(type: AgentType) {
    super({
      name: `Test ${type} Agent`,
      type,
      version: '1.0.0',
      capabilities: ['test'],
      maxConcurrentTasks: 5,
      timeoutMs: 30000,
      enableSandbox: false
    });
  }

  protected async onInitialize(): Promise<void> {
    // Mock initialization
  }

  protected async onShutdown(): Promise<void> {
    // Mock shutdown
  }

  protected async onHealthCheck(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      message: 'Test agent is healthy',
      lastCheck: new Date()
    };
  }

  protected async handleRequest(message: Record<string, unknown>): Promise<unknown> {
    const action = message['action'] as string;
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return {
      success: true,
      action,
      outputs: {
        result: `Test result for ${action}`,
        timestamp: new Date().toISOString()
      }
    };
  }

  protected async handleEvent(message: Record<string, unknown>): Promise<void> {
    // Mock event handling
  }

  protected async handleError(message: Record<string, unknown>): Promise<void> {
    // Mock error handling
  }
}

describe('Workflow Integration Tests', () => {
  let intentRouter: IntentRouter;
  let agentRegistry: AgentRegistry;
  let testAgents: TestAgent[];

  beforeEach(async () => {
    // Reset all singletons
    resetWorkflowOrchestrator();
    resetContextStore();
    resetMessageBus();

    // Create Intent Router
    intentRouter = new IntentRouter({
      maxWorkflowsPerAgent: 10,
      defaultTimeoutMs: 30000,
      enableAdvancedNLP: false,
      confidenceThreshold: 0.6
    });

    // Set up agent registry with test agents
    agentRegistry = AgentRegistry.getInstance();
    testAgents = [];

    // Create test agents for each type
    for (const agentType of Object.values(AgentType)) {
      const agent = new TestAgent(agentType);
      await agent.initialize();
      agentRegistry.register(agent);
      testAgents.push(agent);
    }

    // Initialize Intent Router
    await intentRouter.initialize();
    agentRegistry.register(intentRouter);
  });

  afterEach(async () => {
    // Clean up agents
    for (const agent of testAgents) {
      await agent.shutdown();
    }
    await intentRouter.shutdown();
    await agentRegistry.shutdownAll();
  });

  test('should complete end-to-end workflow orchestration', async () => {
    // Test user input
    const userInput = 'Generate a TypeScript function to calculate fibonacci numbers with comprehensive tests';

    // Step 1: Analyze intent
    const intentAnalysis = await intentRouter.analyzeIntent(userInput);
    
    expect(intentAnalysis).toBeDefined();
    expect(intentAnalysis.primaryIntent).toBe(IntentCategory.CODE_GENERATION);
    expect(intentAnalysis.requiredAgents).toContain(AgentType.CODE_ENGINEER);
    expect(intentAnalysis.requiredAgents).toContain(AgentType.TEST_AGENT);

    // Step 2: Route to agents and create workflow
    const workflow = await intentRouter.routeToAgents(intentAnalysis);
    
    expect(workflow).toBeDefined();
    expect(workflow.steps.length).toBeGreaterThan(0);
    expect(workflow.intent).toEqual(intentAnalysis);

    // Step 3: Orchestrate workflow execution
    const executionPlan = await intentRouter.orchestrateWorkflow(workflow);
    
    expect(executionPlan).toBeDefined();
    expect(executionPlan.workflow.id).toBe(workflow.id);
    expect(executionPlan.schedule.length).toBeGreaterThan(0);

    // Step 4: Monitor execution
    const executionStatus = await intentRouter.monitorExecution(executionPlan);
    
    expect(executionStatus).toBeDefined();
    expect(executionStatus.planId).toBe(executionPlan.id);
    expect(['pending', 'running', 'completed']).toContain(executionStatus.status);

    // Verify context store integration
    const contextStore = getContextStore();
    const context = contextStore.getContext(workflow.id);
    
    expect(context).toBeDefined();
    expect(context?.workflowId).toBe(workflow.id);
    expect(context?.requirements.intent.primaryIntent).toBe(IntentCategory.CODE_GENERATION);
  });

  test('should handle complex multi-agent workflow with dependencies', async () => {
    const userInput = 'Design and implement a secure DeFi trading system with comprehensive testing and security validation';

    // Analyze intent
    const intentAnalysis = await intentRouter.analyzeIntent(userInput);
    
    expect(intentAnalysis.primaryIntent).toBe(IntentCategory.SYSTEM_DESIGN);
    expect(intentAnalysis.secondaryIntents).toContain(IntentCategory.SECURITY_VALIDATION);
    expect(intentAnalysis.complexity).toBe(ComplexityLevel.HIGH);
    expect(intentAnalysis.riskLevel).toBe(RiskLevel.HIGH);

    // Create workflow
    const workflow = await intentRouter.routeToAgents(intentAnalysis);
    
    expect(workflow.steps.length).toBeGreaterThan(2);
    expect(workflow.dependencies.length).toBeGreaterThan(0);

    // Orchestrate execution
    const executionPlan = await intentRouter.orchestrateWorkflow(workflow);
    
    expect(executionPlan.dependencies.length).toBeGreaterThan(0);
    
    // Verify that security validator is included for high-risk workflow
    const securityStep = workflow.steps.find(step => step.agentType === AgentType.SECURITY_VALIDATOR);
    expect(securityStep).toBeDefined();
  });

  test('should handle workflow with parallel execution groups', async () => {
    const userInput = 'Research blockchain technologies and analyze security patterns while generating documentation';

    const intentAnalysis = await intentRouter.analyzeIntent(userInput);
    const workflow = await intentRouter.routeToAgents(intentAnalysis);
    
    expect(workflow.parallelGroups.length).toBeGreaterThan(0);
    
    // Check that research and security validation can run in parallel
    const researchStep = workflow.steps.find(step => step.agentType === AgentType.RESEARCH_AGENT);
    const securityStep = workflow.steps.find(step => step.agentType === AgentType.SECURITY_VALIDATOR);
    
    if (researchStep && securityStep) {
      // These steps should be in the same parallel group or different groups with no dependencies
      const researchGroup = workflow.parallelGroups.find(group => group.includes(researchStep.id));
      const securityGroup = workflow.parallelGroups.find(group => group.includes(securityStep.id));
      
      expect(researchGroup || securityGroup).toBeDefined();
    }
  });

  test('should maintain audit trail throughout workflow execution', async () => {
    const userInput = 'Create a simple calculator function';

    const intentAnalysis = await intentRouter.analyzeIntent(userInput);
    const workflow = await intentRouter.routeToAgents(intentAnalysis);
    const executionPlan = await intentRouter.orchestrateWorkflow(workflow);

    // Verify audit agent is included
    const auditStep = workflow.steps.find(step => step.agentType === AgentType.AUDIT_AGENT);
    expect(auditStep).toBeDefined();

    // Verify context store has decision history
    const contextStore = getContextStore();
    const context = contextStore.getContext(workflow.id);
    
    expect(context).toBeDefined();
    expect(context?.decisions).toBeDefined();
  });

  test('should handle workflow cancellation', async () => {
    const userInput = 'Generate a complex machine learning model';

    const intentAnalysis = await intentRouter.analyzeIntent(userInput);
    const workflow = await intentRouter.routeToAgents(intentAnalysis);
    const executionPlan = await intentRouter.orchestrateWorkflow(workflow);

    // Cancel the workflow
    const orchestrator = getWorkflowOrchestrator();
    await orchestrator.cancelWorkflow(workflow.id, 'Test cancellation');

    // Verify workflow is no longer active
    const activeWorkflows = orchestrator.getActiveWorkflows();
    expect(activeWorkflows.find(w => w.id === workflow.id)).toBeUndefined();
  });

  test('should provide comprehensive metrics', async () => {
    const userInput = 'Test metrics collection';

    const intentAnalysis = await intentRouter.analyzeIntent(userInput);
    const workflow = await intentRouter.routeToAgents(intentAnalysis);
    await intentRouter.orchestrateWorkflow(workflow);

    // Check orchestrator metrics
    const orchestrator = getWorkflowOrchestrator();
    const metrics = orchestrator.getMetrics();
    
    expect(metrics).toBeDefined();
    expect(metrics.totalWorkflows).toBeGreaterThan(0);
    expect(metrics.resourceUtilization).toBeDefined();
    expect(typeof metrics.resourceUtilization[AgentType.CODE_ENGINEER]).toBe('number');

    // Check context store metrics
    const contextStore = getContextStore();
    const contextMetrics = contextStore.getMetrics();
    
    expect(contextMetrics).toBeDefined();
    expect(contextMetrics.totalContexts).toBeGreaterThan(0);
  });
});