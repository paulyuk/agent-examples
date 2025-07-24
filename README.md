# Azure OpenAI MCP Agent (.NET)

A sophisticated C#/.NET implementation of an Azure OpenAI MCP (Model Context Protocol) Agent that provides intelligent assistance for Azure Functions development using enterprise-grade patterns.

## Features

- 🤖 **Azure OpenAI Integration** - Powered by Azure.AI.OpenAI SDK v2.1.0
- 🔧 **MCP Tool Support** - Extensible tool system for specialized capabilities  
- 🛡️ **Enterprise Security** - Managed Identity support for production environments
- 📝 **Interactive CLI** - Rich console interface with command support
- 🏗️ **Dependency Injection** - Modern .NET hosting and DI patterns
- 📊 **Structured Logging** - Comprehensive logging with Microsoft.Extensions.Logging
- ⚙️ **Configuration Management** - Environment-specific settings with validation

## Architecture

```
AzureOpenAIMcpAgent/
├── Models/
│   └── Types.cs              # Data models and configurations
├── Services/
│   ├── AgentLoop.cs          # Core agent orchestration
│   ├── McpServer.cs          # MCP tool implementations
│   └── CliClient.cs          # Interactive CLI interface
├── Program.cs                # Main entry point with DI setup
├── appsettings.json          # Production configuration
├── appsettings.Development.json # Development configuration
└── AzureOpenAIMcpAgent.csproj # Project dependencies
```

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Azure OpenAI service instance
- Azure subscription (for production deployment)

## Setup

1. **Clone and install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your Azure OpenAI credentials
   ```

3. **Required environment variables**:
   ```env
   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
   AZURE_OPENAI_API_KEY=your-api-key
   AZURE_OPENAI_DEPLOYMENT_NAME=your-deployment-name
   MCP_SERVER_PORT=3000
   ```

## Usage

### Development Mode
```bash
npm run dev
```

### Build and Run
```bash
npm run build
npm start
```

### Interactive Commands

Once the CLI starts, you can use these commands:

- `/help` - Show available commands
- `/clear` - Clear conversation history  
- `/history` - Show conversation history
- `/tools` - Show registered tools
- `/exit` - Exit the application

### Example Questions

- "How do I create a timer trigger in Azure Functions?"
- "What are the best practices for Azure Functions performance?"
- "Show me how to implement Durable Functions"
- "How do I use Azure Functions with Cosmos DB?"

## Project Structure

```
src/
├── agent/
│   └── loop.ts           # Main agent loop implementation
├── server/
│   └── mcp-server.ts     # MCP server with Azure Functions tool
├── client/
│   └── cli.ts            # Interactive client
├── types/
│   └── index.ts          # TypeScript type definitions
└── index.ts              # Entry point
```

## Azure Functions Tool

The MCP server exposes an `azure-functions-chat` tool that provides:

- Azure Functions runtime and trigger guidance
- Binding configuration patterns
- Performance optimization recommendations
- Security best practices
- Deployment strategies
- Monitoring and diagnostics advice
- Cost optimization tips
- Integration patterns with other Azure services

## Security

- **Authentication**: Uses Azure Managed Identity in production, API keys for development
- **Credentials**: Never hardcoded, uses Azure Key Vault patterns
- **Error Handling**: Comprehensive error handling and logging
- **Type Safety**: Full TypeScript implementation with strict mode

## Development

### Linting
```bash
npm run lint
```

### Testing
```bash
npm test
```

### TypeScript Compilation
```bash
npm run build
```

## Troubleshooting

1. **Authentication Issues**: Ensure your Azure OpenAI credentials are correct
2. **Connection Problems**: Check your Azure OpenAI endpoint URL
3. **Module Errors**: Run `npm install` to ensure all dependencies are installed
4. **TypeScript Errors**: Run `npm run build` to check for compilation issues

## Contributing

1. Follow TypeScript best practices
2. Add comprehensive error handling
3. Include unit tests for new features
4. Update documentation for changes

## License

MIT License - see LICENSE file for details
