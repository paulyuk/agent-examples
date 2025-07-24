import * as dotenv from 'dotenv';
import { CLIClient } from './client/cli.js';
import { AgentLoopConfig } from './types/index.js';

// Load environment variables
dotenv.config();

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

    // Configure the agent
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
      systemPrompt: `You are an Azure Functions expert assistant powered by Azure OpenAI. 
      You have access to specialized Azure Functions tools through the Model Context Protocol (MCP).
      
      Your expertise includes:
      - Azure Functions development and best practices
      - Triggers, bindings, and runtime configurations
      - Performance optimization and scaling
      - Security and monitoring with managed identity
      - Integration with other Azure services
      - Deployment strategies and DevOps
      
      Use the available MCP tools when users ask specific questions about Azure Functions.
      Always provide practical, actionable advice with code examples when relevant.
      Focus on modern best practices, security, and performance optimization.`,
    };

    // Create and start the CLI client
    const client = new CLIClient(config);

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down gracefully...');
      await client.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down gracefully...');
      await client.stop();
      process.exit(0);
    });

    // Start the client
    await client.start();

  } catch (error) {
    console.error('💥 Failed to start Azure OpenAI MCP Agent:', error);
    process.exit(1);
  }
}

// Run the application
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}
