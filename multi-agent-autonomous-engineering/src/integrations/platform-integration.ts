/**
 * Multi-Platform Integration Module
 * Coordinates agents across different platforms and services
 * 
 * Requirements: Task 14 - Multi-platform integration
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  AgentType,
  AgentMessage,
  IntentCategory,
  AgentRole
} from '../types/agents';

// Platform types
export type PlatformType = 
  | 'ethereum' 
  | 'polygon' 
  | 'arbitrum' 
  | 'optimism' 
  | 'base' 
  | 'bsc' 
  | 'solana'
  | 'github'
  | 'gitlab'
  | 'aws'
  | 'gcp'
  | 'azure'
  | 'vercel'
  | 'railway';

export interface PlatformConfig {
  id: string;
  type: PlatformType;
  name: string;
  enabled: boolean;
  credentials?: Record<string, string>;
  endpoints?: Record<string, string>;
  options?: Record<string, unknown>;
}

export interface PlatformCapability {
  name: string;
  supported: boolean;
  requirements?: string[];
  limitations?: string[];
}

export interface CrossPlatformTask {
  id: string;
  name: string;
  sourcePlatform: PlatformType;
  targetPlatform: PlatformType;
  operation: string;
  params: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface PlatformAdapter {
  type: PlatformType;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  isConnected(): boolean;
  getCapabilities(): PlatformCapability[];
  execute(operation: string, params: Record<string, unknown>): Promise<unknown>;
}

// Platform capability definitions
const PLATFORM_CAPABILITIES: Record<PlatformType, PlatformCapability[]> = {
  ethereum: [
    { name: 'smart-contracts', supported: true },
    { name: 'defi-protocols', supported: true },
    { name: 'nft-operations', supported: true },
    { name: 'token-transfers', supported: true }
  ],
  polygon: [
    { name: 'smart-contracts', supported: true },
    { name: 'defi-protocols', supported: true },
    { name: 'low-gas-fees', supported: true },
    { name: 'nft-operations', supported: true }
  ],
  arbitrum: [
    { name: 'smart-contracts', supported: true },
    { name: 'defi-protocols', supported: true },
    { name: 'l2-scaling', supported: true }
  ],
  optimism: [
    { name: 'smart-contracts', supported: true },
    { name: 'defi-protocols', supported: true },
    { name: 'l2-scaling', supported: true }
  ],
  base: [
    { name: 'smart-contracts', supported: true },
    { name: 'defi-protocols', supported: true },
    { name: 'coinbase-integration', supported: true }
  ],
  bsc: [
    { name: 'smart-contracts', supported: true },
    { name: 'defi-protocols', supported: true },
    { name: 'cex-integration', supported: true }
  ],
  solana: [
    { name: 'programs', supported: true },
    { name: 'high-throughput', supported: true },
    { name: 'nft-operations', supported: true }
  ],
  github: [
    { name: 'repository-management', supported: true },
    { name: 'ci-cd', supported: true },
    { name: 'issue-tracking', supported: true },
    { name: 'code-review', supported: true }
  ],
  gitlab: [
    { name: 'repository-management', supported: true },
    { name: 'ci-cd', supported: true },
    { name: 'issue-tracking', supported: true },
    { name: 'devops', supported: true }
  ],
  aws: [
    { name: 'compute', supported: true },
    { name: 'storage', supported: true },
    { name: 'serverless', supported: true },
    { name: 'containers', supported: true }
  ],
  gcp: [
    { name: 'compute', supported: true },
    { name: 'storage', supported: true },
    { name: 'kubernetes', supported: true },
    { name: 'ai-ml', supported: true }
  ],
  azure: [
    { name: 'compute', supported: true },
    { name: 'storage', supported: true },
    { name: 'enterprise', supported: true },
    { name: 'identity', supported: true }
  ],
  vercel: [
    { name: 'frontend-deployment', supported: true },
    { name: 'serverless', supported: true },
    { name: 'edge-functions', supported: true }
  ],
  railway: [
    { name: 'backend-deployment', supported: true },
    { name: 'databases', supported: true },
    { name: 'easy-scaling', supported: true }
  ]
};

// Generic platform adapter implementation
class GenericPlatformAdapter implements PlatformAdapter {
  type: PlatformType;
  private config: PlatformConfig;
  private connected = false;

  constructor(config: PlatformConfig) {
    this.type = config.type;
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Simulate connection
    this.connected = true;
  }

  async shutdown(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getCapabilities(): PlatformCapability[] {
    return PLATFORM_CAPABILITIES[this.type] || [];
  }

  async execute(operation: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.connected) {
      throw new Error(`Platform ${this.type} is not connected`);
    }

    // Return mock result based on operation
    return {
      operation,
      platform: this.type,
      params,
      success: true,
      timestamp: new Date().toISOString()
    };
  }
}

export interface IntegrationConfig {
  platforms: PlatformConfig[];
  defaultTimeout: number;
  retryAttempts: number;
  enableCrossChain: boolean;
}

const DEFAULT_INTEGRATION_CONFIG: IntegrationConfig = {
  platforms: [],
  defaultTimeout: 30000,
  retryAttempts: 3,
  enableCrossChain: false
};

export class MultiPlatformIntegration extends EventEmitter {
  private config: IntegrationConfig;
  private adapters: Map<PlatformType, PlatformAdapter> = new Map();
  private tasks: Map<string, CrossPlatformTask> = new Map();
  private initialized = false;

  constructor(config: Partial<IntegrationConfig> = {}) {
    super();
    this.config = { ...DEFAULT_INTEGRATION_CONFIG, ...config };
  }

  /**
   * Initialize all configured platforms
   */
  async initialize(): Promise<void> {
    for (const platformConfig of this.config.platforms) {
      if (platformConfig.enabled) {
        await this.registerPlatform(platformConfig);
      }
    }
    this.initialized = true;
    this.emit('initialized', { platforms: Array.from(this.adapters.keys()) });
  }

  /**
   * Shutdown all platforms
   */
  async shutdown(): Promise<void> {
    for (const [type, adapter] of this.adapters) {
      await adapter.shutdown();
      this.emit('platform-disconnected', { type });
    }
    this.adapters.clear();
    this.initialized = false;
    this.emit('shutdown');
  }

  /**
   * Register a platform adapter
   */
  async registerPlatform(config: PlatformConfig): Promise<void> {
    const adapter = new GenericPlatformAdapter(config);
    await adapter.initialize();
    this.adapters.set(config.type, adapter);
    this.emit('platform-registered', { type: config.type, capabilities: adapter.getCapabilities() });
  }

  /**
   * Unregister a platform
   */
  async unregisterPlatform(type: PlatformType): Promise<void> {
    const adapter = this.adapters.get(type);
    if (adapter) {
      await adapter.shutdown();
      this.adapters.delete(type);
      this.emit('platform-unregistered', { type });
    }
  }

  /**
   * Get all registered platforms
   */
  getRegisteredPlatforms(): PlatformType[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Get platform capabilities
   */
  getPlatformCapabilities(type: PlatformType): PlatformCapability[] {
    const adapter = this.adapters.get(type);
    return adapter?.getCapabilities() || [];
  }

  /**
   * Check if a capability is supported
   */
  hasCapability(type: PlatformType, capability: string): boolean {
    const capabilities = this.getPlatformCapabilities(type);
    return capabilities.some(c => c.name === capability && c.supported);
  }

  /**
   * Execute operation on a platform
   */
  async executeOnPlatform(
    platform: PlatformType,
    operation: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new Error(`Platform ${platform} is not registered`);
    }

    this.emit('operation-started', { platform, operation, params });

    try {
      const result = await adapter.execute(operation, params);
      this.emit('operation-completed', { platform, operation, result });
      return result;
    } catch (error) {
      this.emit('operation-failed', { platform, operation, error });
      throw error;
    }
  }

  /**
   * Create a cross-platform task
   */
  async createCrossPlatformTask(
    name: string,
    sourcePlatform: PlatformType,
    targetPlatform: PlatformType,
    operation: string,
    params: Record<string, unknown>
  ): Promise<CrossPlatformTask> {
    // Verify platforms are available
    if (!this.adapters.has(sourcePlatform)) {
      throw new Error(`Source platform ${sourcePlatform} is not registered`);
    }
    if (!this.adapters.has(targetPlatform)) {
      throw new Error(`Target platform ${targetPlatform} is not registered`);
    }

    const task: CrossPlatformTask = {
      id: uuidv4(),
      name,
      sourcePlatform,
      targetPlatform,
      operation,
      params,
      status: 'pending'
    };

    this.tasks.set(task.id, task);
    this.emit('task-created', { task });

    return task;
  }

  /**
   * Execute a cross-platform task
   */
  async executeCrossPlatformTask(taskId: string): Promise<unknown> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = 'running';
    task.startedAt = new Date();
    this.emit('task-started', { task });

    try {
      // Execute on source platform first
      const sourceResult = await this.executeOnPlatform(
        task.sourcePlatform,
        `${task.operation}:source`,
        task.params
      );

      // Then execute on target platform
      const targetResult = await this.executeOnPlatform(
        task.targetPlatform,
        `${task.operation}:target`,
        { ...task.params, sourceResult }
      );

      task.status = 'completed';
      task.completedAt = new Date();
      task.result = targetResult;
      this.emit('task-completed', { task });

      return targetResult;
    } catch (error) {
      task.status = 'failed';
      task.completedAt = new Date();
      task.error = error instanceof Error ? error.message : String(error);
      this.emit('task-failed', { task, error });
      throw error;
    }
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): CrossPlatformTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): CrossPlatformTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Find compatible platforms for an operation
   */
  findCompatiblePlatforms(capability: string): PlatformType[] {
    const compatible: PlatformType[] = [];
    for (const [type, adapter] of this.adapters) {
      const capabilities = adapter.getCapabilities();
      if (capabilities.some(c => c.name === capability && c.supported)) {
        compatible.push(type);
      }
    }
    return compatible;
  }

  /**
   * Bridge operation between blockchain platforms
   */
  async bridgeAssets(
    sourceChain: PlatformType,
    targetChain: PlatformType,
    asset: string,
    amount: bigint
  ): Promise<{ transactionHash: string; estimatedTime: number }> {
    if (!this.config.enableCrossChain) {
      throw new Error('Cross-chain operations are not enabled');
    }

    // Validate chains support bridging
    const sourceCapabilities = this.getPlatformCapabilities(sourceChain);
    const targetCapabilities = this.getPlatformCapabilities(targetChain);

    if (!sourceCapabilities.some(c => c.name === 'smart-contracts' && c.supported)) {
      throw new Error(`Source chain ${sourceChain} does not support smart contracts`);
    }
    if (!targetCapabilities.some(c => c.name === 'smart-contracts' && c.supported)) {
      throw new Error(`Target chain ${targetChain} does not support smart contracts`);
    }

    // Create bridge task
    const task = await this.createCrossPlatformTask(
      `Bridge ${asset} from ${sourceChain} to ${targetChain}`,
      sourceChain,
      targetChain,
      'bridge',
      { asset, amount: amount.toString() }
    );

    // Execute bridge
    await this.executeCrossPlatformTask(task.id);

    return {
      transactionHash: `0x${uuidv4().replace(/-/g, '')}`,
      estimatedTime: 600 // 10 minutes estimated
    };
  }

  /**
   * Deploy to multiple platforms
   */
  async multiPlatformDeploy(
    platforms: PlatformType[],
    deployment: {
      name: string;
      version: string;
      artifacts: Record<string, unknown>;
      config: Record<string, unknown>;
    }
  ): Promise<Map<PlatformType, { success: boolean; url?: string; error?: string }>> {
    const results = new Map<PlatformType, { success: boolean; url?: string; error?: string }>();

    for (const platform of platforms) {
      try {
        const result = await this.executeOnPlatform(platform, 'deploy', deployment);
        results.set(platform, {
          success: true,
          url: `https://${deployment.name}.${platform}.example.com`
        });
      } catch (error) {
        results.set(platform, {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    this.emit('multi-deploy-completed', { platforms, results: Object.fromEntries(results) });

    return results;
  }

  /**
   * Sync state across platforms
   */
  async syncState(
    platforms: PlatformType[],
    state: Record<string, unknown>
  ): Promise<void> {
    const syncPromises = platforms.map(async platform => {
      await this.executeOnPlatform(platform, 'sync-state', { state });
    });

    await Promise.all(syncPromises);
    this.emit('state-synced', { platforms, state });
  }
}

// Factory function
export function createMultiPlatformIntegration(config?: Partial<IntegrationConfig>): MultiPlatformIntegration {
  return new MultiPlatformIntegration(config);
}

// Export platform registry
export const PlatformRegistry = {
  blockchain: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'bsc', 'solana'] as PlatformType[],
  devops: ['github', 'gitlab'] as PlatformType[],
  cloud: ['aws', 'gcp', 'azure'] as PlatformType[],
  deployment: ['vercel', 'railway'] as PlatformType[],

  isBlockchain(type: PlatformType): boolean {
    return this.blockchain.includes(type);
  },

  isDevOps(type: PlatformType): boolean {
    return this.devops.includes(type);
  },

  isCloud(type: PlatformType): boolean {
    return this.cloud.includes(type);
  },

  isDeployment(type: PlatformType): boolean {
    return this.deployment.includes(type);
  },

  getCategory(type: PlatformType): string {
    if (this.isBlockchain(type)) return 'blockchain';
    if (this.isDevOps(type)) return 'devops';
    if (this.isCloud(type)) return 'cloud';
    if (this.isDeployment(type)) return 'deployment';
    return 'unknown';
  }
};
