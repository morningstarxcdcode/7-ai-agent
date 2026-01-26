/**
 * Integration Tests for Multi-Agent Autonomous Engineering System
 * 
 * Requirements: Task 17 - Final Validation
 */

import * as fc from 'fast-check';
import {
  createIntentRouterAgent,
  IntentRouterAgentImpl
} from '../src/agents/intent-router/intent-router';
import {
  createProductArchitectAgent,
  ProductArchitectAgentImpl
} from '../src/agents/product-architect/product-architect';
import {
  createCodeEngineerAgent,
  CodeEngineerAgentImpl
} from '../src/agents/code-engineer/code-engineer';
import {
  createTestAutoFixAgent,
  TestAutoFixAgentImpl
} from '../src/agents/test-agent/test-agent';
import {
  createSecurityValidatorAgent,
  SecurityValidatorAgentImpl
} from '../src/agents/security-validator/security-validator';
import {
  createResearchAgent,
  ResearchAgentImpl
} from '../src/agents/research-agent/research-agent';
import {
  createAuditAgent,
  AuditAgentImpl
} from '../src/agents/audit-agent/audit-agent';
import {
  createHookSystem,
  AgentHookSystem,
  HookPriority
} from '../src/hooks/agent-hooks';
import {
  createSteeringSystem,
  SteeringSystem
} from '../src/steering/steering-system';
import {
  createDeFiSafetyModule,
  DeFiSafetyModule
} from '../src/defi/defi-safety';
import {
  createMultiPlatformIntegration,
  MultiPlatformIntegration
} from '../src/integrations/platform-integration';
import { AgentType, IntentCategory, RiskLevel } from '../src/types/agents';

