# Azure OpenAI MCP Agent (TypeScript)

A sophisticated TypeScript/Node.js implementation of an Azure OpenAI MCP (Model Context Protocol) Agent that provides intelligent assistance for Azure Functions development using modern TypeScript patterns.

## Features

- 🤖 **Azure OpenAI Integration** - Powered by OpenAI SDK v4.67.3 with Azure support
- 🔧 **MCP Tool Support** - Extensible tool system for specialized Azure Functions capabilities  
- 🛡️ **Enterprise Security** - Azure Identity integration with managed identity support
- 📝 **Interactive CLI** - Rich console interface with command support
- 🏗️ **TypeScript** - Full type safety with strict TypeScript configuration
- 📊 **Modern ESM** - ES modules with async/await patterns
- ⚙️ **Environment Configuration** - Secure credential management with dotenv
- 🔄 **Streaming Support** - Real-time response streaming for better user experience
- 💾 **Conversation Persistence** - Optional Cosmos DB integration for conversation history
- 🆔 **Session Management** - Unique session IDs for conversation tracking

## Architecture

```
azure-openai-mcp-agent/
├── src/
│   ├── index.ts              # Main entry point with configuration
│   ├── agent/
│   │   └── loop.ts           # Core agent orchestration
│   ├── server/
│   │   └── mcp-server.ts     # MCP tool implementations
│   ├── client/
│   │   └── cli.ts            # Interactive CLI interface
│   └── types/
│       └── index.ts          # TypeScript type definitions
├── package.json              # Node.js dependencies and scripts
├── tsconfig.json            # TypeScript configuration
└── .env                     # Environment variables (create from .env.example)
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
   # Copy the example environment file and edit with your credentials
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

4. **Optional Cosmos DB configuration** (for conversation persistence):
   ```env
   COSMOS_ENDPOINT=https://your-cosmos-account.documents.azure.com:443/
   COSMOS_KEY=your-cosmos-key
   COSMOS_DATABASE_ID=agent-conversations
   COSMOS_CONTAINER_ID=sessions
   ```

## Usage

### Development Mode (with hot reload)
```bash
npm run dev
# or for watch mode
npm run dev:watch
```

### Build and Run
```bash
npm run build
npm start
```

### Run Demo
```bash
npm run demo
```

### Interactive Commands

Once the CLI starts, you can use these commands:

- `/help` - Show available commands
- `/clear` - Clear conversation history  
- `/history` - Show conversation history
- `/tools` - Show registered tools
- `/streaming` - Toggle streaming mode on/off
- `/session` - Show session information (ID, message count, etc.)
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
│   └── cli.ts            # Interactive CLI client
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

## Key Features Implemented

### 1. **Streaming Messages and Event Responses**
- Real-time response streaming for better user experience
- Toggle between streaming and non-streaming modes with `/streaming` command
- Simulated word-by-word response delivery

### 2. **Conversation History Persistence to Cosmos DB**
- Optional Azure Cosmos DB integration for conversation storage
- Automatic session management with unique session IDs
- Messages include timestamps and session tracking
- Load previous conversations when restarting with the same session

### 3. **Session ID Management**
- Unique UUID-based session identifiers
- Session information display with `/session` command
- Conversation history tied to specific sessions
- Cross-session conversation persistence

## Security

- **Authentication**: Uses Azure Identity SDK with support for Managed Identity in production, API keys for development
- **Credentials**: Environment-based configuration, never hardcoded values
- **Error Handling**: Comprehensive error handling with detailed logging
- **Type Safety**: Full TypeScript implementation with strict type checking enabled
- **Modern Security**: ES modules with secure coding patterns

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

1. **Authentication Issues**: Ensure your Azure OpenAI credentials are correct in your `.env` file
2. **Connection Problems**: Check your Azure OpenAI endpoint URL and deployment name
3. **Module Errors**: Run `npm install` to ensure all dependencies are installed
4. **TypeScript Errors**: Run `npm run build` to check for compilation issues
5. **Permission Issues**: Ensure your Azure OpenAI resource has the correct permissions configured

## Contributing

1. Follow TypeScript best practices
2. Add comprehensive error handling
3. Include unit tests for new features
4. Update documentation for changes

## License

MIT License - see LICENSE file for details
