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
}

export interface AgentResponse {
  message: string;
  toolCalls?: MCPToolCall[];
  error?: string;
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
  systemPrompt?: string;
}
