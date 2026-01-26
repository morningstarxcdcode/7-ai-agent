/**
 * Steering System Implementation
 * Provides human-in-the-loop oversight and correction for agent actions
 * 
 * Requirements: Task 12 - Steering System with Human Oversight
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AgentType, AgentId, RiskLevel } from '../types/core';

// Steering command types
export type SteeringCommand = 
  | 'pause'
  | 'resume'
  | 'stop'
  | 'redirect'
  | 'modify'
  | 'approve'
  | 'reject'
  | 'rollback'
  | 'escalate'
  | 'override';

// Steering priority
export type SteeringPriority = 'immediate' | 'high' | 'normal' | 'low';

// Agent state
export type AgentState = 'idle' | 'running' | 'paused' | 'stopped' | 'error' | 'waiting-approval';

// Steering instruction
export interface SteeringInstruction {
  id: string;
  command: SteeringCommand;
  targetAgentId: AgentId;
  priority: SteeringPriority;
  reason: string;
  payload?: any;
  issuedBy: string;
  issuedAt: Date;
  expiresAt?: Date;
  status: 'pending' | 'applied' | 'rejected' | 'expired';
}

// Agent steering state
export interface AgentSteeringState {
  agentId: AgentId;
  agentType: AgentType;
  state: AgentState;
  currentTask?: string;
  progress?: number;
  lastUpdate: Date;
  pendingInstructions: SteeringInstruction[];
  constraints: SteeringConstraint[];
  overrides: SteeringOverride[];
}

// Steering constraint
export interface SteeringConstraint {
  id: string;
  type: 'value-limit' | 'rate-limit' | 'action-block' | 'resource-limit' | 'time-limit';
  description: string;
  condition: (action: any) => boolean;
  action: 'block' | 'warn' | 'require-approval';
  isActive: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

// Steering override
export interface SteeringOverride {
  id: string;
  targetAction: string;
  originalValue: any;
  overrideValue: any;
  reason: string;
  appliedBy: string;
  appliedAt: Date;
  expiresAt?: Date;
}

// Checkpoint for rollback
export interface SteeringCheckpoint {
  id: string;
  agentId: AgentId;
  timestamp: Date;
  state: any;
  description: string;
  canRollback: boolean;
}

// Steering configuration
export interface SteeringConfig {
  enableAutoCorrection: boolean;
  maxPendingInstructions: number;
  instructionTimeoutMs: number;
  checkpointInterval: number;
  maxCheckpoints: number;
  escalationRules: EscalationRule[];
}

// Escalation rule
export interface EscalationRule {
  id: string;
  condition: (state: AgentSteeringState) => boolean;
  escalateTo: string[];
  message: string;
  priority: SteeringPriority;
}

// Steering event
export interface SteeringEvent {
  id: string;
  type: string;
  agentId: AgentId;
  timestamp: Date;
  data: any;
}

export class SteeringSystem extends EventEmitter {
  private config: SteeringConfig;
  private agentStates: Map<AgentId, AgentSteeringState> = new Map();
  private checkpoints: Map<AgentId, SteeringCheckpoint[]> = new Map();
  private globalConstraints: SteeringConstraint[] = [];
  private instructionQueue: SteeringInstruction[] = [];
  private eventHistory: SteeringEvent[] = [];

  constructor(config: Partial<SteeringConfig> = {}) {
    super();

    this.config = {
      enableAutoCorrection: config.enableAutoCorrection ?? true,
      maxPendingInstructions: config.maxPendingInstructions || 100,
      instructionTimeoutMs: config.instructionTimeoutMs || 300000, // 5 minutes
      checkpointInterval: config.checkpointInterval || 10, // Every 10 actions
      maxCheckpoints: config.maxCheckpoints || 50,
      escalationRules: config.escalationRules || []
    };

    // Start instruction processor
    this.startInstructionProcessor();
  }

  /**
   * Register an agent for steering
   */
  public registerAgent(agentId: AgentId, agentType: AgentType): void {
    if (this.agentStates.has(agentId)) {
      throw new Error(`Agent ${agentId} is already registered`);
    }

    const state: AgentSteeringState = {
      agentId,
      agentType,
      state: 'idle',
      lastUpdate: new Date(),
      pendingInstructions: [],
      constraints: [],
      overrides: []
    };

    this.agentStates.set(agentId, state);
    this.checkpoints.set(agentId, []);

    this.logEvent('agent-registered', agentId, { agentType });
    this.emit('agent-registered', { agentId, agentType });
  }

  /**
   * Unregister an agent
   */
  public unregisterAgent(agentId: AgentId): void {
    this.agentStates.delete(agentId);
    this.checkpoints.delete(agentId);
    
    this.logEvent('agent-unregistered', agentId, {});
    this.emit('agent-unregistered', { agentId });
  }

  /**
   * Issue a steering instruction
   */
  public async issueInstruction(
    command: SteeringCommand,
    targetAgentId: AgentId,
    reason: string,
    issuedBy: string,
    options: {
      priority?: SteeringPriority;
      payload?: any;
      expiresIn?: number;
    } = {}
  ): Promise<string> {
    const state = this.agentStates.get(targetAgentId);
    if (!state) {
      throw new Error(`Agent ${targetAgentId} is not registered`);
    }

    const instruction: SteeringInstruction = {
      id: uuidv4(),
      command,
      targetAgentId,
      priority: options.priority || 'normal',
      reason,
      payload: options.payload,
      issuedBy,
      issuedAt: new Date(),
      expiresAt: options.expiresIn 
        ? new Date(Date.now() + options.expiresIn)
        : new Date(Date.now() + this.config.instructionTimeoutMs),
      status: 'pending'
    };

    // Add to queue based on priority
    this.addToQueue(instruction);

    // Add to agent's pending instructions
    state.pendingInstructions.push(instruction);

    this.logEvent('instruction-issued', targetAgentId, instruction);
    this.emit('instruction-issued', instruction);

    // For immediate priority, process now
    if (instruction.priority === 'immediate') {
      await this.processInstruction(instruction);
    }

    return instruction.id;
  }

  /**
   * Pause an agent
   */
  public async pauseAgent(agentId: AgentId, reason: string, issuedBy: string): Promise<string> {
    return this.issueInstruction('pause', agentId, reason, issuedBy, { priority: 'immediate' });
  }

  /**
   * Resume an agent
   */
  public async resumeAgent(agentId: AgentId, reason: string, issuedBy: string): Promise<string> {
    return this.issueInstruction('resume', agentId, reason, issuedBy, { priority: 'immediate' });
  }

  /**
   * Stop an agent
   */
  public async stopAgent(agentId: AgentId, reason: string, issuedBy: string): Promise<string> {
    return this.issueInstruction('stop', agentId, reason, issuedBy, { priority: 'immediate' });
  }

  /**
   * Redirect agent to different task
   */
  public async redirectAgent(
    agentId: AgentId,
    newTask: any,
    reason: string,
    issuedBy: string
  ): Promise<string> {
    return this.issueInstruction('redirect', agentId, reason, issuedBy, {
      priority: 'high',
      payload: { newTask }
    });
  }

  /**
   * Override agent parameter
   */
  public async overrideParameter(
    agentId: AgentId,
    parameter: string,
    value: any,
    reason: string,
    issuedBy: string
  ): Promise<string> {
    const state = this.agentStates.get(agentId);
    if (!state) {
      throw new Error(`Agent ${agentId} is not registered`);
    }

    const override: SteeringOverride = {
      id: uuidv4(),
      targetAction: parameter,
      originalValue: state.overrides.find(o => o.targetAction === parameter)?.overrideValue,
      overrideValue: value,
      reason,
      appliedBy: issuedBy,
      appliedAt: new Date()
    };

    // Remove existing override for same parameter
    state.overrides = state.overrides.filter(o => o.targetAction !== parameter);
    state.overrides.push(override);

    this.logEvent('parameter-overridden', agentId, override);
    this.emit('parameter-overridden', { agentId, override });

    return override.id;
  }

  /**
   * Add a constraint
   */
  public addConstraint(
    agentId: AgentId | 'global',
    constraint: Omit<SteeringConstraint, 'id' | 'createdAt' | 'isActive'>
  ): string {
    const fullConstraint: SteeringConstraint = {
      ...constraint,
      id: uuidv4(),
      createdAt: new Date(),
      isActive: true
    };

    if (agentId === 'global') {
      this.globalConstraints.push(fullConstraint);
    } else {
      const state = this.agentStates.get(agentId);
      if (!state) {
        throw new Error(`Agent ${agentId} is not registered`);
      }
      state.constraints.push(fullConstraint);
    }

    this.logEvent('constraint-added', agentId === 'global' ? 'system' : agentId, fullConstraint);
    this.emit('constraint-added', { agentId, constraint: fullConstraint });

    return fullConstraint.id;
  }

  /**
   * Remove a constraint
   */
  public removeConstraint(constraintId: string): boolean {
    // Check global constraints
    const globalIndex = this.globalConstraints.findIndex(c => c.id === constraintId);
    if (globalIndex >= 0) {
      this.globalConstraints.splice(globalIndex, 1);
      this.emit('constraint-removed', { constraintId, scope: 'global' });
      return true;
    }

    // Check agent constraints
    for (const [agentId, state] of this.agentStates) {
      const index = state.constraints.findIndex(c => c.id === constraintId);
      if (index >= 0) {
        state.constraints.splice(index, 1);
        this.emit('constraint-removed', { constraintId, agentId });
        return true;
      }
    }

    return false;
  }

  /**
   * Check if action is allowed under current constraints
   */
  public checkConstraints(agentId: AgentId, action: any): {
    allowed: boolean;
    violations: Array<{ constraint: SteeringConstraint; action: 'block' | 'warn' | 'require-approval' }>;
  } {
    const state = this.agentStates.get(agentId);
    const violations: Array<{ constraint: SteeringConstraint; action: 'block' | 'warn' | 'require-approval' }> = [];

    // Check global constraints
    for (const constraint of this.globalConstraints) {
      if (constraint.isActive && constraint.condition(action)) {
        violations.push({ constraint, action: constraint.action });
      }
    }

    // Check agent-specific constraints
    if (state) {
      for (const constraint of state.constraints) {
        if (constraint.isActive && constraint.condition(action)) {
          violations.push({ constraint, action: constraint.action });
        }
      }
    }

    const hasBlocking = violations.some(v => v.action === 'block');

    return {
      allowed: !hasBlocking,
      violations
    };
  }

  /**
   * Create a checkpoint
   */
  public createCheckpoint(
    agentId: AgentId,
    state: any,
    description: string
  ): string {
    const agentCheckpoints = this.checkpoints.get(agentId) || [];
    
    const checkpoint: SteeringCheckpoint = {
      id: uuidv4(),
      agentId,
      timestamp: new Date(),
      state: JSON.parse(JSON.stringify(state)), // Deep copy
      description,
      canRollback: true
    };

    agentCheckpoints.push(checkpoint);

    // Trim old checkpoints
    if (agentCheckpoints.length > this.config.maxCheckpoints) {
      agentCheckpoints.splice(0, agentCheckpoints.length - this.config.maxCheckpoints);
    }

    this.checkpoints.set(agentId, agentCheckpoints);

    this.logEvent('checkpoint-created', agentId, { checkpointId: checkpoint.id, description });
    this.emit('checkpoint-created', checkpoint);

    return checkpoint.id;
  }

  /**
   * Rollback to checkpoint
   */
  public async rollbackToCheckpoint(
    agentId: AgentId,
    checkpointId: string,
    reason: string,
    issuedBy: string
  ): Promise<SteeringCheckpoint | null> {
    const agentCheckpoints = this.checkpoints.get(agentId);
    if (!agentCheckpoints) {
      return null;
    }

    const checkpoint = agentCheckpoints.find(c => c.id === checkpointId);
    if (!checkpoint || !checkpoint.canRollback) {
      return null;
    }

    // Issue rollback instruction
    await this.issueInstruction('rollback', agentId, reason, issuedBy, {
      priority: 'immediate',
      payload: { checkpoint }
    });

    this.logEvent('rollback-initiated', agentId, { checkpointId, reason });
    this.emit('rollback-initiated', { agentId, checkpoint, reason, issuedBy });

    return checkpoint;
  }

  /**
   * Get available checkpoints for agent
   */
  public getCheckpoints(agentId: AgentId): SteeringCheckpoint[] {
    return this.checkpoints.get(agentId) || [];
  }

  /**
   * Update agent state
   */
  public updateAgentState(
    agentId: AgentId,
    updates: Partial<Pick<AgentSteeringState, 'state' | 'currentTask' | 'progress'>>
  ): void {
    const state = this.agentStates.get(agentId);
    if (!state) {
      throw new Error(`Agent ${agentId} is not registered`);
    }

    Object.assign(state, updates, { lastUpdate: new Date() });

    // Check escalation rules
    this.checkEscalationRules(state);

    this.emit('agent-state-updated', { agentId, state });
  }

  /**
   * Get agent state
   */
  public getAgentState(agentId: AgentId): AgentSteeringState | undefined {
    return this.agentStates.get(agentId);
  }

  /**
   * Get all agent states
   */
  public getAllAgentStates(): AgentSteeringState[] {
    return Array.from(this.agentStates.values());
  }

  /**
   * Get pending instructions for agent
   */
  public getPendingInstructions(agentId: AgentId): SteeringInstruction[] {
    const state = this.agentStates.get(agentId);
    return state?.pendingInstructions.filter(i => i.status === 'pending') || [];
  }

  /**
   * Get active overrides for agent
   */
  public getActiveOverrides(agentId: AgentId): SteeringOverride[] {
    const state = this.agentStates.get(agentId);
    if (!state) return [];

    const now = new Date();
    return state.overrides.filter(o => !o.expiresAt || o.expiresAt > now);
  }

  /**
   * Apply override to value
   */
  public applyOverrides(agentId: AgentId, parameter: string, originalValue: any): any {
    const overrides = this.getActiveOverrides(agentId);
    const override = overrides.find(o => o.targetAction === parameter);
    return override ? override.overrideValue : originalValue;
  }

  /**
   * Add escalation rule
   */
  public addEscalationRule(rule: Omit<EscalationRule, 'id'>): string {
    const fullRule: EscalationRule = {
      ...rule,
      id: uuidv4()
    };

    this.config.escalationRules.push(fullRule);
    this.emit('escalation-rule-added', fullRule);

    return fullRule.id;
  }

  /**
   * Get event history
   */
  public getEventHistory(filter?: {
    agentId?: AgentId;
    type?: string;
    since?: Date;
    limit?: number;
  }): SteeringEvent[] {
    let events = [...this.eventHistory];

    if (filter?.agentId) {
      events = events.filter(e => e.agentId === filter.agentId);
    }

    if (filter?.type) {
      events = events.filter(e => e.type === filter.type);
    }

    if (filter?.since) {
      events = events.filter(e => e.timestamp >= filter.since!);
    }

    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filter?.limit) {
      events = events.slice(0, filter.limit);
    }

    return events;
  }

  // Private methods

  private addToQueue(instruction: SteeringInstruction): void {
    const priorityOrder: Record<SteeringPriority, number> = {
      immediate: 0,
      high: 1,
      normal: 2,
      low: 3
    };

    // Insert based on priority
    let inserted = false;
    for (let i = 0; i < this.instructionQueue.length; i++) {
      if (priorityOrder[instruction.priority] < priorityOrder[this.instructionQueue[i].priority]) {
        this.instructionQueue.splice(i, 0, instruction);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      this.instructionQueue.push(instruction);
    }

    // Trim if over limit
    if (this.instructionQueue.length > this.config.maxPendingInstructions) {
      const removed = this.instructionQueue.pop();
      if (removed) {
        removed.status = 'expired';
      }
    }
  }

  private async processInstruction(instruction: SteeringInstruction): Promise<void> {
    const state = this.agentStates.get(instruction.targetAgentId);
    if (!state) {
      instruction.status = 'rejected';
      return;
    }

    // Check if expired
    if (instruction.expiresAt && instruction.expiresAt < new Date()) {
      instruction.status = 'expired';
      return;
    }

    try {
      switch (instruction.command) {
        case 'pause':
          state.state = 'paused';
          break;
        case 'resume':
          state.state = 'running';
          break;
        case 'stop':
          state.state = 'stopped';
          break;
        case 'redirect':
          state.currentTask = instruction.payload?.newTask;
          break;
        default:
          // Other commands handled by the agent
          break;
      }

      instruction.status = 'applied';
      state.lastUpdate = new Date();

      this.logEvent('instruction-applied', instruction.targetAgentId, instruction);
      this.emit('instruction-applied', instruction);

    } catch (error) {
      instruction.status = 'rejected';
      this.emit('instruction-failed', { instruction, error });
    }

    // Remove from pending
    state.pendingInstructions = state.pendingInstructions.filter(i => i.id !== instruction.id);
  }

  private startInstructionProcessor(): void {
    setInterval(async () => {
      // Process non-immediate instructions
      const pendingInstructions = this.instructionQueue.filter(
        i => i.status === 'pending' && i.priority !== 'immediate'
      );

      for (const instruction of pendingInstructions) {
        await this.processInstruction(instruction);
      }

      // Remove processed instructions from queue
      this.instructionQueue = this.instructionQueue.filter(i => i.status === 'pending');
    }, 1000); // Process every second
  }

  private checkEscalationRules(state: AgentSteeringState): void {
    for (const rule of this.config.escalationRules) {
      try {
        if (rule.condition(state)) {
          this.emit('escalation-triggered', {
            rule,
            state,
            escalateTo: rule.escalateTo,
            message: rule.message
          });
        }
      } catch (e) {
        // Ignore rule evaluation errors
      }
    }
  }

  private logEvent(type: string, agentId: AgentId | string, data: any): void {
    const event: SteeringEvent = {
      id: uuidv4(),
      type,
      agentId: agentId as AgentId,
      timestamp: new Date(),
      data
    };

    this.eventHistory.push(event);

    // Keep only last 1000 events
    if (this.eventHistory.length > 1000) {
      this.eventHistory = this.eventHistory.slice(-500);
    }
  }
}

