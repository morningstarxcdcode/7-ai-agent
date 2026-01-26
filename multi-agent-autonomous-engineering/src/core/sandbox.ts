/**
 * Sandbox Environment Implementation
 * Provides secure isolation for autonomous agent operations
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AgentId, ResourceLimits } from '../types/core';

export interface SandboxConfig {
  id: string;
  agentId: AgentId;
  isolated: boolean;
  resourceLimits: ResourceLimits;
  allowedOperations: string[];
  blockedOperations: string[];
  networkAccess: NetworkAccessConfig;
  fileSystemAccess: FileSystemAccessConfig;
  timeoutMs: number;
}

export interface NetworkAccessConfig {
  allowedDomains: string[];
  blockedDomains: string[];
  allowedPorts: number[];
  rateLimits: Record<string, number>;
  requiresApproval: string[];
}

export interface FileSystemAccessConfig {
  allowedPaths: string[];
  blockedPaths: string[];
  readOnly: boolean;
  maxFileSize: number;
  maxTotalSize: number;
}

export interface SandboxExecution {
  id: string;
  operation: string;
  parameters: Record<string, unknown>;
  startTime: Date;
  endTime?: Date;
  status: ExecutionStatus;
  result?: unknown;
  error?: string;
  resourceUsage: ResourceUsage;
}

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  BLOCKED = 'blocked'
}

export interface ResourceUsage {
  cpuTimeMs: number;
  memoryUsedMB: number;
  networkRequestsCount: number;
  fileOperationsCount: number;
  executionTimeMs: number;
}

export interface SandboxViolation {
  id: string;
  type: ViolationType;
  description: string;
  operation: string;
  parameters: Record<string, unknown>;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  blocked: boolean;
}

export enum ViolationType {
  RESOURCE_LIMIT_EXCEEDED = 'resource_limit_exceeded',
  BLOCKED_OPERATION = 'blocked_operation',
  NETWORK_ACCESS_DENIED = 'network_access_denied',
  FILE_ACCESS_DENIED = 'file_access_denied',
  TIMEOUT_EXCEEDED = 'timeout_exceeded',
  PRODUCTION_ACCESS_ATTEMPTED = 'production_access_attempted'
}

export class SandboxEnvironment extends EventEmitter {
  private config: SandboxConfig;
  private executions: Map<string, SandboxExecution> = new Map();
  private violations: SandboxViolation[] = [];
  private currentResourceUsage: ResourceUsage;
  private isActive = false;

  constructor(config: SandboxConfig) {
    super();
    this.config = config;
    this.currentResourceUsage = {
      cpuTimeMs: 0,
      memoryUsedMB: 0,
      networkRequestsCount: 0,
      fileOperationsCount: 0,
      executionTimeMs: 0
    };
  }

  /**
   * Initialize the sandbox environment
   */
  public async initialize(): Promise<void> {
    this.isActive = true;
    this.emit('sandbox-initialized', { sandboxId: this.config.id });
  }

  /**
   * Execute an operation within the sandbox
   */
  public async execute(
    operation: string,
    parameters: Record<string, unknown> = {}
  ): Promise<SandboxExecution> {
    if (!this.isActive) {
      throw new Error('Sandbox is not active');
    }

    const execution: SandboxExecution = {
      id: uuidv4(),
      operation,
      parameters,
      startTime: new Date(),
      status: ExecutionStatus.PENDING,
      resourceUsage: {
        cpuTimeMs: 0,
        memoryUsedMB: 0,
        networkRequestsCount: 0,
        fileOperationsCount: 0,
        executionTimeMs: 0
      }
    };

    this.executions.set(execution.id, execution);

    try {
      // Pre-execution validation
      await this.validateExecution(execution);
      
      execution.status = ExecutionStatus.RUNNING;
      this.emit('execution-started', execution);

      // Execute the operation with monitoring
      const result = await this.executeWithMonitoring(execution);
      
      execution.result = result;
      execution.status = ExecutionStatus.COMPLETED;
      execution.endTime = new Date();
      execution.resourceUsage.executionTimeMs = 
        execution.endTime.getTime() - execution.startTime.getTime();

      this.emit('execution-completed', execution);
      return execution;

    } catch (error) {
      execution.error = error instanceof Error ? error.message : String(error);
      execution.status = ExecutionStatus.FAILED;
      execution.endTime = new Date();
      
      this.emit('execution-failed', execution);
      return execution;
    }
  }

  /**
   * Check if an operation is allowed
   */
  public isOperationAllowed(operation: string): boolean {
    // Check if operation is explicitly blocked
    if (this.config.blockedOperations.includes(operation)) {
      return false;
    }

    // Check if operation is in allowed list (if specified)
    if (this.config.allowedOperations.length > 0) {
      return this.config.allowedOperations.includes(operation);
    }

    // Default to allowed if no restrictions specified
    return true;
  }

  /**
   * Check if network access is allowed for a domain
   */
  public isNetworkAccessAllowed(domain: string, port?: number): boolean {
    // Check blocked domains first
    if (this.config.networkAccess.blockedDomains.some(blocked => 
      domain.includes(blocked) || blocked.includes(domain)
    )) {
      return false;
    }

    // Check allowed domains
    if (this.config.networkAccess.allowedDomains.length > 0) {
      const allowed = this.config.networkAccess.allowedDomains.some(allowed => 
        domain.includes(allowed) || allowed.includes(domain)
      );
      if (!allowed) return false;
    }

    // Check port restrictions
    if (port && this.config.networkAccess.allowedPorts.length > 0) {
      return this.config.networkAccess.allowedPorts.includes(port);
    }

    return true;
  }

  /**
   * Check if file system access is allowed for a path
   */
  public isFileAccessAllowed(path: string, operation: 'read' | 'write'): boolean {
    // Check blocked paths first
    if (this.config.fileSystemAccess.blockedPaths.some(blocked => 
      path.startsWith(blocked)
    )) {
      return false;
    }

    // Check if write operation is allowed
    if (operation === 'write' && this.config.fileSystemAccess.readOnly) {
      return false;
    }

    // Check allowed paths
    if (this.config.fileSystemAccess.allowedPaths.length > 0) {
      return this.config.fileSystemAccess.allowedPaths.some(allowed => 
        path.startsWith(allowed)
      );
    }

    return true;
  }

  /**
   * Get current resource usage
   */
  public getResourceUsage(): ResourceUsage {
    return { ...this.currentResourceUsage };
  }

  /**
   * Get execution history
   */
  public getExecutions(limit = 100): SandboxExecution[] {
    return Array.from(this.executions.values())
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit);
  }

  /**
   * Get violation history
   */
  public getViolations(limit = 100): SandboxViolation[] {
    return this.violations
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Check if resource limits are exceeded
   */
  public checkResourceLimits(): boolean {
    const limits = this.config.resourceLimits;
    const usage = this.currentResourceUsage;

    return (
      usage.memoryUsedMB > limits.maxMemoryMB ||
      usage.networkRequestsCount > limits.maxNetworkRequestsPerMinute ||
      usage.executionTimeMs > limits.maxExecutionTimeMs
    );
  }

  /**
   * Reset resource usage counters
   */
  public resetResourceUsage(): void {
    this.currentResourceUsage = {
      cpuTimeMs: 0,
      memoryUsedMB: 0,
      networkRequestsCount: 0,
      fileOperationsCount: 0,
      executionTimeMs: 0
    };
  }

  /**
   * Shutdown the sandbox environment
   */
  public async shutdown(): Promise<void> {
    this.isActive = false;
    
    // Cancel any running executions
    for (const execution of this.executions.values()) {
      if (execution.status === ExecutionStatus.RUNNING) {
        execution.status = ExecutionStatus.FAILED;
        execution.error = 'Sandbox shutdown';
        execution.endTime = new Date();
      }
    }

    this.emit('sandbox-shutdown', { sandboxId: this.config.id });
  }

  private async validateExecution(execution: SandboxExecution): Promise<void> {
    // Check if operation is allowed
    if (!this.isOperationAllowed(execution.operation)) {
      const violation = this.createViolation(
        ViolationType.BLOCKED_OPERATION,
        `Operation '${execution.operation}' is not allowed`,
        execution.operation,
        execution.parameters,
        'high',
        true
      );
      this.violations.push(violation);
      throw new Error(`Operation blocked: ${execution.operation}`);
    }

    // Check resource limits
    if (this.checkResourceLimits()) {
      const violation = this.createViolation(
        ViolationType.RESOURCE_LIMIT_EXCEEDED,
        'Resource limits exceeded',
        execution.operation,
        execution.parameters,
        'critical',
        true
      );
      this.violations.push(violation);
      throw new Error('Resource limits exceeded');
    }

    // Check for production access attempts
    if (this.isProductionAccessAttempt(execution)) {
      const violation = this.createViolation(
        ViolationType.PRODUCTION_ACCESS_ATTEMPTED,
        'Attempted access to production systems',
        execution.operation,
        execution.parameters,
        'critical',
        true
      );
      this.violations.push(violation);
      throw new Error('Production access denied');
    }
  }

  private async executeWithMonitoring(execution: SandboxExecution): Promise<unknown> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;

    // Set timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        execution.status = ExecutionStatus.TIMEOUT;
        reject(new Error(`Execution timeout after ${this.config.timeoutMs}ms`));
      }, this.config.timeoutMs);
    });

    // Execute operation
    const executionPromise = this.performOperation(execution);

    try {
      const result = await Promise.race([executionPromise, timeoutPromise]);
      
      // Update resource usage
      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      
      execution.resourceUsage.executionTimeMs = endTime - startTime;
      execution.resourceUsage.memoryUsedMB = Math.max(0, endMemory - startMemory);
      execution.resourceUsage.cpuTimeMs = endTime - startTime; // Simplified CPU time
      
      this.updateCurrentResourceUsage(execution.resourceUsage);
      
      return result;
    } catch (error) {
      // Update resource usage even on error
      const endTime = Date.now();
      execution.resourceUsage.executionTimeMs = endTime - startTime;
      this.updateCurrentResourceUsage(execution.resourceUsage);
      
      throw error;
    }
  }

  private async performOperation(execution: SandboxExecution): Promise<unknown> {
    // This is a simplified implementation
    // In a real system, this would dispatch to specific operation handlers
    
    switch (execution.operation) {
      case 'code_generation':
        return this.simulateCodeGeneration(execution.parameters);
      
      case 'test_execution':
        return this.simulateTestExecution(execution.parameters);
      
      case 'security_validation':
        return this.simulateSecurityValidation(execution.parameters);
      
      case 'api_call':
        return this.simulateAPICall(execution.parameters);
      
      default:
        throw new Error(`Unknown operation: ${execution.operation}`);
    }
  }

  private async simulateCodeGeneration(parameters: Record<string, unknown>): Promise<unknown> {
    // Simulate code generation with artificial delay
    await this.sleep(Math.random() * 1000 + 500);
    
    return {
      generated: true,
      files: ['src/example.ts', 'tests/example.test.ts'],
      linesOfCode: Math.floor(Math.random() * 500) + 100,
      parameters
    };
  }

  private async simulateTestExecution(parameters: Record<string, unknown>): Promise<unknown> {
    // Simulate test execution
    await this.sleep(Math.random() * 2000 + 1000);
    
    const passed = Math.random() > 0.2; // 80% pass rate
    
    return {
      passed,
      testsRun: Math.floor(Math.random() * 50) + 10,
      coverage: Math.random() * 20 + 80, // 80-100% coverage
      parameters
    };
  }

  private async simulateSecurityValidation(parameters: Record<string, unknown>): Promise<unknown> {
    // Simulate security validation
    await this.sleep(Math.random() * 1500 + 500);
    
    const riskLevel = ['low', 'medium', 'high'][Math.floor(Math.random() * 3)];
    
    return {
      validated: true,
      riskLevel,
      vulnerabilities: Math.floor(Math.random() * 3),
      parameters
    };
  }

  private async simulateAPICall(parameters: Record<string, unknown>): Promise<unknown> {
    // Simulate API call with network request tracking
    this.currentResourceUsage.networkRequestsCount++;
    
    await this.sleep(Math.random() * 500 + 200);
    
    return {
      success: Math.random() > 0.1, // 90% success rate
      responseTime: Math.random() * 500 + 100,
      parameters
    };
  }

  private isProductionAccessAttempt(execution: SandboxExecution): boolean {
    // Check for common production indicators
    const productionIndicators = [
      'production',
      'prod',
      'live',
      'mainnet',
      'real-money',
      'actual-funds'
    ];

    const operationStr = execution.operation.toLowerCase();
    const parametersStr = JSON.stringify(execution.parameters).toLowerCase();

    return productionIndicators.some(indicator => 
      operationStr.includes(indicator) || parametersStr.includes(indicator)
    );
  }

  private createViolation(
    type: ViolationType,
    description: string,
    operation: string,
    parameters: Record<string, unknown>,
    severity: 'low' | 'medium' | 'high' | 'critical',
    blocked: boolean
  ): SandboxViolation {
    return {
      id: uuidv4(),
      type,
      description,
      operation,
      parameters,
      timestamp: new Date(),
      severity,
      blocked
    };
  }

  private updateCurrentResourceUsage(executionUsage: ResourceUsage): void {
    this.currentResourceUsage.cpuTimeMs += executionUsage.cpuTimeMs;
    this.currentResourceUsage.memoryUsedMB = Math.max(
      this.currentResourceUsage.memoryUsedMB,
      executionUsage.memoryUsedMB
    );
    this.currentResourceUsage.networkRequestsCount += executionUsage.networkRequestsCount;
    this.currentResourceUsage.fileOperationsCount += executionUsage.fileOperationsCount;
    this.currentResourceUsage.executionTimeMs += executionUsage.executionTimeMs;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Sandbox factory for creating configured sandbox environments
export class SandboxFactory {
  private static defaultConfig: Partial<SandboxConfig> = {
    isolated: true,
    resourceLimits: {
      maxMemoryMB: 512,
      maxCpuPercent: 50,
      maxExecutionTimeMs: 300000, // 5 minutes
      maxNetworkRequestsPerMinute: 100
    },
    allowedOperations: [
      'code_generation',
      'test_execution',
      'security_validation',
      'api_call',
      'file_read',
      'file_write'
    ],
    blockedOperations: [
      'system_command',
      'network_admin',
      'file_delete_system',
      'production_deploy'
    ],
    networkAccess: {
      allowedDomains: [
        'api.coingecko.com',
        'api.0x.org',
        'api.1inch.io',
        'api.gopluslabs.io',
        'api.etherscan.io',
        'api.alchemy.com',
        'api.infura.io'
      ],
      blockedDomains: [
        'production-api.internal',
        'admin.internal',
        'mainnet-rpc.internal'
      ],
      allowedPorts: [80, 443, 8080, 3000],
      rateLimits: {
        'api.coingecko.com': 50,
        'api.0x.org': 100,
        'api.1inch.io': 100
      },
      requiresApproval: []
    },
    fileSystemAccess: {
      allowedPaths: ['/tmp', '/workspace', '/sandbox'],
      blockedPaths: ['/etc', '/usr', '/var', '/root', '/home'],
      readOnly: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxTotalSize: 100 * 1024 * 1024 // 100MB
    },
    timeoutMs: 300000 // 5 minutes
  };

  public static createSandbox(
    agentId: AgentId,
    overrides: Partial<SandboxConfig> = {}
  ): SandboxEnvironment {
    const config: SandboxConfig = {
      id: uuidv4(),
      agentId,
      ...this.defaultConfig,
      ...overrides
    } as SandboxConfig;

    return new SandboxEnvironment(config);
  }

  public static createRestrictedSandbox(agentId: AgentId): SandboxEnvironment {
    return this.createSandbox(agentId, {
      resourceLimits: {
        maxMemoryMB: 256,
        maxCpuPercent: 25,
        maxExecutionTimeMs: 60000, // 1 minute
        maxNetworkRequestsPerMinute: 20
      },
      allowedOperations: ['code_generation', 'test_execution'],
      networkAccess: {
        allowedDomains: [],
        blockedDomains: ['*'],
        allowedPorts: [],
        rateLimits: {},
        requiresApproval: ['*']
      }
    });
  }

  public static createDeFiSandbox(agentId: AgentId): SandboxEnvironment {
    return this.createSandbox(agentId, {
      allowedOperations: [
        'security_validation',
        'api_call',
        'transaction_simulation',
        'price_analysis'
      ],
      networkAccess: {
        allowedDomains: [
          'api.coingecko.com',
          'api.0x.org',
          'api.1inch.io',
          'api.gopluslabs.io',
          'api.etherscan.io',
          'simulate.tenderly.co'
        ],
        blockedDomains: ['mainnet-rpc.*', 'production-*'],
        allowedPorts: [443],
        rateLimits: {
          'api.gopluslabs.io': 60,
          'api.0x.org': 100,
          'api.1inch.io': 100
        },
        requiresApproval: ['mainnet-rpc.*']
      }
    });
  }
}