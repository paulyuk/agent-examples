import * as dotenv from 'dotenv';
import { MCPServer } from '../dist/server/mcp-server.js';

dotenv.config();

async function testMCPServer() {
  try {
    console.log('🧪 Testing MCP Server...');
    
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
    const result = await Promise.race([
      mcpServer.handleAzureFunctionsChat({
        question: 'what are two features of functions'
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('MCP call timeout')), 15000))
    ]);
    
    console.log('🧪 MCP Server result:', result);
    
  } catch (error) {
    console.error('🧪 MCP Server test error:', error);
  }
  process.exit(0);
}

testMCPServer();
