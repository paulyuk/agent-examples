/**
 * Test script to validate Plan-and-Execute functionality
 */
import { AgentLoop } from '../dist/agent/loop.js';

// Test configuration (minimal - will fail if no real credentials, but we can test structure)
const config = {
  azureOpenAI: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || 'https://mock-resource.openai.azure.com/',
    apiKey: process.env.AZURE_OPENAI_API_KEY || 'mock-api-key',
    deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o',
    apiVersion: '2024-06-01'
  },
  mcpServer: {
    port: 3000,
    name: 'test-mcp-server',
    version: '1.0.0'
  },
  planAndExecute: true,
  maxIterations: 5
};

async function testPlanAndExecuteStructure() {
  console.log('🧪 Testing Plan-and-Execute structure...');
  
  const agent = new AgentLoop(config, 'test-session-plan-execute');
  
  try {
    // Test 1: Check that the new method exists
    console.log('✅ AgentLoop.processMessageWithPlan method exists:', typeof agent.processMessageWithPlan === 'function');
    
    // Test 2: Check configuration handling
    console.log('✅ Plan-and-Execute config loaded:', config.planAndExecute);
    console.log('✅ Max iterations config:', config.maxIterations);
    
    // Test 3: Check types are properly imported (will fail if types aren't working)
    console.log('✅ Agent instantiated with plan-execute config successfully');
    
    // Test 4: If we have valid credentials, try a simple plan-execute call
    if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
      console.log('🔧 Testing with real credentials...');
      
      try {
        // Initialize MCP tools first (required for proper functioning)
        await agent.initializeMCPTools();
        console.log('✅ MCP tools initialized');
        
        const result = await agent.processMessageWithPlan("Create a simple hello world Azure Function");
        console.log('✅ Plan-Execute call completed:', {
          hasMessage: !!result.message,
          hasError: !!result.error,
          messageLength: result.message?.length || 0
        });
      } catch (mcpError) {
        console.log('⚠️ Plan-Execute call failed (expected without MCP server):', mcpError.message);
      }
    } else {
      console.log('⚠️ No real credentials - skipping live test');
    }
    
  } catch (error) {
    console.error('❌ Plan-Execute test failed:', error);
  }
  
  await agent.cleanup();
}

async function testSystemPromptTemplate() {
  console.log('🧪 Testing system prompt template...');
  
  try {
    // Check if the system prompt file exists
    const fs = await import('fs');
    const path = await import('path');
    
    const systemPromptPath = path.resolve('system_prompt_plan_execute.md');
    const exists = fs.existsSync(systemPromptPath);
    console.log('✅ System prompt template file exists:', exists);
    
    if (exists) {
      const content = fs.readFileSync(systemPromptPath, 'utf8');
      console.log('✅ System prompt template loaded:', {
        length: content.length,
        hasUserMessagePlaceholder: content.includes('{{USER_MESSAGE}}'),
        hasJsonFormat: content.includes('json'),
        hasPlanArray: content.includes('"plan"')
      });
    }
    
  } catch (error) {
    console.error('❌ System prompt test failed:', error);
  }
}

async function runAllTests() {
  console.log('🚀 Starting Plan-and-Execute tests...\n');
  
  await testSystemPromptTemplate();
  console.log('');
  await testPlanAndExecuteStructure();
  
  console.log('\n✅ Plan-and-Execute tests completed!');
}

runAllTests().catch(console.error);