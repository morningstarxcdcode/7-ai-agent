/**
 * Multi-Agent Autonomous Engineering System
 * Main entry point for the 7-agent platform with workflow orchestration
 */

// Core system components
export { BaseAgentImpl, AgentRegistry } from './core/base-agent';
export { MessageBus, getMessageBus, resetMessageBus } from './core/message-bus';
export { WorkflowOrchestrator, getWorkflowOrchestrator, resetWorkflowOrchestrator } from './core/workflow-orchestrator';
export { ContextStore, getContextStore, resetContextStore } from './core/context-store';
export { MultiAgentSystem, MultiAgentSystemConfig, SystemStatus, ProcessRequestOptions, ProcessRequestResult } from './core/multi-agent-system';

// Agent implementations
export { IntentRouter } from './agents/intent-router';

// DeFi integrations
export { DeFiAPIClient, createDeFiAPIClient, deFiAPI } from './integrations/defi-api-client';
export type { 
  DeFiAPIConfig, 
  TokenSecurityResult, 
  SwapQuoteParams, 
  SwapQuoteResult,
  ProtocolTVL,
  YieldPool 
} from './integrations/defi-api-client';

// Type definitions
export * from './types/core';
export * from './types/agents';
export * from './types/defi';

// Examples and demos
export { WorkflowOrchestrationDemo } from './examples/workflow-orchestration-demo';

// System initialization with workflow orchestration
export async function initializeSystem(): Promise<{
  intentRouter: IntentRouter;
  agentRegistry: AgentRegistry;
  messageBus: MessageBus;
  orchestrator: WorkflowOrchestrator;
  contextStore: ContextStore;
}> {
  const messageBus = getMessageBus();
  const orchestrator = getWorkflowOrchestrator();
  const contextStore = getContextStore();
  const agentRegistry = AgentRegistry.getInstance();
  
  const intentRouter = new IntentRouter({
    maxWorkflowsPerAgent: 10,
    defaultTimeoutMs: 300000,
    enableAdvancedNLP: true,
    confidenceThreshold: 0.7
  });
  
  await intentRouter.initialize();
  agentRegistry.register(intentRouter);
  
  return {
    intentRouter,
    agentRegistry,
    messageBus,
    orchestrator,
    contextStore
  };
}