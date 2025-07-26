#!/usr/bin/env node
import * as dotenv from 'dotenv';
import { AgentLoop } from '../dist/agent/loop.js';

dotenv.config();

async function testCosmosIdentity() {
  console.log('🧪 Testing Cosmos DB with Identity-based Authentication...');
  
  const config = {
    azureOpenAI: {
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    },
    // Cosmos DB with identity-based authentication (no key required)
    cosmos: {
      endpoint: process.env.COSMOS_ENDPOINT || 'https://your-cosmos-account.documents.azure.com:443/',
      databaseId: process.env.COSMOS_DATABASE_ID || 'agent-conversations',
      containerId: process.env.COSMOS_CONTAINER_ID || 'sessions',
      useIdentity: true, // Explicitly use Azure AD identity
      // Note: No 'key' property - uses DefaultAzureCredential instead
    },
    systemPrompt: 'You are a helpful assistant with persistent memory.',
  };

  try {
    const agent = new AgentLoop(config);
    await agent.initializeSession();
    
    console.log('✅ Cosmos DB identity authentication test successful');
    console.log(`📋 Session ID: ${agent.getSessionId()}`);
    
    // Test a simple conversation to verify persistence works
    const response = await agent.processMessage('Hello, can you remember this conversation?');
    console.log('🤖 Response:', response.message);
    
    // Show conversation history
    const history = agent.getConversationHistory();
    console.log(`💾 Conversation history: ${history.length} messages`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.log('💡 Make sure you have:');
    console.log('   1. AZURE_OPENAI_* environment variables set');
    console.log('   2. COSMOS_ENDPOINT pointing to your Cosmos DB account');
    console.log('   3. Azure CLI logged in (az login) or managed identity configured');
    console.log('   4. Your identity has Cosmos DB Data Contributor role');
  }
  
  process.exit(0);
}

testCosmosIdentity().catch(console.error);
