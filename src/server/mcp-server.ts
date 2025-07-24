import OpenAI from 'openai';
import {
  AzureOpenAIConfig,
  AzureFunctionsChatToolParams,
  MCPServerConfig,
} from '../types/index.js';

/**
 * MCP Server that simulates Azure Functions chat tool
 * Uses OpenAI SDK with Azure OpenAI endpoint
 */
export class MCPServer {
  private openaiClient: OpenAI;
  private config: MCPServerConfig;
  private azureConfig: AzureOpenAIConfig;

  constructor(azureConfig: AzureOpenAIConfig, mcpConfig: MCPServerConfig) {
    this.azureConfig = azureConfig;
    this.config = mcpConfig;

    // Initialize OpenAI client for Azure OpenAI
    this.openaiClient = new OpenAI({
      apiKey: azureConfig.apiKey,
      baseURL: `${azureConfig.endpoint}/openai/deployments/${azureConfig.deploymentName}`,
      defaultQuery: { 'api-version': '2024-02-01' },
      defaultHeaders: {
        'api-key': azureConfig.apiKey,
      },
    });
  }

  /**
   * Handle Azure Functions chat tool calls
   */
  async handleAzureFunctionsChat(
    params: AzureFunctionsChatToolParams
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      const { question, context } = params;
      
      // System prompt with Azure Functions expertise
      const systemPrompt = `You are an expert Azure Functions developer and consultant. 
      Provide detailed, accurate, and practical answers about Azure Functions development, 
      deployment, best practices, troubleshooting, and performance optimization.
      
      Focus on:
      - Azure Functions runtime and triggers (HTTP, Timer, Queue, Blob, etc.)
      - Binding configurations and patterns
      - Performance optimization and scaling
      - Security best practices with managed identity
      - Deployment strategies (ZIP, Docker, ARM templates)
      - Monitoring and diagnostics with Application Insights
      - Cost optimization strategies
      - Integration with other Azure services (Storage, Cosmos DB, Service Bus, etc.)
      
      Always provide practical code examples when relevant and explain the reasoning behind recommendations.
      Include specific configuration examples and best practices.`;

      const userContent = context 
        ? `Context: ${context}\n\nQuestion: ${question}`
        : question;

      const response = await this.openaiClient.chat.completions.create({
        model: this.azureConfig.deploymentName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        max_tokens: 1500,
        temperature: 0.3,
        top_p: 0.9,
      });

      const content = response.choices[0]?.message?.content || 'No response generated';
      
      return {
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
      };
    } catch (error) {
      console.error('Error in Azure Functions chat tool:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error processing Azure Functions question: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  /**
   * Get tool description for the Azure Functions chat tool
   */
  getToolDescription(): any {
    return {
      name: 'azure-functions-chat',
      description: 'Chat tool specialized in Azure Functions development, best practices, and troubleshooting',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'Question about Azure Functions development',
          },
          context: {
            type: 'string',
            description: 'Optional context or code snippet for more specific help',
          },
        },
        required: ['question'],
      },
    };
  }

  /**
   * Start the MCP server (simplified)
   */
  async start(): Promise<void> {
    console.log(`🚀 MCP Server ready: ${this.config.name} v${this.config.version}`);
    console.log('🔧 Available tools: azure-functions-chat');
    return Promise.resolve();
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    console.log('🛑 MCP Server stopped');
    return Promise.resolve();
  }
}
