/**
 * Agent Hooks System Implementation
 * Provides lifecycle hooks for agent operations with human-in-the-loop support
 * 
 * Requirements: Task 11 - Agent Hooks Implementation
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AgentType, AgentId, RiskLevel } from '../types/core';

// Hook types
export type HookType = 
  | 'pre-action'
  | 'post-action'
  | 'pre-decision'
  | 'post-decision'
  | 'error'
  | 'rollback'
  | 'approval-required'
  | 'notification'
  | 'resource-limit'
  | 'security-check';

// Hook execution mode
export type HookMode = 'sync' | 'async' | 'blocking';

// Hook priority
export type HookPriority = 'highest' | 'high' | 'normal' | 'low' | 'lowest';

// Hook context
export interface HookContext {
  hookId: string;
  hookType: HookType;
  agentId: AgentId;
  agentType: AgentType;
  timestamp: Date;
  executionId?: string;
  actionId?: string;
  data: any;
  metadata: Record<string, any>;
}

// Hook result
export interface HookResult {
  hookId: string;
  success: boolean;
  continue: boolean;
  modifiedData?: any;
  error?: string;
  duration: number;
  requiresApproval?: boolean;
  approvalReason?: string;
}

// Hook definition
export interface HookDefinition {
  id: string;
  name: string;
  type: HookType;
  priority: HookPriority;
  mode: HookMode;
  enabled: boolean;
  handler: (context: HookContext) => Promise<HookResult>;
  filter?: (context: HookContext) => boolean;
  timeout?: number;
  retryCount?: number;
}

// Approval request
export interface ApprovalRequest {
  id: string;
  hookId: string;
  context: HookContext;
  reason: string;
  riskLevel: RiskLevel;
  timeout: number;
  createdAt: Date;
  expiresAt: Date;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  approver?: string;
  approvedAt?: Date;
  response?: any;
}

// Human in the loop configuration
export interface HITLConfig {
  enabled: boolean;
  approvalTimeoutMs: number;
  autoApproveBelow: RiskLevel;
  requireApprovalFor: HookType[];
  notifyOnApproval: boolean;
  escalationTimeMs: number;
}

// Hook system configuration
export interface HookSystemConfig {
  maxConcurrentHooks: number;
  defaultTimeout: number;
  enableAuditLogging: boolean;
  hitl: HITLConfig;
}

// Priority order mapping
const PRIORITY_ORDER: Record<HookPriority, number> = {
  highest: 0,
  high: 1,
  normal: 2,
  low: 3,
  lowest: 4
};

export class AgentHookSystem extends EventEmitter {
  private config: HookSystemConfig;
  private hooks: Map<string, HookDefinition> = new Map();
  private hooksByType: Map<HookType, HookDefinition[]> = new Map();
  private pendingApprovals: Map<string, ApprovalRequest> = new Map();
  private approvalCallbacks: Map<string, (approved: boolean, response?: any) => void> = new Map();
  private auditLog: Array<{ timestamp: Date; event: string; data: any }> = [];

  constructor(config: Partial<HookSystemConfig> = {}) {
    super();
    
    this.config = {
      maxConcurrentHooks: config.maxConcurrentHooks || 10,
      defaultTimeout: config.defaultTimeout || 30000,
      enableAuditLogging: config.enableAuditLogging ?? true,
      hitl: {
        enabled: config.hitl?.enabled ?? true,
        approvalTimeoutMs: config.hitl?.approvalTimeoutMs || 300000, // 5 minutes
        autoApproveBelow: config.hitl?.autoApproveBelow || RiskLevel.LOW,
        requireApprovalFor: config.hitl?.requireApprovalFor || [
          'approval-required',
          'security-check'
        ],
        notifyOnApproval: config.hitl?.notifyOnApproval ?? true,
        escalationTimeMs: config.hitl?.escalationTimeMs || 60000
      }
    };

    // Initialize type maps
    const hookTypes: HookType[] = [
      'pre-action', 'post-action', 'pre-decision', 'post-decision',
      'error', 'rollback', 'approval-required', 'notification',
      'resource-limit', 'security-check'
    ];
    
    for (const type of hookTypes) {
      this.hooksByType.set(type, []);
    }

    // Start approval timeout checker
    this.startApprovalTimeoutChecker();
  }

  /**
   * Register a hook
   */
  public registerHook(definition: Omit<HookDefinition, 'id'>): string {
    const id = uuidv4();
    const hook: HookDefinition = {
      ...definition,
      id,
      timeout: definition.timeout || this.config.defaultTimeout
    };

    this.hooks.set(id, hook);

    // Add to type index
    const typeHooks = this.hooksByType.get(hook.type) || [];
    typeHooks.push(hook);
    typeHooks.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
    this.hooksByType.set(hook.type, typeHooks);

    this.logAudit('hook-registered', { hookId: id, type: hook.type, name: hook.name });
    this.emit('hook-registered', hook);

    return id;
  }

  /**
   * Unregister a hook
   */
  public unregisterHook(hookId: string): boolean {
    const hook = this.hooks.get(hookId);
    if (!hook) return false;

    this.hooks.delete(hookId);

    // Remove from type index
    const typeHooks = this.hooksByType.get(hook.type) || [];
    const index = typeHooks.findIndex(h => h.id === hookId);
    if (index >= 0) {
      typeHooks.splice(index, 1);
    }

    this.logAudit('hook-unregistered', { hookId });
    this.emit('hook-unregistered', { hookId, type: hook.type });

    return true;
  }

  /**
   * Execute hooks of a specific type
   */
  public async executeHooks(
    type: HookType,
    agentId: AgentId,
    agentType: AgentType,
    data: any,
    metadata: Record<string, any> = {}
  ): Promise<HookResult[]> {
    const hooks = this.hooksByType.get(type) || [];
    const enabledHooks = hooks.filter(h => h.enabled);
    const results: HookResult[] = [];

    const context: HookContext = {
      hookId: '',
      hookType: type,
      agentId,
      agentType,
      timestamp: new Date(),
      data,
      metadata
    };

    for (const hook of enabledHooks) {
      // Check filter
      if (hook.filter && !hook.filter({ ...context, hookId: hook.id })) {
        continue;
      }

      const result = await this.executeHook(hook, { ...context, hookId: hook.id });
      results.push(result);

      // If hook says don't continue, stop processing
      if (!result.continue) {
        break;
      }

      // Update data for next hook if modified
      if (result.modifiedData !== undefined) {
        context.data = result.modifiedData;
      }
    }

    return results;
  }

  /**
   * Execute a single hook with timeout and retry support
   */
  private async executeHook(hook: HookDefinition, context: HookContext): Promise<HookResult> {
    const startTime = Date.now();
    let lastError: string | undefined;
    const retries = hook.retryCount || 0;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await Promise.race([
          hook.handler(context),
          this.createTimeout(hook.timeout || this.config.defaultTimeout)
        ]);

        // Check if approval is required
        if (result.requiresApproval && this.config.hitl.enabled) {
          return await this.handleApprovalRequired(hook, context, result);
        }

        this.logAudit('hook-executed', {
          hookId: hook.id,
          type: hook.type,
          success: result.success,
          duration: Date.now() - startTime,
          attempt
        });

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        
        if (attempt < retries) {
          await this.delay(1000 * (attempt + 1)); // Exponential backoff
        }
      }
    }

    const errorResult: HookResult = {
      hookId: hook.id,
      success: false,
      continue: true, // Allow pipeline to continue on hook failure
      error: lastError || 'Unknown error',
      duration: Date.now() - startTime
    };

    this.logAudit('hook-failed', { hookId: hook.id, error: errorResult.error });
    this.emit('hook-error', { hook, error: errorResult.error, context });

    return errorResult;
  }

  /**
   * Handle approval required scenario
   */
  private async handleApprovalRequired(
    hook: HookDefinition,
    context: HookContext,
    preliminaryResult: HookResult
  ): Promise<HookResult> {
    const riskLevel = this.assessRiskLevel(context);

    // Auto-approve if below threshold
    if (this.compareRiskLevels(riskLevel, this.config.hitl.autoApproveBelow) < 0) {
      return {
        ...preliminaryResult,
        requiresApproval: false
      };
    }

    // Create approval request
    const approvalRequest = await this.requestApproval(
      hook.id,
      context,
      preliminaryResult.approvalReason || 'Approval required for action',
      riskLevel
    );

    // Wait for approval
    return new Promise<HookResult>((resolve) => {
      this.approvalCallbacks.set(approvalRequest.id, (approved, response) => {
        resolve({
          hookId: hook.id,
          success: approved,
          continue: approved,
          modifiedData: response,
          duration: Date.now() - context.timestamp.getTime(),
          requiresApproval: true
        });
      });
    });
  }

  /**
   * Request human approval
   */
  public async requestApproval(
    hookId: string,
    context: HookContext,
    reason: string,
    riskLevel: RiskLevel
  ): Promise<ApprovalRequest> {
    const now = new Date();
    const request: ApprovalRequest = {
      id: uuidv4(),
      hookId,
      context,
      reason,
      riskLevel,
      timeout: this.config.hitl.approvalTimeoutMs,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.config.hitl.approvalTimeoutMs),
      status: 'pending'
    };

    this.pendingApprovals.set(request.id, request);

    this.logAudit('approval-requested', {
      requestId: request.id,
      hookId,
      reason,
      riskLevel
    });

    this.emit('approval-requested', request);

    // Notify if configured
    if (this.config.hitl.notifyOnApproval) {
      this.emit('notification', {
        type: 'approval-needed',
        request,
        message: `Approval required: ${reason}`
      });
    }

    // Set escalation timer
    setTimeout(() => {
      const currentRequest = this.pendingApprovals.get(request.id);
      if (currentRequest && currentRequest.status === 'pending') {
        this.emit('approval-escalation', request);
      }
    }, this.config.hitl.escalationTimeMs);

    return request;
  }

  /**
   * Approve a pending request
   */
  public async approveRequest(
    requestId: string,
    approver: string,
    response?: any
  ): Promise<boolean> {
    const request = this.pendingApprovals.get(requestId);
    if (!request || request.status !== 'pending') {
      return false;
    }

    request.status = 'approved';
    request.approver = approver;
    request.approvedAt = new Date();
    request.response = response;

    this.logAudit('approval-granted', { requestId, approver });
    this.emit('approval-granted', request);

    // Trigger callback
    const callback = this.approvalCallbacks.get(requestId);
    if (callback) {
      callback(true, response);
      this.approvalCallbacks.delete(requestId);
    }

    return true;
  }

  /**
   * Reject a pending request
   */
  public async rejectRequest(requestId: string, approver: string, reason?: string): Promise<boolean> {
    const request = this.pendingApprovals.get(requestId);
    if (!request || request.status !== 'pending') {
      return false;
    }

    request.status = 'rejected';
    request.approver = approver;
    request.approvedAt = new Date();

    this.logAudit('approval-rejected', { requestId, approver, reason });
    this.emit('approval-rejected', { request, reason });

    // Trigger callback
    const callback = this.approvalCallbacks.get(requestId);
    if (callback) {
      callback(false);
      this.approvalCallbacks.delete(requestId);
    }

    return true;
  }

  /**
   * Get pending approval requests
   */
  public getPendingApprovals(): ApprovalRequest[] {
    return Array.from(this.pendingApprovals.values()).filter(r => r.status === 'pending');
  }

  /**
   * Create pre-action hook
   */
  public onPreAction(
    name: string,
    handler: (context: HookContext) => Promise<HookResult>,
    options: Partial<Omit<HookDefinition, 'id' | 'type' | 'handler'>> = {}
  ): string {
    return this.registerHook({
      name,
      type: 'pre-action',
      handler,
      priority: options.priority || 'normal',
      mode: options.mode || 'async',
      enabled: options.enabled ?? true,
      filter: options.filter,
      timeout: options.timeout,
      retryCount: options.retryCount
    });
  }

  /**
   * Create post-action hook
   */
  public onPostAction(
    name: string,
    handler: (context: HookContext) => Promise<HookResult>,
    options: Partial<Omit<HookDefinition, 'id' | 'type' | 'handler'>> = {}
  ): string {
    return this.registerHook({
      name,
      type: 'post-action',
      handler,
      priority: options.priority || 'normal',
      mode: options.mode || 'async',
      enabled: options.enabled ?? true,
      filter: options.filter,
      timeout: options.timeout,
      retryCount: options.retryCount
    });
  }

  /**
   * Create security check hook
   */
  public onSecurityCheck(
    name: string,
    handler: (context: HookContext) => Promise<HookResult>,
    options: Partial<Omit<HookDefinition, 'id' | 'type' | 'handler'>> = {}
  ): string {
    return this.registerHook({
      name,
      type: 'security-check',
      handler,
      priority: options.priority || 'highest',
      mode: options.mode || 'blocking',
      enabled: options.enabled ?? true,
      filter: options.filter,
      timeout: options.timeout,
      retryCount: options.retryCount
    });
  }

  /**
   * Create error hook
   */
  public onError(
    name: string,
    handler: (context: HookContext) => Promise<HookResult>,
    options: Partial<Omit<HookDefinition, 'id' | 'type' | 'handler'>> = {}
  ): string {
    return this.registerHook({
      name,
      type: 'error',
      handler,
      priority: options.priority || 'high',
      mode: options.mode || 'async',
      enabled: options.enabled ?? true,
      filter: options.filter,
      timeout: options.timeout,
      retryCount: options.retryCount
    });
  }

  /**
   * Enable/disable a hook
   */
  public setHookEnabled(hookId: string, enabled: boolean): void {
    const hook = this.hooks.get(hookId);
    if (hook) {
      hook.enabled = enabled;
      this.emit('hook-state-changed', { hookId, enabled });
    }
  }

  /**
   * Get all registered hooks
   */
  public getHooks(): HookDefinition[] {
    return Array.from(this.hooks.values());
  }

  /**
   * Get hooks by type
   */
  public getHooksByType(type: HookType): HookDefinition[] {
    return this.hooksByType.get(type) || [];
  }

  // Private helper methods

  private assessRiskLevel(context: HookContext): RiskLevel {
    // Simple risk assessment based on context
    if (context.metadata.riskLevel) {
      return context.metadata.riskLevel as RiskLevel;
    }

    if (context.hookType === 'security-check') {
      return RiskLevel.HIGH;
    }

    if (context.data?.value && BigInt(context.data.value) > BigInt('1000000000000000000')) {
      return RiskLevel.HIGH;
    }

    return RiskLevel.MEDIUM;
  }

  private compareRiskLevels(a: RiskLevel, b: RiskLevel): number {
    const order = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL];
    return order.indexOf(a) - order.indexOf(b);
  }

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Hook timeout after ${ms}ms`)), ms);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private startApprovalTimeoutChecker(): void {
    setInterval(() => {
      const now = new Date();
      for (const [id, request] of this.pendingApprovals) {
        if (request.status === 'pending' && request.expiresAt < now) {
          request.status = 'expired';
          
          this.logAudit('approval-expired', { requestId: id });
          this.emit('approval-expired', request);

          const callback = this.approvalCallbacks.get(id);
          if (callback) {
            callback(false);
            this.approvalCallbacks.delete(id);
          }
        }
      }
    }, 10000); // Check every 10 seconds
  }

  private logAudit(event: string, data: any): void {
    if (this.config.enableAuditLogging) {
      this.auditLog.push({
        timestamp: new Date(),
        event,
        data
      });

      // Keep only last 1000 entries
      if (this.auditLog.length > 1000) {
        this.auditLog = this.auditLog.slice(-500);
      }
    }
  }

  /**
   * Get audit log
   */
  public getAuditLog(): Array<{ timestamp: Date; event: string; data: any }> {
    return [...this.auditLog];
  }
}

// Factory function
export function createHookSystem(config?: Partial<HookSystemConfig>): AgentHookSystem {
  return new AgentHookSystem(config);
}

// Default hooks for common scenarios
export const DEFAULT_HOOKS = {
  // Log all actions
  actionLogger: (system: AgentHookSystem) => {
    system.onPostAction('action-logger', async (context) => {
      console.log(`[${context.timestamp.toISOString()}] Action by ${context.agentId}: ${JSON.stringify(context.data)}`);
      return { hookId: context.hookId, success: true, continue: true, duration: 0 };
    });
  },

  // DeFi value threshold check
  defiValueCheck: (system: AgentHookSystem, threshold: bigint) => {
    system.onPreAction('defi-value-check', async (context) => {
      const value = BigInt(context.data?.value || 0);
      if (value > threshold) {
        return {
          hookId: context.hookId,
          success: true,
          continue: true,
          requiresApproval: true,
          approvalReason: `Transaction value ${value} exceeds threshold ${threshold}`,
          duration: 0
        };
      }
      return { hookId: context.hookId, success: true, continue: true, duration: 0 };
    }, { priority: 'high' });
  },

  // Security validation
  securityValidation: (system: AgentHookSystem) => {
    system.onSecurityCheck('security-validation', async (context) => {
      // Add security checks here
      const securityIssues = [];
      
      // Example checks
      if (context.data?.untrustedInput) {
        securityIssues.push('Untrusted input detected');
      }

      if (securityIssues.length > 0) {
        return {
          hookId: context.hookId,
          success: false,
          continue: false,
          error: securityIssues.join(', '),
          duration: 0
        };
      }

      return { hookId: context.hookId, success: true, continue: true, duration: 0 };
    });
  }
};
