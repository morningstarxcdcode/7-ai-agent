/**
 * Message Bus Tests
 * Tests for the core message bus infrastructure
 */

import { MessageBus, getMessageBus, resetMessageBus } from '../../src/core/message-bus';
import { MessageType, Priority } from '../../src/types/core';
import TestUtils from '../setup';

describe('MessageBus', () => {
  let messageBus: MessageBus;
  const agentId1 = TestUtils.createMockAgentId('agent1');
  const agentId2 = TestUtils.createMockAgentId('agent2');

  beforeEach(() => {
    resetMessageBus();
    messageBus = getMessageBus();
  });

  afterEach(async () => {
    await messageBus.shutdown();
    resetMessageBus();
  });

  describe('Message Sending', () => {
    it('should send a message successfully', async () => {
      const payload = TestUtils.createMockPayload();
      
      const messageId = await messageBus.sendMessage(
        agentId1,
        agentId2,
        MessageType.REQUEST,
        payload
      );

      expect(messageId).toBeValidAgentId();
      expect(typeof messageId).toBe('string');
      expect(messageId.length).toBeGreaterThan(0);
    });

    it('should validate message parameters', async () => {
      const payload = TestUtils.createMockPayload();

      // Test missing sender
      await expect(
        messageBus.sendMessage('', agentId2, MessageType.REQUEST, payload)
      ).rejects.toThrow('Message must have a sender');

      // Test missing recipient
      await expect(
        messageBus.sendMessage(agentId1, '', MessageType.REQUEST, payload)
      ).rejects.toThrow('Message must have a recipient');

      // Test missing payload
      await expect(
        messageBus.sendMessage(agentId1, agentId2, MessageType.REQUEST, null as any)
      ).rejects.toThrow('Message must have a payload');
    });

    it('should handle different message priorities', async () => {
      const payload = TestUtils.createMockPayload();
      
      const priorities = [Priority.LOW, Priority.MEDIUM, Priority.HIGH, Priority.CRITICAL];
      
      for (const priority of priorities) {
        const messageId = await messageBus.sendMessage(
          agentId1,
          agentId2,
          MessageType.REQUEST,
          payload,
          { priority }
        );
        
        expect(messageId).toBeValidAgentId();
      }
    });
  });

  describe('Message Handling', () => {
    it('should register and handle messages', async () => {
      const receivedMessages: any[] = [];
      
      // Register handler
      messageBus.registerHandler(agentId2, async (message) => {
        receivedMessages.push(message);
        return {
          id: TestUtils.randomString(),
          from: agentId2,
          to: message.from,
          type: MessageType.RESPONSE,
          payload: { received: true },
          priority: Priority.MEDIUM,
          timestamp: new Date(),
          correlationId: message.correlationId
        };
      });

      const payload = TestUtils.createMockPayload();
      await messageBus.sendMessage(agentId1, agentId2, MessageType.REQUEST, payload);

      // Wait for message processing
      await TestUtils.waitFor(() => receivedMessages.length > 0);

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0]).toBeValidMessage();
      expect(receivedMessages[0].from).toBe(agentId1);
      expect(receivedMessages[0].to).toBe(agentId2);
      expect(receivedMessages[0].payload).toEqual(payload);
    });

    it('should handle request-response pattern', async () => {
      // Register handler that responds
      messageBus.registerHandler(agentId2, async (message) => {
        return {
          id: TestUtils.randomString(),
          from: agentId2,
          to: message.from,
          type: MessageType.RESPONSE,
          payload: { echo: message.payload },
          priority: Priority.MEDIUM,
          timestamp: new Date(),
          correlationId: message.correlationId
        };
      });

      const payload = TestUtils.createMockPayload();
      const response = await messageBus.sendRequest(
        agentId1,
        agentId2,
        'test_action',
        payload
      );

      expect(response).toBeValidMessage();
      expect(response.type).toBe(MessageType.RESPONSE);
      expect(response.from).toBe(agentId2);
      expect(response.to).toBe(agentId1);
      expect(response.payload.echo).toEqual(payload);
    });

    it('should timeout on unresponsive handlers', async () => {
      // Register handler that never responds
      messageBus.registerHandler(agentId2, async () => {
        await TestUtils.sleep(10000); // Long delay
        return undefined;
      });

      const payload = TestUtils.createMockPayload();
      
      await expect(
        messageBus.sendRequest(agentId1, agentId2, 'test_action', payload, {
          timeoutMs: 1000
        })
      ).rejects.toThrow('Request timeout');
    });
  });

  describe('Event Broadcasting', () => {
    it('should broadcast events to all registered agents', async () => {
      const receivedEvents: Record<string, any[]> = {
        [agentId1]: [],
        [agentId2]: []
      };

      // Register handlers for both agents
      messageBus.registerHandler(agentId1, async (message) => {
        receivedEvents[agentId1].push(message);
      });

      messageBus.registerHandler(agentId2, async (message) => {
        receivedEvents[agentId2].push(message);
      });

      const broadcaster = TestUtils.createMockAgentId('broadcaster');
      const payload = TestUtils.createMockPayload();

      await messageBus.broadcastEvent(broadcaster, 'test_event', payload);

      // Wait for event processing
      await TestUtils.waitFor(() => 
        receivedEvents[agentId1].length > 0 && receivedEvents[agentId2].length > 0
      );

      expect(receivedEvents[agentId1]).toHaveLength(1);
      expect(receivedEvents[agentId2]).toHaveLength(1);
      
      expect(receivedEvents[agentId1][0].type).toBe(MessageType.EVENT);
      expect(receivedEvents[agentId2][0].type).toBe(MessageType.EVENT);
    });

    it('should exclude specified agents from broadcast', async () => {
      const receivedEvents: Record<string, any[]> = {
        [agentId1]: [],
        [agentId2]: []
      };

      messageBus.registerHandler(agentId1, async (message) => {
        receivedEvents[agentId1].push(message);
      });

      messageBus.registerHandler(agentId2, async (message) => {
        receivedEvents[agentId2].push(message);
      });

      const broadcaster = TestUtils.createMockAgentId('broadcaster');
      const payload = TestUtils.createMockPayload();

      await messageBus.broadcastEvent(broadcaster, 'test_event', payload, {
        excludeAgents: [agentId1]
      });

      // Wait a bit to ensure messages are processed
      await TestUtils.sleep(100);

      expect(receivedEvents[agentId1]).toHaveLength(0);
      expect(receivedEvents[agentId2]).toHaveLength(1);
    });
  });

  describe('Message Filtering and History', () => {
    it('should filter messages by criteria', async () => {
      const payload1 = TestUtils.createMockPayload({ type: 'test1' });
      const payload2 = TestUtils.createMockPayload({ type: 'test2' });

      await messageBus.sendMessage(agentId1, agentId2, MessageType.REQUEST, payload1);
      await messageBus.sendMessage(agentId2, agentId1, MessageType.EVENT, payload2);

      const requestMessages = messageBus.getMessages({ type: MessageType.REQUEST });
      const eventMessages = messageBus.getMessages({ type: MessageType.EVENT });
      const fromAgent1 = messageBus.getMessages({ from: agentId1 });

      expect(requestMessages).toHaveLength(1);
      expect(eventMessages).toHaveLength(1);
      expect(fromAgent1).toHaveLength(1);
      
      expect(requestMessages[0].type).toBe(MessageType.REQUEST);
      expect(eventMessages[0].type).toBe(MessageType.EVENT);
      expect(fromAgent1[0].from).toBe(agentId1);
    });

    it('should limit message history results', async () => {
      const payload = TestUtils.createMockPayload();
      
      // Send multiple messages
      for (let i = 0; i < 5; i++) {
        await messageBus.sendMessage(agentId1, agentId2, MessageType.REQUEST, payload);
      }

      const messages = messageBus.getMessages({}, 3);
      expect(messages).toHaveLength(3);
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should track message metrics', async () => {
      const payload = TestUtils.createMockPayload();
      
      const initialMetrics = messageBus.getMetrics();
      
      await messageBus.sendMessage(agentId1, agentId2, MessageType.REQUEST, payload);
      await messageBus.sendMessage(agentId1, agentId2, MessageType.EVENT, payload);

      const updatedMetrics = messageBus.getMetrics();
      
      expect(updatedMetrics.totalMessages).toBeGreaterThan(initialMetrics.totalMessages);
      expect(updatedMetrics.messagesByType[MessageType.REQUEST]).toBeGreaterThan(0);
      expect(updatedMetrics.messagesByType[MessageType.EVENT]).toBeGreaterThan(0);
    });

    it('should clear message history', () => {
      const payload = TestUtils.createMockPayload();
      
      messageBus.sendMessage(agentId1, agentId2, MessageType.REQUEST, payload);
      
      let messages = messageBus.getMessages({});
      expect(messages.length).toBeGreaterThan(0);
      
      messageBus.clearHistory();
      
      messages = messageBus.getMessages({});
      expect(messages).toHaveLength(0);
      
      const metrics = messageBus.getMetrics();
      expect(metrics.totalMessages).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle handler errors gracefully', async () => {
      const errorMessage = 'Handler error';
      
      // Register handler that throws error
      messageBus.registerHandler(agentId2, async () => {
        throw new Error(errorMessage);
      });

      const payload = TestUtils.createMockPayload();
      
      // Should not throw, but should emit error event
      const errorPromise = new Promise((resolve) => {
        messageBus.once('message-error', resolve);
      });

      await messageBus.sendMessage(agentId1, agentId2, MessageType.REQUEST, payload);
      
      const errorEvent = await errorPromise;
      expect(errorEvent).toBeDefined();
    });

    it('should send error responses for failed requests', async () => {
      // Register handler that throws error
      messageBus.registerHandler(agentId2, async () => {
        throw new Error('Request failed');
      });

      const payload = TestUtils.createMockPayload();
      
      const response = await messageBus.sendRequest(
        agentId1,
        agentId2,
        'failing_action',
        payload,
        { timeoutMs: 5000 }
      );

      expect(response.type).toBe(MessageType.ERROR);
      expect(response.payload.error).toContain('Request failed');
    });
  });
});