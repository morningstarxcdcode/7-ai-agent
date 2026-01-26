/**
 * Workflow Orchestrator Implementation
 * Manages multi-agent workflow execution with dependency management and conflict resolution
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AgentId, AgentType, Priority, RiskLevel, MessageType } from '../types/core';
import { 
  AgentWorkflow, 
  WorkflowStep, 
  ExecutionPlan, 
  ExecutionStatus, 
  ExecutionSchedule,
  ExecutionDependency,
  ExecutionError,
  IntentAnalysis
} from '../types/agents';
import { MessageBus, getMessageBus } from './message-bus';
import { AgentRegistry } from './base-agent';
import { ContextStore, getContextStore, WorkflowContext } from './context-store';

export interface WorkflowOrchestratorConfig {
  maxConcurrentWorkflows: number;
  defaultStepTimeout: number;
  maxRetryAttempts: number;
  resourceAllocationTimeout: number;
  conflictResolutionTimeout: number;
  enableMetrics: boolean;
}

export interface ResourceAllocation {
  agentId: AgentId;
  agentType: AgentType;
  allocatedAt: Date;
  workflowId: string;
  stepId: string;
  priority: Priority;
  estimatedDuration: number;
}

export interface ConflictResolution {
  conflictId: string;
  type: 'resource' | 'dependency' | 'priority';
  description: string;
  affectedWorkflows: string[];
  resolution: 'queue' | 'preempt' | 'scale' | 'reject';
  resolvedAt: Date;
  reasoning: string;
}

export interface WorkflowMetrics {
  totalWorkflows: number;
  activeWorkflows: number;
  completedWorkflows: number;
  failedWorkflows: number;
  averageExecutionTime: number;
  resourceUtilization: Record<AgentType, number>;
  conflictResolutions: number;
}

export class WorkflowOrchestrator extends EventEmitter {
  private config: WorkflowOrchestratorConfig;
  private messageBus: MessageBus;
  private agentRegistry: AgentRegistry;
  private contextStore: ContextStore;
  
  private activeWorkflows: Map<string, AgentWorkflow> = new Map();
  private executionPlans: Map<string, ExecutionPlan> = new Map();
  private executionStatuses: Map<string, ExecutionStatus> = new Map();
  private resourceAllocations: Map<AgentId, ResourceAllocation> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private conflictQueue: ConflictResolution[] = [];
  private metrics: WorkflowMetrics;

  constructor(config: Partial<WorkflowOrchestratorConfig> = {}) {
    super();
    
    this.config = {
      maxConcurrentWorkflows: 50,
      defaultStepTimeout: 300000, // 5 minutes
      maxRetryAttempts: 3,
      resourceAllocationTimeout: 30000, // 30 seconds
      conflictResolutionTimeout: 60000, // 1 minute
      enableMetrics: true,
      ...config
    };

    this.messageBus = getMessageBus();
    this.agentRegistry = AgentRegistry.getInstance();
    this.contextStore = getContextStore();
    
    this.metrics = {
      totalWorkflows: 0,
      activeWorkflows: 0,
      completedWorkflows: 0,
      failedWorkflows: 0,
      averageExecutionTime: 0,
      resourceUtilization: {} as Record<AgentType, number>,
      conflictResolutions: 0
    };

    // Initialize resource utilization tracking
    Object.values(AgentType).forEach(type => {
      this.metrics.resourceUtilization[type] = 0;
    });
  }

  /**
   * Create and orchestrate a workflow
   */
  public async orchestrateWorkflow(workflow: AgentWorkflow): Promise<ExecutionPlan> {
    try {
      // Validate workflow
      this.validateWorkflow(workflow);
      
      // Check capacity
      if (this.activeWorkflows.size >= this.config.maxConcurrentWorkflows) {
        throw new Error('Maximum concurrent workflows reached');
      }

      // Create workflow context in context store
      const context = this.contextStore.createContext(
        workflow.id,
        {
          originalInput: workflow.intent?.reasoning || 'Unknown input',
          intent: workflow.intent,
          preferences: {
            riskTolerance: workflow.intent?.riskLevel || RiskLevel.MEDIUM,
            qualityLevel: 'standard',
            notificationLevel: 'standard'
          },
          constraints: [],
          acceptanceCriteria: []
        },
        {
          agentConfigurations: new Map(),
          resourceLimits: {
            maxConcurrentWorkflows: this.config.maxConcurrentWorkflows,
            maxExecutionTime: this.config.defaultStepTimeout,
            maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
            maxNetworkRequests: 1000
          },
          securityPolicies: [],
          complianceRules: []
        }
      );

      // Create execution plan
      const executionPlan = await this.createExecutionPlan(workflow);
      
      // Allocate resources
      await this.allocateResources(executionPlan);
      
      // Store workflow and plan
      this.activeWorkflows.set(workflow.id, workflow);
      this.executionPlans.set(executionPlan.id, executionPlan);
      
      // Initialize execution status
      const executionStatus: ExecutionStatus = {
        planId: executionPlan.id,
        status: 'pending',
        progress: 0,
        completedSteps: [],
        failedSteps: [],
        errors: []
      };
      this.executionStatuses.set(executionPlan.id, executionStatus);
      
      // Update context with execution plan
      this.contextStore.updateContext({
        workflowId: workflow.id,
        updates: {
          state: {
            ...context.state,
            status: 'pending'
          },
          progress: {
            ...context.progress,
            estimatedCompletion: executionPlan.estimatedCompletion
          }
        },
        source: 'orchestrator',
        reason: 'Execution plan created'
      });
      
      // Start execution
      await this.startExecution(executionPlan);
      
      // Update metrics
      this.updateMetrics();
      
      this.emit('workflow-orchestrated', { workflow, executionPlan });
      
      return executionPlan;

    } catch (error) {
      this.emit('orchestration-error', { workflow, error });
      throw error;
    }
  }

  /**
   * Monitor workflow execution
   */
  public async monitorExecution(planId: string): Promise<ExecutionStatus> {
    const status = this.executionStatuses.get(planId);
    if (!status) {
      throw new Error(`Execution plan not found: ${planId}`);
    }

    // Update status based on current step states
    await this.updateExecutionStatus(status);
    
    return { ...status };
  }

  /**
   * Cancel a workflow
   */
  public async cancelWorkflow(workflowId: string, reason: string): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Find execution plan
    const executionPlan = Array.from(this.executionPlans.values())
      .find(plan => plan.workflow.id === workflowId);
    
    if (!executionPlan) {
      throw new Error(`Execution plan not found for workflow: ${workflowId}`);
    }

    // Cancel all running steps
    await this.cancelExecutionSteps(executionPlan, reason);
    
    // Release resources
    await this.releaseWorkflowResources(workflowId);
    
    // Update status
    const status = this.executionStatuses.get(executionPlan.id);
    if (status) {
      status.status = 'cancelled';
      status.errors.push({
        stepId: 'workflow',
        agentId: 'orchestrator',
        error: `Workflow cancelled: ${reason}`,
        timestamp: new Date(),
        recoverable: false
      });
    }

    // Clean up
    this.activeWorkflows.delete(workflowId);
    this.executionPlans.delete(executionPlan.id);
    
    this.emit('workflow-cancelled', { workflowId, reason });
  }

  /**
   * Get workflow metrics
   */
  public getMetrics(): WorkflowMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get active workflows
   */
  public getActiveWorkflows(): AgentWorkflow[] {
    return Array.from(this.activeWorkflows.values());
  }

  /**
   * Get resource allocations
   */
  public getResourceAllocations(): ResourceAllocation[] {
    return Array.from(this.resourceAllocations.values());
  }

  /**
   * Get conflict resolutions
   */
  public getConflictResolutions(): ConflictResolution[] {
    return [...this.conflictQueue];
  }

  /**
   * Create execution plan from workflow
   */
  private async createExecutionPlan(workflow: AgentWorkflow): Promise<ExecutionPlan> {
    // Create execution schedule
    const schedule = await this.createExecutionSchedule(workflow);
    
    // Create execution dependencies
    const dependencies = this.createExecutionDependencies(workflow);
    
    // Estimate completion time
    const estimatedCompletion = this.estimateCompletionTime(workflow, schedule);
    
    const executionPlan: ExecutionPlan = {
      id: uuidv4(),
      workflow,
      schedule,
      dependencies,
      estimatedCompletion
    };

    return executionPlan;
  }

  /**
   * Create execution schedule for workflow steps
   */
  private async createExecutionSchedule(workflow: AgentWorkflow): Promise<ExecutionSchedule[]> {
    const schedule: ExecutionSchedule[] = [];
    
    // Build dependency graph
    const dependencyMap = new Map<string, string[]>();
    for (const dep of workflow.dependencies) {
      dependencyMap.set(dep.stepId, dep.dependsOn);
    }

    // Calculate start times based on dependencies
    const stepStartTimes = new Map<string, Date>();
    const baseTime = new Date();
    
    // Process steps in dependency order
    const processedSteps = new Set<string>();
    const queue = [...workflow.steps];
    
    while (queue.length > 0) {
      const step = queue.shift();
      if (!step) continue;
      
      const dependencies = dependencyMap.get(step.id) || [];
      const unmetDependencies = dependencies.filter(dep => !processedSteps.has(dep));
      
      if (unmetDependencies.length > 0) {
        // Put back in queue if dependencies not met
        queue.push(step);
        continue;
      }
      
      // Calculate start time based on dependencies
      let startTime = baseTime;
      for (const depId of dependencies) {
        const depSchedule = schedule.find(s => s.stepId === depId);
        if (depSchedule) {
          const depEndTime = new Date(depSchedule.scheduledStart.getTime() + depSchedule.estimatedDuration);
          if (depEndTime > startTime) {
            startTime = depEndTime;
          }
        }
      }
      
      // Find available agent
      const agentId = await this.findAvailableAgent(step.agentType, startTime);
      
      const scheduleItem: ExecutionSchedule = {
        stepId: step.id,
        agentId,
        scheduledStart: startTime,
        estimatedDuration: step.timeout || this.config.defaultStepTimeout,
        priority: this.calculateStepPriority(step, workflow.intent)
      };
      
      schedule.push(scheduleItem);
      stepStartTimes.set(step.id, startTime);
      processedSteps.add(step.id);
    }
    
    return schedule.sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime());
  }

  /**
   * Create execution dependencies
   */
  private createExecutionDependencies(workflow: AgentWorkflow): ExecutionDependency[] {
    return workflow.dependencies.map(dep => ({
      stepId: dep.stepId,
      dependsOn: dep.dependsOn,
      type: 'blocking' as const
    }));
  }

  /**
   * Estimate workflow completion time
   */
  private estimateCompletionTime(workflow: AgentWorkflow, schedule: ExecutionSchedule[]): Date {
    if (schedule.length === 0) {
      return new Date();
    }
    
    // Find the latest completion time
    let latestCompletion = new Date();
    
    for (const item of schedule) {
      const completionTime = new Date(item.scheduledStart.getTime() + item.estimatedDuration);
      if (completionTime > latestCompletion) {
        latestCompletion = completionTime;
      }
    }
    
    // Add buffer for coordination overhead
    const bufferMs = Math.min(60000, schedule.length * 5000); // Max 1 minute buffer
    return new Date(latestCompletion.getTime() + bufferMs);
  }

  /**
   * Allocate resources for execution plan
   */
  private async allocateResources(executionPlan: ExecutionPlan): Promise<void> {
    const allocations: ResourceAllocation[] = [];
    
    for (const scheduleItem of executionPlan.schedule) {
      // Check if agent is available
      const existingAllocation = this.resourceAllocations.get(scheduleItem.agentId);
      
      if (existingAllocation) {
        // Handle resource conflict
        const resolution = await this.resolveResourceConflict(
          scheduleItem,
          existingAllocation,
          executionPlan
        );
        
        if (resolution.resolution === 'reject') {
          throw new Error(`Resource allocation failed: ${resolution.description}`);
        }
      }
      
      // Create allocation
      const allocation: ResourceAllocation = {
        agentId: scheduleItem.agentId,
        agentType: this.getAgentType(scheduleItem.agentId),
        allocatedAt: new Date(),
        workflowId: executionPlan.workflow.id,
        stepId: scheduleItem.stepId,
        priority: scheduleItem.priority,
        estimatedDuration: scheduleItem.estimatedDuration
      };
      
      allocations.push(allocation);
      this.resourceAllocations.set(scheduleItem.agentId, allocation);
    }
    
    this.emit('resources-allocated', { executionPlan, allocations });
  }

  /**
   * Start workflow execution
   */
  private async startExecution(executionPlan: ExecutionPlan): Promise<void> {
    const status = this.executionStatuses.get(executionPlan.id);
    if (!status) {
      throw new Error(`Execution status not found: ${executionPlan.id}`);
    }
    
    status.status = 'running';
    
    // Start executing steps based on schedule and dependencies
    await this.executeStepsInOrder(executionPlan);
    
    this.emit('execution-started', executionPlan);
  }

  /**
   * Execute workflow steps in dependency order
   */
  private async executeStepsInOrder(executionPlan: ExecutionPlan): Promise<void> {
    const { workflow, schedule, dependencies } = executionPlan;
    const completedSteps = new Set<string>();
    const runningSteps = new Map<string, Promise<void>>();
    
    // Process steps in parallel groups based on dependencies
    const processStep = async (stepId: string): Promise<void> => {
      const step = workflow.steps.find(s => s.id === stepId);
      const scheduleItem = schedule.find(s => s.stepId === stepId);
      
      if (!step || !scheduleItem) {
        throw new Error(`Step or schedule not found: ${stepId}`);
      }
      
      try {
        // Wait for dependencies
        const stepDependencies = dependencies.find(d => d.stepId === stepId);
        if (stepDependencies) {
          await Promise.all(
            stepDependencies.dependsOn.map(depId => runningSteps.get(depId))
          );
        }
        
        // Execute step
        await this.executeStep(step, scheduleItem, executionPlan);
        completedSteps.add(stepId);
        
        this.emit('step-completed', { stepId, workflowId: workflow.id });
        
      } catch (error) {
        this.emit('step-failed', { 
          stepId, 
          workflowId: workflow.id, 
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    };
    
    // Start all steps (they will wait for dependencies internally)
    for (const step of workflow.steps) {
      const stepPromise = processStep(step.id);
      runningSteps.set(step.id, stepPromise);
    }
    
    // Wait for all steps to complete
    try {
      await Promise.all(Array.from(runningSteps.values()));
      
      // Update final status
      const status = this.executionStatuses.get(executionPlan.id);
      if (status) {
        status.status = 'completed';
        status.progress = 100;
        status.completedSteps = Array.from(completedSteps);
      }
      
      this.emit('workflow-completed', { workflowId: workflow.id });
      
    } catch (error) {
      // Update failed status
      const status = this.executionStatuses.get(executionPlan.id);
      if (status) {
        status.status = 'failed';
        status.errors.push({
          stepId: 'workflow',
          agentId: 'orchestrator',
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
          recoverable: false
        });
      }
      
      this.emit('workflow-failed', { workflowId: workflow.id, error });
    } finally {
      // Clean up resources
      await this.releaseWorkflowResources(workflow.id);
      this.activeWorkflows.delete(workflow.id);
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    step: WorkflowStep,
    scheduleItem: ExecutionSchedule,
    executionPlan: ExecutionPlan
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Send execution request to agent
      const response = await this.messageBus.sendRequest(
        'orchestrator',
        scheduleItem.agentId,
        step.action,
        {
          step,
          workflowId: executionPlan.workflow.id,
          parameters: step.parameters || {}
        },
        {
          priority: scheduleItem.priority,
          timeoutMs: step.timeout || this.config.defaultStepTimeout
        }
      );
      
      // Update step with results
      step.status = 'completed';
      step.executionTime = Date.now() - startTime;
      step.outputs = response.payload.outputs as any;
      
    } catch (error) {
      step.status = 'failed';
      step.errorMessage = error instanceof Error ? error.message : String(error);
      step.executionTime = Date.now() - startTime;
      
      // Retry if configured
      if ((step.retryCount || 0) < this.config.maxRetryAttempts) {
        step.retryCount = (step.retryCount || 0) + 1;
        
        // Exponential backoff
        const delay = Math.pow(2, step.retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry execution
        return this.executeStep(step, scheduleItem, executionPlan);
      }
      
      throw error;
    }
  }

  /**
   * Find available agent for a given type and time
   */
  private async findAvailableAgent(agentType: AgentType, scheduledTime: Date): Promise<AgentId> {
    const agents = this.agentRegistry.getAgentsByType(agentType);
    
    if (agents.length === 0) {
      throw new Error(`No agents available for type: ${agentType}`);
    }
    
    // Find agent with least conflicts at scheduled time
    let bestAgent = agents[0];
    let minConflicts = Infinity;
    
    for (const agent of agents) {
      const conflicts = this.countResourceConflicts(agent.id, scheduledTime);
      if (conflicts < minConflicts) {
        minConflicts = conflicts;
        bestAgent = agent;
      }
    }
    
    return bestAgent.id;
  }

  /**
   * Count resource conflicts for an agent at a given time
   */
  private countResourceConflicts(agentId: AgentId, scheduledTime: Date): number {
    const allocation = this.resourceAllocations.get(agentId);
    if (!allocation) {
      return 0;
    }
    
    const allocationEnd = new Date(
      allocation.allocatedAt.getTime() + allocation.estimatedDuration
    );
    
    // Check if scheduled time conflicts with existing allocation
    return scheduledTime < allocationEnd ? 1 : 0;
  }

  /**
   * Calculate step priority based on workflow intent and step characteristics
   */
  private calculateStepPriority(step: WorkflowStep, intent: IntentAnalysis): number {
    let priority = Priority.MEDIUM;
    
    // Increase priority for critical risk levels
    if (intent.riskLevel === RiskLevel.CRITICAL) {
      priority = Priority.CRITICAL;
    } else if (intent.riskLevel === RiskLevel.HIGH) {
      priority = Priority.HIGH;
    }
    
    // Increase priority for required steps
    if (step.required) {
      priority = Math.max(priority, Priority.HIGH);
    }
    
    // Increase priority for security validation
    if (step.agentType === AgentType.SECURITY_VALIDATOR) {
      priority = Math.max(priority, Priority.HIGH);
    }
    
    return priority;
  }

  /**
   * Resolve resource conflicts
   */
  private async resolveResourceConflict(
    newScheduleItem: ExecutionSchedule,
    existingAllocation: ResourceAllocation,
    executionPlan: ExecutionPlan
  ): Promise<ConflictResolution> {
    const conflictId = uuidv4();
    const conflict: ConflictResolution = {
      conflictId,
      type: 'resource',
      description: `Agent ${newScheduleItem.agentId} is already allocated to workflow ${existingAllocation.workflowId}`,
      affectedWorkflows: [executionPlan.workflow.id, existingAllocation.workflowId],
      resolution: 'queue',
      resolvedAt: new Date(),
      reasoning: 'Default resolution: queue new request'
    };
    
    // Determine resolution strategy based on priorities
    if (newScheduleItem.priority > existingAllocation.priority) {
      conflict.resolution = 'preempt';
      conflict.reasoning = 'Higher priority workflow preempts existing allocation';
      
      // Preempt existing allocation
      await this.preemptAllocation(existingAllocation);
      
    } else if (newScheduleItem.priority === existingAllocation.priority) {
      // Try to find alternative agent
      const alternativeAgent = await this.findAlternativeAgent(
        newScheduleItem.agentId,
        this.getAgentType(newScheduleItem.agentId),
        newScheduleItem.scheduledStart
      );
      
      if (alternativeAgent) {
        newScheduleItem.agentId = alternativeAgent;
        conflict.resolution = 'scale';
        conflict.reasoning = 'Allocated alternative agent of same type';
      } else {
        conflict.resolution = 'queue';
        conflict.reasoning = 'No alternative agents available, queuing request';
      }
    }
    
    this.conflictQueue.push(conflict);
    this.metrics.conflictResolutions++;
    
    this.emit('conflict-resolved', conflict);
    
    return conflict;
  }

  /**
   * Preempt an existing resource allocation
   */
  private async preemptAllocation(allocation: ResourceAllocation): Promise<void> {
    // Cancel the current step
    await this.messageBus.sendMessage(
      'orchestrator',
      allocation.agentId,
      MessageType.CANCEL_STEP,
      {
        workflowId: allocation.workflowId,
        stepId: allocation.stepId,
        reason: 'Preempted by higher priority workflow'
      }
    );
    
    // Release the allocation
    this.resourceAllocations.delete(allocation.agentId);
    
    this.emit('allocation-preempted', allocation);
  }

  /**
   * Find alternative agent of the same type
   */
  private async findAlternativeAgent(
    excludeAgentId: AgentId,
    agentType: AgentType,
    scheduledTime: Date
  ): Promise<AgentId | null> {
    const agents = this.agentRegistry.getAgentsByType(agentType)
      .filter(agent => agent.id !== excludeAgentId);
    
    for (const agent of agents) {
      const conflicts = this.countResourceConflicts(agent.id, scheduledTime);
      if (conflicts === 0) {
        return agent.id;
      }
    }
    
    return null;
  }

  /**
   * Get agent type by agent ID
   */
  private getAgentType(agentId: AgentId): AgentType {
    const agent = this.agentRegistry.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    return agent.type;
  }

  /**
   * Release resources for a workflow
   */
  private async releaseWorkflowResources(workflowId: string): Promise<void> {
    const allocationsToRelease = Array.from(this.resourceAllocations.entries())
      .filter(([_, allocation]) => allocation.workflowId === workflowId);
    
    for (const [agentId, allocation] of allocationsToRelease) {
      this.resourceAllocations.delete(agentId);
      this.emit('resource-released', { agentId, allocation });
    }
  }

  /**
   * Cancel execution steps
   */
  private async cancelExecutionSteps(executionPlan: ExecutionPlan, reason: string): Promise<void> {
    const cancelPromises = executionPlan.schedule.map(async (scheduleItem) => {
      try {
        await this.messageBus.sendMessage(
          'orchestrator',
          scheduleItem.agentId,
          MessageType.CANCEL_STEP,
          {
            workflowId: executionPlan.workflow.id,
            stepId: scheduleItem.stepId,
            reason
          }
        );
      } catch (error) {
        this.emit('step-cancellation-error', { 
          stepId: scheduleItem.stepId, 
          error 
        });
      }
    });
    
    await Promise.allSettled(cancelPromises);
  }

  /**
   * Update execution status
   */
  private async updateExecutionStatus(status: ExecutionStatus): Promise<void> {
    const executionPlan = this.executionPlans.get(status.planId);
    if (!executionPlan) {
      return;
    }
    
    const workflow = executionPlan.workflow;
    const completedSteps: string[] = [];
    const failedSteps: string[] = [];
    const errors: ExecutionError[] = [];
    
    // Check status of each step
    for (const step of workflow.steps) {
      if (step.status === 'completed') {
        completedSteps.push(step.id);
      } else if (step.status === 'failed') {
        failedSteps.push(step.id);
        if (step.errorMessage) {
          errors.push({
            stepId: step.id,
            agentId: step.agentId || 'unknown',
            error: step.errorMessage,
            timestamp: new Date(),
            recoverable: (step.retryCount || 0) < this.config.maxRetryAttempts
          });
        }
      }
    }
    
    // Update status
    status.completedSteps = completedSteps;
    status.failedSteps = failedSteps;
    status.errors = errors;
    
    // Calculate progress
    status.progress = workflow.steps.length > 0 ? 
      (completedSteps.length / workflow.steps.length) * 100 : 0;
    
    // Determine overall status
    if (failedSteps.length > 0) {
      status.status = 'failed';
    } else if (completedSteps.length === workflow.steps.length) {
      status.status = 'completed';
    } else if (completedSteps.length > 0) {
      status.status = 'running';
    }
    
    // Find current step
    const currentStep = workflow.steps.find(step => 
      step.status === 'in_progress' || step.status === 'pending'
    );
    
    if (currentStep) {
      status.currentStep = currentStep.id;
    }
  }

  /**
   * Validate workflow before execution
   */
  private validateWorkflow(workflow: AgentWorkflow): void {
    if (!workflow.id) {
      throw new Error('Workflow must have an ID');
    }
    
    if (!workflow.steps || workflow.steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }
    
    // Validate step dependencies
    const stepIds = new Set(workflow.steps.map(s => s.id));
    for (const dependency of workflow.dependencies) {
      if (!stepIds.has(dependency.stepId)) {
        throw new Error(`Invalid dependency: step ${dependency.stepId} not found`);
      }
      
      for (const depId of dependency.dependsOn) {
        if (!stepIds.has(depId)) {
          throw new Error(`Invalid dependency: step ${depId} not found`);
        }
      }
    }
    
    // Check for circular dependencies
    this.checkCircularDependencies(workflow);
  }

  /**
   * Check for circular dependencies in workflow
   */
  private checkCircularDependencies(workflow: AgentWorkflow): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const dependencyMap = new Map<string, string[]>();
    for (const dep of workflow.dependencies) {
      dependencyMap.set(dep.stepId, dep.dependsOn);
    }
    
    const hasCycle = (stepId: string): boolean => {
      if (recursionStack.has(stepId)) {
        return true;
      }
      
      if (visited.has(stepId)) {
        return false;
      }
      
      visited.add(stepId);
      recursionStack.add(stepId);
      
      const dependencies = dependencyMap.get(stepId) || [];
      for (const depId of dependencies) {
        if (hasCycle(depId)) {
          return true;
        }
      }
      
      recursionStack.delete(stepId);
      return false;
    };
    
    for (const step of workflow.steps) {
      if (hasCycle(step.id)) {
        throw new Error(`Circular dependency detected involving step: ${step.id}`);
      }
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    if (!this.config.enableMetrics) {
      return;
    }
    
    this.metrics.activeWorkflows = this.activeWorkflows.size;
    
    // Calculate resource utilization
    const utilizationCounts: Record<AgentType, number> = {} as Record<AgentType, number>;
    const totalAgentCounts: Record<AgentType, number> = {} as Record<AgentType, number>;
    
    // Initialize counts
    Object.values(AgentType).forEach(type => {
      utilizationCounts[type] = 0;
      totalAgentCounts[type] = this.agentRegistry.getAgentsByType(type).length;
    });
    
    // Count allocated agents
    for (const allocation of this.resourceAllocations.values()) {
      utilizationCounts[allocation.agentType]++;
    }
    
    // Calculate utilization percentages
    Object.values(AgentType).forEach(type => {
      const total = totalAgentCounts[type];
      const used = utilizationCounts[type];
      this.metrics.resourceUtilization[type] = total > 0 ? (used / total) * 100 : 0;
    });
  }
}

// Singleton instance
let orchestratorInstance: WorkflowOrchestrator | null = null;

export function getWorkflowOrchestrator(config?: Partial<WorkflowOrchestratorConfig>): WorkflowOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new WorkflowOrchestrator(config);
  }
  return orchestratorInstance;
}

export function resetWorkflowOrchestrator(): void {
  orchestratorInstance = null;
}