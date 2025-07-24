using Azure;
using Azure.AI.OpenAI;
using Azure.Identity;
using AzureOpenAIMcpAgent.Models;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace AzureOpenAIMcpAgent.Services;

/// <summary>
/// Agent Loop that orchestrates conversations using Azure OpenAI with MCP tools
/// Handles tool calling, conversation history, and response generation
/// </summary>
public class AgentLoop
{
    private readonly OpenAIClient _openAIClient;
    private readonly AgentLoopConfig _config;
    private readonly ILogger<AgentLoop> _logger;
    private readonly List<ChatMessage> _conversationHistory = new();
    private readonly Dictionary<string, Func<object, Task<McpToolResponse>>> _mcpTools = new();

    public AgentLoop(AgentLoopConfig config, ILogger<AgentLoop> logger)
    {
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));

        // Initialize Azure OpenAI client with best practices for authentication
        // Use managed identity in production environments for enhanced security
        var credential = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Production"
            ? new DefaultAzureCredential()
            : new AzureKeyCredential(config.AzureOpenAI.ApiKey);

        _openAIClient = new OpenAIClient(new Uri(config.AzureOpenAI.Endpoint), credential);

        // Set up system prompt if provided
        if (!string.IsNullOrEmpty(config.SystemPrompt))
        {
            _conversationHistory.Add(new ChatMessage
            {
                Role = "system",
                Content = config.SystemPrompt
            });
        }
    }

    /// <summary>
    /// Register an MCP tool for use in conversations
    /// </summary>
    /// <param name="name">Tool name</param>
    /// <param name="toolHandler">Tool handler function</param>
    public void RegisterMcpTool(string name, Func<object, Task<McpToolResponse>> toolHandler)
    {
        ArgumentException.ThrowIfNullOrEmpty(name);
        ArgumentNullException.ThrowIfNull(toolHandler);

        _mcpTools[name] = toolHandler;
        _logger.LogInformation("🔧 Registered MCP tool: {ToolName}", name);
    }

    /// <summary>
    /// Process a user message and generate a response using Azure OpenAI
    /// Handles tool calling and maintains conversation context
    /// </summary>
    /// <param name="userMessage">User's message</param>
    /// <returns>Agent response with message and optional tool calls</returns>
    public async Task<AgentResponse> ProcessMessageAsync(string userMessage)
    {
        try
        {
            ArgumentException.ThrowIfNullOrEmpty(userMessage);

            _logger.LogInformation("Processing user message: {Message}", userMessage);

            // Add user message to conversation history
            _conversationHistory.Add(new ChatMessage
            {
                Role = "user",
                Content = userMessage
            });

            // Prepare tools for OpenAI function calling
            var tools = new List<ChatCompletionsFunctionToolDefinition>();
            foreach (var toolName in _mcpTools.Keys)
            {
                var toolDescription = GetToolDescription(toolName);
                tools.Add(new ChatCompletionsFunctionToolDefinition
                {
                    Name = toolName,
                    Description = toolDescription.Description,
                    Parameters = BinaryData.FromObjectAsJson(toolDescription.Parameters)
                });
            }

            var chatCompletionsOptions = new ChatCompletionsOptions
            {
                DeploymentName = _config.AzureOpenAI.DeploymentName,
                MaxTokens = 2000,
                Temperature = 0.3f,
                NucleusSamplingFactor = 0.9f
            };

            // Add conversation history
            foreach (var message in _conversationHistory)
            {
                if (message.Role == "system")
                    chatCompletionsOptions.Messages.Add(new ChatRequestSystemMessage(message.Content));
                else if (message.Role == "user")
                    chatCompletionsOptions.Messages.Add(new ChatRequestUserMessage(message.Content));
                else if (message.Role == "assistant")
                    chatCompletionsOptions.Messages.Add(new ChatRequestAssistantMessage(message.Content));
            }

            // Add tools if available
            if (tools.Count > 0)
            {
                foreach (var tool in tools)
                {
                    chatCompletionsOptions.Tools.Add(tool);
                }
                chatCompletionsOptions.ToolChoice = ChatCompletionsToolChoice.Auto;
            }

            var response = await _openAIClient.GetChatCompletionsAsync(chatCompletionsOptions);
            var choice = response.Value.Choices[0];

            if (choice?.Message == null)
            {
                throw new InvalidOperationException("No response from Azure OpenAI");
            }

            // Handle tool calls if present
            if (choice.Message.ToolCalls?.Count > 0)
            {
                return await HandleToolCallsAsync(choice.Message.ToolCalls);
            }

            // Regular response without tool calls
            var assistantMessage = choice.Message.Content ?? "No response generated";

            // Add assistant response to conversation history
            _conversationHistory.Add(new ChatMessage
            {
                Role = "assistant",
                Content = assistantMessage
            });

            _logger.LogInformation("Successfully processed user message");

            return new AgentResponse
            {
                Message = assistantMessage
            };
        }
        catch (RequestFailedException ex)
        {
            _logger.LogError(ex, "Azure OpenAI request failed: {Message}", ex.Message);
            return new AgentResponse
            {
                Message = "Sorry, I encountered an error processing your request.",
                Error = ex.Message
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing message: {Message}", ex.Message);
            return new AgentResponse
            {
                Message = "Sorry, I encountered an error processing your request.",
                Error = ex.Message
            };
        }
    }

    /// <summary>
    /// Handle tool calls from Azure OpenAI
    /// </summary>
    /// <param name="toolCalls">Tool calls to execute</param>
    /// <returns>Agent response with tool call results</returns>
    private async Task<AgentResponse> HandleToolCallsAsync(IReadOnlyList<ChatCompletionsToolCall> toolCalls)
    {
        var mcpToolCalls = new List<McpToolCall>();
        var toolResults = new List<string>();

        foreach (var toolCall in toolCalls)
        {
            if (toolCall is ChatCompletionsFunctionToolCall functionCall)
            {
                var toolName = functionCall.Name;
                var toolArgs = JsonSerializer.Deserialize<Dictionary<string, object>>(functionCall.Arguments) 
                    ?? new Dictionary<string, object>();

                mcpToolCalls.Add(new McpToolCall
                {
                    Name = toolName,
                    Arguments = toolArgs
                });

                // Execute the MCP tool
                if (_mcpTools.TryGetValue(toolName, out var toolHandler))
                {
                    try
                    {
                        var result = await toolHandler(toolArgs);
                        var resultText = result.Content.FirstOrDefault()?.Text ?? JsonSerializer.Serialize(result);
                        toolResults.Add($"Tool {toolName} result: {resultText}");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error executing tool {ToolName}: {Message}", toolName, ex.Message);
                        toolResults.Add($"Tool {toolName} error: {ex.Message}");
                    }
                }
                else
                {
                    toolResults.Add($"Tool {toolName} not found");
                }
            }
        }

        // Add tool results to conversation and get final response
        _conversationHistory.Add(new ChatMessage
        {
            Role = "assistant",
            Content = $"I'll use the {string.Join(", ", mcpToolCalls.Select(tc => tc.Name))} tool(s) to help you."
        });

        // Get final response from Azure OpenAI with tool results
        var chatCompletionsOptions = new ChatCompletionsOptions
        {
            DeploymentName = _config.AzureOpenAI.DeploymentName,
            MaxTokens = 2000,
            Temperature = 0.3f
        };

        // Add conversation history
        foreach (var message in _conversationHistory)
        {
            if (message.Role == "system")
                chatCompletionsOptions.Messages.Add(new ChatRequestSystemMessage(message.Content));
            else if (message.Role == "user")
                chatCompletionsOptions.Messages.Add(new ChatRequestUserMessage(message.Content));
            else if (message.Role == "assistant")
                chatCompletionsOptions.Messages.Add(new ChatRequestAssistantMessage(message.Content));
        }

        // Add tool results
        chatCompletionsOptions.Messages.Add(new ChatRequestUserMessage(
            $"Based on these tool results, please provide a helpful response:\n{string.Join("\n", toolResults)}"));

        var finalResponse = await _openAIClient.GetChatCompletionsAsync(chatCompletionsOptions);
        var finalMessage = finalResponse.Value.Choices[0]?.Message?.Content ?? "No final response generated";

        // Add final response to conversation history
        _conversationHistory.Add(new ChatMessage
        {
            Role = "assistant",
            Content = finalMessage
        });

        return new AgentResponse
        {
            Message = finalMessage,
            ToolCalls = mcpToolCalls
        };
    }

    /// <summary>
    /// Get tool description for OpenAI function calling
    /// </summary>
    /// <param name="toolName">Name of the tool</param>
    /// <returns>Tool description</returns>
    private (string Description, object Parameters) GetToolDescription(string toolName)
    {
        return toolName switch
        {
            "azure-functions-chat" => (
                "Chat tool specialized in Azure Functions development, best practices, and troubleshooting",
                new
                {
                    type = "object",
                    properties = new
                    {
                        question = new
                        {
                            type = "string",
                            description = "Question about Azure Functions development"
                        },
                        context = new
                        {
                            type = "string",
                            description = "Optional context or code snippet for more specific help"
                        }
                    },
                    required = new[] { "question" }
                }
            ),
            _ => ($"Tool: {toolName}", new { type = "object", properties = new { } })
        };
    }

    /// <summary>
    /// Get conversation history
    /// </summary>
    /// <returns>Copy of conversation history</returns>
    public IReadOnlyList<ChatMessage> GetConversationHistory()
    {
        return _conversationHistory.AsReadOnly();
    }

    /// <summary>
    /// Clear conversation history but keep system prompt
    /// </summary>
    public void ClearHistory()
    {
        var systemMessages = _conversationHistory.Where(msg => msg.Role == "system").ToList();
        _conversationHistory.Clear();
        _conversationHistory.AddRange(systemMessages);
        _logger.LogInformation("🧹 Conversation history cleared");
    }

    /// <summary>
    /// Get registered tools
    /// </summary>
    /// <returns>List of registered tool names</returns>
    public IReadOnlyList<string> GetRegisteredTools()
    {
        return _mcpTools.Keys.ToList().AsReadOnly();
    }
}
