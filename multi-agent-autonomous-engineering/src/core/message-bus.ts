/**
 * Message Bus Implementation for Multi-Agent Communication
 * Provides centralized communication infrastructure following the agent coordination steering
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AgentId, MessageId, Priority, MessageType } from '../types/core';

export interface BusMessage {
  id: MessageId;
  from: AgentId;
  to: AgentId;
  type: MessageType;
  action?: string;
  payload: Record<string, unknown>;
  priority: Priority;
  timestamp: Date;
  correlationId?: string;
  replyTo?: MessageId;
  ttl?: number; // Time to live in milliseconds
}

export interface MessageHandler {
  (message: BusMessage): Promise<BusMessage | void>;
}

export interface MessageFilter {
  from?: AgentId;
  to?: AgentId;
  type?: MessageType;
  action?: string;
  priority?: Priority;
}

export interface MessageBusConfig {
  maxQueueSize: number;
  defaultTTL: number;
  retryAttempts: number;
  retryDelayMs: number;
  enableMetrics: boolean;
}

export interface MessageMetrics {
  totalMessages: number;
  messagesByType: Record<MessageType, number>;
  messagesByPriority: Record<Priority, number>;
  averageProcessingTime: number;
  errorRate: number;
  queueSize: number;
}

export class MessageBus extends EventEmitter {
  private handlers: Map<AgentId, MessageHandler> = new Map();
  private messageQueue: Map<Priority, BusMessage[]> = new Map();
  private processingQueue: Set<MessageId> = new Set();
  private messageHistory: Map<MessageId, BusMessage> = new Map();
  private metrics: MessageMetrics;
  private config: MessageBusConfig;
  private isProcessing = false;

  constructor(config: Partial<MessageBusConfig> = {}) {
    super();
    
    this.config = {
      maxQueueSize: 10000,
      defaultTTL: 300000, // 5 minutes
      retryAttempts: 3,
      retryDelayMs: 1000,
      enableMetrics: true,
      ...config
    };

    // Initialize priority queues
    Object.values(Priority).forEach(priority => {
      if (typeof priority === 'number') {
        this.messageQueue.set(priority, []);
      }
    });

    this.metrics = {
      totalMessages: 0,
      messagesByType: {
        [MessageType.REQUEST]: 0,
        [MessageType.RESPONSE]: 0,
        [MessageType.EVENT]: 0,
        [MessageType.ERROR]: 0,
        [MessageType.CANCEL_STEP]: 0
      },
      messagesByPriority: {
        [Priority.LOW]: 0,
        [Priority.MEDIUM]: 0,
        [Priority.HIGH]: 0,
        [Priority.CRITICAL]: 0
      },
      averageProcessingTime: 0,
      errorRate: 0,
      queueSize: 0
    };

    // Start message processing
    this.startProcessing();
  }

  /**
   * Register a message handler for an agent
   */
  public registerHandler(agentId: AgentId, handler: MessageHandler): void {
    this.handlers.set(agentId, handler);
    this.emit('handler-registered', { agentId });
  }

  /**
   * Unregister a message handler for an agent
   */
  public unregisterHandler(agentId: AgentId): void {
    this.handlers.delete(agentId);
    this.emit('handler-unregistered', { agentId });
  }

  /**
   * Send a message through the bus
   */
  public async sendMessage(
    from: AgentId,
    to: AgentId,
    type: MessageType,
    payload: Record<string, unknown>,
    options: {
      action?: string;
      priority?: Priority;
      correlationId?: string;
      replyTo?: MessageId;
      ttl?: number;
    } = {}
  ): Promise<MessageId> {
    const message: BusMessage = {
      id: uuidv4(),
      from,
      to,
      type,
      payload,
      priority: options.priority ?? Priority.MEDIUM,
      timestamp: new Date(),
      ttl: options.ttl ?? this.config.defaultTTL,
      ...(options.action !== undefined && { action: options.action }),
      ...(options.correlationId !== undefined && { correlationId: options.correlationId }),
      ...(options.replyTo !== undefined && { replyTo: options.replyTo })
    };

    // Validate message
    this.validateMessage(message);

    // Store in history
    this.messageHistory.set(message.id, message);

    // Add to appropriate priority queue
    const queue = this.messageQueue.get(message.priority);
    if (!queue) {
      throw new Error(`Invalid priority: ${message.priority}`);
    }

    // Check queue size limits
    if (this.getTotalQueueSize() >= this.config.maxQueueSize) {
      throw new Error('Message queue is full');
    }

    queue.push(message);
    this.updateMetrics(message);

    this.emit('message-queued', message);
    return message.id;
  }

  /**
   * Send a request and wait for response
   */
  public async sendRequest(
    from: AgentId,
    to: AgentId,
    action: string,
    payload: Record<string, unknown>,
    options: {
      priority?: Priority;
      timeoutMs?: number;
      correlationId?: string;
    } = {}
  ): Promise<BusMessage> {
    const correlationId = options.correlationId || uuidv4();
    const timeoutMs = options.timeoutMs || 30000;

    // Send request
    await this.sendMessage(from, to, MessageType.REQUEST, payload, {
      action,
      ...(options.priority !== undefined && { priority: options.priority }),
      correlationId
    });

    // Wait for response
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeListener('message-processed', responseHandler);
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      const responseHandler = (processedMessage: BusMessage) => {
        if (
          (processedMessage.type === MessageType.RESPONSE || processedMessage.type === MessageType.ERROR) &&
          processedMessage.correlationId === correlationId &&
          processedMessage.from === to &&
          processedMessage.to === from
        ) {
          clearTimeout(timeout);
          this.removeListener('message-processed', responseHandler);
          resolve(processedMessage);
        }
      };

      this.on('message-processed', responseHandler);
    });
  }

  /**
   * Broadcast an event to all registered agents
   */
  public async broadcastEvent(
    from: AgentId,
    eventType: string,
    payload: Record<string, unknown>,
    options: {
      priority?: Priority;
      excludeAgents?: AgentId[];
    } = {}
  ): Promise<MessageId[]> {
    const messageIds: MessageId[] = [];
    const excludeSet = new Set(options.excludeAgents || []);
    excludeSet.add(from); // Don't send to sender

    for (const agentId of this.handlers.keys()) {
      if (!excludeSet.has(agentId)) {
        const messageId = await this.sendMessage(
          from,
          agentId,
          MessageType.EVENT,
          payload,
          {
            action: eventType,
            ...(options.priority !== undefined && { priority: options.priority })
          }
        );
        messageIds.push(messageId);
      }
    }

    return messageIds;
  }

  /**
   * Get messages matching filter criteria
   */
  public getMessages(filter: MessageFilter, limit = 100): BusMessage[] {
    const messages = Array.from(this.messageHistory.values());
    const filtered = messages.filter(message => {
      if (filter.from && message.from !== filter.from) return false;
      if (filter.to && message.to !== filter.to) return false;
      if (filter.type && message.type !== filter.type) return false;
      if (filter.action && message.action !== filter.action) return false;
      if (filter.priority && message.priority !== filter.priority) return false;
      return true;
    });

    return filtered
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get current metrics
   */
  public getMetrics(): MessageMetrics {
    this.metrics.queueSize = this.getTotalQueueSize();
    return { ...this.metrics };
  }

  /**
   * Clear message history and reset metrics
   */
  public clearHistory(): void {
    this.messageHistory.clear();
    this.metrics = {
      totalMessages: 0,
      messagesByType: {
        [MessageType.REQUEST]: 0,
        [MessageType.RESPONSE]: 0,
        [MessageType.EVENT]: 0,
        [MessageType.ERROR]: 0,
        [MessageType.CANCEL_STEP]: 0
      },
      messagesByPriority: {
        [Priority.LOW]: 0,
        [Priority.MEDIUM]: 0,
        [Priority.HIGH]: 0,
        [Priority.CRITICAL]: 0
      },
      averageProcessingTime: 0,
      errorRate: 0,
      queueSize: 0
    };
  }

  /**
   * Shutdown the message bus
   */
  public async shutdown(): Promise<void> {
    this.isProcessing = false;
    this.handlers.clear();
    this.messageQueue.clear();
    this.processingQueue.clear();
    this.removeAllListeners();
  }

  private validateMessage(message: BusMessage): void {
    if (!message.from) throw new Error('Message must have a sender');
    if (!message.to) throw new Error('Message must have a recipient');
    if (!message.type) throw new Error('Message must have a type');
    if (!message.payload) throw new Error('Message must have a payload');
    if (!Object.values(MessageType).includes(message.type)) {
      throw new Error(`Invalid message type: ${message.type}`);
    }
    if (!Object.values(Priority).includes(message.priority)) {
      throw new Error(`Invalid priority: ${message.priority}`);
    }
  }

  private async startProcessing(): Promise<void> {
    this.isProcessing = true;
    
    while (this.isProcessing) {
      try {
        const message = this.getNextMessage();
        if (message) {
          await this.processMessage(message);
        } else {
          // No messages to process, wait a bit
          await this.sleep(10);
        }
      } catch (error) {
        this.emit('processing-error', error);
        await this.sleep(100); // Brief pause on error
      }
    }
  }

  private getNextMessage(): BusMessage | null {
    // Process messages by priority (highest first)
    const priorities = [Priority.CRITICAL, Priority.HIGH, Priority.MEDIUM, Priority.LOW];
    
    for (const priority of priorities) {
      const queue = this.messageQueue.get(priority);
      if (queue && queue.length > 0) {
        const message = queue.shift();
        if (message && !this.isMessageExpired(message)) {
          return message;
        }
      }
    }
    
    return null;
  }

  private async processMessage(message: BusMessage): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Check if message is already being processed
      if (this.processingQueue.has(message.id)) {
        return;
      }
      
      this.processingQueue.add(message.id);
      
      // Find handler for recipient
      const handler = this.handlers.get(message.to);
      if (!handler) {
        if (message.type === MessageType.RESPONSE || message.type === MessageType.ERROR) {
          this.emit('message-processed', message);
          return;
        }
        throw new Error(`No handler registered for agent: ${message.to}`);
      }
      
      // Process message
      const response = await handler(message);
      
      // If handler returns a response, send it back
      if (response) {
        const responseQueue = this.messageQueue.get(response.priority);
        if (responseQueue) {
          responseQueue.push(response);
        }
      }
      
      this.emit('message-processed', message);
      
    } catch (error) {
      this.emit('message-error', { message, error });
      
      // Send error response if this was a request
      if (message.type === MessageType.REQUEST) {
        await this.sendErrorResponse(message, error as Error);
      }
      
      this.updateErrorMetrics();
    } finally {
      this.processingQueue.delete(message.id);
      
      // Update processing time metrics
      const processingTime = Date.now() - startTime;
      this.updateProcessingTimeMetrics(processingTime);
    }
  }

  private async sendErrorResponse(originalMessage: BusMessage, error: Error): Promise<void> {
    try {
      await this.sendMessage(
        originalMessage.to,
        originalMessage.from,
        MessageType.ERROR,
        {
          error: error.message,
          originalMessageId: originalMessage.id,
          timestamp: new Date().toISOString()
        },
        {
          ...(originalMessage.correlationId !== undefined && { correlationId: originalMessage.correlationId }),
          replyTo: originalMessage.id,
          priority: originalMessage.priority
        }
      );
    } catch (sendError) {
      this.emit('error-response-failed', { originalMessage, error, sendError });
    }
  }

  private isMessageExpired(message: BusMessage): boolean {
    if (!message.ttl) return false;
    const age = Date.now() - message.timestamp.getTime();
    return age > message.ttl;
  }

  private getTotalQueueSize(): number {
    let total = 0;
    for (const queue of this.messageQueue.values()) {
      total += queue.length;
    }
    return total;
  }

  private updateMetrics(message: BusMessage): void {
    if (!this.config.enableMetrics) return;
    
    this.metrics.totalMessages++;
    this.metrics.messagesByType[message.type]++;
    this.metrics.messagesByPriority[message.priority]++;
  }

  private updateProcessingTimeMetrics(processingTime: number): void {
    if (!this.config.enableMetrics) return;
    
    // Simple moving average
    const alpha = 0.1;
    this.metrics.averageProcessingTime = 
      (1 - alpha) * this.metrics.averageProcessingTime + alpha * processingTime;
  }

  private updateErrorMetrics(): void {
    if (!this.config.enableMetrics) return;
    
    // Simple error rate calculation
    const totalProcessed = this.metrics.totalMessages;
    if (totalProcessed > 0) {
      this.metrics.errorRate = (this.metrics.errorRate * (totalProcessed - 1) + 1) / totalProcessed;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance for global access
let messageBusInstance: MessageBus | null = null;

export function getMessageBus(config?: Partial<MessageBusConfig>): MessageBus {
  if (!messageBusInstance) {
    messageBusInstance = new MessageBus(config);
  }
  return messageBusInstance;
}

export function resetMessageBus(): void {
  if (messageBusInstance) {
    messageBusInstance.shutdown();
    messageBusInstance = null;
  }
}