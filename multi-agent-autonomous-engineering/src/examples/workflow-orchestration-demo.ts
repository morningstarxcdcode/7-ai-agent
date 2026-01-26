/**
 * Workflow Orchestration Demo
 * Demonstrates the multi-agent workflow orchestration system with dependency management and conflict resolution
 */

import { IntentRouter } from '../agents/intent-router';
import { getWorkflowOrchestrator, resetWorkflowOrchestrator } from '../core/workflow-orchestrator';
import { getContextStore, resetContextStore } from '../core/context-store';
import { getMessageBus, resetMessageBus } from '../core/message-bus';
import { AgentRegistry, BaseAgentImpl } from '../core/base-agent';
import { AgentType, IntentCategory, ComplexityLevel, RiskLevel } from '../types/core';
import { HealthStatus } from '../types/agents';

// Demo agent implementation
class DemoAgent extends BaseAgentImpl {
  constructor(type: AgentType) {
    super({
      name: `Demo ${type} Agent`,
      type,
      version: '1.0.0',
      capabilities: ['demo', 'orchestration'],
      maxConcurrentTasks: 3,
      timeoutMs: 60000,
      enableSandbox: false
    });
  }

  protected async onInitialize(): Promise<void> {
    console.log(`🚀 ${this.name} initialized`);
  }

  protected async onShutdown(): Promise<void> {
    console.log(`🛑 ${this.name} shutdown`);
  }

  protected async onHealthCheck(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      message: `${this.name} is operational`,
      lastCheck: new Date()
    };
  }

  protected async handleRequest(message: Record<string, unknown>): Promise<unknown> {
    const action = message['action'] as string;
    const step = message['step'] as any;
    
    console.log(`🔄 ${this.name} executing: ${action} (Step: ${step?.id})`);
    
    // Simulate realistic processing time based on agent type
    const processingTime = this.getProcessingTime(action);
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    const result = this.generateResult(action, step);
    
    console.log(`✅ ${this.name} completed: ${action} -> ${result.summary}`);
    
    return {
      success: true,
      action,
      outputs: result
    };
  }

  protected async handleEvent(message: Record<string, unknown>): Promise<void> {
    const eventType = message['action'] as string;
    console.log(`📢 ${this.name} received event: ${eventType}`);
  }

  protected async handleError(message: Record<string, unknown>): Promise<void> {
    const error = message['payload'] as { error: string };
    console.log(`❌ ${this.name} handling error: ${error.error}`);
  }

  private getProcessingTime(action: string): number {
    const baseTimes: Record<string, number> = {
      'analyze_requirements': 2000,
      'generate_architecture': 3000,
      'create_specifications': 2500,
      'generate_code': 4000,
      'refactor_code': 3000,
      'generate_tests': 3500,
      'debug_issues': 2000,
      'validate_security': 2500,
      'validate_defi_transaction': 3000,
      'conduct_research': 2000,
      'gather_information': 1500,
      'log_audit': 500
    };
    
    return baseTimes[action] || 1000;
  }

  private generateResult(action: string, step: any): any {
    const results: Record<string, any> = {
      'analyze_requirements': {
        summary: 'Requirements analyzed',
        functionalRequirements: ['User authentication', 'Data processing', 'API integration'],
        nonFunctionalRequirements: ['Performance: <100ms response', 'Security: OAuth 2.0'],
        constraints: ['Budget: $50k', 'Timeline: 3 months']
      },
      'generate_architecture': {
        summary: 'System architecture generated',
        components: ['API Gateway', 'Authentication Service', 'Data Layer', 'UI Components'],
        patterns: ['Microservices', 'Event-driven', 'CQRS'],
        technologies: ['Node.js', 'PostgreSQL', 'Redis', 'React']
      },
      'generate_code': {
        summary: 'Code generated successfully',
        files: ['src/auth/service.ts', 'src/api/routes.ts', 'src/models/user.ts'],
        linesOfCode: 1250,
        language: step?.parameters?.language || 'typescript'
      },
      'generate_tests': {
        summary: 'Test suite generated',
        testFiles: ['auth.test.ts', 'api.test.ts', 'models.test.ts'],
        coverage: step?.parameters?.coverage || 85,
        testTypes: ['unit', 'integration', 'property-based']
      },
      'validate_security': {
        summary: 'Security validation completed',
        vulnerabilities: [],
        riskLevel: 'LOW',
        recommendations: ['Enable HTTPS', 'Implement rate limiting', 'Add input validation']
      },
      'conduct_research': {
        summary: 'Research completed',
        sources: ['Academic papers', 'Industry reports', 'Open source projects'],
        findings: ['Best practices identified', 'Technology trends analyzed', 'Risk factors assessed'],
        recommendations: ['Use proven frameworks', 'Follow security standards', 'Implement monitoring']
      },
      'log_audit': {
        summary: 'Audit log created',
        entries: 1,
        timestamp: new Date().toISOString(),
        compliance: 'PASSED'
      }
    };
    
    return results[action] || {
      summary: `${action} completed`,
      result: 'Generic result',
      timestamp: new Date().toISOString()
    };
  }
}

