# Prompt: Build and Run an Azure OpenAI MCP Agent

## Objective

Create a simple agent loop using the Azure OpenAI SDK and the Model Context Protocol (MCP). The project will consist of three main components:
1. **Agent Loop**: Using OpenAI SDK that loads a single MCP tool
2. **MCP Server**: Exposes an `Azure Functions chat` tool powered by Azure OpenAI that provides better context and answers for Azure Functions
3. **Client**: Chats with the agent and prints the responses asynchronously

The entire project should be written in TypeScript.

## Architecture

```
Client ←→ Agent Loop (OpenAI SDK) ←→ MCP Server (Azure Functions Chat Tool)
                                            ↓
                                     Azure OpenAI Service
```

## Technical Requirements

### Agent Loop
- Initialize OpenAI SDK client
- Load and register the MCP tool
- Handle conversation flow with tool calling
- Manage context and conversation history
- Streaming messages and event responses vs waiting for whole completion
- Persist conversation history to Cosmosdb
- Introduce session id's
- Implement async/await patterns

### MCP Server
- Implement MCP protocol server
- Expose `azure-functions-chat` tool
- Tool should accept questions about Azure Functions
- Use Azure OpenAI to generate specialized responses
- Include Azure Functions best practices and context
- Handle tool parameters and validation

### Client Application
- Interactive CLI interface
- Async communication with agent loop
- Real-time response streaming
- Graceful error handling
- Exit commands and session management

## Implementation Details

### Project Structure
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

### Dependencies
- `@azure/openai` - Azure OpenAI SDK
- `@modelcontextprotocol/sdk` - MCP SDK
- `readline` - CLI interaction
- `dotenv` - Environment configuration

### Environment Configuration
```env
AZURE_OPENAI_ENDPOINT=your-endpoint
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_DEPLOYMENT_NAME=your-deployment
```

## Key Features

1. **Tool Integration**: Seamless MCP tool loading and execution
2. **Azure Functions Expertise**: Specialized knowledge and responses
3. **Async Operations**: Non-blocking conversation flow
4. **Error Resilience**: Comprehensive error handling
5. **Type Safety**: Full TypeScript implementation

## Success Criteria

- Agent loop successfully loads MCP tool
- MCP server provides Azure Functions-specific responses
- Client maintains interactive conversation
- Async responses display in real-time
- Code follows professional TypeScript standards
- Clear documentation and setup instructions

## Professional Standards

- Clean, modular architecture
- Comprehensive error handling
- TypeScript strict mode
- ESLint configuration
- Unit test structure
- Professional logging
- Configuration management
