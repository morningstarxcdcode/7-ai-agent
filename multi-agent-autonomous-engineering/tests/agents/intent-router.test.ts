/**
 * Unit Tests for Intent Router Agent
 * Tests the intent analysis and classification system
 */

import { IntentRouter } from '../../src/agents/intent-router';
import { IntentCategory, AgentType, ComplexityLevel, RiskLevel } from '../../src/types/core';
import { getMessageBus, resetMessageBus } from '../../src/core/message-bus';

describe('IntentRouter', () => {
  let intentRouter: IntentRouter;

  beforeEach(async () => {
    resetMessageBus();
    intentRouter = new IntentRouter({
      id: 'test-intent-router',
      confidenceThreshold: 0.6
    });
    await intentRouter.initialize();
  });

  afterEach(async () => {
    await intentRouter.shutdown();
    resetMessageBus();
  });

  describe('Intent Analysis', () => {
    describe('Code Generation Intent', () => {
      it('should identify code generation intent from explicit requests', async () => {
        const input = 'Generate a TypeScript function to calculate fibonacci numbers';
        const analysis = await intentRouter.analyzeIntent(input);

        expect(analysis.primaryIntent).toBe(IntentCategory.CODE_GENERATION);
        expect(analysis.requiredAgents).toContain(AgentType.CODE_ENGINEER);
        expect(analysis.confidence).toBeGreaterThan(0.6);
        expect(analysis.reasoning).toContain('code_generation');
      });

      it('should extract programming language from code generation requests', async () => {
        const input = 'Create a Python class for user authentication';
        const analysis = await intentRouter.analyzeIntent(input);

        expect(analysis.primaryIntent).toBe(IntentCategory.CODE_GENERATION);
        expect(analysis.parameters.language).toBe('python');
      });

      it('should identify framework requirements', async () => {
        const input = 'Build a React component for displaying user profiles';
        const analysis = await intentRouter.analyzeIntent(input);

        expect(analysis.primaryIntent).toBe(IntentCategory.CODE_GENERATION);
        expect(analysis.parameters.framework).toBe('react');
      });
    });

    describe('Testing Intent', () => {
      it('should identify testing intent from test-related keywords', async () => {
        const input = 'Write unit tests for the authentication service';
        const analysis = await intentRouter.analyzeIntent(input);

        expect(analysis.primaryIntent).toBe(IntentCategory.TESTING);
        expect(analysis.requiredAgents).toContain(AgentType.TEST_AGENT);
      });

      it('should identify debugging intent', async () => {
        const input = 'Debug the failing login functionality';
        const analysis = await intentRouter.analyzeIntent(input);

        expect(analysis.primaryIntent).toBe(IntentCategory.DEBUGGING);
        expect(analysis.requiredAgents).toContain(AgentType.TEST_AGENT);
      });
    });

    describe('Security Validation Intent', () => {
      it('should identify security validation for DeFi operations', async () => {
        const input = 'Validate this smart contract for rug pull risks';
        const analysis = await intentRouter.analyzeIntent(input);

        expect(analysis.primaryIntent).toBe(IntentCategory.SECURITY_VALIDATION);
        expect(analysis.requiredAgents).toContain(AgentType.SECURITY_VALIDATOR);
        expect(analysis.riskLevel).toBe(RiskLevel.MEDIUM);
        expect(analysis.riskLevel === RiskLevel.MEDIUM || analysis.riskLevel === RiskLevel.HIGH).toBe(true);
      });

      it('should extract contract addresses from security requests', async () => {
        const input = 'Check security of contract 0x1234567890123456789012345678901234567890';
        const analysis = await intentRouter.analyzeIntent(input);

        expect(analysis.primaryIntent).toBe(IntentCategory.SECURITY_VALIDATION);
        expect(analysis.parameters.contractAddress).toBe('0x1234567890123456789012345678901234567890');
      });
    });

    describe('DeFi Operations Intent', () => {
      it('should identify DeFi operations and assess high risk', async () => {
        const input = 'Swap 100 ETH for USDC on Uniswap';
        const analysis = await intentRouter.analyzeIntent(input);

        expect(analysis.primaryIntent).toBe(IntentCategory.DEFI_OPERATION);
        expect(analysis.requiredAgents).toContain(AgentType.SECURITY_VALIDATOR);
        expect(analysis.riskLevel === RiskLevel.HIGH || analysis.riskLevel === RiskLevel.CRITICAL).toBe(true);
      });

      it('should extract token information from DeFi requests', async () => {
        const input = 'Trade 50 USDC for ETH';
        const analysis = await intentRouter.analyzeIntent(input);

        expect(analysis.primaryIntent).toBe(IntentCategory.DEFI_OPERATION);
        expect(analysis.parameters.tokens).toContain('usdc');
        expect(analysis.parameters.tokens).toContain('eth');
        expect(analysis.parameters.amount).toBe(50);
      });
    });

    describe('Research Intent', () => {
      it('should identify research requests', async () => {
        const input = 'Research the best API for getting cryptocurrency prices';
        const analysis = await intentRouter.analyzeIntent(input);

        expect(analysis.primaryIntent).toBe(IntentCategory.RESEARCH);
        expect(analysis.requiredAgents).toContain(AgentType.RESEARCH_AGENT);
      });

      it('should handle question-based research', async () => {
        const input = 'What is the best way to implement OAuth authentication?';
        const analysis = await intentRouter.analyzeIntent(input);

        expect(analysis.primaryIntent).toBe(IntentCategory.RESEARCH);
      });
    });

    describe('System Design Intent', () => {
      it('should identify system design requests', async () => {
        const input = 'Design a scalable microservices architecture for an e-commerce platform';
        const analysis = await intentRouter.analyzeIntent(input);

        expect(analysis.primaryIntent).toBe(IntentCategory.SYSTEM_DESIGN);
        expect(analysis.requiredAgents).toContain(AgentType.PRODUCT_ARCHITECT);
        expect(analysis.complexity === ComplexityLevel.HIGH || analysis.complexity === ComplexityLevel.CRITICAL).toBe(true);
      });
    });

    describe('Secondary Intents', () => {
      it('should identify secondary intents in complex requests', async () => {
        const input = 'Create a secure authentication system and write comprehensive tests for it';
        const analysis = await intentRouter.analyzeIntent(input);

        expect(analysis.primaryIntent).toBe(IntentCategory.CODE_GENERATION);
        expect(analysis.secondaryIntents).toContain(IntentCategory.TESTING);
        expect(analysis.secondaryIntents).toContain(IntentCategory.SECURITY_VALIDATION);
      });
    });

    describe('Complexity Assessment', () => {
      it('should assess low complexity for simple requests', async () => {
        const input = 'What is TypeScript?';
        const analysis = await intentRouter.analyzeIntent(input);

        expect(analysis.complexity).toBe(ComplexityLevel.LOW);
      });

      it('should assess high complexity for multi-agent requests', async () => {
        const input = 'Build a complete DeFi trading platform with security validation, testing, and deployment';
        const analysis = await intentRouter.analyzeIntent(input);

        expect(analysis.complexity === ComplexityLevel.HIGH || analysis.complexity === ComplexityLevel.CRITICAL).toBe(true);
      });

      it('should increase complexity for production-related requests', async () => {
        const input = 'Deploy the authentication service to production with monitoring';
        const analysis = await intentRouter.analyzeIntent(input);

        expect(analysis.complexity === ComplexityLevel.MEDIUM || analysis.complexity === ComplexityLevel.HIGH || analysis.complexity === ComplexityLevel.CRITICAL).toBe(true);
      });
    });

    describe('Risk Assessment', () => {
      it('should assess low risk for research requests', async () => {
        const input = 'Research JavaScript frameworks';
        const analysis = await intentRouter.analyzeIntent(input);

        expect(analysis.riskLevel).toBe(RiskLevel.LOW);
      });

      it('should assess high risk for financial operations', async () => {
        const input = 'Transfer funds from my wallet to another address';
        const analysis = await intentRouter.analyzeIntent(input);

        expect(analysis.riskLevel === RiskLevel.HIGH || analysis.riskLevel === RiskLevel.CRITICAL).toBe(true);
      });

      it('should assess critical risk for production deployments with financial data', async () => {
        const input = 'Deploy the trading bot to mainnet with live funds';
        const analysis = await intentRouter.analyzeIntent(input);

        expect(analysis.riskLevel).toBe(RiskLevel.CRITICAL);
      });
    });

    describe('Confidence Calculation', () => {
      it('should have high confidence for clear, specific requests', async () => {
        const input = 'Generate a TypeScript interface for user data with name, email, and age fields';
        const analysis = await intentRouter.analyzeIntent(input);

        expect(analysis.confidence).toBeGreaterThan(0.8);
      });

      it('should have low confidence for ambiguous requests', async () => {
        const input = 'Do something';
        const analysis = await intentRouter.analyzeIntent(input);

        expect(analysis.confidence).toBeLessThan(0.5);
      });

      it('should have medium confidence for partially clear requests', async () => {
        const input = 'Help me with my code';
        const analysis = await intentRouter.analyzeIntent(input);

        expect(analysis.confidence).toBeGreaterThan(0.3);
        expect(analysis.confidence).toBeLessThan(0.8);
      });
    });

    describe('Agent Selection', () => {
      it('should always include Intent Router and Audit Agent', async () => {
        const input = 'Research TypeScript best practices';
        const analysis = await intentRouter.analyzeIntent(input);

        expect(analysis.requiredAgents).toContain(AgentType.INTENT_ROUTER);
        expect(analysis.requiredAgents).toContain(AgentType.AUDIT_AGENT);
      });

      it('should include multiple agents for complex operations', async () => {
        const input = 'Build and test a secure payment processing system';
        const analysis = await intentRouter.analyzeIntent(input);

        expect(analysis.requiredAgents).toContain(AgentType.CODE_ENGINEER);
        expect(analysis.requiredAgents).toContain(AgentType.TEST_AGENT);
        expect(analysis.requiredAgents).toContain(AgentType.SECURITY_VALIDATOR);
        expect(analysis.requiredAgents.length).toBeGreaterThan(3);
      });
    });

    describe('Duration Estimation', () => {
      it('should estimate shorter duration for simple tasks', async () => {
        const input = 'What is React?';
        const analysis = await intentRouter.analyzeIntent(input);

        expect(analysis.estimatedDuration).toBeLessThan(60000); // Less than 1 minute
      });

      it('should estimate longer duration for complex tasks', async () => {
        const input = 'Build a complete e-commerce platform with payment processing';
        const analysis = await intentRouter.analyzeIntent(input);

        expect(analysis.estimatedDuration).toBeGreaterThan(300000); // More than 5 minutes
      });
    });
  });

  describe('Agent Routing', () => {
    it('should create workflow for valid intent analysis', async () => {
      const input = 'Create a REST API for user management';
      const analysis = await intentRouter.analyzeIntent(input);
      const workflow = await intentRouter.routeToAgents(analysis);

      expect(workflow.id).toBeDefined();
      expect(workflow.name).toContain('code_generation');
      expect(workflow.steps.length).toBeGreaterThan(0);
      expect(workflow.intent).toEqual(analysis);
      expect(workflow.status).toBe('pending');
    });

    it('should reject ambiguous intents below confidence threshold', async () => {
      const input = 'Do something';
      const analysis = await intentRouter.analyzeIntent(input);
      
      // Lower the confidence to test rejection
      analysis.confidence = 0.3;

      await expect(intentRouter.routeToAgents(analysis)).rejects.toThrow('ambiguous');
    });

    it('should create appropriate workflow steps for each required agent', async () => {
      const input = 'Generate and test a TypeScript utility function';
      const analysis = await intentRouter.analyzeIntent(input);
      const workflow = await intentRouter.routeToAgents(analysis);

      const codeStep = workflow.steps.find(s => s.agentType === AgentType.CODE_ENGINEER);
      const testStep = workflow.steps.find(s => s.agentType === AgentType.TEST_AGENT);

      expect(codeStep).toBeDefined();
      expect(testStep).toBeDefined();
      expect(codeStep?.action).toBe('generate_code');
      expect(testStep?.action).toBe('validate_code');
    });

    it('should set appropriate timeouts based on complexity', async () => {
      const simpleInput = 'What is TypeScript?';
      const complexInput = 'Build a distributed microservices architecture';

      const simpleAnalysis = await intentRouter.analyzeIntent(simpleInput);
      const complexAnalysis = await intentRouter.analyzeIntent(complexInput);

      const simpleWorkflow = await intentRouter.routeToAgents(simpleAnalysis);
      const complexWorkflow = await intentRouter.routeToAgents(complexAnalysis);

      const simpleTimeout = simpleWorkflow.steps[0]?.timeout || 0;
      const complexTimeout = complexWorkflow.steps[0]?.timeout || 0;

      expect(complexTimeout).toBeGreaterThan(simpleTimeout);
    });

    it('should create proper dependencies between workflow steps', async () => {
      const input = 'Generate code, then test it, then validate security';
      const analysis = await intentRouter.analyzeIntent(input);
      const workflow = await intentRouter.routeToAgents(analysis);

      expect(workflow.dependencies.length).toBeGreaterThan(0);
      
      // Test step should depend on code step
      const testDep = workflow.dependencies.find(d => 
        workflow.steps.find(s => s.id === d.stepId)?.agentType === AgentType.TEST_AGENT
      );
      expect(testDep).toBeDefined();
    });
  });

  describe('Workflow Orchestration', () => {
    it('should create execution plan from workflow', async () => {
      const input = 'Create a simple calculator function';
      const analysis = await intentRouter.analyzeIntent(input);
      const workflow = await intentRouter.routeToAgents(analysis);
      const executionPlan = await intentRouter.orchestrateWorkflow(workflow);

      expect(executionPlan.id).toBeDefined();
      expect(executionPlan.workflow).toEqual(workflow);
      expect(executionPlan.schedule.length).toBe(workflow.steps.length);
      expect(executionPlan.estimatedCompletion).toBeInstanceOf(Date);
    });

    it('should schedule steps with proper timing', async () => {
      const input = 'Build and test a user service';
      const analysis = await intentRouter.analyzeIntent(input);
      const workflow = await intentRouter.routeToAgents(analysis);
      const executionPlan = await intentRouter.orchestrateWorkflow(workflow);

      const scheduleItems = executionPlan.schedule;
      expect(scheduleItems.length).toBeGreaterThan(0);
      
      // Check that scheduled times are in the future
      scheduleItems.forEach(item => {
        expect(item.scheduledStart.getTime()).toBeGreaterThan(Date.now() - 1000);
      });
    });
  });

  describe('Execution Monitoring', () => {
    it('should monitor workflow execution status', async () => {
      const input = 'Create a simple function';
      const analysis = await intentRouter.analyzeIntent(input);
      const workflow = await intentRouter.routeToAgents(analysis);
      const executionPlan = await intentRouter.orchestrateWorkflow(workflow);

      const status = await intentRouter.monitorExecution(executionPlan);

      expect(status.planId).toBe(executionPlan.id);
      expect(status.status).toBe('pending');
      expect(status.progress).toBe(0);
      expect(status.completedSteps).toEqual([]);
      expect(status.failedSteps).toEqual([]);
    });

    it('should calculate progress correctly', async () => {
      const input = 'Create a function';
      const analysis = await intentRouter.analyzeIntent(input);
      const workflow = await intentRouter.routeToAgents(analysis);
      
      // Simulate completed steps
      workflow.steps[0].status = 'completed';
      if (workflow.steps.length > 1) {
        workflow.steps[1].status = 'in_progress';
      }

      const executionPlan = await intentRouter.orchestrateWorkflow(workflow);
      const status = await intentRouter.monitorExecution(executionPlan);

      expect(status.progress).toBeGreaterThan(0);
      expect(status.completedSteps.length).toBe(1);
    });

    it('should identify failed steps and errors', async () => {
      const input = 'Create a function';
      const analysis = await intentRouter.analyzeIntent(input);
      const workflow = await intentRouter.routeToAgents(analysis);
      
      // Simulate failed step
      workflow.steps[0].status = 'failed';
      workflow.steps[0].errorMessage = 'Test error';

      const executionPlan = await intentRouter.orchestrateWorkflow(workflow);
      const status = await intentRouter.monitorExecution(executionPlan);

      expect(status.status).toBe('failed');
      expect(status.failedSteps.length).toBe(1);
      expect(status.errors.length).toBe(1);
      expect(status.errors[0].error).toBe('Test error');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid input gracefully', async () => {
      await expect(intentRouter.analyzeIntent('')).rejects.toThrow();
    });

    it('should handle null or undefined input', async () => {
      await expect(intentRouter.analyzeIntent(null as any)).rejects.toThrow();
      await expect(intentRouter.analyzeIntent(undefined as any)).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long input strings', async () => {
      const longInput = 'Create a function '.repeat(100);
      const analysis = await intentRouter.analyzeIntent(longInput);

      expect(analysis.primaryIntent).toBe(IntentCategory.CODE_GENERATION);
      expect(analysis.confidence).toBeGreaterThan(0);
    });

    it('should handle input with special characters', async () => {
      const input = 'Create a function with @decorators and #hashtags & symbols!';
      const analysis = await intentRouter.analyzeIntent(input);

      expect(analysis.primaryIntent).toBe(IntentCategory.CODE_GENERATION);
    });

    it('should handle mixed case input', async () => {
      const input = 'CREATE A TYPESCRIPT FUNCTION';
      const analysis = await intentRouter.analyzeIntent(input);

      expect(analysis.primaryIntent).toBe(IntentCategory.CODE_GENERATION);
      expect(analysis.parameters.language).toBe('typescript');
    });
  });

  describe('Integration', () => {
    it('should integrate with message bus for logging', async () => {
      const messageBus = getMessageBus();
      const messagesSent: any[] = [];
      
      // Mock message sending
      const originalSendMessage = messageBus.sendMessage;
      messageBus.sendMessage = jest.fn().mockImplementation((...args) => {
        messagesSent.push(args);
        return Promise.resolve('mock-message-id');
      });

      const input = 'Create a simple function';
      await intentRouter.analyzeIntent(input);

      expect(messagesSent.length).toBeGreaterThan(0);
      
      // Restore original method
      messageBus.sendMessage = originalSendMessage;
    });
  });
});