export class WorkflowOrchestrationDemo {
  private intentRouter!: IntentRouter;
  private agentRegistry!: AgentRegistry;
  private demoAgents: DemoAgent[] = [];

  async initialize(): Promise<void> {
    console.log('🎯 Initializing Workflow Orchestration Demo...\n');

    // Reset singletons for clean demo
    resetWorkflowOrchestrator();
    resetContextStore();
    resetMessageBus();

    // Create Intent Router
    this.intentRouter = new IntentRouter({
      maxWorkflowsPerAgent: 5,
      defaultTimeoutMs: 60000,
      enableAdvancedNLP: true,
      confidenceThreshold: 0.7
    });

    // Set up agent registry
    this.agentRegistry = AgentRegistry.getInstance();

    // Create demo agents for each type
    console.log('🤖 Creating demo agents...');
    for (const agentType of Object.values(AgentType)) {
      const agent = new DemoAgent(agentType);
      await agent.initialize();
      this.agentRegistry.register(agent);
      this.demoAgents.push(agent);
    }

    // Initialize Intent Router
    await this.intentRouter.initialize();
    this.agentRegistry.register(this.intentRouter);

    console.log('✅ Demo initialization complete!\n');
  }

  async runDemo(): Promise<void> {
    console.log('🚀 Starting Workflow Orchestration Demo\n');
    console.log('=' .repeat(80));

    // Demo 1: Simple Code Generation Workflow
    await this.demoSimpleWorkflow();
    
    console.log('\n' + '=' .repeat(80));
    
    // Demo 2: Complex Multi-Agent Workflow with Dependencies
    await this.demoComplexWorkflow();
    
    console.log('\n' + '=' .repeat(80));
    
    // Demo 3: Parallel Workflow Execution
    await this.demoParallelWorkflow();
    
    console.log('\n' + '=' .repeat(80));
    
    // Demo 4: Resource Conflict Resolution
    await this.demoResourceConflicts();
    
    console.log('\n' + '=' .repeat(80));
    
    // Demo 5: Workflow Monitoring and Metrics
    await this.demoMonitoringAndMetrics();
  }

