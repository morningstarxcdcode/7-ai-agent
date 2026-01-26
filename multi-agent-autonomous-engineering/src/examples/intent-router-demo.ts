/**
 * Intent Router Demo
 * Demonstrates the intent analysis and classification system
 */

import { IntentRouter } from '../agents/intent-router';
import { IntentCategory, AgentType, ComplexityLevel, RiskLevel } from '../types/core';

async function runIntentRouterDemo() {
  console.log('🚀 Intent Router Agent Demo\n');

  // Initialize the Intent Router
  const intentRouter = new IntentRouter({
    id: 'demo-intent-router',
    confidenceThreshold: 0.6
  });

  await intentRouter.initialize();

  // Test cases demonstrating different intent categories
  const testCases = [
    {
      name: 'Code Generation',
      input: 'Generate a TypeScript function to calculate fibonacci numbers'
    },
    {
      name: 'DeFi Operation',
      input: 'Swap 100 ETH for USDC on Uniswap with security validation'
    },
    {
      name: 'Security Validation',
      input: 'Check this smart contract 0x1234567890123456789012345678901234567890 for rug pull risks'
    },
    {
      name: 'System Design',
      input: 'Design a scalable microservices architecture for an e-commerce platform'
    },
    {
      name: 'Testing',
      input: 'Write comprehensive unit tests for the authentication service'
    },
    {
      name: 'Research',
      input: 'Research the best APIs for getting real-time cryptocurrency prices'
    },
    {
      name: 'Complex Multi-Agent',
      input: 'Build a secure DeFi trading bot, test it thoroughly, and deploy to production'
    },
    {
      name: 'Ambiguous Request',
      input: 'Help me with my code'
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📝 Test Case: ${testCase.name}`);
    console.log(`Input: "${testCase.input}"`);
    console.log('─'.repeat(60));

    try {
      // Analyze intent
      const analysis = await intentRouter.analyzeIntent(testCase.input);
      
      console.log(`✅ Primary Intent: ${analysis.primaryIntent}`);
      console.log(`🔄 Secondary Intents: ${analysis.secondaryIntents.join(', ') || 'None'}`);
      console.log(`⚡ Complexity: ${analysis.complexity}`);
      console.log(`⚠️  Risk Level: ${analysis.riskLevel}`);
      console.log(`🎯 Confidence: ${(analysis.confidence * 100).toFixed(1)}%`);
      console.log(`🤖 Required Agents: ${analysis.requiredAgents.join(', ')}`);
      console.log(`⏱️  Estimated Duration: ${(analysis.estimatedDuration / 1000).toFixed(1)}s`);
      console.log(`💭 Reasoning: ${analysis.reasoning}`);

      // Extract parameters if any
      if (Object.keys(analysis.parameters).length > 0) {
        console.log(`📋 Parameters:`, analysis.parameters);
      }

      // Try to route to agents if confidence is high enough
      if (analysis.confidence >= 0.6) {
        console.log('\n🔀 Routing to agents...');
        const workflow = await intentRouter.routeToAgents(analysis);
        console.log(`📋 Workflow Created: ${workflow.id}`);
        console.log(`👥 Participating Agents: ${workflow.participatingAgents?.length || 0}`);
        console.log(`📝 Workflow Steps: ${workflow.steps.length}`);
        
        // Show workflow steps
        workflow.steps.forEach((step, index) => {
          console.log(`   ${index + 1}. ${step.agentType}: ${step.action} (timeout: ${step.timeout}ms)`);
        });

        // Create execution plan
        console.log('\n⚙️  Creating execution plan...');
        const executionPlan = await intentRouter.orchestrateWorkflow(workflow);
        console.log(`📅 Execution Plan: ${executionPlan.id}`);
        console.log(`🎯 Estimated Completion: ${executionPlan.estimatedCompletion.toLocaleTimeString()}`);

        // Monitor execution status
        const status = await intentRouter.monitorExecution(executionPlan);
        console.log(`📊 Current Status: ${status.status} (${status.progress.toFixed(1)}% complete)`);
      } else {
        console.log(`❌ Low confidence (${(analysis.confidence * 100).toFixed(1)}%) - would request clarification`);
      }

    } catch (error) {
      console.log(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Demonstrate agent health check
  console.log('\n🏥 Agent Health Check');
  console.log('─'.repeat(60));
  const health = await intentRouter.healthCheck();
  console.log(`Status: ${health.status}`);
  console.log(`Message: ${health.message || 'No message'}`);
  console.log(`Last Check: ${health.lastCheck.toLocaleTimeString()}`);

  // Show agent metrics
  console.log('\n📊 Agent Metrics');
  console.log('─'.repeat(60));
  const metrics = intentRouter.getMetrics();
  console.log(JSON.stringify(metrics, null, 2));

  // Cleanup
  await intentRouter.shutdown();
  console.log('\n✅ Demo completed successfully!');
}

// Run the demo
if (require.main === module) {
  runIntentRouterDemo().catch(console.error);
}

export { runIntentRouterDemo };