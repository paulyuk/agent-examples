using Azure;
using Azure.AI.OpenAI;
using Azure.Core;
using Azure.Identity;
using AzureOpenAIMcpAgent.Models;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace AzureOpenAIMcpAgent.Services;

/// <summary>
/// MCP Server that simulates Azure Functions chat tool
/// Uses Azure OpenAI SDK with proper authentication and error handling
/// </summary>
public class McpServer
{
    private readonly OpenAIClient _openAIClient;
    private readonly McpServerConfig _config;
    private readonly AzureOpenAIConfig _azureConfig;
    private readonly ILogger<McpServer> _logger;

    public McpServer(
        AzureOpenAIConfig azureConfig, 
        McpServerConfig mcpConfig,
        ILogger<McpServer> logger)
    {
        _azureConfig = azureConfig ?? throw new ArgumentNullException(nameof(azureConfig));
        _config = mcpConfig ?? throw new ArgumentNullException(nameof(mcpConfig));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));

        // Initialize Azure OpenAI client with best practices for authentication
        // Use managed identity in production, API key for development
        _openAIClient = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Production"
            ? new OpenAIClient(new Uri(azureConfig.Endpoint), new DefaultAzureCredential())
            : new OpenAIClient(new Uri(azureConfig.Endpoint), new AzureKeyCredential(azureConfig.ApiKey));
    }

    /// <summary>
    /// Handle Azure Functions chat tool calls with specialized expertise
    /// </summary>
    /// <param name="parameters">Tool parameters containing question and optional context</param>
    /// <returns>Specialized Azure Functions response</returns>
    public async Task<McpToolResponse> HandleAzureFunctionsChatAsync(AzureFunctionsChatToolParams parameters)
    {
        try
        {
            _logger.LogInformation("Processing Azure Functions chat request: {Question}", parameters.Question);

            // System prompt with Azure Functions expertise
            const string systemPrompt = """
                You are an expert Azure Functions developer and consultant. 
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
                Include specific configuration examples and best practices.
                """;

            var userContent = !string.IsNullOrEmpty(parameters.Context)
                ? $"Context: {parameters.Context}\n\nQuestion: {parameters.Question}"
                : parameters.Question;

            var chatCompletionsOptions = new ChatCompletionsOptions
            {
                DeploymentName = _azureConfig.DeploymentName,
                Messages =
                {
                    new ChatRequestSystemMessage(systemPrompt),
                    new ChatRequestUserMessage(userContent)
                },
                MaxTokens = 1500,
                Temperature = 0.3f,
                NucleusSamplingFactor = 0.9f
            };

            var response = await _openAIClient.GetChatCompletionsAsync(chatCompletionsOptions);
            var content = response.Value.Choices[0]?.Message?.Content ?? "No response generated";

            _logger.LogInformation("Successfully processed Azure Functions chat request");

            return new McpToolResponse
            {
                Content = new List<McpContent>
                {
                    new McpContent
                    {
                        Type = "text",
                        Text = content
                    }
                }
            };
        }
        catch (RequestFailedException ex)
        {
            _logger.LogError(ex, "Azure OpenAI request failed: {Message}", ex.Message);
            return new McpToolResponse
            {
                Content = new List<McpContent>
                {
                    new McpContent
                    {
                        Type = "text",
                        Text = $"Error processing Azure Functions question: {ex.Message}"
                    }
                }
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error in Azure Functions chat tool: {Message}", ex.Message);
            return new McpToolResponse
            {
                Content = new List<McpContent>
                {
                    new McpContent
                    {
                        Type = "text",
                        Text = $"Error processing Azure Functions question: {ex.Message}"
                    }
                }
            };
        }
    }

    /// <summary>
    /// Get tool description for the Azure Functions chat tool
    /// </summary>
    /// <returns>Tool description object</returns>
    public object GetToolDescription()
    {
        return new
        {
            name = "azure-functions-chat",
            description = "Chat tool specialized in Azure Functions development, best practices, and troubleshooting",
            parameters = new
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
        };
    }

    /// <summary>
    /// Start the MCP server
    /// </summary>
    public Task StartAsync()
    {
        _logger.LogInformation("🚀 MCP Server ready: {Name} v{Version}", _config.Name, _config.Version);
        _logger.LogInformation("🔧 Available tools: azure-functions-chat");
        return Task.CompletedTask;
    }

    /// <summary>
    /// Stop the MCP server
    /// </summary>
    public Task StopAsync()
    {
        _logger.LogInformation("🛑 MCP Server stopped");
        return Task.CompletedTask;
    }
}
