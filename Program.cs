using Azure.AI.OpenAI;
using Azure.Identity;
using AzureOpenAIMcpAgent.Models;
using AzureOpenAIMcpAgent.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AzureOpenAIMcpAgent;

/// <summary>
/// Main program entry point for Azure OpenAI MCP Agent
/// Sets up dependency injection, configuration, and starts the CLI
/// </summary>
class Program
{
    private static CliClient? _cliClient;

    static async Task Main(string[] args)
    {
        try
        {
            // Set up configuration
            var configuration = new ConfigurationBuilder()
                .SetBasePath(Directory.GetCurrentDirectory())
                .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
                .AddJsonFile($"appsettings.{Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production"}.json", optional: true)
                .AddEnvironmentVariables()
                .AddCommandLine(args)
                .Build();

            // Set up dependency injection
            var host = CreateHostBuilder(configuration).Build();

            // Handle Ctrl+C gracefully
            Console.CancelKeyPress += (sender, e) =>
            {
                e.Cancel = true;
                _cliClient?.HandleCancelKeyPress();
            };

            // Get CLI client and start
            _cliClient = host.Services.GetRequiredService<CliClient>();
            await _cliClient.StartAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Fatal error: {ex.Message}");
            Console.WriteLine($"💡 Please check your configuration and try again.");
            
            if (ex.InnerException != null)
            {
                Console.WriteLine($"🔍 Inner exception: {ex.InnerException.Message}");
            }

            Environment.Exit(1);
        }
    }

    /// <summary>
    /// Create and configure the host builder
    /// </summary>
    /// <param name="configuration">Application configuration</param>
    /// <returns>Configured host builder</returns>
    private static IHostBuilder CreateHostBuilder(IConfiguration configuration)
    {
        return Host.CreateDefaultBuilder()
            .ConfigureServices((context, services) =>
            {
                // Configuration
                services.AddSingleton(configuration);

                // Logging
                services.AddLogging(builder =>
                {
                    builder.ClearProviders();
                    builder.AddConsole();
                    builder.AddDebug();
                    builder.SetMinimumLevel(LogLevel.Information);

                    // In development, show more detailed logs
                    if (Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Development")
                    {
                        builder.SetMinimumLevel(LogLevel.Debug);
                    }
                });

                // Configuration models
                var agentConfig = new AgentLoopConfig();
                configuration.GetSection("AgentLoop").Bind(agentConfig);
                services.AddSingleton(agentConfig);

                var mcpConfig = new McpServerConfig();
                configuration.GetSection("McpServer").Bind(mcpConfig);
                services.AddSingleton(mcpConfig);

                // Validate configuration
                ValidateConfiguration(agentConfig, mcpConfig);

                // Azure OpenAI Client
                services.AddSingleton<OpenAIClient>(serviceProvider =>
                {
                    var logger = serviceProvider.GetRequiredService<ILogger<Program>>();
                    
                    try
                    {
                        // Use managed identity in production for enhanced security
                        var credential = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Production"
                            ? new DefaultAzureCredential()
                            : new AzureKeyCredential(agentConfig.AzureOpenAI.ApiKey);

                        var client = new OpenAIClient(new Uri(agentConfig.AzureOpenAI.Endpoint), credential);
                        
                        logger.LogInformation("✅ Azure OpenAI client initialized successfully");
                        return client;
                    }
                    catch (Exception ex)
                    {
                        logger.LogError(ex, "❌ Failed to initialize Azure OpenAI client: {Message}", ex.Message);
                        throw;
                    }
                });

                // Services
                services.AddSingleton<McpServer>();
                services.AddSingleton<AgentLoop>();
                services.AddSingleton<CliClient>();

                // Health checks (optional for monitoring)
                services.AddHealthChecks();
            })
            .UseConsoleLifetime(); // Ensures proper shutdown handling
    }

    /// <summary>
    /// Validate application configuration
    /// </summary>
    /// <param name="agentConfig">Agent configuration</param>
    /// <param name="mcpConfig">MCP server configuration</param>
    private static void ValidateConfiguration(AgentLoopConfig agentConfig, McpServerConfig mcpConfig)
    {
        var errors = new List<string>();

        // Validate Azure OpenAI configuration
        if (agentConfig.AzureOpenAI == null)
        {
            errors.Add("AzureOpenAI configuration is missing");
        }
        else
        {
            if (string.IsNullOrEmpty(agentConfig.AzureOpenAI.Endpoint))
            {
                errors.Add("AzureOpenAI:Endpoint is required");
            }
            else if (!Uri.TryCreate(agentConfig.AzureOpenAI.Endpoint, UriKind.Absolute, out _))
            {
                errors.Add("AzureOpenAI:Endpoint must be a valid URL");
            }

            if (string.IsNullOrEmpty(agentConfig.AzureOpenAI.DeploymentName))
            {
                errors.Add("AzureOpenAI:DeploymentName is required");
            }

            // API key is only required in non-production environments
            if (Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") != "Production" && 
                string.IsNullOrEmpty(agentConfig.AzureOpenAI.ApiKey))
            {
                errors.Add("AzureOpenAI:ApiKey is required for non-production environments");
            }
        }

        // Validate MCP Server configuration
        if (mcpConfig == null)
        {
            errors.Add("McpServer configuration is missing");
        }
        else
        {
            if (string.IsNullOrEmpty(mcpConfig.Name))
            {
                errors.Add("McpServer:Name is required");
            }

            if (string.IsNullOrEmpty(mcpConfig.Version))
            {
                errors.Add("McpServer:Version is required");
            }
        }

        if (errors.Count > 0)
        {
            Console.WriteLine("❌ Configuration validation failed:");
            foreach (var error in errors)
            {
                Console.WriteLine($"   • {error}");
            }
            Console.WriteLine("\n💡 Please check your appsettings.json file and environment variables.");
            Environment.Exit(1);
        }

        Console.WriteLine("✅ Configuration validation passed");
    }
}