// Factory function
export function createSteeringSystem(config?: Partial<SteeringConfig>): SteeringSystem {
  return new SteeringSystem(config);
}

// Predefined constraints
export const PREDEFINED_CONSTRAINTS = {
  // Value limit for DeFi transactions
  valueLimit: (maxValue: bigint): Omit<SteeringConstraint, 'id' | 'createdAt' | 'isActive'> => ({
    type: 'value-limit',
    description: `Block transactions over ${maxValue}`,
    condition: (action) => {
      const value = BigInt(action?.value || 0);
      return value > maxValue;
    },
    action: 'require-approval'
  }),

  // Rate limiting
  rateLimit: (maxPerMinute: number): Omit<SteeringConstraint, 'id' | 'createdAt' | 'isActive'> => {
    const timestamps: number[] = [];
    return {
      type: 'rate-limit',
      description: `Limit to ${maxPerMinute} actions per minute`,
      condition: () => {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        
        // Clean old timestamps
        while (timestamps.length > 0 && timestamps[0] < oneMinuteAgo) {
          timestamps.shift();
        }

        timestamps.push(now);
        return timestamps.length > maxPerMinute;
      },
      action: 'block'
    };
  },

  // Block specific actions
  blockAction: (actionName: string): Omit<SteeringConstraint, 'id' | 'createdAt' | 'isActive'> => ({
    type: 'action-block',
    description: `Block action: ${actionName}`,
    condition: (action) => action?.type === actionName || action?.name === actionName,
    action: 'block'
  }),

  // Time-based constraint
  timeWindow: (
    startHour: number,
    endHour: number,
    action: 'block' | 'warn' | 'require-approval'
  ): Omit<SteeringConstraint, 'id' | 'createdAt' | 'isActive'> => ({
    type: 'time-limit',
    description: `Restrict actions outside ${startHour}:00-${endHour}:00`,
    condition: () => {
      const hour = new Date().getHours();
      return hour < startHour || hour >= endHour;
    },
    action
  })
};
