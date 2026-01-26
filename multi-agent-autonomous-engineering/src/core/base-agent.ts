/**
 * Base Agent Implementation
 * Provides common functionality for all agents in the Multi-Agent Autonomous Engineering System
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AgentId, AgentType, MessageType, Priority } from '../types/core';
import { BaseAgent, AgentStatus, HealthStatus } from '../types/agents';
import { MessageBus, BusMessage, getMessageBus } from './message-bus';
import { SandboxEnvironment, SandboxFactory } from './sandbox';

export interface BaseAgentConfig {
  id?: AgentId;
  name: string;
  type: AgentType;
  version: string;
  capabilities: string[];
  maxConcurrentTasks: number;
  timeoutMs: number;
  enableSandbox: boolean;
  sandboxConfig?: Record<string, unknown>;
}

export abstract class BaseAgentImpl extends EventEmitter implements BaseAgent {
  public readonly id: AgentId;
  public readonly name: string;
  public readonly version: string;
  public readonly type: AgentType;
  public readonly capabilities: string[];
  
  public status: AgentStatus = AgentStatus.INITIALIZING;
  protected messageBus: MessageBus;
  protected sandbox?: SandboxEnvironment;
  protected config: BaseAgentConfig;
  protected activeTasks: Map<string, Promise<unknown>> = new Map();
  protected lastHealthCheck: Date = new Date();

  constructor(config: BaseAgentConfig) {
    super();
    
    this.id = config.id || uuidv4();
    this.name = config.name;
    this.version = config.version;
    this.type = config.type;
    this.capabilities = [...config.capabilities];
    this.config = config;
    
    this.messageBus = getMessageBus();
  }

  /**
   * Initialize the agent
   */
  public async initialize(): Promise<void> {
    try {
      this.status = AgentStatus.INITIALIZING;
      this.emit('status-changed', this.status);

      // Initialize sandbox if enabled
      if (this.config.enableSandbox) {
        this.sandbox = this.createSandbox();
        await this.sandbox.initialize();
      }

      // Register message handler
      this.messageBus.registerHandler(this.id, this.handleMessage.bind(this));

      // Perform agent-specific initialization
      await this.onInitialize();

      this.status = AgentStatus.READY;
      this.emit('status-changed', this.status);
      this.emit('initialized');

    } catch (error) {
      this.status = AgentStatus.ERROR;
      this.emit('status-changed', this.status);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Shutdown the agent
   */
  public async shutdown(): Promise<void> {
    try {
      this.status = AgentStatus.SHUTDOWN;
      this.emit('status-changed', this.status);

      // Cancel active tasks
      for (const [taskId, taskPromise] of this.activeTasks) {
        try {
          // Note: In a real implementation, we'd need a way to cancel promises
          this.emit('task-cancelled', taskId);
        } catch (error) {
          this.emit('task-cancellation-error', { taskId, error });
        }
      }
      this.activeTasks.clear();

      // Shutdown sandbox
      if (this.sandbox) {
        await this.sandbox.shutdown();
      }

      // Unregister message handler
      this.messageBus.unregisterHandler(this.id);

      // Perform agent-specific cleanup
      await this.onShutdown();

      this.emit('shutdown');

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Perform health check
   */
  public async healthCheck(): Promise<HealthStatus> {
    try {
      this.lastHealthCheck = new Date();

      // Check basic agent status
      if (this.status === AgentStatus.ERROR) {
        return {
          status: 'unhealthy',
          message: 'Agent is in error state',
          lastCheck: this.lastHealthCheck
        };
      }

      if (this.status === AgentStatus.SHUTDOWN) {
        return {
          status: 'unhealthy',
          message: 'Agent is shutdown',
          lastCheck: this.lastHealthCheck
        };
      }

      // Check sandbox health if enabled
      if (this.sandbox) {
        const resourceUsage = this.sandbox.getResourceUsage();
        if (this.sandbox.checkResourceLimits()) {
          return {
            status: 'degraded',
            message: 'Resource limits exceeded',
            lastCheck: this.lastHealthCheck
          };
        }
      }

      // Check active tasks
      if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
        return {
          status: 'degraded',
          message: 'Maximum concurrent tasks reached',
          lastCheck: this.lastHealthCheck
        };
      }

      // Perform agent-specific health checks
      const agentHealth = await this.onHealthCheck();
      
      return {
        status: agentHealth.status,
        message: agentHealth.message,
        lastCheck: this.lastHealthCheck
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
        lastCheck: this.lastHealthCheck
      };
    }
  }

  /**
   * Send a message to another agent
   */
  protected async sendMessage(
    to: AgentId,
    type: MessageType,
    payload: Record<string, unknown>,
    options: {
      action?: string;
      priority?: Priority;
      correlationId?: string;
      replyTo?: string;
    } = {}
  ): Promise<string> {
    return this.messageBus.sendMessage(this.id, to, type, payload, options);
  }

  /**
   * Send a request and wait for response
   */
  protected async sendRequest(
    to: AgentId,
    action: string,
    payload: Record<string, unknown>,
    options: {
      priority?: Priority;
      timeoutMs?: number;
    } = {}
  ): Promise<BusMessage> {
    return this.messageBus.sendRequest(this.id, to, action, payload, options);
  }

  /**
   * Broadcast an event to all agents
   */
  protected async broadcastEvent(
    eventType: string,
    payload: Record<string, unknown>,
    options: {
      priority?: Priority;
      excludeAgents?: AgentId[];
    } = {}
  ): Promise<string[]> {
    return this.messageBus.broadcastEvent(this.id, eventType, payload, options);
  }

  /**
   * Execute an operation in the sandbox
   */
  protected async executeInSandbox(
    operation: string,
    parameters: Record<string, unknown> = {}
  ): Promise<unknown> {
    if (!this.sandbox) {
      throw new Error('Sandbox is not enabled for this agent');
    }

    const execution = await this.sandbox.execute(operation, parameters);
    
    if (execution.status === 'failed') {
      throw new Error(execution.error || 'Sandbox execution failed');
    }

    return execution.result;
  }

  /**
   * Add a task to the active tasks list
   */
  protected addTask(taskId: string, taskPromise: Promise<unknown>): void {
    if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
      throw new Error('Maximum concurrent tasks reached');
    }

    this.activeTasks.set(taskId, taskPromise);
    
    // Clean up when task completes
    taskPromise.finally(() => {
      this.activeTasks.delete(taskId);
      this.emit('task-completed', taskId);
    });

    this.emit('task-started', taskId);
  }

  /**
   * Get current agent metrics
   */
  public getMetrics(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      status: this.status,
      activeTasks: this.activeTasks.size,
      maxConcurrentTasks: this.config.maxConcurrentTasks,
      lastHealthCheck: this.lastHealthCheck,
      sandboxEnabled: !!this.sandbox,
      resourceUsage: this.sandbox?.getResourceUsage(),
      uptime: Date.now() - this.lastHealthCheck.getTime()
    };
  }

  /**
   * Handle incoming messages
   */
  private async handleMessage(message: BusMessage): Promise<BusMessage | void> {
    try {
      this.emit('message-received', message);

      // Update status to busy if not already
      if (this.status === AgentStatus.READY) {
        this.status = AgentStatus.BUSY;
        this.emit('status-changed', this.status);
      }

      // Route message to appropriate handler
      let response: unknown = undefined;

      switch (message.type) {
        case MessageType.REQUEST:
          response = await this.handleRequest(message as unknown as Record<string, unknown>);
          break;
        
        case MessageType.EVENT:
          await this.handleEvent(message as unknown as Record<string, unknown>);
          break;
        
        case MessageType.ERROR:
          await this.handleError(message as unknown as Record<string, unknown>);
          break;
        
        default:
          throw new Error(`Unsupported message type: ${message.type}`);
      }

      // Update status back to ready if no active tasks
      if (this.activeTasks.size === 0 && this.status === AgentStatus.BUSY) {
        this.status = AgentStatus.READY;
        this.emit('status-changed', this.status);
      }

      return response as BusMessage | void;

    } catch (error) {
      this.emit('message-error', { message, error });
      
      // Send error response if this was a request
      if (message.type === MessageType.REQUEST) {
        return {
          id: uuidv4(),
          from: this.id,
          to: message.from,
          type: MessageType.ERROR,
          payload: {
            error: error instanceof Error ? error.message : String(error),
            originalMessageId: message.id
          },
          priority: message.priority,
          timestamp: new Date(),
          correlationId: message.correlationId,
          replyTo: message.id
        };
      }
    }
  }

  /**
   * Create sandbox environment for this agent
   * Can be overridden by subclasses
   */
  protected createSandbox(): SandboxEnvironment {
    switch (this.type) {
      case AgentType.SECURITY_VALIDATOR:
        return SandboxFactory.createDeFiSandbox(this.id);
      
      case AgentType.CODE_ENGINEER:
      case AgentType.TEST_AGENT:
        return SandboxFactory.createRestrictedSandbox(this.id);
      
      default:
        return SandboxFactory.createSandbox(this.id, this.config.sandboxConfig);
    }
  }

  // Abstract methods to be implemented by concrete agents
  protected abstract onInitialize(): Promise<void>;
  protected abstract onShutdown(): Promise<void>;
  protected abstract onHealthCheck(): Promise<HealthStatus>;
  protected abstract handleRequest(message: Record<string, unknown>): Promise<unknown>;
  protected abstract handleEvent(message: Record<string, unknown>): Promise<void>;
  protected abstract handleError(message: Record<string, unknown>): Promise<void>;
}

