/**
 * WebSocket Service for Real-time Communication
 * 
 * Handles WebSocket connections, message routing, and real-time updates
 * for the chat interface and agent status monitoring.
 * 
 * Requirements: 2.3, 2.4
 */

// Browser-compatible EventEmitter
type EventListener = (...args: any[]) => void;

class BrowserEventEmitter {
  private events: Map<string, EventListener[]> = new Map();

  on(event: string, listener: EventListener): this {
    const listeners = this.events.get(event) || [];
    listeners.push(listener);
    this.events.set(event, listeners);
    return this;
  }

  off(event: string, listener: EventListener): this {
    const listeners = this.events.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    const listeners = this.events.get(event);
    if (listeners && listeners.length > 0) {
      listeners.forEach(listener => listener(...args));
      return true;
    }
    return false;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }
}

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
  id?: string;
}

export interface ConnectionConfig {
  url: string;
  userId: string;
  conversationId?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export class WebSocketService extends BrowserEventEmitter {
  private ws: WebSocket | null = null;
  private config: ConnectionConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isConnecting = false;
  private messageQueue: WebSocketMessage[] = [];

  constructor(config: ConnectionConfig) {
    super();
    this.config = {
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      ...config
    };
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
        resolve();
        return;
      }

      this.isConnecting = true;
      const wsUrl = `${this.config.url}/${this.config.userId}/${this.config.conversationId || 'new'}`;
      
      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.emit('connected');
          
          // Send queued messages
          this.flushMessageQueue();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
            this.emit('error', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          this.isConnecting = false;
          this.emit('disconnected', event);
          
          // Attempt to reconnect if not a clean close
          if (event.code !== 1000 && this.reconnectAttempts < this.config.maxReconnectAttempts!) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          this.emit('error', error);
          reject(error);
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.reconnectAttempts = this.config.maxReconnectAttempts!;
    this.emit('disconnected', { code: 1000, reason: 'Client disconnect' });
  }

  /**
   * Send message to server
   */
  send(message: Omit<WebSocketMessage, 'timestamp' | 'id'>): void {
    const fullMessage: WebSocketMessage = {
      ...message,
      id: this.generateMessageId(),
      timestamp: new Date().toISOString()
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(fullMessage));
    } else {
      // Queue message for later sending
      this.messageQueue.push(fullMessage);
      
      // Attempt to connect if not connected
      if (!this.isConnecting) {
        this.connect().catch(error => {
          console.error('Failed to connect for message sending:', error);
        });
      }
    }
  }

  /**
   * Send user message
   */
  sendUserMessage(content: string, metadata?: any): void {
    this.send({
      type: 'user_message',
      payload: {
        content,
        user_id: this.config.userId,
        conversation_id: this.config.conversationId,
        metadata
      }
    });
  }

  /**
   * Send action approval
   */
  sendActionApproval(actionId: string, approved: boolean, action: any): void {
    this.send({
      type: 'action_approval',
      payload: {
        action_id: actionId,
        approved,
        action,
        user_id: this.config.userId,
        conversation_id: this.config.conversationId
      }
    });
  }

  /**
   * Send typing indicator
   */
  sendTypingIndicator(isTyping: boolean): void {
    this.send({
      type: 'typing_indicator',
      payload: {
        is_typing: isTyping,
        user_id: this.config.userId,
        conversation_id: this.config.conversationId
      }
    });
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection state
   */
  getConnectionState(): string {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'unknown';
    }
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'message_response':
        this.emit('message', message.payload);
        break;

      case 'agent_status_update':
        this.emit('agent_status', message.payload);
        break;

      case 'typing_indicator':
        this.emit('typing', message.payload);
        break;

      case 'action_result':
        this.emit('action_result', message.payload);
        break;

      case 'system_notification':
        this.emit('notification', message.payload);
        break;

      case 'error':
        this.emit('error', message.payload);
        break;

      case 'ping':
        // Respond to ping with pong
        this.send({
          type: 'pong',
          payload: message.payload
        });
        break;

      default:
        console.warn('Unknown message type:', message.type);
        this.emit('unknown_message', message);
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.config.reconnectInterval! * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Flush queued messages
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
      }
    }
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * WebSocket Service Factory
 */
export class WebSocketServiceFactory {
  private static instances: Map<string, WebSocketService> = new Map();

  static getInstance(config: ConnectionConfig): WebSocketService {
    const key = `${config.userId}_${config.conversationId || 'default'}`;
    
    if (!this.instances.has(key)) {
      const service = new WebSocketService(config);
      this.instances.set(key, service);
      
      // Clean up on disconnect
      service.on('disconnected', () => {
        if (service.getConnectionState() === 'disconnected') {
          this.instances.delete(key);
        }
      });
    }

    return this.instances.get(key)!;
  }

  static cleanup(): void {
    this.instances.forEach(service => {
      service.disconnect();
    });
    this.instances.clear();
  }
}

export default WebSocketService;