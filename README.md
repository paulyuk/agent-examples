# Azure OpenAI MCP Agent

A TypeScript implementation of an agent loop using Azure OpenAI SDK and the Model Context Protocol (MCP) to provide specialized Azure Functions development assistance.

## Architecture

The project consists of three main components:

1. **Agent Loop**: Orchestrates conversations using Azure OpenAI with MCP tool integration
2. **MCP Server**: Exposes an Azure Functions chat tool powered by Azure OpenAI
3. **CLI Client**: Interactive command-line interface for chatting with the agent

```
Client ←→ Agent Loop (Azure OpenAI) ←→ MCP Server (Azure Functions Tool)
                                              ↓
                                       Azure OpenAI Service
```

## Features

- 🤖 **Azure OpenAI Integration**: Powered by Azure OpenAI for natural language understanding
- 🔧 **MCP Tool Support**: Model Context Protocol for extensible tool integration
- ⚡ **Azure Functions Expertise**: Specialized knowledge for Azure Functions development
- 🛡️ **Security Best Practices**: Managed Identity support for production environments
- 📝 **Interactive CLI**: User-friendly command-line interface with async responses
- 🔄 **Conversation Management**: Maintains context and conversation history

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