// Agent registry for managing all agents
export class AgentRegistry {
  private static instance: AgentRegistry;
  private agents: Map<AgentId, BaseAgentImpl> = new Map();
  private agentsByType: Map<AgentType, BaseAgentImpl[]> = new Map();

  private constructor() {
    // Initialize agent type maps
    Object.values(AgentType).forEach(type => {
      this.agentsByType.set(type, []);
    });
  }

  public static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  /**
   * Register an agent
   */
  public register(agent: BaseAgentImpl): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent with ID ${agent.id} is already registered`);
    }

    this.agents.set(agent.id, agent);
    
    const typeAgents = this.agentsByType.get(agent.type) || [];
    typeAgents.push(agent);
    this.agentsByType.set(agent.type, typeAgents);
  }

  /**
   * Unregister an agent
   */
  public unregister(agentId: AgentId): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    this.agents.delete(agentId);
    
    const typeAgents = this.agentsByType.get(agent.type) || [];
    const index = typeAgents.findIndex(a => a.id === agentId);
    if (index >= 0) {
      typeAgents.splice(index, 1);
    }
  }

  /**
   * Get agent by ID
   */
  public getAgent(agentId: AgentId): BaseAgentImpl | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get agents by type
   */
  public getAgentsByType(type: AgentType): BaseAgentImpl[] {
    return [...(this.agentsByType.get(type) || [])];
  }

  /**
   * Get all agents
   */
  public getAllAgents(): BaseAgentImpl[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agent metrics
   */
  public getMetrics(): Record<string, unknown> {
    const agents = this.getAllAgents();
    const statusCounts = agents.reduce((acc, agent) => {
      const status = agent.getMetrics().status as string;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalAgents: agents.length,
      statusCounts,
      agentsByType: Object.fromEntries(
        Array.from(this.agentsByType.entries()).map(([type, agents]) => [
          type,
          agents.length
        ])
      ),
      activeAgents: agents.filter(a => 
        a.getMetrics().status === AgentStatus.READY || 
        a.getMetrics().status === AgentStatus.BUSY
      ).length
    };
  }

  /**
   * Shutdown all agents
   */
  public async shutdownAll(): Promise<void> {
    const agents = this.getAllAgents();
    await Promise.all(agents.map(agent => agent.shutdown()));
    this.agents.clear();
    this.agentsByType.clear();
  }
}