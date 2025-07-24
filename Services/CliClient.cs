using AzureOpenAIMcpAgent.Models;
using AzureOpenAIMcpAgent.Services;
using Microsoft.Extensions.Logging;
using System.Text;

namespace AzureOpenAIMcpAgent.Services;

/// <summary>
/// Command Line Interface for Azure OpenAI MCP Agent
/// Provides interactive console interface for chat sessions
/// </summary>
public class CliClient
{
    private readonly AgentLoop _agentLoop;
    private readonly McpServer _mcpServer;
    private readonly ILogger<CliClient> _logger;
    private readonly Dictionary<string, Func<string, Task>> _commands = new();
    private bool _isRunning = false;

    public CliClient(AgentLoop agentLoop, McpServer mcpServer, ILogger<CliClient> logger)
    {
        _agentLoop = agentLoop ?? throw new ArgumentNullException(nameof(agentLoop));
        _mcpServer = mcpServer ?? throw new ArgumentNullException(nameof(mcpServer));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));

        RegisterCommands();
        SetupAgentWithMcpTools();
    }

    /// <summary>
    /// Start the interactive CLI session
    /// </summary>
    public async Task StartAsync()
    {
        _logger.LogInformation("Starting Azure OpenAI MCP Agent CLI");

        // Display welcome message
        DisplayWelcomeMessage();

        _isRunning = true;

        while (_isRunning)
        {
            try
            {
                await ProcessUserInputAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in CLI loop: {Message}", ex.Message);
                Console.WriteLine($"❌ Error: {ex.Message}");
            }
        }

        Console.WriteLine("👋 Goodbye!");
    }

    /// <summary>
    /// Process user input and execute commands or chat
    /// </summary>
    private async Task ProcessUserInputAsync()
    {
        Console.Write("\n🤖 You: ");
        var input = await ReadLineAsync();

        if (string.IsNullOrWhiteSpace(input))
        {
            return;
        }

        // Check for commands
        if (input.StartsWith('/'))
        {
            await ProcessCommandAsync(input);
            return;
        }

        // Regular chat message
        await ProcessChatMessageAsync(input);
    }

    /// <summary>
    /// Process chat message through the agent
    /// </summary>
    /// <param name="message">User message</param>
    private async Task ProcessChatMessageAsync(string message)
    {
        try
        {
            // Show thinking indicator
            var thinkingTask = ShowThinkingIndicatorAsync();

            // Process message through agent
            var response = await _agentLoop.ProcessMessageAsync(message);

            // Stop thinking indicator
            await StopThinkingIndicatorAsync();

            // Display response
            Console.WriteLine($"\n🤖 Assistant: {response.Message}");

            // Display tool calls if any
            if (response.ToolCalls?.Count > 0)
            {
                Console.WriteLine("\n🔧 Tools used:");
                foreach (var toolCall in response.ToolCalls)
                {
                    Console.WriteLine($"   • {toolCall.Name}");
                }
            }

            // Display error if any
            if (!string.IsNullOrEmpty(response.Error))
            {
                Console.WriteLine($"\n⚠️  Error: {response.Error}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing chat message: {Message}", ex.Message);
            Console.WriteLine($"\n❌ Error processing your message: {ex.Message}");
        }
    }

    /// <summary>
    /// Process CLI commands
    /// </summary>
    /// <param name="input">Command input</param>
    private async Task ProcessCommandAsync(string input)
    {
        var parts = input.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        var command = parts[0].ToLowerInvariant();
        var args = parts.Length > 1 ? parts[1] : string.Empty;

        if (_commands.TryGetValue(command, out var commandHandler))
        {
            await commandHandler(args);
        }
        else
        {
            Console.WriteLine($"❌ Unknown command: {command}");
            Console.WriteLine("Type /help for available commands");
        }
    }

    /// <summary>
    /// Register CLI commands
    /// </summary>
    private void RegisterCommands()
    {
        _commands["/help"] = async (args) => await ShowHelpAsync();
        _commands["/clear"] = async (args) => await ClearHistoryAsync();
        _commands["/history"] = async (args) => await ShowHistoryAsync();
        _commands["/tools"] = async (args) => await ShowToolsAsync();
        _commands["/exit"] = async (args) => await ExitAsync();
        _commands["/quit"] = async (args) => await ExitAsync();
    }

    /// <summary>
    /// Setup agent with MCP tools
    /// </summary>
    private void SetupAgentWithMcpTools()
    {
        // Register Azure Functions chat tool
        _agentLoop.RegisterMcpTool("azure-functions-chat", async (args) =>
        {
            var argsDict = args as Dictionary<string, object> ?? new Dictionary<string, object>();
            var question = argsDict.TryGetValue("question", out var q) ? q?.ToString() : "General Azure Functions question";
            var context = argsDict.TryGetValue("context", out var c) ? c?.ToString() : "";

            return await _mcpServer.HandleAzureFunctionsChatAsync(question, context);
        });

        _logger.LogInformation("🔧 MCP tools registered with agent");
    }

    /// <summary>
    /// Display welcome message
    /// </summary>
    private void DisplayWelcomeMessage()
    {
        var welcomeMessage = """
        ╔══════════════════════════════════════════════════════════════╗
        ║                🤖 Azure OpenAI MCP Agent                     ║
        ║                                                              ║
        ║  Welcome to your AI assistant powered by Azure OpenAI!      ║
        ║  I can help you with Azure Functions development and more.   ║
        ║                                                              ║
        ║  Available commands:                                         ║
        ║    /help     - Show this help message                       ║
        ║    /clear    - Clear conversation history                   ║
        ║    /history  - Show conversation history                    ║
        ║    /tools    - Show available tools                         ║
        ║    /exit     - Exit the application                         ║
        ║                                                              ║
        ║  Just type your message to start chatting!                  ║
        ╚══════════════════════════════════════════════════════════════╝
        """;

        Console.WriteLine(welcomeMessage);
    }

    /// <summary>
    /// Show help message
    /// </summary>
    private async Task ShowHelpAsync()
    {
        var helpMessage = """
        
        📖 Available Commands:
        
        /help     - Show this help message
        /clear    - Clear conversation history
        /history  - Show conversation history
        /tools    - Show available MCP tools
        /exit     - Exit the application
        /quit     - Exit the application
        
        💡 Tips:
        • Ask me anything about Azure Functions development
        • I can help with best practices, troubleshooting, and code examples
        • Use specific questions for better responses
        • Include code snippets in your questions for context
        """;

        Console.WriteLine(helpMessage);
        await Task.CompletedTask;
    }

    /// <summary>
    /// Clear conversation history
    /// </summary>
    private async Task ClearHistoryAsync()
    {
        _agentLoop.ClearHistory();
        Console.WriteLine("🧹 Conversation history cleared!");
        await Task.CompletedTask;
    }

    /// <summary>
    /// Show conversation history
    /// </summary>
    private async Task ShowHistoryAsync()
    {
        var history = _agentLoop.GetConversationHistory();
        
        if (history.Count == 0)
        {
            Console.WriteLine("📝 No conversation history yet");
            return;
        }

        Console.WriteLine("\n📝 Conversation History:");
        Console.WriteLine("═══════════════════════");

        foreach (var message in history)
        {
            var roleIcon = message.Role switch
            {
                "system" => "🔧",
                "user" => "👤",
                "assistant" => "🤖",
                _ => "❓"
            };

            var truncatedContent = message.Content.Length > 100 
                ? message.Content[..100] + "..." 
                : message.Content;

            Console.WriteLine($"{roleIcon} {message.Role}: {truncatedContent}");
        }

        await Task.CompletedTask;
    }

    /// <summary>
    /// Show available tools
    /// </summary>
    private async Task ShowToolsAsync()
    {
        var tools = _agentLoop.GetRegisteredTools();

        Console.WriteLine("\n🔧 Available MCP Tools:");
        Console.WriteLine("═══════════════════════");

        if (tools.Count == 0)
        {
            Console.WriteLine("No tools registered");
            return;
        }

        foreach (var tool in tools)
        {
            var description = tool switch
            {
                "azure-functions-chat" => "Chat assistant for Azure Functions development",
                _ => "Tool description not available"
            };

            Console.WriteLine($"• {tool}: {description}");
        }

        await Task.CompletedTask;
    }

    /// <summary>
    /// Exit the application
    /// </summary>
    private async Task ExitAsync()
    {
        _isRunning = false;
        Console.WriteLine("\n👋 Exiting Azure OpenAI MCP Agent...");
        await Task.CompletedTask;
    }

    /// <summary>
    /// Read line asynchronously
    /// </summary>
    /// <returns>User input</returns>
    private async Task<string?> ReadLineAsync()
    {
        return await Task.Run(() => Console.ReadLine());
    }

    /// <summary>
    /// Show thinking indicator
    /// </summary>
    private async Task ShowThinkingIndicatorAsync()
    {
        await Task.Run(() =>
        {
            Console.Write("\n🤔 Thinking");
        });
    }

    /// <summary>
    /// Stop thinking indicator
    /// </summary>
    private async Task StopThinkingIndicatorAsync()
    {
        await Task.CompletedTask;
        // Clear the thinking line
        Console.Write("\r" + new string(' ', 20) + "\r");
    }

    /// <summary>
    /// Handle console cancel key press
    /// </summary>
    public void HandleCancelKeyPress()
    {
        _isRunning = false;
        Console.WriteLine("\n\n👋 Received exit signal. Goodbye!");
    }
}
