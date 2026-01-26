/**
 * Workflow Orchestrator Tests
 * Tests for multi-agent workflow orchestration with dependency management and conflict resolution
 */

import { WorkflowOrchestrator, getWorkflowOrchestrator, resetWorkflowOrchestrator } from '../../src/core/workflow-orchestrator';
import { getContextStore, resetContextStore } from '../../src/core/context-store';
import { getMessageBus, resetMessageBus } from '../../src/core/message-bus';
import { AgentRegistry, BaseAgentImpl } from '../../src/core/base-agent';
import { AgentType, IntentCategory, ComplexityLevel, RiskLevel, Priority } from '../../src/types/core';
import { AgentWorkflow, WorkflowStep, IntentAnalysis, HealthStatus } from '../../src/types/agents';

// Mock agent implementation for testing
class MockAgent extends BaseAgentImpl {
  constructor(type: AgentType) {
    super({
      name: `Mock ${type} Agent`,
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
      message: 'Mock agent is healthy',
      lastCheck: new Date()
    };
  }

  protected async handleRequest(message: Record<string, unknown>): Promise<unknown> {
    const action = message['action'] as string;
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      success: true,
      action,
      outputs: {
        result: `Mock result for ${action}`,
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

describe('WorkflowOrchestrator', () => {
  let orchestrator: WorkflowOrchestrator;
  let agentRegistry: AgentRegistry;
  let mockAgents: MockAgent[];

  beforeEach(async () => {
    // Reset singletons
    resetWorkflowOrchestrator();
    resetContextStore();
    resetMessageBus();

    // Create orchestrator
    orchestrator = getWorkflowOrchestrator({
      maxConcurrentWorkflows: 10,
      defaultStepTimeout: 30000,
      maxRetryAttempts: 2,
      enableMetrics: true
    });

    // Set up agent registry with mock agents
    agentRegistry = AgentRegistry.getInstance();
    mockAgents = [];

    // Create mock agents for each type
    for (const agentType of Object.values(AgentType)) {
      const agent = new MockAgent(agentType);
      await agent.initialize();
      agentRegistry.register(agent);
      mockAgents.push(agent);
    }
  });

  afterEach(async () => {
    // Clean up agents
    for (const agent of mockAgents) {
      await agent.shutdown();
    }
    await agentRegistry.shutdownAll();
  });

  describe('Workflow Creation and Orchestration', () => {
    test('should create and orchestrate a simple workflow', async () => {
      const intent: IntentAnalysis = {
        primaryIntent: IntentCategory.CODE_GENERATION,
        secondaryIntents: [],
        complexity: ComplexityLevel.MEDIUM,
        requiredAgents: [AgentType.CODE_ENGINEER, AgentType.TEST_AGENT],
        estimatedDuration: 120000,
        riskLevel: RiskLevel.LOW,
        confidence: 0.9,
        reasoning: 'Simple code generation task',
        parameters: { language: 'typescript' }
      };

      const workflow: AgentWorkflow = {
        id: 'test-workflow-1',
        name: 'Test Code Generation Workflow',
        steps: [
          {
            id: 'step-1',
            agentType: AgentType.CODE_ENGINEER,
            action: 'generate_code',
            order: 1,
            timeout: 30000,
            required: true,
            parameters: { language: 'typescript' }
          },
          {
            id: 'step-2',
            agentType: AgentType.TEST_AGENT,
            action: 'generate_tests',
            order: 2,
            timeout: 30000,
            required: true,
            parameters: { coverage: 80 }
          }
        ],
        status: 'pending',
        dependencies: [
          {
            stepId: 'step-2',
            dependsOn: ['step-1']
          }
        ],
        parallelGroups: [['step-1'], ['step-2']],
        intent,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const executionPlan = await orchestrator.orchestrateWorkflow(workflow);

      expect(executionPlan).toBeDefined();
      expect(executionPlan.workflow.id).toBe('test-workflow-1');
      expect(executionPlan.schedule).toHaveLength(2);
      expect(executionPlan.dependencies).toHaveLength(1);
      expect(executionPlan.estimatedCompletion).toBeInstanceOf(Date);

      // Check that context was created
      const contextStore = getContextStore();
      const context = contextStore.getContext('test-workflow-1');
      expect(context).toBeDefined();
      expect(context?.workflowId).toBe('test-workflow-1');
    });

    test('should handle workflow with parallel steps', async () => {
      const intent: IntentAnalysis = {
        primaryIntent: IntentCategory.SYSTEM_DESIGN,
        secondaryIntents: [IntentCategory.RESEARCH],
        complexity: ComplexityLevel.HIGH,
        requiredAgents: [AgentType.PRODUCT_ARCHITECT, AgentType.RESEARCH_AGENT, AgentType.SECURITY_VALIDATOR],
        estimatedDuration: 300000,
        riskLevel: RiskLevel.MEDIUM,
        confidence: 0.8,
        reasoning: 'Complex system design with research',
        parameters: {}
      };

      const workflow: AgentWorkflow = {
        id: 'test-workflow-parallel',
        name: 'Parallel Workflow Test',
        steps: [
          {
            id: 'research-step',
            agentType: AgentType.RESEARCH_AGENT,
            action: 'conduct_research',
            order: 1,
            timeout: 60000,
            required: true
          },
          {
            id: 'security-step',
            agentType: AgentType.SECURITY_VALIDATOR,
            action: 'security_scan',
            order: 1,
            timeout: 60000,
            required: true
          },
          {
            id: 'design-step',
            agentType: AgentType.PRODUCT_ARCHITECT,
            action: 'generate_architecture',
            order: 2,
            timeout: 90000,
            required: true
          }
        ],
        status: 'pending',
        dependencies: [
          {
            stepId: 'design-step',
            dependsOn: ['research-step', 'security-step']
          }
        ],
        parallelGroups: [['research-step', 'security-step'], ['design-step']],
        intent,
        createdAt: new Date()
      };

      const executionPlan = await orchestrator.orchestrateWorkflow(workflow);

      expect(executionPlan.schedule).toHaveLength(3);
      
      // Check that parallel steps are scheduled appropriately
      const researchSchedule = executionPlan.schedule.find(s => s.stepId === 'research-step');
      const securitySchedule = executionPlan.schedule.find(s => s.stepId === 'security-step');
      const designSchedule = executionPlan.schedule.find(s => s.stepId === 'design-step');

      expect(researchSchedule).toBeDefined();
      expect(securitySchedule).toBeDefined();
      expect(designSchedule).toBeDefined();

      // Design step should be scheduled after research and security
      expect(designSchedule!.scheduledStart.getTime()).toBeGreaterThanOrEqual(
        Math.max(
          researchSchedule!.scheduledStart.getTime() + researchSchedule!.estimatedDuration,
          securitySchedule!.scheduledStart.getTime() + securitySchedule!.estimatedDuration
        )
      );
    });

    test('should validate workflow dependencies', async () => {
      const workflow: AgentWorkflow = {
        id: 'invalid-workflow',
        name: 'Invalid Workflow',
        steps: [
          {
            id: 'step-1',
            agentType: AgentType.CODE_ENGINEER,
            action: 'generate_code',
            order: 1,
            timeout: 30000,
            required: true
          }
        ],
        status: 'pending',
        dependencies: [
          {
            stepId: 'step-1',
            dependsOn: ['non-existent-step'] // Invalid dependency
          }
        ],
        parallelGroups: [],
        intent: {
          primaryIntent: IntentCategory.CODE_GENERATION,
          secondaryIntents: [],
          complexity: ComplexityLevel.LOW,
          requiredAgents: [AgentType.CODE_ENGINEER],
          estimatedDuration: 30000,
          riskLevel: RiskLevel.LOW,
          confidence: 0.9,
          reasoning: 'Test',
          parameters: {}
        },
        createdAt: new Date()
      };

      await expect(orchestrator.orchestrateWorkflow(workflow))
        .rejects.toThrow('Invalid dependency: step non-existent-step not found');
    });

    test('should detect circular dependencies', async () => {
      const workflow: AgentWorkflow = {
        id: 'circular-workflow',
        name: 'Circular Dependency Workflow',
        steps: [
          {
            id: 'step-1',
            agentType: AgentType.CODE_ENGINEER,
            action: 'generate_code',
            order: 1,
            timeout: 30000,
            required: true
          },
          {
            id: 'step-2',
            agentType: AgentType.TEST_AGENT,
            action: 'generate_tests',
            order: 2,
            timeout: 30000,
            required: true
          }
        ],
        status: 'pending',
        dependencies: [
          {
            stepId: 'step-1',
            dependsOn: ['step-2']
          },
          {
            stepId: 'step-2',
            dependsOn: ['step-1']
          }
        ],
        parallelGroups: [],
        intent: {
          primaryIntent: IntentCategory.CODE_GENERATION,
          secondaryIntents: [],
          complexity: ComplexityLevel.LOW,
          requiredAgents: [AgentType.CODE_ENGINEER, AgentType.TEST_AGENT],
          estimatedDuration: 60000,
          riskLevel: RiskLevel.LOW,
          confidence: 0.9,
          reasoning: 'Test circular dependency',
          parameters: {}
        },
        createdAt: new Date()
      };

      await expect(orchestrator.orchestrateWorkflow(workflow))
        .rejects.toThrow(/Circular dependency detected/);
    });
  });

  describe('Resource Allocation and Conflict Resolution', () => {
    test('should allocate resources for workflow execution', async () => {
      const workflow: AgentWorkflow = {
        id: 'resource-test-workflow',
        name: 'Resource Allocation Test',
        steps: [
          {
            id: 'step-1',
            agentType: AgentType.CODE_ENGINEER,
            action: 'generate_code',
            order: 1,
            timeout: 30000,
            required: true
          }
        ],
        status: 'pending',
        dependencies: [],
        parallelGroups: [['step-1']],
        intent: {
          primaryIntent: IntentCategory.CODE_GENERATION,
          secondaryIntents: [],
          complexity: ComplexityLevel.LOW,
          requiredAgents: [AgentType.CODE_ENGINEER],
          estimatedDuration: 30000,
          riskLevel: RiskLevel.LOW,
          confidence: 0.9,
          reasoning: 'Resource allocation test',
          parameters: {}
        },
        createdAt: new Date()
      };

      const executionPlan = await orchestrator.orchestrateWorkflow(workflow);
      
      // Check resource allocations
      const allocations = orchestrator.getResourceAllocations();
      expect(allocations).toHaveLength(1);
      expect(allocations[0].workflowId).toBe('resource-test-workflow');
      expect(allocations[0].agentType).toBe(AgentType.CODE_ENGINEER);
    });

    test('should handle resource conflicts with priority-based resolution', async () => {
      // Create first workflow with medium priority
      const workflow1: AgentWorkflow = {
        id: 'workflow-1',
        name: 'First Workflow',
        steps: [
          {
            id: 'step-1',
            agentType: AgentType.CODE_ENGINEER,
            action: 'generate_code',
            order: 1,
            timeout: 60000,
            required: true
          }
        ],
        status: 'pending',
        dependencies: [],
        parallelGroups: [['step-1']],
        intent: {
          primaryIntent: IntentCategory.CODE_GENERATION,
          secondaryIntents: [],
          complexity: ComplexityLevel.MEDIUM,
          requiredAgents: [AgentType.CODE_ENGINEER],
          estimatedDuration: 60000,
          riskLevel: RiskLevel.MEDIUM,
          confidence: 0.8,
          reasoning: 'First workflow',
          parameters: {}
        },
        createdAt: new Date()
      };

      // Create second workflow with higher priority
      const workflow2: AgentWorkflow = {
        id: 'workflow-2',
        name: 'High Priority Workflow',
        steps: [
          {
            id: 'step-1',
            agentType: AgentType.CODE_ENGINEER,
            action: 'urgent_code_fix',
            order: 1,
            timeout: 30000,
            required: true
          }
        ],
        status: 'pending',
        dependencies: [],
        parallelGroups: [['step-1']],
        intent: {
          primaryIntent: IntentCategory.DEBUGGING,
          secondaryIntents: [],
          complexity: ComplexityLevel.HIGH,
          requiredAgents: [AgentType.CODE_ENGINEER],
          estimatedDuration: 30000,
          riskLevel: RiskLevel.CRITICAL, // Higher priority
          confidence: 0.9,
          reasoning: 'Critical bug fix',
          parameters: {}
        },
        createdAt: new Date()
      };

      // Start first workflow
      await orchestrator.orchestrateWorkflow(workflow1);
      
      // Start second workflow (should handle conflict)
      const executionPlan2 = await orchestrator.orchestrateWorkflow(workflow2);
      
      expect(executionPlan2).toBeDefined();
      
      // Check conflict resolutions
      const conflicts = orchestrator.getConflictResolutions();
      expect(conflicts.length).toBeGreaterThan(0);
      
      const resourceConflict = conflicts.find(c => c.type === 'resource');
      expect(resourceConflict).toBeDefined();
    });
  });

  describe('Workflow Monitoring and Status', () => {
    test('should monitor workflow execution status', async () => {
      const workflow: AgentWorkflow = {
        id: 'monitor-test-workflow',
        name: 'Monitoring Test',
        steps: [
          {
            id: 'step-1',
            agentType: AgentType.RESEARCH_AGENT,
            action: 'conduct_research',
            order: 1,
            timeout: 30000,
            required: true
          }
        ],
        status: 'pending',
        dependencies: [],
        parallelGroups: [['step-1']],
        intent: {
          primaryIntent: IntentCategory.RESEARCH,
          secondaryIntents: [],
          complexity: ComplexityLevel.LOW,
          requiredAgents: [AgentType.RESEARCH_AGENT],
          estimatedDuration: 30000,
          riskLevel: RiskLevel.LOW,
          confidence: 0.9,
          reasoning: 'Monitoring test',
          parameters: {}
        },
        createdAt: new Date()
      };

      const executionPlan = await orchestrator.orchestrateWorkflow(workflow);
      
      // Monitor execution
      const status = await orchestrator.monitorExecution(executionPlan.id);
      
      expect(status).toBeDefined();
      expect(status.planId).toBe(executionPlan.id);
      expect(['pending', 'running', 'completed']).toContain(status.status);
      expect(status.progress).toBeGreaterThanOrEqual(0);
      expect(status.progress).toBeLessThanOrEqual(100);
    });

    test('should cancel workflow execution', async () => {
      const workflow: AgentWorkflow = {
        id: 'cancel-test-workflow',
        name: 'Cancellation Test',
        steps: [
          {
            id: 'step-1',
            agentType: AgentType.CODE_ENGINEER,
            action: 'long_running_task',
            order: 1,
            timeout: 120000,
            required: true
          }
        ],
        status: 'pending',
        dependencies: [],
        parallelGroups: [['step-1']],
        intent: {
          primaryIntent: IntentCategory.CODE_GENERATION,
          secondaryIntents: [],
          complexity: ComplexityLevel.HIGH,
          requiredAgents: [AgentType.CODE_ENGINEER],
          estimatedDuration: 120000,
          riskLevel: RiskLevel.MEDIUM,
          confidence: 0.8,
          reasoning: 'Cancellation test',
          parameters: {}
        },
        createdAt: new Date()
      };

      const executionPlan = await orchestrator.orchestrateWorkflow(workflow);
      
      // Cancel workflow
      await orchestrator.cancelWorkflow('cancel-test-workflow', 'Test cancellation');
      
      // Check that workflow is no longer active
      const activeWorkflows = orchestrator.getActiveWorkflows();
      expect(activeWorkflows.find(w => w.id === 'cancel-test-workflow')).toBeUndefined();
    });
  });

  describe('Metrics and Performance', () => {
    test('should track workflow metrics', async () => {
      const workflow: AgentWorkflow = {
        id: 'metrics-test-workflow',
        name: 'Metrics Test',
        steps: [
          {
            id: 'step-1',
            agentType: AgentType.AUDIT_AGENT,
            action: 'log_audit',
            order: 1,
            timeout: 10000,
            required: true
          }
        ],
        status: 'pending',
        dependencies: [],
        parallelGroups: [['step-1']],
        intent: {
          primaryIntent: IntentCategory.SYSTEM_DESIGN,
          secondaryIntents: [],
          complexity: ComplexityLevel.LOW,
          requiredAgents: [AgentType.AUDIT_AGENT],
          estimatedDuration: 10000,
          riskLevel: RiskLevel.LOW,
          confidence: 0.9,
          reasoning: 'Metrics test',
          parameters: {}
        },
        createdAt: new Date()
      };

      await orchestrator.orchestrateWorkflow(workflow);
      
      const metrics = orchestrator.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.totalWorkflows).toBeGreaterThan(0);
      expect(metrics.activeWorkflows).toBeGreaterThanOrEqual(0);
      expect(metrics.resourceUtilization).toBeDefined();
      expect(typeof metrics.resourceUtilization[AgentType.AUDIT_AGENT]).toBe('number');
    });

    test('should handle maximum concurrent workflows limit', async () => {
      // Create orchestrator with low limit
      const limitedOrchestrator = new WorkflowOrchestrator({
        maxConcurrentWorkflows: 1,
        defaultStepTimeout: 30000
      });

      const createWorkflow = (id: string): AgentWorkflow => ({
        id,
        name: `Test Workflow ${id}`,
        steps: [
          {
            id: 'step-1',
            agentType: AgentType.RESEARCH_AGENT,
            action: 'conduct_research',
            order: 1,
            timeout: 60000,
            required: true
          }
        ],
        status: 'pending',
        dependencies: [],
        parallelGroups: [['step-1']],
        intent: {
          primaryIntent: IntentCategory.RESEARCH,
          secondaryIntents: [],
          complexity: ComplexityLevel.LOW,
          requiredAgents: [AgentType.RESEARCH_AGENT],
          estimatedDuration: 60000,
          riskLevel: RiskLevel.LOW,
          confidence: 0.9,
          reasoning: 'Limit test',
          parameters: {}
        },
        createdAt: new Date()
      });

      // First workflow should succeed
      await limitedOrchestrator.orchestrateWorkflow(createWorkflow('workflow-1'));
      
      // Second workflow should fail due to limit
      await expect(limitedOrchestrator.orchestrateWorkflow(createWorkflow('workflow-2')))
        .rejects.toThrow('Maximum concurrent workflows reached');
    });
  });

  describe('Context Store Integration', () => {
    test('should create and update workflow context', async () => {
      const workflow: AgentWorkflow = {
        id: 'context-test-workflow',
        name: 'Context Integration Test',
        steps: [
          {
            id: 'step-1',
            agentType: AgentType.PRODUCT_ARCHITECT,
            action: 'generate_architecture',
            order: 1,
            timeout: 30000,
            required: true
          }
        ],
        status: 'pending',
        dependencies: [],
        parallelGroups: [['step-1']],
        intent: {
          primaryIntent: IntentCategory.SYSTEM_DESIGN,
          secondaryIntents: [],
          complexity: ComplexityLevel.MEDIUM,
          requiredAgents: [AgentType.PRODUCT_ARCHITECT],
          estimatedDuration: 30000,
          riskLevel: RiskLevel.MEDIUM,
          confidence: 0.8,
          reasoning: 'Context integration test',
          parameters: {}
        },
        createdAt: new Date()
      };

      await orchestrator.orchestrateWorkflow(workflow);
      
      // Check that context was created and updated
      const contextStore = getContextStore();
      const context = contextStore.getContext('context-test-workflow');
      
      expect(context).toBeDefined();
      expect(context?.workflowId).toBe('context-test-workflow');
      expect(context?.state.status).toBe('running');
      expect(context?.requirements.intent.primaryIntent).toBe(IntentCategory.SYSTEM_DESIGN);
    });
  });
});