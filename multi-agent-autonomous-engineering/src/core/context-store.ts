/**
 * Shared Context Store Implementation
 * Provides centralized state management for multi-agent workflows
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AgentId, AgentType, RiskLevel } from '../types/core';
import { AgentWorkflow, ExecutionPlan, ExecutionStatus, IntentAnalysis } from '../types/agents';

export interface WorkflowContext {
  id: string;
  workflowId: string;
  state: WorkflowState;
  progress: WorkflowProgress;
  requirements: UserRequirements;
  configuration: SystemConfiguration;
  decisions: DecisionHistory[];
  riskAssessment: RiskAssessment;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowState {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep?: string;
  completedSteps: string[];
  failedSteps: string[];
  activeAgents: AgentId[];
  resourceAllocations: ResourceAllocation[];
  dependencies: DependencyState[];
}

export interface WorkflowProgress {
  percentage: number;
  estimatedCompletion: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  milestones: Milestone[];
  blockers: Blocker[];
}

export interface UserRequirements {
  originalInput: string;
  intent: IntentAnalysis;
  preferences: UserPreferences;
  constraints: Constraint[];
  acceptanceCriteria: string[];
}

export interface UserPreferences {
  riskTolerance: RiskLevel;
  timeConstraints?: Date;
  qualityLevel: 'basic' | 'standard' | 'premium';
  notificationLevel: 'minimal' | 'standard' | 'verbose';
}

export interface Constraint {
  type: 'time' | 'resource' | 'quality' | 'security' | 'compliance';
  description: string;
  value: unknown;
  mandatory: boolean;
}

export interface SystemConfiguration {
  agentConfigurations: Map<AgentType, AgentConfiguration>;
  resourceLimits: ResourceLimits;
  securityPolicies: SecurityPolicy[];
  complianceRules: ComplianceRule[];
}

export interface AgentConfiguration {
  agentType: AgentType;
  enabled: boolean;
  maxConcurrentTasks: number;
  timeout: number;
  retryPolicy: RetryPolicy;
  customSettings: Record<string, unknown>;
}

export interface ResourceLimits {
  maxConcurrentWorkflows: number;
  maxExecutionTime: number;
  maxMemoryUsage: number;
  maxNetworkRequests: number;
}

export interface SecurityPolicy {
  id: string;
  name: string;
  rules: SecurityRule[];
  enforcement: 'strict' | 'advisory';
}

export interface SecurityRule {
  condition: string;
  action: 'allow' | 'deny' | 'require_approval';
  reason: string;
}

export interface ComplianceRule {
  id: string;
  name: string;
  requirement: string;
  validation: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface DecisionHistory {
  id: string;
  timestamp: Date;
  agentId: AgentId;
  decision: string;
  reasoning: string;
  alternatives: string[];
  confidence: number;
  outcome?: string;
}

export interface RiskAssessment {
  overallRisk: RiskLevel;
  riskFactors: RiskFactor[];
  mitigations: Mitigation[];
  approvals: Approval[];
  lastUpdated: Date;
}

export interface RiskFactor {
  type: string;
  description: string;
  likelihood: number;
  impact: number;
  severity: RiskLevel;
  source: AgentId;
}

export interface Mitigation {
  riskFactorId: string;
  strategy: string;
  implementation: string;
  effectiveness: number;
  status: 'planned' | 'implemented' | 'verified';
}

export interface Approval {
  id: string;
  type: 'human' | 'automated';
  approver: string;
  decision: 'approved' | 'rejected' | 'pending';
  reason: string;
  timestamp: Date;
}

export interface ResourceAllocation {
  agentId: AgentId;
  agentType: AgentType;
  allocatedAt: Date;
  estimatedDuration: number;
  actualDuration?: number;
  status: 'allocated' | 'active' | 'completed' | 'released';
}

export interface DependencyState {
  stepId: string;
  dependsOn: string[];
  status: 'waiting' | 'ready' | 'satisfied';
  blockedBy: string[];
}

export interface Milestone {
  id: string;
  name: string;
  description: string;
  targetDate: Date;
  actualDate?: Date;
  status: 'pending' | 'completed' | 'missed';
  dependencies: string[];
}

export interface Blocker {
  id: string;
  type: 'dependency' | 'resource' | 'approval' | 'error';
  description: string;
  affectedSteps: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  resolvedAt?: Date;
  resolution?: string;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
}

export interface ContextQuery {
  workflowId?: string;
  agentId?: AgentId;
  status?: string[];
  riskLevel?: RiskLevel[];
  timeRange?: {
    start: Date;
    end: Date;
  };
}

export interface ContextUpdate {
  workflowId: string;
  updates: Partial<WorkflowContext>;
  source: AgentId;
  reason: string;
}

export class ContextStore extends EventEmitter {
  private contexts: Map<string, WorkflowContext> = new Map();
  private workflowIndex: Map<string, string> = new Map(); // workflowId -> contextId
  private agentIndex: Map<AgentId, Set<string>> = new Map(); // agentId -> contextIds
  private stateHistory: Map<string, WorkflowContext[]> = new Map();
  private maxHistorySize = 100;

  /**
   * Create a new workflow context
   */
  public createContext(
    workflowId: string,
    requirements: UserRequirements,
    configuration: SystemConfiguration
  ): WorkflowContext {
    const contextId = uuidv4();
    
    const context: WorkflowContext = {
      id: contextId,
      workflowId,
      state: {
        status: 'pending',
        completedSteps: [],
        failedSteps: [],
        activeAgents: [],
        resourceAllocations: [],
        dependencies: []
      },
      progress: {
        percentage: 0,
        estimatedCompletion: new Date(Date.now() + 300000), // Default 5 minutes
        milestones: [],
        blockers: []
      },
      requirements,
      configuration,
      decisions: [],
      riskAssessment: {
        overallRisk: requirements.intent.riskLevel,
        riskFactors: [],
        mitigations: [],
        approvals: [],
        lastUpdated: new Date()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store context
    this.contexts.set(contextId, context);
    this.workflowIndex.set(workflowId, contextId);
    
    // Initialize history
    this.stateHistory.set(contextId, [{ ...context }]);
    
    this.emit('context-created', context);
    
    return context;
  }

  /**
   * Get workflow context by workflow ID
   */
  public getContext(workflowId: string): WorkflowContext | undefined {
    const contextId = this.workflowIndex.get(workflowId);
    if (!contextId) {
      return undefined;
    }
    
    return this.contexts.get(contextId);
  }

  /**
   * Get context by context ID
   */
  public getContextById(contextId: string): WorkflowContext | undefined {
    return this.contexts.get(contextId);
  }

  /**
   * Update workflow context
   */
  public updateContext(update: ContextUpdate): WorkflowContext {
    const context = this.getContext(update.workflowId);
    if (!context) {
      throw new Error(`Context not found for workflow: ${update.workflowId}`);
    }

    // Create updated context
    const updatedContext: WorkflowContext = {
      ...context,
      ...update.updates,
      updatedAt: new Date()
    };

    // Validate state consistency
    this.validateStateConsistency(updatedContext);

    // Store updated context
    this.contexts.set(context.id, updatedContext);
    
    // Update history
    this.addToHistory(context.id, updatedContext);
    
    // Update indices if needed
    this.updateIndices(updatedContext, update.source);
    
    this.emit('context-updated', {
      context: updatedContext,
      source: update.source,
      reason: update.reason
    });
    
    return updatedContext;
  }

  /**
   * Query contexts based on criteria
   */
  public queryContexts(query: ContextQuery): WorkflowContext[] {
    let results = Array.from(this.contexts.values());

    if (query.workflowId) {
      results = results.filter(ctx => ctx.workflowId === query.workflowId);
    }

    if (query.agentId) {
      const contextIds = this.agentIndex.get(query.agentId) || new Set();
      results = results.filter(ctx => contextIds.has(ctx.id));
    }

    if (query.status && query.status.length > 0) {
      results = results.filter(ctx => query.status!.includes(ctx.state.status));
    }

    if (query.riskLevel && query.riskLevel.length > 0) {
      results = results.filter(ctx => query.riskLevel!.includes(ctx.riskAssessment.overallRisk));
    }

    if (query.timeRange) {
      results = results.filter(ctx => 
        ctx.createdAt >= query.timeRange!.start && 
        ctx.createdAt <= query.timeRange!.end
      );
    }

    return results;
  }

  /**
   * Add decision to context
   */
  public addDecision(
    workflowId: string,
    agentId: AgentId,
    decision: string,
    reasoning: string,
    alternatives: string[] = [],
    confidence: number = 1.0
  ): void {
    const context = this.getContext(workflowId);
    if (!context) {
      throw new Error(`Context not found for workflow: ${workflowId}`);
    }

    const decisionEntry: DecisionHistory = {
      id: uuidv4(),
      timestamp: new Date(),
      agentId,
      decision,
      reasoning,
      alternatives,
      confidence
    };

    context.decisions.push(decisionEntry);
    context.updatedAt = new Date();

    this.contexts.set(context.id, context);
    this.addToHistory(context.id, context);

    this.emit('decision-added', { context, decision: decisionEntry });
  }

  /**
   * Update risk assessment
   */
  public updateRiskAssessment(
    workflowId: string,
    riskFactors: RiskFactor[],
    mitigations: Mitigation[] = []
  ): void {
    const context = this.getContext(workflowId);
    if (!context) {
      throw new Error(`Context not found for workflow: ${workflowId}`);
    }

    // Calculate overall risk
    const overallRisk = this.calculateOverallRisk(riskFactors);

    context.riskAssessment = {
      overallRisk,
      riskFactors,
      mitigations,
      approvals: context.riskAssessment.approvals,
      lastUpdated: new Date()
    };

    context.updatedAt = new Date();
    this.contexts.set(context.id, context);
    this.addToHistory(context.id, context);

    this.emit('risk-updated', { context, riskAssessment: context.riskAssessment });
  }

  /**
   * Add approval to context
   */
  public addApproval(
    workflowId: string,
    approval: Omit<Approval, 'id' | 'timestamp'>
  ): void {
    const context = this.getContext(workflowId);
    if (!context) {
      throw new Error(`Context not found for workflow: ${workflowId}`);
    }

    const approvalEntry: Approval = {
      id: uuidv4(),
      timestamp: new Date(),
      ...approval
    };

    context.riskAssessment.approvals.push(approvalEntry);
    context.updatedAt = new Date();

    this.contexts.set(context.id, context);
    this.addToHistory(context.id, context);

    this.emit('approval-added', { context, approval: approvalEntry });
  }

  /**
   * Get context history
   */
  public getContextHistory(contextId: string): WorkflowContext[] {
    return this.stateHistory.get(contextId) || [];
  }

  /**
   * Rollback context to previous state
   */
  public rollbackContext(contextId: string, steps: number = 1): WorkflowContext {
    const history = this.stateHistory.get(contextId);
    if (!history || history.length <= steps) {
      throw new Error(`Cannot rollback ${steps} steps - insufficient history`);
    }

    const targetState = history[history.length - 1 - steps];
    const rolledBackContext = { ...targetState, updatedAt: new Date() };

    this.contexts.set(contextId, rolledBackContext);
    this.addToHistory(contextId, rolledBackContext);

    this.emit('context-rolled-back', { context: rolledBackContext, steps });

    return rolledBackContext;
  }

  /**
   * Delete context
   */
  public deleteContext(workflowId: string): void {
    const context = this.getContext(workflowId);
    if (!context) {
      return;
    }

    // Clean up indices
    this.workflowIndex.delete(workflowId);
    this.contexts.delete(context.id);
    this.stateHistory.delete(context.id);

    // Clean up agent index
    for (const [agentId, contextIds] of this.agentIndex.entries()) {
      contextIds.delete(context.id);
      if (contextIds.size === 0) {
        this.agentIndex.delete(agentId);
      }
    }

    this.emit('context-deleted', { workflowId, contextId: context.id });
  }

  /**
   * Get system metrics
   */
  public getMetrics(): Record<string, unknown> {
    const contexts = Array.from(this.contexts.values());
    
    const statusCounts = contexts.reduce((acc, ctx) => {
      acc[ctx.state.status] = (acc[ctx.state.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const riskCounts = contexts.reduce((acc, ctx) => {
      acc[ctx.riskAssessment.overallRisk] = (acc[ctx.riskAssessment.overallRisk] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalContexts: contexts.length,
      statusDistribution: statusCounts,
      riskDistribution: riskCounts,
      averageDecisions: contexts.reduce((sum, ctx) => sum + ctx.decisions.length, 0) / contexts.length,
      activeAgents: this.agentIndex.size,
      memoryUsage: {
        contexts: this.contexts.size,
        historyEntries: Array.from(this.stateHistory.values()).reduce((sum, hist) => sum + hist.length, 0)
      }
    };
  }

  /**
   * Clear all contexts (for testing/cleanup)
   */
  public clear(): void {
    this.contexts.clear();
    this.workflowIndex.clear();
    this.agentIndex.clear();
    this.stateHistory.clear();
    
    this.emit('contexts-cleared');
  }

  /**
   * Validate state consistency
   */
  private validateStateConsistency(context: WorkflowContext): void {
    // Check that completed steps don't overlap with failed steps
    const completedSet = new Set(context.state.completedSteps);
    const failedSet = new Set(context.state.failedSteps);
    
    for (const stepId of completedSet) {
      if (failedSet.has(stepId)) {
        throw new Error(`Step ${stepId} cannot be both completed and failed`);
      }
    }

    // Check that active agents are valid
    for (const agentId of context.state.activeAgents) {
      if (!agentId || typeof agentId !== 'string') {
        throw new Error(`Invalid agent ID: ${agentId}`);
      }
    }

    // Check that risk assessment is consistent
    if (context.riskAssessment.riskFactors.length === 0 && 
        context.riskAssessment.overallRisk === RiskLevel.CRITICAL) {
      throw new Error('Critical risk level requires at least one risk factor');
    }
  }

  /**
   * Update indices when context changes
   */
  private updateIndices(context: WorkflowContext, sourceAgent: AgentId): void {
    // Update agent index
    let agentContexts = this.agentIndex.get(sourceAgent);
    if (!agentContexts) {
      agentContexts = new Set();
      this.agentIndex.set(sourceAgent, agentContexts);
    }
    agentContexts.add(context.id);

    // Update for active agents
    for (const agentId of context.state.activeAgents) {
      let agentContexts = this.agentIndex.get(agentId);
      if (!agentContexts) {
        agentContexts = new Set();
        this.agentIndex.set(agentId, agentContexts);
      }
      agentContexts.add(context.id);
    }
  }

  /**
   * Add context to history
   */
  private addToHistory(contextId: string, context: WorkflowContext): void {
    let history = this.stateHistory.get(contextId);
    if (!history) {
      history = [];
      this.stateHistory.set(contextId, history);
    }

    history.push({ ...context });

    // Trim history if too large
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }
  }

  /**
   * Calculate overall risk from risk factors
   */
  private calculateOverallRisk(riskFactors: RiskFactor[]): RiskLevel {
    if (riskFactors.length === 0) {
      return RiskLevel.LOW;
    }

    // Find highest risk level
    let maxRisk: RiskLevel = RiskLevel.LOW;
    for (const factor of riskFactors) {
      if (factor.severity === RiskLevel.CRITICAL) {
        return RiskLevel.CRITICAL;
      }
      if (factor.severity === RiskLevel.HIGH && maxRisk !== RiskLevel.HIGH) {
        maxRisk = RiskLevel.HIGH;
      }
      if (factor.severity === RiskLevel.MEDIUM && maxRisk === RiskLevel.LOW) {
        maxRisk = RiskLevel.MEDIUM;
      }
    }

    return maxRisk;
  }
}

// Singleton instance
let contextStoreInstance: ContextStore | null = null;

export function getContextStore(): ContextStore {
  if (!contextStoreInstance) {
    contextStoreInstance = new ContextStore();
  }
  return contextStoreInstance;
}

export function resetContextStore(): void {
  if (contextStoreInstance) {
    contextStoreInstance.clear();
  }
  contextStoreInstance = null;
}