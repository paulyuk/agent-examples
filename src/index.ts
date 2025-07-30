import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CLIClient } from './client/cli.js';
import { AgentLoopConfig } from './types/index.js';

// Load environment variables
dotenv.config();

/**
 * Load system prompt from external markdown file
 */
function loadSystemPrompt(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const promptPath = join(__dirname, 'system_prompt.md');
    return readFileSync(promptPath, 'utf-8');
  } catch (error) {
    console.error('⚠️ Could not load system_prompt.md, using fallback prompt');
    return 'You are an Azure Functions expert assistant. Provide helpful guidance on Azure Functions development.';
  }
}

/**
 * Main entry point for the Azure OpenAI MCP Agent
 * Initializes and starts the interactive CLI client
 */
async function main(): Promise<void> {
  try {
    // Validate environment variables
    const requiredEnvVars = [
      'AZURE_OPENAI_ENDPOINT',
      'AZURE_OPENAI_API_KEY',
      'AZURE_OPENAI_DEPLOYMENT_NAME',
    ];

    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    if (missingEnvVars.length > 0) {
      console.error('❌ Missing required environment variables:');
      missingEnvVars.forEach(envVar => console.error(`   - ${envVar}`));
      console.error('');
      console.error('💡 Please check your .env file or set these environment variables.');
      console.error('📝 See .env.example for reference.');
      process.exit(1);
    }

    // Configure Cosmos DB - support both identity and key-based authentication
    const cosmosConfig = process.env.COSMOS_ENDPOINT ? {
      endpoint: process.env.COSMOS_ENDPOINT,
      ...(process.env.COSMOS_KEY && { key: process.env.COSMOS_KEY }),
      databaseId: process.env.COSMOS_DATABASE_ID || 'agent-conversations',
      containerId: process.env.COSMOS_CONTAINER_ID || 'sessions',
      useIdentity: process.env.COSMOS_USE_IDENTITY === 'true' || !process.env.COSMOS_KEY,
    } : undefined;

    const config: AgentLoopConfig = {
      azureOpenAI: {
        endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
        apiKey: process.env.AZURE_OPENAI_API_KEY!,
        deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME!,
      },
      mcpServer: {
        port: parseInt(process.env.MCP_SERVER_PORT || '3000'),
        name: 'azure-functions-mcp-server',
        version: '1.0.0',
      },
      ...(cosmosConfig && { cosmos: cosmosConfig }),
      systemPrompt: loadSystemPrompt(),
    };

    // Create and start the CLI client with streaming support
    const client = new CLIClient(config);
    await client.start();
  } catch (error) {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Goodbye!');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Goodbye!');
  process.exit(0);
});

main().catch(error => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});
