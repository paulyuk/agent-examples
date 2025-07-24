namespace AzureOpenAIMcpAgent.Models;

/// <summary>
/// Configuration for Azure OpenAI service connection
/// </summary>
public class AzureOpenAIConfig
{
    public required string Endpoint { get; set; }
    public required string ApiKey { get; set; }
    public required string DeploymentName { get; set; }
}

/// <summary>
/// Configuration for MCP server
/// </summary>
public class McpServerConfig
{
    public int Port { get; set; }
    public required string Name { get; set; }
    public required string Version { get; set; }
}

/// <summary>
/// Overall agent configuration
/// </summary>
public class AgentLoopConfig
{
    public required AzureOpenAIConfig AzureOpenAI { get; set; }
    public required McpServerConfig McpServer { get; set; }
    public string? SystemPrompt { get; set; }
}

/// <summary>
/// Represents a chat message with role and content
/// </summary>
public class ChatMessage
{
    public required string Role { get; set; }
    public required string Content { get; set; }
}

/// <summary>
/// Tool call information for MCP integration
/// </summary>
public class McpToolCall
{
    public required string Name { get; set; }
    public required Dictionary<string, object> Arguments { get; set; }
}

/// <summary>
/// Response from the agent containing message and optional tool calls
/// </summary>
public class AgentResponse
{
    public required string Message { get; set; }
    public List<McpToolCall>? ToolCalls { get; set; }
    public string? Error { get; set; }
}

/// <summary>
/// Parameters for Azure Functions chat tool
/// </summary>
public class AzureFunctionsChatToolParams
{
    public required string Question { get; set; }
    public string? Context { get; set; }
}

/// <summary>
/// Response content from MCP tools
/// </summary>
public class McpToolResponse
{
    public required List<McpContent> Content { get; set; }
}

/// <summary>
/// Content item for MCP tool responses
/// </summary>
public class McpContent
{
    public required string Type { get; set; }
    public required string Text { get; set; }
}
