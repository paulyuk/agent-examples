import * as dotenv from 'dotenv';
import { MCPServer } from '../dist/server/mcp-server.js';

// Load environment variables
dotenv.config();

async function testMCPServer() {
  try {
    console.log('🧪 Testing MCP Server directly...');
    
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
    };

    const mcpServer = new MCPServer(config.azureOpenAI, config.mcpServer);
    
    console.log('🧪 Calling handleAzureFunctionsChat...');
    const result = await mcpServer.handleAzureFunctionsChat({
      question: 'what are two features of functions'
    });
    
    console.log('🧪 MCP Server result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('🧪 MCP Server test error:', error);
  }
}

testMCPServer();