  private async demoSimpleWorkflow(): Promise<void> {
    console.log('📋 DEMO 1: Simple Code Generation Workflow');
    console.log('-' .repeat(50));

    const userInput = 'Generate a TypeScript function to calculate fibonacci numbers with unit tests';
    console.log(`User Input: "${userInput}"\n`);

    try {
      // Step 1: Intent Analysis
      console.log('🧠 Step 1: Analyzing user intent...');
      const intentAnalysis = await this.intentRouter.analyzeIntent(userInput);
      
      console.log(`   Primary Intent: ${intentAnalysis.primaryIntent}`);
      console.log(`   Complexity: ${intentAnalysis.complexity}`);
      console.log(`   Risk Level: ${intentAnalysis.riskLevel}`);
      console.log(`   Required Agents: ${intentAnalysis.requiredAgents.join(', ')}`);
      console.log(`   Confidence: ${(intentAnalysis.confidence * 100).toFixed(1)}%\n`);

      // Step 2: Workflow Creation
      console.log('🔄 Step 2: Creating workflow...');
      const workflow = await this.intentRouter.routeToAgents(intentAnalysis);
      
      console.log(`   Workflow ID: ${workflow.id}`);
      console.log(`   Steps: ${workflow.steps.length}`);
      console.log(`   Dependencies: ${workflow.dependencies.length}\n`);

      // Step 3: Workflow Orchestration
      console.log('🎭 Step 3: Orchestrating workflow execution...');
      const executionPlan = await this.intentRouter.orchestrateWorkflow(workflow);
      
      console.log(`   Execution Plan ID: ${executionPlan.id}`);
      console.log(`   Scheduled Steps: ${executionPlan.schedule.length}`);
      console.log(`   Estimated Completion: ${executionPlan.estimatedCompletion.toLocaleTimeString()}\n`);

      // Step 4: Monitor Execution
      console.log('👀 Step 4: Monitoring execution...');
      await this.monitorWorkflowExecution(executionPlan.id);

    } catch (error) {
      console.error(`❌ Demo 1 failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async demoComplexWorkflow(): Promise<void> {
    console.log('📋 DEMO 2: Complex Multi-Agent Workflow with Dependencies');
    console.log('-' .repeat(50));

    const userInput = 'Design and implement a secure DeFi trading system with comprehensive testing, security validation, and audit logging';
    console.log(`User Input: "${userInput}"\n`);

    try {
      const intentAnalysis = await this.intentRouter.analyzeIntent(userInput);
      console.log(`🧠 Intent Analysis:`);
      console.log(`   Primary: ${intentAnalysis.primaryIntent}`);
      console.log(`   Secondary: ${intentAnalysis.secondaryIntents.join(', ')}`);
      console.log(`   Complexity: ${intentAnalysis.complexity}`);
      console.log(`   Risk Level: ${intentAnalysis.riskLevel}\n`);

      const workflow = await this.intentRouter.routeToAgents(intentAnalysis);
      console.log(`🔄 Workflow Created:`);
      console.log(`   Steps: ${workflow.steps.length}`);
      console.log(`   Dependencies: ${workflow.dependencies.length}`);
      console.log(`   Parallel Groups: ${workflow.parallelGroups.length}\n`);

      // Show workflow structure
      console.log('📊 Workflow Structure:');
      workflow.steps.forEach((step, index) => {
        const deps = workflow.dependencies.find(d => d.stepId === step.id);
        const depsStr = deps ? ` (depends on: ${deps.dependsOn.join(', ')})` : '';
        console.log(`   ${index + 1}. ${step.agentType}: ${step.action}${depsStr}`);
      });
      console.log();

      const executionPlan = await this.intentRouter.orchestrateWorkflow(workflow);
      await this.monitorWorkflowExecution(executionPlan.id);

    } catch (error) {
      console.error(`❌ Demo 2 failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async demoParallelWorkflow(): Promise<void> {
    console.log('📋 DEMO 3: Parallel Workflow Execution');
    console.log('-' .repeat(50));

    const userInput = 'Research blockchain technologies and analyze security patterns while conducting market analysis';
    console.log(`User Input: "${userInput}"\n`);

    try {
      const intentAnalysis = await this.intentRouter.analyzeIntent(userInput);
      const workflow = await this.intentRouter.routeToAgents(intentAnalysis);
      
      console.log('🔄 Parallel Execution Groups:');
      workflow.parallelGroups.forEach((group, index) => {
        console.log(`   Group ${index + 1}: ${group.join(', ')}`);
      });
      console.log();

      const executionPlan = await this.intentRouter.orchestrateWorkflow(workflow);
      await this.monitorWorkflowExecution(executionPlan.id);

    } catch (error) {
      console.error(`❌ Demo 3 failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async demoResourceConflicts(): Promise<void> {
    console.log('📋 DEMO 4: Resource Conflict Resolution');
    console.log('-' .repeat(50));

    try {
      const orchestrator = getWorkflowOrchestrator();

      // Create two competing workflows
      const workflow1Input = 'Generate a complex machine learning model';
      const workflow2Input = 'URGENT: Fix critical security vulnerability in authentication system';

      console.log('🔄 Creating competing workflows...');
      console.log(`   Workflow 1: "${workflow1Input}"`);
      console.log(`   Workflow 2: "${workflow2Input}" (Higher Priority)\n`);

      // Start first workflow
      const intent1 = await this.intentRouter.analyzeIntent(workflow1Input);
      const workflow1 = await this.intentRouter.routeToAgents(intent1);
      const plan1 = await this.intentRouter.orchestrateWorkflow(workflow1);

      // Start second workflow (should create conflicts)
      const intent2 = await this.intentRouter.analyzeIntent(workflow2Input);
      const workflow2 = await this.intentRouter.routeToAgents(intent2);
      const plan2 = await this.intentRouter.orchestrateWorkflow(workflow2);

      // Show conflict resolutions
      const conflicts = orchestrator.getConflictResolutions();
      console.log(`⚡ Conflict Resolutions: ${conflicts.length}`);
      conflicts.forEach((conflict, index) => {
        console.log(`   ${index + 1}. ${conflict.type}: ${conflict.description}`);
        console.log(`      Resolution: ${conflict.resolution} - ${conflict.reasoning}`);
      });
      console.log();

      // Monitor both workflows
      await Promise.all([
        this.monitorWorkflowExecution(plan1.id, 'Workflow 1'),
        this.monitorWorkflowExecution(plan2.id, 'Workflow 2')
      ]);

    } catch (error) {
      console.error(`❌ Demo 4 failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async demoMonitoringAndMetrics(): Promise<void> {
    console.log('📋 DEMO 5: Workflow Monitoring and Metrics');
    console.log('-' .repeat(50));

    try {
      const orchestrator = getWorkflowOrchestrator();
      const contextStore = getContextStore();

      // Show orchestrator metrics
      const metrics = orchestrator.getMetrics();
      console.log('📊 Orchestrator Metrics:');
      console.log(`   Total Workflows: ${metrics.totalWorkflows}`);
      console.log(`   Active Workflows: ${metrics.activeWorkflows}`);
      console.log(`   Completed Workflows: ${metrics.completedWorkflows}`);
      console.log(`   Failed Workflows: ${metrics.failedWorkflows}`);
      console.log(`   Conflict Resolutions: ${metrics.conflictResolutions}`);
      
      console.log('\n📈 Resource Utilization:');
      Object.entries(metrics.resourceUtilization).forEach(([agentType, utilization]) => {
        console.log(`   ${agentType}: ${utilization.toFixed(1)}%`);
      });

      // Show context store metrics
      const contextMetrics = contextStore.getMetrics();
      console.log('\n🗄️ Context Store Metrics:');
      console.log(`   Total Contexts: ${contextMetrics.totalContexts}`);
      console.log(`   Active Agents: ${contextMetrics.activeAgents}`);
      
      if (contextMetrics.statusDistribution) {
        console.log('\n📋 Status Distribution:');
        Object.entries(contextMetrics.statusDistribution as Record<string, number>).forEach(([status, count]) => {
          console.log(`   ${status}: ${count}`);
        });
      }

      // Show active workflows
      const activeWorkflows = orchestrator.getActiveWorkflows();
      console.log(`\n🔄 Active Workflows: ${activeWorkflows.length}`);
      activeWorkflows.forEach((workflow, index) => {
        console.log(`   ${index + 1}. ${workflow.name} (${workflow.status})`);
      });

    } catch (error) {
      console.error(`❌ Demo 5 failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async monitorWorkflowExecution(planId: string, label: string = 'Workflow'): Promise<void> {
    console.log(`👀 Monitoring ${label} execution...`);
    
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      try {
        const status = await this.intentRouter.monitorExecution({ id: planId } as any);
        
        console.log(`   Status: ${status.status} | Progress: ${status.progress.toFixed(1)}%`);
        
        if (status.status === 'completed') {
          console.log(`   ✅ ${label} completed successfully!`);
          break;
        } else if (status.status === 'failed') {
          console.log(`   ❌ ${label} failed!`);
          if (status.errors.length > 0) {
            console.log(`   Errors: ${status.errors.map(e => e.error).join(', ')}`);
          }
          break;
        } else if (status.status === 'cancelled') {
          console.log(`   🛑 ${label} was cancelled`);
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
        
      } catch (error) {
        console.log(`   ⚠️ Monitoring error: ${error instanceof Error ? error.message : String(error)}`);
        break;
      }
    }
    
    if (attempts >= maxAttempts) {
      console.log(`   ⏰ Monitoring timeout for ${label}`);
    }
    
    console.log();
  }

  async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up demo...');
    
    // Shutdown all agents
    for (const agent of this.demoAgents) {
      await agent.shutdown();
    }
    await this.intentRouter.shutdown();
    await this.agentRegistry.shutdownAll();
    
    console.log('✅ Demo cleanup complete!');
  }
}

// Run demo if this file is executed directly
if (require.main === module) {
  const demo = new WorkflowOrchestrationDemo();
  
  demo.initialize()
    .then(() => demo.runDemo())
    .then(() => demo.cleanup())
    .catch(error => {
      console.error('❌ Demo failed:', error);
      process.exit(1);
    });
}