describe('Multi-Agent Autonomous Engineering System', () => {
  // Agent creation tests
  describe('Agent Creation', () => {
    test('should create all 7 agent types', () => {
      const intentRouter = createIntentRouterAgent();
      const productArchitect = createProductArchitectAgent();
      const codeEngineer = createCodeEngineerAgent();
      const testAgent = createTestAutoFixAgent();
      const securityValidator = createSecurityValidatorAgent();
      const researchAgent = createResearchAgent();
      const auditAgent = createAuditAgent();

      expect(intentRouter).toBeDefined();
      expect(productArchitect).toBeDefined();
      expect(codeEngineer).toBeDefined();
      expect(testAgent).toBeDefined();
      expect(securityValidator).toBeDefined();
      expect(researchAgent).toBeDefined();
      expect(auditAgent).toBeDefined();
    });

    test('should initialize agents successfully', async () => {
      const agents = [
        createIntentRouterAgent(),
        createProductArchitectAgent(),
        createCodeEngineerAgent(),
        createTestAutoFixAgent(),
        createSecurityValidatorAgent(),
        createResearchAgent(),
        createAuditAgent()
      ];

      for (const agent of agents) {
        await expect(agent.initialize()).resolves.not.toThrow();
        await agent.shutdown();
      }
    });
  });

  // Intent Router tests
  describe('Intent Router Agent', () => {
    let intentRouter: IntentRouterAgentImpl;

    beforeEach(async () => {
      intentRouter = createIntentRouterAgent();
      await intentRouter.initialize();
    });

    afterEach(async () => {
      await intentRouter.shutdown();
    });

    test('should analyze intent correctly', async () => {
      const result = await intentRouter.analyzeIntent('Build a REST API for user management');
      
      expect(result).toBeDefined();
      expect(result.primaryIntent).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    test('should route to appropriate agents', async () => {
      const intent = await intentRouter.analyzeIntent('Create a new React component');
      const result = await intentRouter.routeToAgents(intent);
      
      expect(result).toBeDefined();
      expect(result.steps).toBeDefined();
      expect(result.steps.length).toBeGreaterThan(0);
    });
  });

  // Product Architect tests
  describe('Product Architect Agent', () => {
    let architect: ProductArchitectAgentImpl;

    beforeEach(async () => {
      architect = createProductArchitectAgent();
      await architect.initialize();
    });

    afterEach(async () => {
      await architect.shutdown();
    });

    test('should generate architecture', async () => {
      const result = await architect.generateArchitecture({
        functional: [{
          id: 'f1',
          description: 'E-commerce platform with user auth and payment processing',
          priority: 'must',
          acceptanceCriteria: ['User can register', 'User can login', 'User can make payments']
        }],
        nonFunctional: [{
          id: 'nf1',
          type: 'scalability',
          description: 'Support 10000 concurrent users',
          metrics: [{ name: 'concurrent_users', target: 10000, unit: 'users', measurement: 'load_test' }]
        }],
        constraints: [],
        stakeholders: []
      });

      expect(result).toBeDefined();
      expect(result.components).toBeDefined();
      expect(result.components.length).toBeGreaterThan(0);
    });

    test('should create UX flows', async () => {
      const result = await architect.createUXFlows([{
        id: 'us1',
        title: 'User Registration',
        description: 'User registration and login flow',
        acceptanceCriteria: ['User can register with email', 'User can login'],
        priority: 1,
        estimatedEffort: 5
      }]);

      expect(result).toBeDefined();
      expect(result.flows).toBeDefined();
      expect(result.flows.length).toBeGreaterThan(0);
    });
  });

  // Code Engineer tests
  describe('Code Engineer Agent', () => {
    let codeEngineer: CodeEngineerAgentImpl;

    beforeEach(async () => {
      codeEngineer = createCodeEngineerAgent();
      await codeEngineer.initialize();
    });

    afterEach(async () => {
      await codeEngineer.shutdown();
    });

    test('should generate code', async () => {
      const result = await codeEngineer.generateCode({
        description: 'Create a function that validates email addresses',
        language: 'typescript',
        framework: 'node'
      });

      expect(result).toBeDefined();
      expect(result.code).toBeDefined();
      expect(result.language).toBe('typescript');
    });

    test('should refactor code', async () => {
      const originalCode = `
        function add(a,b) {
          return a+b;
        }
      `;

      const result = await codeEngineer.refactorCode(
        originalCode,
        'typescript',
        'Add type annotations'
      );

      expect(result).toBeDefined();
      expect(result.refactoredCode).toBeDefined();
    });
  });

  // Test Agent tests
  describe('Test & Auto-Fix Agent', () => {
    let testAgent: TestAutoFixAgentImpl;

    beforeEach(async () => {
      testAgent = createTestAutoFixAgent();
      await testAgent.initialize();
    });

    afterEach(async () => {
      await testAgent.shutdown();
    });

    test('should generate tests', async () => {
      const code = {
        files: [{
          path: 'src/add.ts',
          content: `export function add(a: number, b: number): number { return a + b; }`,
          language: 'typescript',
          type: 'source' as const,
          metadata: {
            author: 'test',
            created: new Date(),
            modified: new Date(),
            version: '1.0.0',
            checksum: 'abc123'
          }
        }],
        entryPoint: 'src/add.ts',
        dependencies: []
      };

      const result = await testAgent.generateTests(code);

      expect(result).toBeDefined();
      expect(result.tests).toBeDefined();
    });

    test('should detect bugs', async () => {
      const buggyCode = {
        files: [{
          path: 'src/divide.ts',
          content: `function divide(a, b) { return a / b; }`,
          language: 'typescript',
          type: 'source' as const,
          metadata: {
            author: 'test',
            created: new Date(),
            modified: new Date(),
            version: '1.0.0',
            checksum: 'abc123'
          }
        }],
        entryPoint: 'src/divide.ts',
        dependencies: []
      };

      const result = await testAgent.detectBugs(buggyCode);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // Security Validator tests
  describe('Security Validator Agent', () => {
    let securityValidator: SecurityValidatorAgentImpl;

    beforeEach(async () => {
      securityValidator = createSecurityValidatorAgent();
      await securityValidator.initialize();
    });

    afterEach(async () => {
      await securityValidator.shutdown();
    });

    test('should scan for vulnerabilities', async () => {
      const vulnerableCode = `
        const query = "SELECT * FROM users WHERE id = " + userId;
        db.execute(query);
      `;

      const result = await securityValidator.scanVulnerabilities({
        files: [{
          path: 'test.ts',
          content: vulnerableCode,
          language: 'typescript',
          type: 'source',
          metadata: {
            author: 'test',
            created: new Date(),
            modified: new Date(),
            version: '1.0.0',
            checksum: 'abc123'
          }
        }],
        entryPoint: 'test.ts',
        dependencies: []
      });

      expect(result).toBeDefined();
      expect(result.vulnerabilities.length).toBeGreaterThan(0);
    });

    test('should check compliance', async () => {
      const code = {
        files: [{
          path: 'test.ts',
          content: `console.log('test');`,
          language: 'typescript',
          type: 'source' as const,
          metadata: {
            author: 'test',
            created: new Date(),
            modified: new Date(),
            version: '1.0.0',
            checksum: 'abc123'
          }
        }],
        entryPoint: 'test.ts',
        dependencies: []
      };
      const result = await securityValidator.checkCompliance(code, ['OWASP']);

      expect(result).toBeDefined();
      expect(result.checks).toBeDefined();
      expect(result.overallStatus).toBeDefined();
    });

    test('should validate DeFi safety', async () => {
      const result = await securityValidator.validateDeFiSafety({
        files: [{
          path: 'contract.sol',
          content: `
            function swap(uint256 amountIn) external {
              // swap logic
            }
          `,
          language: 'solidity',
          type: 'source' as const,
          metadata: {
            author: 'test',
            created: new Date(),
            modified: new Date(),
            version: '1.0.0',
            checksum: 'abc123'
          }
        }],
        entryPoint: 'contract.sol',
        dependencies: []
      });

      expect(result).toBeDefined();
      expect(result.passed).toBeDefined();
      expect(result.overallSafetyScore).toBeDefined();
    });
  });

  // Research Agent tests
  describe('Research Agent', () => {
    let researchAgent: ResearchAgentImpl;

    beforeEach(async () => {
      researchAgent = createResearchAgent();
      await researchAgent.initialize();
    });

    afterEach(async () => {
      await researchAgent.shutdown();
    });

    test('should research topics', async () => {
      const result = await researchAgent.research({
        query: 'React hooks best practices',
        context: {
          domain: 'frontend',
          technologies: ['react', 'typescript']
        }
      });

      expect(result).toBeDefined();
      expect(result.query).toBeDefined();
      expect(result.findings).toBeDefined();
    });

    test('should get best practices', async () => {
      const result = await researchAgent.getBestPractices('typescript');

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  // Audit Agent tests
  describe('Audit Agent', () => {
    let auditAgent: AuditAgentImpl;

    beforeEach(async () => {
      auditAgent = createAuditAgent();
      await auditAgent.initialize();
    });

    afterEach(async () => {
      await auditAgent.shutdown();
    });

    test('should log audit entries', () => {
      const entryId = auditAgent.logAudit({
        action: 'test-action',
        actor: 'test-actor',
        resource: 'test-resource',
        outcome: 'success'
      });

      expect(entryId).toBeDefined();
      expect(typeof entryId).toBe('string');
    });

    test('should generate audit report', async () => {
      const startDate = new Date(Date.now() - 86400000);
      const endDate = new Date();
      
      const report = await auditAgent.generateAuditReport(startDate, endDate);

      expect(report).toBeDefined();
      expect(report.period).toBeDefined();
      expect(report.summary).toBeDefined();
    });
  });

  // Hook System tests
  describe('Agent Hook System', () => {
    let hookSystem: AgentHookSystem;

    beforeEach(() => {
      hookSystem = createHookSystem();
    });

    test('should register and execute hooks', async () => {
      let executed = false;

      hookSystem.registerHook({
        name: 'Test Hook',
        type: 'pre-action',
        priority: 'normal',
        mode: 'async',
        enabled: true,
        handler: async () => {
          executed = true;
          return { hookId: 'test', success: true, continue: true, duration: 0 };
        }
      });

      await hookSystem.executeHooks('pre-action', 'agent-1', 'CODE_ENGINEER' as any, {});

      expect(executed).toBe(true);
    });

    test('should handle approval workflow', async () => {
      const context: any = {
        hookId: 'test-hook',
        hookType: 'approval-required',
        agentId: 'agent-1',
        agentType: 'CODE_ENGINEER',
        timestamp: new Date(),
        data: {},
        metadata: {}
      };
      
      const approvalPromise = hookSystem.requestApproval(
        'test-hook',
        context,
        'Test action',
        RiskLevel.MEDIUM
      );
      
      // Get pending request and approve
      const pending = hookSystem.getPendingApprovals();
      if (pending.length > 0) {
        await hookSystem.approveRequest(pending[0].id, 'test-user');
      }

      const result = await approvalPromise;
      expect(result).toBeDefined();
    });
  });

  // Steering System tests
  describe('Steering System', () => {
    let steeringSystem: SteeringSystem;

    beforeEach(() => {
      steeringSystem = createSteeringSystem();
    });

    test('should register agents', () => {
      steeringSystem.registerAgent('agent-1', 'CODE_ENGINEER' as any);

      const state = steeringSystem.getAgentState('agent-1');
      expect(state).toBeDefined();
      expect(state?.state).toBe('idle');
    });

    test('should issue steering instructions', async () => {
      steeringSystem.registerAgent('agent-1', 'CODE_ENGINEER' as any);

      const instructionId = await steeringSystem.issueInstruction(
        'pause',
        'agent-1',
        'Test pause',
        'test'
      );

      expect(instructionId).toBeDefined();
    });
  });

  // DeFi Safety Module tests
  describe('DeFi Safety Module', () => {
    let defiSafety: DeFiSafetyModule;

    beforeEach(() => {
      defiSafety = createDeFiSafetyModule();
    });

    test('should calculate slippage', () => {
      const result = defiSafety.calculateSlippage({
        tokenIn: 'ETH',
        tokenOut: 'USDC',
        amountIn: BigInt('1000000000000000000'), // 1 ETH
        reserveIn: BigInt('100000000000000000000'), // 100 ETH
        reserveOut: BigInt('200000000000000000000000'), // 200,000 USDC
      });

      expect(result).toBeDefined();
      expect(result.expectedOutput).toBeGreaterThan(0n);
      expect(result.priceImpact).toBeDefined();
      expect(result.slippagePercent).toBeDefined();
    });

    test('should detect rug pull indicators', async () => {
      const result = await defiSafety.detectRugPull({
        contractAddress: '0x1234567890123456789012345678901234567890',
        tokenMetrics: {
          totalSupply: BigInt('1000000000000000000000000'),
          ownerBalance: BigInt('500000000000000000000000'), // 50%
          lpTokensLocked: false
        }
      });

      expect(result).toBeDefined();
      expect(result.riskScore).toBeGreaterThan(0);
      expect(result.indicators.length).toBeGreaterThan(0);
    });

    test('should analyze MEV risk', () => {
      const result = defiSafety.analyzeMEVRisk({
        transactionType: 'swap',
        value: BigInt('10000000000000000000'), // 10 ETH
      });

      expect(result).toBeDefined();
      expect(result.riskLevel).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  // Multi-Platform Integration tests
  describe('Multi-Platform Integration', () => {
    let integration: MultiPlatformIntegration;

    beforeEach(async () => {
      integration = createMultiPlatformIntegration({
        platforms: [
          { id: 'eth', type: 'ethereum', name: 'Ethereum', enabled: true },
          { id: 'gh', type: 'github', name: 'GitHub', enabled: true }
        ]
      });
      await integration.initialize();
    });

    afterEach(async () => {
      await integration.shutdown();
    });

    test('should register platforms', () => {
      const platforms = integration.getRegisteredPlatforms();
      expect(platforms.length).toBe(2);
      expect(platforms).toContain('ethereum');
      expect(platforms).toContain('github');
    });

    test('should get platform capabilities', () => {
      const capabilities = integration.getPlatformCapabilities('ethereum');
      expect(capabilities.length).toBeGreaterThan(0);
      expect(capabilities.some(c => c.name === 'smart-contracts')).toBe(true);
    });

    test('should execute operations on platform', async () => {
      const result = await integration.executeOnPlatform('ethereum', 'getBalance', {
        address: '0x1234'
      });

      expect(result).toBeDefined();
    });
  });
});

// Property-based tests
describe('Property-Based Tests', () => {
  describe('Slippage Calculation Properties', () => {
    const defiSafety = createDeFiSafetyModule();

    test('property: output is always less than reserve out', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: 1n, max: BigInt('1000000000000000000000') }),
          fc.bigInt({ min: BigInt('1000000000000000000'), max: BigInt('1000000000000000000000000') }),
          fc.bigInt({ min: BigInt('1000000000000000000'), max: BigInt('1000000000000000000000000') }),
          (amountIn, reserveIn, reserveOut) => {
            const result = defiSafety.calculateSlippage({
              tokenIn: 'A',
              tokenOut: 'B',
              amountIn,
              reserveIn,
              reserveOut
            });
            return result.expectedOutput < reserveOut;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('property: larger trades have higher price impact', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: BigInt('1000000000000000000'), max: BigInt('100000000000000000000000') }),
          fc.bigInt({ min: BigInt('1000000000000000000'), max: BigInt('1000000000000000000000000') }),
          (reserveIn, reserveOut) => {
            const smallTrade = defiSafety.calculateSlippage({
              tokenIn: 'A',
              tokenOut: 'B',
              amountIn: reserveIn / 100n,
              reserveIn,
              reserveOut
            });

            const largeTrade = defiSafety.calculateSlippage({
              tokenIn: 'A',
              tokenOut: 'B',
              amountIn: reserveIn / 10n,
              reserveIn,
              reserveOut
            });

            return largeTrade.priceImpact >= smallTrade.priceImpact;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('MEV Risk Properties', () => {
    const defiSafety = createDeFiSafetyModule();

    test('property: higher values have higher or equal MEV risk', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: BigInt('1000000000000000'), max: BigInt('100000000000000000000') }),
          (value) => {
            const smallValue = defiSafety.analyzeMEVRisk({
              transactionType: 'swap',
              value: value / 10n
            });

            const largeValue = defiSafety.analyzeMEVRisk({
              transactionType: 'swap',
              value
            });

            const riskLevels = ['low', 'medium', 'high', 'critical'];
            return riskLevels.indexOf(largeValue.riskLevel) >= 
                   riskLevels.indexOf(smallValue.riskLevel);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
