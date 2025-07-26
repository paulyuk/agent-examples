// TypeScript type definitions for the Azure OpenAI MCP Agent

export interface AzureOpenAIConfig {
  endpoint: string;
  apiKey: string;
  deploymentName: string;
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolResponse {
  content: string;
  error?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  sessionId?: string;
}

export interface AgentResponse {
  message: string;
  toolCalls?: MCPToolCall[];
  error?: string;
  isStreaming?: boolean;
}

export interface ConversationSession {
  id: string;
  sessionId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CosmosConfig {
  endpoint: string;
  key?: string; // Optional - use identity-based auth if not provided
  databaseId: string;
  containerId: string;
  // Optional identity configuration
  useIdentity?: boolean; // Defaults to true if key is not provided
}

export interface AzureFunctionsChatToolParams {
  question: string;
  context?: string;
}

export interface MCPServerConfig {
  port: number;
  name: string;
  version: string;
}


export interface AgentLoopConfig {
  azureOpenAI: AzureOpenAIConfig;
  mcpServer: MCPServerConfig;
  cosmos?: CosmosConfig;
  systemPrompt?: string;
  chainOfThought?: boolean; // Enable chain of thought mode
}
