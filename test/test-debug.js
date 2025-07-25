import * as dotenv from 'dotenv';
import { AgentLoop } from '../dist/agent/loop.js';
import { MCPServer } from '../dist/server/mcp-server.js';

// Load environment variables
dotenv.config();

async function test() {
  try {
    console.log('🧪 Testing tool execution...');
    
    // Check environment variables
    console.log('Environment check:');
    console.log('- AZURE_OPENAI_ENDPOINT:', process.env.AZURE_OPENAI_ENDPOINT ? '✅ Set' : '❌ Missing');
    console.log('- AZURE_OPENAI_API_KEY:', process.env.AZURE_OPENAI_API_KEY ? '✅ Set' : '❌ Missing');
    console.log('- AZURE_OPENAI_DEPLOYMENT_NAME:', process.env.AZURE_OPENAI_DEPLOYMENT_NAME || '❌ Missing');
    
    const config = {
      azureOpenAI: {
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
      },
      mcpServer: {
        port: 3000,
        name: 'azure-functions-mcp-server',
        version: '1.0.0',
      },
      systemPrompt: 'You are a helpful Azure Functions expert assistant.',
    };

    const agent = new AgentLoop(config);
    const mcpServer = new MCPServer(config.azureOpenAI, config.mcpServer);
    
    // Register the tool
    agent.registerMCPTool('azure-functions-chat', async (args) => {
      console.log('🧪 Tool called with args:', args);
      const result = await mcpServer.handleAzureFunctionsChat(args);
      console.log('🧪 Tool result:', result);
      return result;
    });
    
    await agent.initializeSession();
    
    // Just test the agent with a simple message
    console.log('🧪 Testing simple message processing...');
    const response = await agent.processMessage('what are two features of functions');
    console.log('🧪 Final response:', response);
    
  } catch (error) {
    console.error('🧪 Test error:', error);
  }
}

test();
