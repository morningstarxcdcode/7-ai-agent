/**
 * Simplified Execution & Audit Agent Implementation
 * Monitors execution, maintains audit trails, and tracks agent operations
 * 
 * Requirements: Task 9 - Execution & Audit Agent
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseAgentImpl, BaseAgentConfig } from '../../core/base-agent';
import { AgentType, RiskLevel } from '../../types/core';
import {
  AuditEntry,
  AuditEntryInput,
  ExecutionPlan,
  ExecutionStatus,
  AgentAction,
  ResourceUsage,
  ComplianceAudit,
  AuditReport,
  AuditFilter,
  AgentMessage,
  HealthStatus
} from '../../types/agents';

export interface AuditAgentConfig extends BaseAgentConfig {
  retentionDays: number;
  enableRealTimeMonitoring: boolean;
  alertThresholds: {
    errorRate: number;
    latencyMs: number;
    resourceUsage: number;
  };
  complianceFrameworks: string[];
  maxEntriesInMemory: number;
}

export class AuditAgentImpl extends BaseAgentImpl {
  private auditConfig: AuditAgentConfig;
  private auditEntries: AuditEntry[] = [];
  private activeExecutions: Map<string, { plan: ExecutionPlan; startTime: Date }> = new Map();
  private resourceHistory: Map<string, ResourceUsage[]> = new Map();
  private alerts: Array<{ id: string; message: string; severity: string; timestamp: Date }> = [];

  constructor(config: Partial<AuditAgentConfig> = {}) {
    const fullConfig: AuditAgentConfig = {
      id: config.id || uuidv4(),
      name: config.name || 'Execution & Audit Agent',
      type: AgentType.AUDIT_AGENT,
      version: config.version || '1.0.0',
      capabilities: [
        'execution_monitoring',
        'audit_logging',
        'compliance_tracking',
        'resource_monitoring',
        'report_generation'
      ],
      maxConcurrentTasks: config.maxConcurrentTasks || 10,
      timeoutMs: config.timeoutMs || 30000,
      enableSandbox: config.enableSandbox ?? false,
      retentionDays: config.retentionDays || 90,
      enableRealTimeMonitoring: config.enableRealTimeMonitoring ?? true,
      alertThresholds: config.alertThresholds || {
        errorRate: 0.05,
        latencyMs: 5000,
        resourceUsage: 0.8
      },
      complianceFrameworks: config.complianceFrameworks || ['SOC2', 'GDPR', 'DEFI'],
      maxEntriesInMemory: config.maxEntriesInMemory || 10000
    };

    super(fullConfig);
    this.auditConfig = fullConfig;
  }

  protected async onInitialize(): Promise<void> {
    this.emit('audit-initialized', { agentId: this.id });
  }

  protected async onShutdown(): Promise<void> {
    this.emit('audit-shutdown', { agentId: this.id, entriesCount: this.auditEntries.length });
  }

  protected async onHealthCheck(): Promise<HealthStatus> {
    const memoryUsage = this.auditEntries.length / this.auditConfig.maxEntriesInMemory;
    return {
      status: memoryUsage < 0.9 ? 'healthy' : 'degraded',
      message: `Audit entries: ${this.auditEntries.length}/${this.auditConfig.maxEntriesInMemory}`,
      lastCheck: new Date()
    };
  }

  protected async handleRequest(message: Record<string, unknown>): Promise<unknown> {
    return { received: true, messageId: message['id'] };
  }

  protected async handleEvent(message: Record<string, unknown>): Promise<void> {
    this.logAudit({
      action: 'event_received',
      actor: String(message['from']),
      resource: 'message_bus',
      outcome: 'success',
      details: { messageType: message['type'] }
    });
  }

  protected async handleError(message: Record<string, unknown>): Promise<void> {
    this.logAudit({
      action: 'error_handled',
      actor: String(message['from']),
      resource: 'audit_agent',
      outcome: 'failure',
      details: { error: String(message['error'] || 'Unknown error') },
      riskLevel: RiskLevel.HIGH
    });
  }

  /**
   * Log an audit entry
   */
  public logAudit(input: AuditEntryInput): string {
    const entry: AuditEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      action: input.action,
      actor: input.actor,
      resource: input.resource,
      outcome: input.outcome,
      details: input.details || {},
      riskLevel: input.riskLevel
    };

    this.auditEntries.push(entry);
    this.emit('audit-logged', entry);

    // Trim if over limit
    if (this.auditEntries.length > this.auditConfig.maxEntriesInMemory) {
      this.auditEntries = this.auditEntries.slice(-this.auditConfig.maxEntriesInMemory);
    }

    return entry.id;
  }

  /**
   * Log an agent action
   */
  public logAgentAction(action: AgentAction): void {
    this.logAudit({
      action: action.action,
      actor: action.agentId,
      resource: String(action.agentType),
      outcome: action.success ? 'success' : 'failure',
      details: {
        input: action.input,
        output: action.output,
        duration: action.duration,
        error: action.error
      }
    });
  }

  /**
   * Start tracking an execution
   */
  public startExecution(planId: string, plan: ExecutionPlan): void {
    this.activeExecutions.set(planId, { plan, startTime: new Date() });
    
    this.logAudit({
      action: 'execution_started',
      actor: 'orchestrator',
      resource: planId,
      outcome: 'success',
      details: {
        workflowId: plan.workflow?.id,
        stepsCount: plan.schedule?.length || 0
      }
    });
  }

  /**
   * Complete tracking an execution
   */
  public completeExecution(planId: string, status: ExecutionStatus): void {
    const execution = this.activeExecutions.get(planId);
    
    this.logAudit({
      action: 'execution_completed',
      actor: 'orchestrator',
      resource: planId,
      outcome: status.status === 'completed' ? 'success' : 
               status.status === 'failed' ? 'failure' : 'partial',
      details: {
        status: status.status,
        progress: status.progress,
        completedSteps: status.completedSteps?.length || 0,
        failedSteps: status.failedSteps?.length || 0,
        duration: execution ? Date.now() - execution.startTime.getTime() : undefined
      }
    });

    this.activeExecutions.delete(planId);
  }

  /**
   * Log resource usage
   */
  public logResourceUsage(usage: ResourceUsage): void {
    const history = this.resourceHistory.get(usage.agentId) || [];
    history.push(usage);
    
    // Keep last 100 entries per agent
    if (history.length > 100) {
      history.shift();
    }
    
    this.resourceHistory.set(usage.agentId, history);

    // Check thresholds
    if (usage.cpuPercent > this.auditConfig.alertThresholds.resourceUsage * 100) {
      this.createAlert('warning', `High CPU usage for ${usage.agentId}: ${usage.cpuPercent}%`);
    }
  }

  /**
   * Generate an audit report
   */
  public async generateAuditReport(startDate: Date, endDate: Date): Promise<AuditReport> {
    const filteredEntries = this.auditEntries.filter(
      e => e.timestamp >= startDate && e.timestamp <= endDate
    );

    // Summarize by outcome
    const byOutcome: Record<string, number> = {};
    const byActor: Record<string, number> = {};
    const byResource: Record<string, number> = {};
    const riskDistribution: Record<string, number> = {};

    for (const entry of filteredEntries) {
      byOutcome[entry.outcome] = (byOutcome[entry.outcome] || 0) + 1;
      byActor[entry.actor] = (byActor[entry.actor] || 0) + 1;
      byResource[entry.resource] = (byResource[entry.resource] || 0) + 1;
      
      const risk = entry.riskLevel || 'unspecified';
      riskDistribution[risk] = (riskDistribution[risk] || 0) + 1;
    }

    const compliance = this.checkCompliance(filteredEntries);

    return {
      id: uuidv4(),
      generatedAt: new Date(),
      period: { start: startDate, end: endDate },
      summary: {
        totalEntries: filteredEntries.length,
        byOutcome,
        byActor,
        byResource,
        riskDistribution
      },
      entries: filteredEntries,
      compliance,
      recommendations: this.generateRecommendations(filteredEntries, compliance)
    };
  }

  /**
   * Check compliance against configured frameworks
   */
  public checkCompliance(entries: AuditEntry[]): ComplianceAudit {
    const violations: Array<{
      rule: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      affectedEntries: string[];
    }> = [];

    // Check for sensitive data access without logging
    const sensitiveAccesses = entries.filter(
      e => e.action.includes('access') && !e.details
    );
    if (sensitiveAccesses.length > 0) {
      violations.push({
        rule: 'AUDIT-001',
        severity: 'medium',
        description: 'Resource access without detailed logging',
        affectedEntries: sensitiveAccesses.map(e => e.id)
      });
    }

    // Check for high error rate
    const errors = entries.filter(e => e.outcome === 'failure');
    const errorRate = entries.length > 0 ? errors.length / entries.length : 0;
    if (errorRate > this.auditConfig.alertThresholds.errorRate) {
      violations.push({
        rule: 'AUDIT-002',
        severity: 'high',
        description: `Error rate ${(errorRate * 100).toFixed(1)}% exceeds threshold`,
        affectedEntries: errors.map(e => e.id)
      });
    }

    // Check for high-risk operations without approval
    const highRiskWithoutApproval = entries.filter(
      e => e.riskLevel === RiskLevel.CRITICAL && 
           !e.details?.approved
    );
    if (highRiskWithoutApproval.length > 0) {
      violations.push({
        rule: 'AUDIT-003',
        severity: 'critical',
        description: 'Critical risk operations without approval',
        affectedEntries: highRiskWithoutApproval.map(e => e.id)
      });
    }

    const score = Math.max(0, 100 - (violations.length * 10));

    return {
      compliant: violations.length === 0,
      score,
      violations,
      recommendations: violations.map(v => `Address ${v.rule}: ${v.description}`)
    };
  }

  /**
   * Query audit entries with filter
   */
  public queryAuditLog(filter: AuditFilter): AuditEntry[] {
    return this.auditEntries.filter(entry => {
      if (filter.startDate && entry.timestamp < filter.startDate) return false;
      if (filter.endDate && entry.timestamp > filter.endDate) return false;
      if (filter.actors && !filter.actors.includes(entry.actor)) return false;
      if (filter.resources && !filter.resources.includes(entry.resource)) return false;
      if (filter.outcomes && !filter.outcomes.includes(entry.outcome)) return false;
      if (filter.riskLevels && entry.riskLevel && !filter.riskLevels.includes(entry.riskLevel)) return false;
      return true;
    });
  }

  /**
   * Get active executions
   */
  public getActiveExecutions(): string[] {
    return Array.from(this.activeExecutions.keys());
  }

  /**
   * Get resource history for an agent
   */
  public getResourceHistory(agentId: string): ResourceUsage[] {
    return this.resourceHistory.get(agentId) || [];
  }

  /**
   * Get alerts
   */
  public getAlerts(): Array<{ id: string; message: string; severity: string; timestamp: Date }> {
    return [...this.alerts];
  }

  /**
   * Clear old alerts
   */
  public clearAlerts(): void {
    this.alerts = [];
  }

  // Private helpers
  private createAlert(severity: string, message: string): void {
    const alert = {
      id: uuidv4(),
      message,
      severity,
      timestamp: new Date()
    };
    this.alerts.push(alert);
    this.emit('alert', alert);
  }

  private generateRecommendations(entries: AuditEntry[], compliance: ComplianceAudit): string[] {
    const recommendations: string[] = [];

    if (!compliance.compliant) {
      recommendations.push('Address compliance violations before production deployment');
    }

    const errorCount = entries.filter(e => e.outcome === 'failure').length;
    if (errorCount > 10) {
      recommendations.push('Investigate root cause of frequent failures');
    }

    const criticalOps = entries.filter(e => e.riskLevel === RiskLevel.CRITICAL);
    if (criticalOps.length > 5) {
      recommendations.push('Review critical operations for potential automation or safety improvements');
    }

    return recommendations;
  }
}

// Factory function
export function createAuditAgent(config?: Partial<AuditAgentConfig>): AuditAgentImpl {
  return new AuditAgentImpl(config);
}
