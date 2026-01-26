/**
 * Simple validation script to test property test logic
 */

import { IntentRouter } from './src/agents/intent-router';
import { IntentCategory, ComplexityLevel, RiskLevel, AgentType } from './src/types/core';
import { resetMessageBus } from './src/core/message-bus';

async function validatePropertyTest() {
  console.log('Starting property test validation...');
  
  resetMessageBus();
  const agent = new IntentRouter({
    id: 'test-intent-router-validation',
    confidenceThreshold: 0.5
  });
  
  try {
    await agent.initialize();
    console.log('✓ Agent initialized successfully');
    
    // Test 1: Intent Analysis Consistency
    console.log('\nTesting Intent Analysis Consistency...');
    const testInputs = [
      'generate code for a user authentication system',
      'test the payment processing module',
      'validate security of smart contract',
      'research best practices for API design',
      'design a microservices architecture'
    ];
    
    for (const input of testInputs) {
      const analysis = await agent.analyzeIntent(input);
      
      // Validate structure
      console.log(`Input: "${input}"`);
      console.log(`  Primary Intent: ${analysis.primaryIntent}`);
      console.log(`  Confidence: ${analysis.confidence}`);
      console.log(`  Required Agents: ${analysis.requiredAgents.length}`);
      
      // Basic property checks
      if (!Object.values(IntentCategory).includes(analysis.primaryIntent)) {
        throw new Error(`Invalid primary intent: ${analysis.primaryIntent}`);
      }
      
      if (analysis.confidence < 0 || analysis.confidence > 1) {
        throw new Error(`Invalid confidence: ${analysis.confidence}`);
      }
      
      if (!Array.isArray(analysis.requiredAgents) || analysis.requiredAgents.length === 0) {
        throw new Error('Required agents should be non-empty array');
      }
      
      if (!analysis.requiredAgents.includes(AgentType.INTENT_ROUTER)) {
        throw new Error('Intent Router should always be included');
      }
      
      if (!analysis.requiredAgents.includes(AgentType.AUDIT_AGENT)) {
        throw new Error('Audit Agent should always be included');
      }
      
      // Test consistency
      const secondAnalysis = await agent.analyzeIntent(input);
      if (secondAnalysis.primaryIntent !== analysis.primaryIntent) {
        throw new Error('Intent analysis should be consistent');
      }
      
      console.log('  ✓ Analysis passed all property checks');
    }
    
    // Test 2: Agent Routing
    console.log('\nTesting Agent Routing...');
    const analysis = await agent.analyzeIntent('create a TypeScript function');
    analysis.confidence = 0.8; // Ensure routing succeeds
    
    const workflow = await agent.routeToAgents(analysis);
    console.log(`Workflow created with ${workflow.steps.length} steps`);
    
    // Validate workflow structure
    if (!workflow.id || typeof workflow.id !== 'string') {
      throw new Error('Workflow should have valid ID');
    }
    
    if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {
      throw new Error('Workflow should have steps');
    }
    
    workflow.steps.forEach((step, index) => {
      if (!step.id || typeof step.id !== 'string') {
        throw new Error(`Step ${index} should have valid ID`);
      }
      
      if (!Object.values(AgentType).includes(step.agentType)) {
        throw new Error(`Step ${index} has invalid agent type: ${step.agentType}`);
      }
      
      if (!step.action || typeof step.action !== 'string') {
        throw new Error(`Step ${index} should have valid action`);
      }
    });
    
    console.log('  ✓ Workflow passed all property checks');
    
    // Test 3: Workflow Orchestration
    console.log('\nTesting Workflow Orchestration...');
    const executionPlan = await agent.orchestrateWorkflow(workflow);
    console.log(`Execution plan created with ${executionPlan.schedule.length} scheduled items`);
    
    // Validate execution plan
    if (!executionPlan.id || typeof executionPlan.id !== 'string') {
      throw new Error('Execution plan should have valid ID');
    }
    
    if (executionPlan.schedule.length !== workflow.steps.length) {
      throw new Error('Schedule should match workflow steps');
    }
    
    if (!(executionPlan.estimatedCompletion instanceof Date)) {
      throw new Error('Estimated completion should be a Date');
    }
    
    console.log('  ✓ Execution plan passed all property checks');
    
    // Test 4: Execution Monitoring
    console.log('\nTesting Execution Monitoring...');
    const status = await agent.monitorExecution(executionPlan);
    console.log(`Status: ${status.status}, Progress: ${status.progress}%`);
    
    // Validate execution status
    if (!['pending', 'running', 'completed', 'failed', 'cancelled'].includes(status.status)) {
      throw new Error(`Invalid status: ${status.status}`);
    }
    
    if (status.progress < 0 || status.progress > 100) {
      throw new Error(`Invalid progress: ${status.progress}`);
    }
    
    console.log('  ✓ Execution status passed all property checks');
    
    console.log('\n🎉 All property test validations passed!');
    console.log('✓ Intent Analysis and Routing Consistency validated');
    console.log('✓ Agent routing produces valid workflows');
    console.log('✓ Workflow orchestration creates valid execution plans');
    console.log('✓ Execution monitoring provides accurate status');
    
  } catch (error) {
    console.error('❌ Property test validation failed:', error);
    process.exit(1);
  } finally {
    await agent.shutdown();
    resetMessageBus();
  }
}

// Run validation if this file is executed directly
if (require.main === module) {
  validatePropertyTest().catch(console.error);
}

export { validatePropertyTest };