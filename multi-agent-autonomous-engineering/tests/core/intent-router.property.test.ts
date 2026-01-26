/**
 * Property-Based Tests for Intent Router Agent
 * Tests universal properties that should hold across all valid inputs
 * 
 * Feature: multi-agent-autonomous-engineering
 * Property 1: Intent Analysis and Routing Consistency
 * Validates: Requirements 1.1, 1.2, 1.4, 1.5
 */

import * as fc from 'fast-check';
import { IntentRouter } from '../../src/agents/intent-router';
import { IntentCategory, ComplexityLevel, RiskLevel, AgentType } from '../../src/types/core';
import { resetMessageBus } from '../../src/core/message-bus';

describe('Intent Router Agent - Property Tests', () => {
  let agent: IntentRouter;

  beforeEach(async () => {
    resetMessageBus();
    agent = new IntentRouter({
      id: 'test-intent-router-property',
      confidenceThreshold: 0.5
    });
    await agent.initialize();
  });

  afterEach(async () => {
    await agent.shutdown();
    resetMessageBus();
  });

  /**
   * Property 1: Intent Analysis and Routing Consistency
   * For any user input, the Intent_Router should consistently analyze the request,
   * identify the primary intent category, and route to appropriate agents while
   * logging all routing decisions with reasoning for audit purposes.
   * 
   * Validates: Requirements 1.1, 1.2, 1.4, 1.5
   */
  it('Property Test: Intent analysis should be consistent and complete', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generator for user input strings
        fc.oneof(
          fc.string({ minLength: 5, maxLength: 200 }).filter(s => s.trim().length > 0),
          fc.constantFrom(
            'generate code for a user authentication system',
            'test the payment processing module',
            'validate security of smart contract',
            'research best practices for API design',
            'design a microservices architecture',
            'refactor the legacy codebase',
            'debug the failing unit tests',
            'deploy to production environment',
            'swap tokens on Ethereum mainnet',
            'create a TypeScript function',
            'write unit tests for authentication',
            'check contract for rug pull risks',
            'find the best API for price data',
            'build a scalable system architecture'
          )
        ),
        async (userInput: string) => {
          // Test the property
          const analysis = await agent.analyzeIntent(userInput);

          // Property assertions
          
          // 1. Analysis should always return a valid structure
          expect(analysis).toBeDefined();
          expect(analysis.primaryIntent).toBeDefined();
          expect(Object.values(IntentCategory)).toContain(analysis.primaryIntent);
          
          // 2. Secondary intents should be valid and different from primary
          expect(Array.isArray(analysis.secondaryIntents)).toBe(true);
          analysis.secondaryIntents.forEach(intent => {
            expect(Object.values(IntentCategory)).toContain(intent);
            expect(intent).not.toBe(analysis.primaryIntent);
          });
          
          // 3. Complexity should be valid
          expect(Object.values(ComplexityLevel)).toContain(analysis.complexity);
          
          // 4. Risk level should be valid
          expect(Object.values(RiskLevel)).toContain(analysis.riskLevel);
          
          // 5. Confidence should be between 0 and 1
          expect(analysis.confidence).toBeGreaterThanOrEqual(0);
          expect(analysis.confidence).toBeLessThanOrEqual(1);
          
          // 6. Required agents should be non-empty and valid
          expect(Array.isArray(analysis.requiredAgents)).toBe(true);
          expect(analysis.requiredAgents.length).toBeGreaterThan(0);
          analysis.requiredAgents.forEach(agentType => {
            expect(Object.values(AgentType)).toContain(agentType);
          });
          
          // 7. Estimated duration should be positive
          expect(analysis.estimatedDuration).toBeGreaterThan(0);
          
          // 8. Reasoning should be provided
          expect(typeof analysis.reasoning).toBe('string');
          expect(analysis.reasoning.length).toBeGreaterThan(0);
          
          // 9. Parameters should be an object
          expect(typeof analysis.parameters).toBe('object');
          expect(analysis.parameters).not.toBeNull();
          
          // 10. Consistency check - same input should produce same primary intent
          const secondAnalysis = await agent.analyzeIntent(userInput);
          expect(secondAnalysis.primaryIntent).toBe(analysis.primaryIntent);
          
          // 11. Intent Router and Audit Agent should always be included
          expect(analysis.requiredAgents).toContain(AgentType.INTENT_ROUTER);
          expect(analysis.requiredAgents).toContain(AgentType.AUDIT_AGENT);
          
          return true;
        }
      ),
      {
        numRuns: 100, // Minimum 100 iterations as specified in design
        timeout: 15000,
        verbose: true
      }
    );
  }, 45000);

  /**
   * Property 2: Ambiguous Intent Handling
   * For any ambiguous user input with low confidence, the Intent_Router should
   * either reject the request or require higher confidence before proceeding.
   * 
   * Validates: Requirements 1.3
   */
  it('Property Test: Low confidence inputs should be handled appropriately', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generator for ambiguous inputs
        fc.oneof(
          fc.constantFrom(
            'do something',
            'help me',
            'fix it',
            'make it better',
            'I need assistance',
            'can you help?',
            'what should I do?',
            'handle this',
            'process the data',
            'work on the project'
          ),
          // Very short inputs that are likely ambiguous
          fc.string({ minLength: 1, maxLength: 10 }).filter(s => 
            s.trim().length > 0 && 
            !s.includes('code') && 
            !s.includes('test') && 
            !s.includes('security')
          )
        ),
        async (ambiguousInput: string) => {
          const analysis = await agent.analyzeIntent(ambiguousInput);
          
          // For ambiguous inputs, confidence should reflect uncertainty
          if (analysis.confidence < 0.6) {
            // When routing with low confidence, should either succeed or throw error
            try {
              const workflow = await agent.routeToAgents(analysis);
              // If it succeeds, workflow should still be valid
              expect(workflow).toBeDefined();
              expect(workflow.steps.length).toBeGreaterThan(0);
            } catch (error) {
              // Should throw meaningful error about ambiguity
              expect(error).toBeInstanceOf(Error);
              expect((error as Error).message.toLowerCase()).toContain('ambiguous');
            }
          }
          
          return true;
        }
      ),
      {
        numRuns: 30,
        timeout: 10000
      }
    );
  }, 20000);

  /**
   * Property 3: Agent Routing Consistency
   * For any valid intent analysis, routing should produce a valid workflow
   * with appropriate agent assignments and dependencies.
   * 
   * Validates: Requirements 1.2
   */
  it('Property Test: Agent routing should produce valid workflows', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Use pre-analyzed intents to test routing
        fc.constantFrom(
          IntentCategory.CODE_GENERATION,
          IntentCategory.TESTING,
          IntentCategory.SECURITY_VALIDATION,
          IntentCategory.RESEARCH,
          IntentCategory.SYSTEM_DESIGN
        ),
        fc.constantFrom(ComplexityLevel.LOW, ComplexityLevel.MEDIUM, ComplexityLevel.HIGH),
        fc.constantFrom(RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH),
        async (primaryIntent: IntentCategory, complexity: ComplexityLevel, riskLevel: RiskLevel) => {
          // First analyze a real input to get proper required agents
          const testInputs: Record<string, string> = {
            code_generation: 'generate a TypeScript function',
            testing: 'write unit tests for the service',
            security_validation: 'validate smart contract security',
            research: 'research API integration patterns',
            system_design: 'design a microservices architecture'
          };
          
          const testInput = (testInputs[primaryIntent] || 'perform an operation') + ` with ${complexity} complexity`;
          const analysis = await agent.analyzeIntent(testInput);
          
          // Override some properties for testing
          analysis.complexity = complexity;
          analysis.riskLevel = riskLevel;
          analysis.confidence = 0.8; // Ensure high confidence for routing
          
          const workflow = await agent.routeToAgents(analysis);
          
          // Property assertions for workflow
          
          // 1. Workflow should have valid structure
          expect(workflow).toBeDefined();
          expect(typeof workflow.id).toBe('string');
          expect(workflow.id.length).toBeGreaterThan(0);
          
          // 2. Steps should be created for required agents
          expect(Array.isArray(workflow.steps)).toBe(true);
          expect(workflow.steps.length).toBeGreaterThan(0);
          
          // 3. Each step should have valid structure
          workflow.steps.forEach(step => {
            expect(typeof step.id).toBe('string');
            expect(step.id.length).toBeGreaterThan(0);
            expect(step.agentType).toBeDefined();
            expect(Object.values(AgentType)).toContain(step.agentType);
            expect(typeof step.action).toBe('string');
            expect(step.action.length).toBeGreaterThan(0);
            expect(typeof step.order).toBe('number');
            expect(step.order).toBeGreaterThanOrEqual(1);
            expect(typeof step.timeout).toBe('number');
            expect(step.timeout).toBeGreaterThan(0);
            expect(typeof step.required).toBe('boolean');
          });
          
          // 4. Dependencies should be valid
          expect(Array.isArray(workflow.dependencies)).toBe(true);
          workflow.dependencies.forEach(dep => {
            expect(typeof dep.stepId).toBe('string');
            expect(Array.isArray(dep.dependsOn)).toBe(true);
            // Dependency should reference valid step IDs
            const stepIds = workflow.steps.map(s => s.id);
            expect(stepIds).toContain(dep.stepId);
            dep.dependsOn.forEach(depId => {
              expect(stepIds).toContain(depId);
            });
          });
          
          // 5. Parallel groups should be valid
          expect(Array.isArray(workflow.parallelGroups)).toBe(true);
          workflow.parallelGroups.forEach(group => {
            expect(Array.isArray(group)).toBe(true);
            group.forEach(stepId => {
              const stepIds = workflow.steps.map(s => s.id);
              expect(stepIds).toContain(stepId);
            });
          });
          
          // 6. Workflow should reference the original intent
          expect(workflow.intent).toBeDefined();
          expect(workflow.intent.primaryIntent).toBe(analysis.primaryIntent);
          
          // 7. Workflow should have proper metadata
          expect(workflow.status).toBe('pending');
          expect(workflow.createdAt).toBeInstanceOf(Date);
          expect(workflow.updatedAt).toBeInstanceOf(Date);
          
          return true;
        }
      ),
      {
        numRuns: 50,
        timeout: 20000
      }
    );
  }, 35000);

  /**
   * Property 4: Workflow Orchestration Consistency
   * For any valid workflow, orchestration should produce a valid execution plan
   * with proper scheduling and dependencies.
   * 
   * Validates: Requirements 1.2
   */
  it('Property Test: Workflow orchestration should produce valid execution plans', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'create a simple function',
          'test the authentication module',
          'validate contract security',
          'research best practices'
        ),
        async (userInput: string) => {
          const analysis = await agent.analyzeIntent(userInput);
          analysis.confidence = 0.8; // Ensure routing succeeds
          
          const workflow = await agent.routeToAgents(analysis);
          const executionPlan = await agent.orchestrateWorkflow(workflow);
          
          // Property assertions for execution plan
          
          // 1. Execution plan should have valid structure
          expect(executionPlan).toBeDefined();
          expect(typeof executionPlan.id).toBe('string');
          expect(executionPlan.id.length).toBeGreaterThan(0);
          
          // 2. Should reference the original workflow
          expect(executionPlan.workflow).toEqual(workflow);
          
          // 3. Schedule should be valid
          expect(Array.isArray(executionPlan.schedule)).toBe(true);
          expect(executionPlan.schedule.length).toBe(workflow.steps.length);
          
          executionPlan.schedule.forEach(scheduleItem => {
            expect(typeof scheduleItem.stepId).toBe('string');
            expect(typeof scheduleItem.agentId).toBe('string');
            expect(scheduleItem.scheduledStart).toBeInstanceOf(Date);
            expect(typeof scheduleItem.estimatedDuration).toBe('number');
            expect(scheduleItem.estimatedDuration).toBeGreaterThan(0);
            expect(typeof scheduleItem.priority).toBe('number');
            expect(scheduleItem.priority).toBeGreaterThan(0);
          });
          
          // 4. Dependencies should be valid
          expect(Array.isArray(executionPlan.dependencies)).toBe(true);
          executionPlan.dependencies.forEach(dep => {
            expect(typeof dep.stepId).toBe('string');
            expect(Array.isArray(dep.dependsOn)).toBe(true);
            expect(['blocking', 'soft']).toContain(dep.type);
          });
          
          // 5. Estimated completion should be in the future
          expect(executionPlan.estimatedCompletion).toBeInstanceOf(Date);
          expect(executionPlan.estimatedCompletion.getTime()).toBeGreaterThan(Date.now());
          
          return true;
        }
      ),
      {
        numRuns: 30,
        timeout: 15000
      }
    );
  }, 25000);

  /**
   * Property 5: Execution Monitoring Consistency
   * For any execution plan, monitoring should provide accurate status information
   * and progress tracking.
   * 
   * Validates: Requirements 1.2, 1.4
   */
  it('Property Test: Execution monitoring should provide accurate status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'create a utility function',
          'write tests for the service',
          'check security vulnerabilities'
        ),
        async (userInput: string) => {
          const analysis = await agent.analyzeIntent(userInput);
          analysis.confidence = 0.8;
          
          const workflow = await agent.routeToAgents(analysis);
          const executionPlan = await agent.orchestrateWorkflow(workflow);
          const status = await agent.monitorExecution(executionPlan);
          
          // Property assertions for execution status
          
          // 1. Status should have valid structure
          expect(status).toBeDefined();
          expect(status.planId).toBe(executionPlan.id);
          
          // 2. Status should be valid
          expect(['pending', 'running', 'completed', 'failed', 'cancelled']).toContain(status.status);
          
          // 3. Progress should be valid percentage
          expect(typeof status.progress).toBe('number');
          expect(status.progress).toBeGreaterThanOrEqual(0);
          expect(status.progress).toBeLessThanOrEqual(100);
          
          // 4. Step arrays should be valid
          expect(Array.isArray(status.completedSteps)).toBe(true);
          expect(Array.isArray(status.failedSteps)).toBe(true);
          expect(Array.isArray(status.errors)).toBe(true);
          
          // 5. All step IDs should reference valid workflow steps
          const workflowStepIds = workflow.steps.map(s => s.id);
          status.completedSteps.forEach(stepId => {
            expect(workflowStepIds).toContain(stepId);
          });
          status.failedSteps.forEach(stepId => {
            expect(workflowStepIds).toContain(stepId);
          });
          
          // 6. Errors should have valid structure
          status.errors.forEach(error => {
            expect(typeof error.stepId).toBe('string');
            expect(typeof error.agentId).toBe('string');
            expect(typeof error.error).toBe('string');
            expect(error.timestamp).toBeInstanceOf(Date);
            expect(typeof error.recoverable).toBe('boolean');
          });
          
          return true;
        }
      ),
      {
        numRuns: 25,
        timeout: 15000
      }
    );
  }, 25000);

  /**
   * Property 6: Audit Logging Consistency
   * For any intent analysis or workflow operation, audit logs should be generated
   * with proper reasoning and traceability information.
   * 
   * Validates: Requirements 1.4, 1.5
   */
  it('Property Test: Audit logging should capture all routing decisions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'generate TypeScript code',
          'test authentication system',
          'validate smart contract',
          'research API patterns',
          'design system architecture'
        ),
        async (userInput: string) => {
          // Mock the message bus to capture audit messages
          const auditMessages: any[] = [];
          const originalSendMessage = agent['sendMessage'];
          agent['sendMessage'] = jest.fn().mockImplementation(async (to, type, payload, metadata) => {
            if (metadata?.action === 'log_intent_analysis' || metadata?.action === 'log_workflow_creation') {
              auditMessages.push({ to, type, payload, metadata });
            }
            return 'mock-message-id';
          });

          try {
            const analysis = await agent.analyzeIntent(userInput);
            analysis.confidence = 0.8; // Ensure routing succeeds
            
            const workflow = await agent.routeToAgents(analysis);
            
            // Property assertions for audit logging
            
            // 1. Intent analysis should generate audit log
            const intentAuditLog = auditMessages.find(msg => 
              msg.metadata?.action === 'log_intent_analysis'
            );
            expect(intentAuditLog).toBeDefined();
            expect(intentAuditLog.payload.event).toBe('intent_analyzed');
            expect(intentAuditLog.payload.input).toBe(userInput);
            expect(intentAuditLog.payload.analysis).toBeDefined();
            expect(typeof intentAuditLog.payload.processingTime).toBe('number');
            expect(intentAuditLog.payload.timestamp).toBeDefined();
            
            // 2. Workflow creation should generate audit log
            const workflowAuditLog = auditMessages.find(msg => 
              msg.metadata?.action === 'log_workflow_creation'
            );
            expect(workflowAuditLog).toBeDefined();
            expect(workflowAuditLog.payload.event).toBe('workflow_created');
            expect(workflowAuditLog.payload.workflow.id).toBe(workflow.id);
            expect(workflowAuditLog.payload.workflow.name).toBe(workflow.name);
            expect(workflowAuditLog.payload.timestamp).toBeDefined();
            
            // 3. Audit messages should be sent to Audit Agent
            auditMessages.forEach(msg => {
              expect(msg.to).toContain('audit_agent');
            });
            
            return true;
          } finally {
            // Restore original method
            agent['sendMessage'] = originalSendMessage;
          }
        }
      ),
      {
        numRuns: 20,
        timeout: 10000
      }
    );
  }, 20000);
});