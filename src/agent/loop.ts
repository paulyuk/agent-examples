import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import {
  ChatMessage,
  AgentResponse,
  MCPToolCall,
  AgentLoopConfig,
} from '../types/index.js';
import { CosmosService } from '../services/cosmos.js';

/**
 * Agent Loop that orchestrates conversations using OpenAI SDK with Azure OpenAI
 * Handles tool calling, conversation history, streaming, and persistence
 */
export class AgentLoop {
  private openaiClient: OpenAI;
  private config: AgentLoopConfig;
  private conversationHistory: ChatMessage[] = [];
  private mcpTools: Map<string, any> = new Map();
  private sessionId: string;
  private cosmosService?: CosmosService;

  constructor(config: AgentLoopConfig, sessionId?: string) {
    this.config = config;
    this.sessionId = sessionId || uuidv4();
    
    // Initialize Cosmos DB service if config is provided
    if (config.cosmos) {
      this.cosmosService = new CosmosService(config.cosmos);
    }
    
    // Initialize OpenAI client for Azure OpenAI
    this.openaiClient = new OpenAI({
      apiKey: config.azureOpenAI.apiKey,
      baseURL: `${config.azureOpenAI.endpoint}/openai/deployments/${config.azureOpenAI.deploymentName}`,
      defaultQuery: { 'api-version': '2024-02-01' },
      defaultHeaders: {
        'api-key': config.azureOpenAI.apiKey,
      },
    });

    // If chain of thought is enabled, prepend a step-by-step system prompt if not already present
    if (config.chainOfThought && !config.systemPrompt) {
      config.systemPrompt = 'You are an expert AI assistant. Think step by step, explain your reasoning before answering, and break down problems into logical steps.';
    }

    console.log(`🆔 Session ID: ${this.sessionId}`);
  }

  /**
   * Initialize session - load from Cosmos DB if available, otherwise start fresh
   */
  async initializeSession(): Promise<void> {
    if (this.cosmosService) {
      const existingSession = await this.cosmosService.loadSession(this.sessionId, true);
      if (existingSession) {
        this.conversationHistory = existingSession.messages;
        console.log(`📂 Loaded ${this.conversationHistory.length} messages from session ${this.sessionId}`);
        return;
      }
    }

    // Set up system prompt if provided and no existing session
    if (this.config.systemPrompt) {
      const systemMessage: ChatMessage = {
        role: 'system',
        content: this.config.systemPrompt,
        timestamp: new Date(),
        sessionId: this.sessionId,
      };
      this.conversationHistory.push(systemMessage);
      await this.saveMessageToCosmos(systemMessage, true); // Print on session creation
    }
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }
  /**
   * Save message to Cosmos DB if service is available
   */
  private async saveMessageToCosmos(message: ChatMessage, debug = false): Promise<void> {
    if (this.cosmosService) {
      await this.cosmosService.addMessageToSession(this.sessionId, message, debug);
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
      // If chain of thought is enabled, insert a synthetic assistant message before user input
      if (this.config.chainOfThought) {
        const reasoningMsg: ChatMessage = {
          role: 'assistant',
          content: "Let's break down the problem and reason step by step before answering.",
          timestamp: new Date(),
          sessionId: this.sessionId,
        };
        this.conversationHistory.push(reasoningMsg);
        await this.saveMessageToCosmos(reasoningMsg);
      }
      // Add user message to conversation history with session info
      const userChatMessage: ChatMessage = {
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
        sessionId: this.sessionId,
      };
      this.conversationHistory.push(userChatMessage);
      await this.saveMessageToCosmos(userChatMessage);

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
        temperature: 0.1,
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
      
      // Add assistant response to conversation history with session info
      const assistantChatMessage: ChatMessage = {
        role: 'assistant',
        content: assistantMessage,
        timestamp: new Date(),
        sessionId: this.sessionId,
      };
      
      this.conversationHistory.push(assistantChatMessage);
      await this.saveMessageToCosmos(assistantChatMessage);

      return {
        message: assistantMessage,
        isStreaming: false,
      };
    } catch (error) {
      console.error('❌ Error processing message:', error);
      return {
        message: 'Sorry, I encountered an error while processing your message.',
        error: error instanceof Error ? error.message : 'Unknown error',
        isStreaming: false,
      };
    }
  }

