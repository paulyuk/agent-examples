import OpenAI from 'openai';
import {
  ChatMessage,
  AgentResponse,
  MCPToolCall,
  AgentLoopConfig,
} from '../types/index.js';

/**
 * Agent Loop that orchestrates conversations using OpenAI SDK with Azure OpenAI
 * Handles tool calling, conversation history, and response generation
 */
export class AgentLoop {
  private openaiClient: OpenAI;
  private config: AgentLoopConfig;
  private conversationHistory: ChatMessage[] = [];
  private mcpTools: Map<string, any> = new Map();

  constructor(config: AgentLoopConfig) {
    this.config = config;
    
    // Initialize OpenAI client for Azure OpenAI
    this.openaiClient = new OpenAI({
      apiKey: config.azureOpenAI.apiKey,
      baseURL: `${config.azureOpenAI.endpoint}/openai/deployments/${config.azureOpenAI.deploymentName}`,
      defaultQuery: { 'api-version': '2024-02-01' },
      defaultHeaders: {
        'api-key': config.azureOpenAI.apiKey,
      },
    });

    // Set up system prompt if provided
    if (config.systemPrompt) {
      this.conversationHistory.push({
        role: 'system',
        content: config.systemPrompt,
      });
    }
  }

  /**
   * Register an MCP tool for use in conversations
   */
  registerMCPTool(name: string, toolHandler: any): void {
    this.mcpTools.set(name, toolHandler);
    console.log(`🔧 Registered MCP tool: ${name}`);
  }

  /**
   * Process a user message and generate a response using Azure OpenAI
   * Handles tool calling and maintains conversation context
   */
  async processMessage(userMessage: string): Promise<AgentResponse> {
    try {
      // Add user message to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: userMessage,
      });

      // Prepare tools for OpenAI function calling
      const tools = Array.from(this.mcpTools.keys()).map(toolName => ({
        type: 'function' as const,
        function: this.getToolDescription(toolName),
      }));

      // Call Azure OpenAI with conversation history and available tools
      const requestParams: any = {
        model: this.config.azureOpenAI.deploymentName,
        messages: this.conversationHistory.map(msg => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content,
        })),
        max_tokens: 2000,
        temperature: 0.3,
        top_p: 0.9,
      };

      if (tools.length > 0) {
        requestParams.tools = tools;
        requestParams.tool_choice = 'auto';
      }

      const response = await this.openaiClient.chat.completions.create(requestParams);

      const choice = response.choices[0];
      if (!choice) {
        throw new Error('No response from Azure OpenAI');
      }

      // Handle tool calls if present
      const toolCalls = choice.message?.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        return await this.handleToolCalls(toolCalls);
      }

      // Regular response without tool calls
      const assistantMessage = choice.message?.content || 'No response generated';
      
      // Add assistant response to conversation history
      this.conversationHistory.push({
        role: 'assistant',
        content: assistantMessage,
      });

      return {
        message: assistantMessage,
      };

    } catch (error) {
      console.error('Error processing message:', error);
      return {
        message: 'Sorry, I encountered an error processing your request.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle tool calls from Azure OpenAI
   */
  private async handleToolCalls(toolCalls: any[]): Promise<AgentResponse> {
    const mcpToolCalls: MCPToolCall[] = [];
    let toolResults = '';

    for (const toolCall of toolCalls) {
      const { function: func } = toolCall;
      const toolName = func.name;
      const toolArgs = JSON.parse(func.arguments || '{}');

      mcpToolCalls.push({
        name: toolName,
        arguments: toolArgs,
      });

      // Execute the MCP tool
      const toolHandler = this.mcpTools.get(toolName);
      if (toolHandler) {
        try {
          const result = await toolHandler(toolArgs);
          // Extract text content from the result
          const resultText = result.content?.[0]?.text || JSON.stringify(result);
          toolResults += `Tool ${toolName} result: ${resultText}\n`;
        } catch (error) {
          console.error(`Error executing tool ${toolName}:`, error);
          toolResults += `Tool ${toolName} error: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
        }
      } else {
        toolResults += `Tool ${toolName} not found\n`;
      }
    }

    // Add tool results to conversation and get final response
    this.conversationHistory.push({
      role: 'assistant',
      content: `I'll use the ${mcpToolCalls.map(tc => tc.name).join(', ')} tool(s) to help you.`,
    });

    // Get final response from Azure OpenAI with tool results
    const finalResponse = await this.openaiClient.chat.completions.create({
      model: this.config.azureOpenAI.deploymentName,
      messages: [
        ...this.conversationHistory.map(msg => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content,
        })),
        {
          role: 'user' as const,
          content: `Based on these tool results, please provide a helpful response:\n${toolResults}`,
        },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    });

    const finalMessage = finalResponse.choices[0]?.message?.content || 'No final response generated';
    
    // Add final response to conversation history
    this.conversationHistory.push({
      role: 'assistant',
      content: finalMessage,
    });

    return {
      message: finalMessage,
      toolCalls: mcpToolCalls,
    };
  }

  /**
   * Get tool description for OpenAI function calling
   */
  private getToolDescription(toolName: string): any {
    switch (toolName) {
      case 'azure-functions-chat':
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
      default:
        return {
          name: toolName,
          description: `Tool: ${toolName}`,
          parameters: {
            type: 'object',
            properties: {},
          },
        };
    }
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Clear conversation history but keep system prompt
   */
  clearHistory(): void {
    const systemMessages = this.conversationHistory.filter(msg => msg.role === 'system');
    this.conversationHistory = systemMessages;
    console.log('🧹 Conversation history cleared');
  }

  /**
   * Get registered tools
   */
  getRegisteredTools(): string[] {
    return Array.from(this.mcpTools.keys());
  }
}
