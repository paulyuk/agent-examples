/**
 * Test script to validate CLI and MCP server interaction
 */
import { CLIClient } from './dist/client/cli.js';

// Test configuration (minimal)
const config = {
  azureOpenAI: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || 'https://your-resource.openai.azure.com/',
    apiKey: process.env.AZURE_OPENAI_API_KEY || 'your-api-key',
    deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o',
    apiVersion: '2024-06-01'
  },
  cosmosDb: {
    endpoint: process.env.COSMOS_DB_ENDPOINT || 'https://your-cosmos.documents.azure.com:443/',
    databaseId: process.env.COSMOS_DB_DATABASE_ID || 'agent-sessions',
    containerId: process.env.COSMOS_DB_CONTAINER_ID || 'sessions'
  },
  mcpServer: {
    port: 8080
  },
  chainOfThought: false
};

async function testMCPToolDirectly() {
  console.log('🧪 Testing MCP tool integration directly...');
  
  const cli = new CLIClient(config);
  
  try {
    // Test the MCP tool by simulating a user question that should trigger it
    console.log('🔧 Testing with sample Azure Functions question...');
    const result = await cli.agent.processMessage("Can you provide a SQL sample from the Azure Developer (azd) gallery?");
    
    console.log('✅ Agent response:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ MCP tool test failed:', error);
  }
  
  await cli.stop();
}

testMCPToolDirectly().catch(console.error);