  /**
   * Process a user message with streaming support
   * Returns an async generator for real-time response streaming
   */
  async* processMessageStream(userMessage: string): AsyncGenerator<string, AgentResponse, unknown> {
    try {
      // If chain of thought is enabled, insert a synthetic assistant message before user input
      if (this.config.chainOfThought) {
        const reasoningMsg: ChatMessage = {
          role: 'assistant',
          content: "Let's break down the problem and reason step by step before answering.",
          timestamp: new Date(),
          sessionId: this.sessionId,
        };
        this.conversationHistory.push(reasoningMsg);
        await this.saveMessageToCosmos(reasoningMsg);
      }
      // Add user message to conversation history with session info
      const userChatMessage: ChatMessage = {
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
        sessionId: this.sessionId,
      };
      
      this.conversationHistory.push(userChatMessage);
      await this.saveMessageToCosmos(userChatMessage);

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

      // Use real streaming from Azure OpenAI
      const streamParams = {
        ...requestParams,
        stream: true as const,
      };
      
      const stream = await this.openaiClient.chat.completions.create(streamParams);
      
      let assistantMessage = '';
      const toolCallsMap = new Map<number, any>();
      
      // Process the real-time stream from Azure OpenAI
      // TypeScript assertion needed for streaming response
      for await (const chunk of stream as any) {
        const delta = chunk.choices[0]?.delta;
        
        if (!delta) continue;
        
        // Handle content streaming
        if (delta.content) {
          assistantMessage += delta.content;
          yield delta.content; // Yield real-time content as it comes from Azure OpenAI
        }
        
        // Handle tool calls in streaming (collect deltas)
        if (delta.tool_calls) {
          for (const toolCallDelta of delta.tool_calls) {
            const index = toolCallDelta.index!;
            if (!toolCallsMap.has(index)) {
              toolCallsMap.set(index, {
                id: toolCallDelta.id || '',
                type: toolCallDelta.type || 'function',
                function: {
                  name: '',
                  arguments: ''
                }
              });
            }
            
            const existingCall = toolCallsMap.get(index)!;
            if (toolCallDelta.function?.name) {
              existingCall.function.name += toolCallDelta.function.name;
            }
            if (toolCallDelta.function?.arguments) {
              existingCall.function.arguments += toolCallDelta.function.arguments;
            }
          }
        }
      }
      
      // Handle tool calls if present after streaming completes
      if (toolCallsMap.size > 0) {
        const completeToolCalls = Array.from(toolCallsMap.values());
        const toolResponse = await this.handleToolCalls(completeToolCalls);
        return toolResponse;
      }
      
      // Add assistant response to conversation history with session info
      const assistantChatMessage: ChatMessage = {
        role: 'assistant',
        content: assistantMessage || 'No response generated',
        timestamp: new Date(),
        sessionId: this.sessionId,
      };
      
      this.conversationHistory.push(assistantChatMessage);
      await this.saveMessageToCosmos(assistantChatMessage);

      return {
        message: assistantMessage || 'No response generated',
        isStreaming: true,
      };
    } catch (error) {
      console.error('❌ Error processing streaming message:', error);
      return {
        message: 'Sorry, I encountered an error while processing your message.',
        error: error instanceof Error ? error.message : 'Unknown error',
        isStreaming: true,
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
      
      let toolArgs;
      try {
        toolArgs = JSON.parse(func.arguments || '{}');
      } catch (parseError) {
        console.error(`🔧 Error parsing tool arguments:`, parseError);
        toolArgs = {};
      }

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
    const toolMessage: ChatMessage = {
      role: 'assistant',
      content: `I'll use the ${mcpToolCalls.map(tc => tc.name).join(', ')} tool(s) to help you.`,
      timestamp: new Date(),
      sessionId: this.sessionId,
    };
    this.conversationHistory.push(toolMessage);
    await this.saveMessageToCosmos(toolMessage);

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
    const finalChatMessage: ChatMessage = {
      role: 'assistant',
      content: finalMessage,
      timestamp: new Date(),
      sessionId: this.sessionId,
    };
    this.conversationHistory.push(finalChatMessage);
    await this.saveMessageToCosmos(finalChatMessage);

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
// ...existing code...
  /**
   * Save the entire session (all messages) to CosmosDB, with debug log
   */
  public async saveFullSession(debug = false): Promise<void> {
    if (this.cosmosService) {
      const now = new Date();
      const session = {
        id: this.sessionId,
        sessionId: this.sessionId,
        messages: this.conversationHistory,
        createdAt: this.conversationHistory[0]?.timestamp || now,
        updatedAt: now,
      };
      await this.cosmosService.saveSession(session, debug);
    }
  }

  /**
   * Clear conversation history but keep system prompt
   */
  public async clearHistory(): Promise<void> {
    const systemMessages = this.conversationHistory.filter(msg => msg.role === 'system');
    this.conversationHistory = systemMessages;
    await this.saveFullSession(true); // Print on clear
    console.log('🧹 Conversation history cleared');
  }

  /**
   * Get registered tools
   */
  getRegisteredTools(): string[] {
    return Array.from(this.mcpTools.keys());
  }
}
