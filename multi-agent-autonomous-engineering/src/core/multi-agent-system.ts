/**
 * Multi-Agent System
 * Main orchestration class for the 7-agent platform
 */

import { AgentRegistry } from './base-agent';
import { MessageBus, getMessageBus, resetMessageBus } from './message-bus';
import { WorkflowOrchestrator, getWorkflowOrchestrator } from './workflow-orchestrator';
import { ContextStore, getContextStore } from './context-store';
import { AgentType } from '../types/core';

export interface MultiAgentSystemConfig {
  enableSandbox?: boolean;
  maxConcurrentTasks?: number;
  messageQueueSize?: number;
  defaultTimeout?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface SystemStatus {
  initialized: boolean;
  config: MultiAgentSystemConfig;
  registry: AgentRegistry | null;
  messageBus: MessageBus | null;
  orchestrator: WorkflowOrchestrator | null;
  contextStore: ContextStore | null;
  activeAgents: number;
  pendingTasks: number;
}

export interface ProcessRequestOptions {
  requestId?: string;
  timeout?: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, unknown>;
}

export interface ProcessRequestResult {
  requestId: string;
  status: 'completed' | 'failed' | 'cancelled';
  output: string;
  metrics: {
    processingTime: number;
    agentsInvolved: number;
  };
}

export class MultiAgentSystem {
  private config: MultiAgentSystemConfig;
  private _initialized: boolean = false;
  private registry: AgentRegistry | null = null;
  private messageBus: MessageBus | null = null;
  private orchestrator: WorkflowOrchestrator | null = null;
  private contextStore: ContextStore | null = null;

  constructor(config: MultiAgentSystemConfig = {}) {
    this.config = {
      enableSandbox: true,
      maxConcurrentTasks: 10,
      messageQueueSize: 1000,
      defaultTimeout: 30000,
      logLevel: 'info',
      ...config
    };

    // Validate configuration
    if (this.config.maxConcurrentTasks !== undefined && this.config.maxConcurrentTasks < 0) {
      this.log('warn', 'Invalid maxConcurrentTasks, using default');
      this.config.maxConcurrentTasks = 10;
    }
  }

  async initialize(): Promise<void> {
    if (this._initialized) {
      throw new Error('System is already initialized');
    }

    try {
      this.log('info', 'Initializing Multi-Agent System...');

      // Initialize core components
      this.registry = AgentRegistry.getInstance();
      this.messageBus = getMessageBus();
      this.orchestrator = getWorkflowOrchestrator();
      this.contextStore = getContextStore();

      this._initialized = true;
      this.log('info', 'Multi-Agent System initialized successfully');
    } catch (error) {
      this.log('error', `Failed to initialize system: ${error}`);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this._initialized) {
      return;
    }

    try {
      this.log('info', 'Shutting down Multi-Agent System...');

      // Shutdown all registered agents
      if (this.registry) {
        const agents = this.registry.getAllAgents();
        for (const agent of agents) {
          try {
            await agent.shutdown();
          } catch (error) {
            this.log('warn', `Failed to shutdown agent ${agent.id}: ${error}`);
          }
        }
      }

      // Reset message bus
      resetMessageBus();

      this._initialized = false;
      this.registry = null;
      this.messageBus = null;
      this.orchestrator = null;
      this.contextStore = null;

      this.log('info', 'Multi-Agent System shut down successfully');
    } catch (error) {
      this.log('error', `Error during shutdown: ${error}`);
      throw error;
    }
  }

  getStatus(): SystemStatus {
    return {
      initialized: this._initialized,
      config: this.config,
      registry: this.registry,
      messageBus: this.messageBus,
      orchestrator: this.orchestrator,
      contextStore: this.contextStore,
      activeAgents: this.registry?.getAllAgents().length || 0,
      pendingTasks: 0 // Placeholder
    };
  }

  getRegistry(): AgentRegistry | null {
    return this.registry;
  }

  getMessageBus(): MessageBus | null {
    return this.messageBus;
  }

  getOrchestrator(): WorkflowOrchestrator | null {
    return this.orchestrator;
  }

  getContextStore(): ContextStore | null {
    return this.contextStore;
  }

  isInitialized(): boolean {
    return this._initialized;
  }

  /**
   * Process a user request through the multi-agent system
   */
  async processRequest(input: string, options: ProcessRequestOptions = {}): Promise<ProcessRequestResult> {
    if (!this._initialized) {
      throw new Error('System is not initialized');
    }

    const requestId = options.requestId || `req_${Date.now()}`;
    const startTime = Date.now();

    this.log('info', `Processing request ${requestId}: ${input.substring(0, 100)}...`);

    try {
      // Get the intent router to analyze the request
      const intentRouter = this.registry?.getAgentsByType(AgentType.INTENT_ROUTER)[0];
      
      if (!intentRouter) {
        throw new Error('Intent Router agent not found');
      }

      // Store workflow context for potential future use
      const _context = {
        requestId,
        input,
        options,
        startTime
      };

      // For now, return a basic result
      // In a full implementation, this would orchestrate the workflow
      const result: ProcessRequestResult = {
        requestId,
        status: 'completed',
        output: `Processed: ${input}`,
        metrics: {
          processingTime: Date.now() - startTime,
          agentsInvolved: 1
        }
      };

      this.log('info', `Request ${requestId} completed in ${result.metrics.processingTime}ms`);
      return result;
    } catch (error) {
      this.log('error', `Request ${requestId} failed: ${error}`);
      throw error;
    }
  }

  private log(level: string, message: string): void {
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevel = this.config.logLevel || 'info';
    
    if (levels.indexOf(level) >= levels.indexOf(configLevel)) {
      const timestamp = new Date().toISOString();
      console[level as 'log'](`[${timestamp}] [MultiAgentSystem] [${level.toUpperCase()}] ${message}`);
    }
  }
}
