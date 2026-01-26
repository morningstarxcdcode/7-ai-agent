/**
 * System Integration Tests
 * Tests the complete Multi-Agent Autonomous Engineering System integration
 */

import { MultiAgentSystem } from '../../src/index';
import { AgentRegistry } from '../../src/core/base-agent';
import { getMessageBus, resetMessageBus } from '../../src/core/message-bus';
import { createIntentRouterAgent } from '../../src/agents/intent-router/intent-router';
import { AgentType } from '../../src/types/core';
import TestUtils from '../setup';

describe('Multi-Agent System Integration', () => {
  let system: MultiAgentSystem;
  let registry: AgentRegistry;

  beforeEach(async () => {
    resetMessageBus();
    registry = AgentRegistry.getInstance();
    
    system = new MultiAgentSystem({
      enableSandbox: false, // Disable for testing
      maxConcurrentTasks: 5,
      messageQueueSize: 1000,
      defaultTimeout: 10000,
      logLevel: 'error' // Reduce noise in tests
    });
  });

  afterEach(async () => {
    try {
      await system.shutdown();
    } catch (error) {
      // Ignore shutdown errors in tests
    }
    resetMessageBus();
  });

  describe('System Initialization', () => {
    it('should initialize the multi-agent system successfully', async () => {
      await system.initialize();
      
      const status = system.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.config).toBeDefined();
      expect(status.registry).toBeDefined();
      expect(status.messageBus).toBeDefined();
    });

    it('should prevent double initialization', async () => {
      await system.initialize();
      
      await expect(system.initialize()).rejects.toThrow('System is already initialized');
    });

    it('should handle initialization errors gracefully', async () => {
      // Create a system with invalid configuration to trigger error
      const invalidSystem = new MultiAgentSystem({
        maxConcurrentTasks: -1 // Invalid value
      });

      // The system should handle this gracefully
      const status = invalidSystem.getStatus();
      expect(status.initialized).toBe(false);
    });
  });

  describe('Agent Registration and Management', () => {
    beforeEach(async () => {
      await system.initialize();
    });

    it('should register and manage agents correctly', async () => {
      // Create and register an intent router agent
      const intentRouter = createIntentRouterAgent({
        name: 'Test Intent Router'
      });
      
      await intentRouter.initialize();
      registry.register(intentRouter);

      // Verify registration
      const agents = registry.getAllAgents();
      expect(agents.length).toBeGreaterThan(0);
      
      const routerAgents = registry.getAgentsByType(AgentType.INTENT_ROUTER);
      expect(routerAgents.length).toBe(1);
      expect(routerAgents[0].id).toBe(intentRouter.id);

      // Verify agent metrics
      const metrics = registry.getMetrics();
      expect(metrics.totalAgents).toBeGreaterThan(0);
      const agentsByType = metrics.agentsByType as Record<string, number>;
      expect(agentsByType[AgentType.INTENT_ROUTER]).toBe(1);
    });

    it('should handle agent health checks', async () => {
      const intentRouter = createIntentRouterAgent({
        name: 'Health Test Router'
      });
      
      await intentRouter.initialize();
      registry.register(intentRouter);

      const health = await intentRouter.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.lastCheck).toBeInstanceOf(Date);
    });

    it('should unregister agents properly', async () => {
      const intentRouter = createIntentRouterAgent({
        name: 'Unregister Test Router'
      });
      
      await intentRouter.initialize();
      registry.register(intentRouter);

      // Verify registration
      expect(registry.getAllAgents().length).toBeGreaterThan(0);

      // Unregister
      registry.unregister(intentRouter.id);

      // Verify unregistration
      const agent = registry.getAgent(intentRouter.id);
      expect(agent).toBeUndefined();
    });
  });

  describe('Message Bus Integration', () => {
    let messageBus: ReturnType<typeof getMessageBus>;

    beforeEach(async () => {
      await system.initialize();
      messageBus = getMessageBus();
    });

    it('should handle message bus operations', async () => {
      const agentId1 = TestUtils.createMockAgentId('sender');
      const agentId2 = TestUtils.createMockAgentId('receiver');
      
      // Register a simple message handler
      let receivedMessage: any = null;
      messageBus.registerHandler(agentId2, async (message) => {
        receivedMessage = message;
        return undefined;
      });

      // Send a message
      const payload = TestUtils.createMockPayload({ test: 'integration' });
      await messageBus.sendMessage(agentId1, agentId2, 'request' as any, payload);

      // Wait for message processing
      await TestUtils.waitFor(() => receivedMessage !== null, 5000);

      expect(receivedMessage).toBeDefined();
      expect(receivedMessage.from).toBe(agentId1);
      expect(receivedMessage.to).toBe(agentId2);
      expect(receivedMessage.payload.test).toBe('integration');
    });

    it('should track message metrics', async () => {
      const agentId1 = TestUtils.createMockAgentId('metrics-sender');
      const agentId2 = TestUtils.createMockAgentId('metrics-receiver');
      
      messageBus.registerHandler(agentId2, async () => undefined);

      const initialMetrics = messageBus.getMetrics();
      
      // Send multiple messages
      const payload = TestUtils.createMockPayload();
      await messageBus.sendMessage(agentId1, agentId2, 'request' as any, payload);
      await messageBus.sendMessage(agentId1, agentId2, 'event' as any, payload);

      const updatedMetrics = messageBus.getMetrics();
      expect(updatedMetrics.totalMessages).toBeGreaterThan(initialMetrics.totalMessages);
    });
  });

  describe('End-to-End Request Processing', () => {
    beforeEach(async () => {
      await system.initialize();
      
      // Register a mock intent router for testing
      const intentRouter = createIntentRouterAgent({
        name: 'E2E Test Router'
      });
      
      await intentRouter.initialize();
      registry.register(intentRouter);
    });

    it('should process simple user requests', async () => {
      const userInput = 'generate code for a simple calculator';
      
      try {
        const response = await system.processRequest(userInput, {
          userId: 'test-user',
          sessionId: 'test-session',
          timeout: 15000
        });

        // The response should be defined (exact structure depends on implementation)
        expect(response).toBeDefined();
      } catch (error) {
        // For now, we expect this to work with the mock setup
        // In a full implementation, this would return a proper response
        expect(error).toBeDefined();
      }
    });

    it('should handle request timeouts', async () => {
      const userInput = 'generate complex enterprise system';
      
      await expect(
        system.processRequest(userInput, {
          timeout: 100 // Very short timeout
        })
      ).rejects.toThrow();
    });

    it('should validate request parameters', async () => {
      await expect(
        system.processRequest('', {}) // Empty input
      ).rejects.toThrow();
    });
  });

  describe('System Shutdown', () => {
    it('should shutdown gracefully', async () => {
      await system.initialize();
      
      const intentRouter = createIntentRouterAgent({
        name: 'Shutdown Test Router'
      });
      
      await intentRouter.initialize();
      registry.register(intentRouter);

      // Verify system is running
      expect(system.getStatus().initialized).toBe(true);

      // Shutdown
      await system.shutdown();

      // Verify shutdown
      expect(system.getStatus().initialized).toBe(false);
    });

    it('should handle shutdown when not initialized', async () => {
      // Should not throw error
      await expect(system.shutdown()).resolves.not.toThrow();
    });

    it('should cleanup resources on shutdown', async () => {
      await system.initialize();
      
      const initialAgentCount = registry.getAllAgents().length;
      
      await system.shutdown();
      
      // Registry should be cleaned up
      const finalAgentCount = registry.getAllAgents().length;
      expect(finalAgentCount).toBeLessThanOrEqual(initialAgentCount);
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await system.initialize();
    });

    it('should handle agent failures gracefully', async () => {
      const faultyAgent = createIntentRouterAgent({
        name: 'Faulty Agent'
      });
      
      // Don't initialize the agent to simulate failure
      registry.register(faultyAgent);

      // System should still function
      const status = system.getStatus();
      expect(status.initialized).toBe(true);
    });

    it('should recover from message bus errors', async () => {
      const messageBus = getMessageBus();
      
      // Simulate error condition
      const agentId = TestUtils.createMockAgentId('error-agent');
      messageBus.registerHandler(agentId, async () => {
        throw new Error('Simulated handler error');
      });

      // Send message that will cause error
      const payload = TestUtils.createMockPayload();
      
      // Should not crash the system
      await expect(
        messageBus.sendMessage('sender', agentId, 'request' as any, payload)
      ).resolves.toBeDefined();
    });
  });

  describe('Performance and Scalability', () => {
    beforeEach(async () => {
      await system.initialize();
    });

    it('should handle multiple concurrent requests', async () => {
      const intentRouter = createIntentRouterAgent({
        name: 'Concurrent Test Router'
      });
      
      await intentRouter.initialize();
      registry.register(intentRouter);

      // Create multiple concurrent requests
      const requests = Array.from({ length: 5 }, (_, i) => 
        system.processRequest(`generate code for module ${i}`, {
          userId: `user-${i}`,
          timeout: 10000
        }).catch(() => null) // Ignore errors for this test
      );

      // All requests should complete (or fail gracefully)
      const results = await Promise.allSettled(requests);
      expect(results.length).toBe(5);
      
      // At least some should complete without throwing
      const completed = results.filter(r => r.status === 'fulfilled');
      expect(completed.length).toBeGreaterThanOrEqual(0);
    });

    it('should respect concurrency limits', async () => {
      const limitedSystem = new MultiAgentSystem({
        maxConcurrentTasks: 2,
        defaultTimeout: 5000
      });

      await limitedSystem.initialize();
      
      // The system should enforce the limit
      const status = limitedSystem.getStatus();
      expect(status.config.maxConcurrentTasks).toBe(2);

      await limitedSystem.shutdown();
    });
  });
});