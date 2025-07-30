import * as dotenv from 'dotenv';
import { AgentLoop } from '../dist/agent/loop.js';

// Load environment variables
dotenv.config();

async function testMCPViaAgentLoop() {
  let agentLoop = null;
  try {
    console.log('🧪 Testing MCP via Agent Loop...');
    
    const config = {
      azureOpenAI: {
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
      },
      systemPrompt: 'You are an Azure Functions expert. Use tools when needed.',
    };

    agentLoop = new AgentLoop(config);
    await agentLoop.initializeSession();
    await agentLoop.initializeMCPTools('test-session');
    
    console.log('🧪 Asking: Find me an Azure Functions sample...');
    const result = await agentLoop.processMessage('Find me an Azure Functions sample for sql in python');
    
    console.log('🧪 Agent result:', result.message);
    if (result.toolCalls) {
      console.log('🔧 Tools used:', result.toolCalls.map(tc => tc.name));
    }
    
    // Validate that the SQL trigger sample is mentioned
    const hasSQL = result.message.toLowerCase().includes('sql');
    const hasTrigger = result.message.toLowerCase().includes('trigger');
    const hasPython = result.message.toLowerCase().includes('python');
    
    if (hasSQL && hasTrigger && hasPython) {
      console.log('✅ Test PASSED: SQL trigger sample found in response');
    } else {
      console.log('❌ Test FAILED: Expected SQL trigger Python sample not found');
      console.log(`   SQL: ${hasSQL}, Trigger: ${hasTrigger}, Python: ${hasPython}`);
    }
    
  } catch (error) {
    console.error('🧪 MCP test error:', error);
  } finally {
    if (agentLoop) await agentLoop.cleanup();
  }
}

testMCPViaAgentLoop();
