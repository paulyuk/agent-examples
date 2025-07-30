# 🤖 GitHub Copilot Workflow Instructions

## ⚠️ CRITICAL: Never Forget These Commands

### MCP Server Management
- **ONLY THE HUMAN** can start/stop the MCP server
- **Command**: `npm run mcp-server`
- **Architecture**: **MUST USE OFFICIAL MCP SDK ONLY** - StreamableHTTPServerTransport for HTTP servers, never custom HTTP servers
- **Official SDK Sample**: Use the official MCP SDK patterns for StreamableHTTPServerTransport

### CLI Client Management  
- **Copilot should use**: `npm run dev` to start the CLI client
- **Never use**: `node dist/src/client/cli.js` directly
- **The CLI connects to the MCP server** via stdio transport

## 🎯 DYNAMIC TOOL DISCOVERY - NEVER HARDCODE TOOLS

### Core Principle: NO HARDCODED TOOL DESCRIPTIONS
- ✅ **ALWAYS** use `tools/list` MCP endpoint to discover tools dynamically
- ❌ **NEVER** hardcode tool names, descriptions, or schemas in code
- ✅ Tools are registered dynamically via `registerDiscoveredMCPTools()`
- ❌ **NEVER** use switch statements or hardcoded tool handlers

### Dynamic Tool Flow (REQUIRED)
1. **MCP Session Init**: CLI calls `initialize` to get session ID
2. **Tool Discovery**: `getToolDescriptionsFromMCP()` calls `tools/list` endpoint  
3. **Dynamic Registration**: `registerDiscoveredMCPTools()` creates generic handlers
4. **Runtime Calls**: Generic handlers call `tools/call` with tool name and args

## 🚨 MANDATORY: ALWAYS USE OFFICIAL MCP SDK

### 🔥 NEW LESSON LEARNED: Client-Side Rules
- ✅ **ALWAYS use official MCP Client SDK** - `StreamableHTTPClientTransport` and `Client`
- ❌ **NEVER use raw HTTP fetch calls** for MCP communication
- ✅ **Reference**: See [`src/agent/loop.ts`](src/agent/loop.ts) for correct client implementation
- ✅ **Use SDK convenience methods**: `client.listTools()` and `client.callTool()`

```typescript
// ✅ CORRECT CLIENT PATTERN - Use this in loop.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// Create client
this.mcpClient = new Client({
  name: 'azure-functions-cli',
  version: '1.0.0'
});

// Create transport
const mcpUrl = new URL('http://localhost:3000/mcp');
this.mcpTransport = new StreamableHTTPClientTransport(mcpUrl);

// Connect
await this.mcpClient.connect(this.mcpTransport);

// Use convenience methods
const tools = await this.mcpClient.listTools();
const result = await this.mcpClient.callTool({ name: toolName, arguments: args });
```

### 🔥 NEW LESSON LEARNED: Server-Side Rules
- ✅ **ALWAYS use Express with StreamableHTTPServerTransport** - NOT raw Node.js HTTP server
- ✅ **Reference**: See [`src/tools/mcp-server.ts`](src/tools/mcp-server.ts) for correct server implementation
- ❌ **NEVER use raw `http.createServer()`** - causes session management issues

```typescript
// ✅ CORRECT SERVER PATTERN - Use this in mcp-server.ts
import express from 'express';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const server = new McpServer({ name: "...", version: "..." });
const app = express();

// Register tools with Zod schemas
server.tool("tool-name", "description", TOOL_SCHEMA, async (params) => {
  // implementation
});

// Create transport
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
  enableDnsRebindingProtection: true,
  allowedHosts: ['127.0.0.1', 'localhost'],
});

// Connect server to transport
await server.connect(transport);

// Use Express to handle HTTP
app.use('/mcp', async (req, res) => {
  await transport.handleRequest(req, res);
});

app.listen(PORT, () => {
  console.log(`MCP Server running on http://localhost:${PORT}/mcp`);
});
```

### 🔑 CRITICAL Tool Schema Rules (LESSON LEARNED)
- ✅ **MUST use Zod schemas** - `z.string().describe("...")` 
- ❌ **NEVER use JSON Schema objects** - `{ type: "string", description: "..." }`
- ✅ **Pass Zod schema directly** as 3rd parameter to `server.tool()`
- ❌ **NEVER wrap in `{ inputSchema: ... }`** - this prevents MCP Inspector from showing input fields
- ✅ **Use `.optional()`** for optional parameters
- ✅ **Use `.default(value)`** for parameters with defaults
- ✅ **Use `.describe("text")`** for parameter descriptions
- ⚠️ **AVOID confusing optional parameters** - AI models get confused and try to set them unnecessarily

### 🎯 Parameter Design Best Practices (NEW)
- ✅ **Keep tool parameters simple** - fewer parameters = better AI behavior
- ✅ **Make query-based tools** - let AI choose natural search terms
- ❌ **Avoid category/type parameters** - AI models obsess over setting these incorrectly
- ✅ **Use descriptive parameter names** - `query` instead of `searchTerm`

### Why This Works
- Official MCP SDK transport (StreamableHTTPServerTransport)
- Proper server.tool() registration method
- **Zod schemas enable MCP Inspector parameter input fields**
- Standard HTTP communication protocol
- No custom HTTP servers or middleware outside the pattern

## 🔄 Standard Workflow

1. **Human starts MCP server**: `npm run mcp-server`
2. **Copilot tests CLI**: `npm run dev` 
3. **MCP Inspector can connect**: Via HTTP transport at localhost:3000/mcp
4. **Run tests after major changes**: `npm test` to prevent regressions

### ⚠️ Session Management Rules
- **Official SDK handles all session management automatically**
- **StreamableHTTPServerTransport manages sessions internally**
- **Reconnections work automatically with proper transport usage**

### 🧪 Testing Requirements (MANDATORY)
- ✅ **ALWAYS run `npm test` after major changes**
- ✅ **Test validates MCP integration end-to-end**
- ✅ **Prevents regressions in tool calling and AI behavior**
- ✅ **Verifies SQL trigger sample is returned correctly**

## 🔧 Critical Implementation Patterns

### Dynamic Tool Registration (DEPRECATED - USE SDK)
```typescript
// ❌ OLD PATTERN - Don't use raw fetch anymore
const toolHandler = async (args: any) => {
  const response = await fetch('http://localhost:3000/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'mcp-session-id': mcpSessionId
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Math.random().toString(36),
      method: 'tools/call',
      params: { name: toolName, arguments: args }
    })
  });
  // ... SSE parsing logic
};

// ✅ NEW PATTERN - Use SDK client instead
const toolHandler = async (args: any) => {
  const result = await this.mcpClient.callTool({
    name: toolName,
    arguments: args
  });
  return result;
};
```

## 🚫 What NOT to Do

- ❌ Don't start MCP server from Copilot
- ❌ **NEVER** create custom HTTP servers for MCP outside the SDK pattern
- ❌ **NEVER** use raw Node.js `http.createServer()` for MCP - use Express + StreamableHTTPServerTransport
- ❌ **NEVER** use raw HTTP fetch calls for MCP communication - use official MCP Client SDK
- ❌ Don't use `node dist/src/client/cli.js` directly
- ❌ Don't try to run CLI in background with `isBackground: true`
- ❌ **NEVER hardcode tool names, descriptions, or schemas anywhere**
- ❌ **NEVER use switch statements for tool handling**
- ❌ **NEVER skip the tools/list discovery step**
- ❌ **NEVER use JSON Schema objects for tool parameters** - use Zod schemas only
- ❌ **NEVER wrap schemas in `{ inputSchema: ... }`** - pass Zod schema directly
- ❌ **NEVER add confusing optional parameters** - AI models obsess over category/type parameters

## ✅ What TO Do

- ✅ Use `npm run dev` for CLI testing
- ✅ Let human manage MCP server lifecycle
- ✅ **ALWAYS** use official MCP Client SDK (`StreamableHTTPClientTransport` + `Client`)
- ✅ **ALWAYS** use Express + StreamableHTTPServerTransport for MCP servers
- ✅ **ALWAYS** use `client.listTools()` and `client.callTool()` convenience methods
- ✅ **ALWAYS** use server.tool() method for registering tools
- ✅ **ALWAYS** use Zod schemas for tool parameters - enables MCP Inspector input fields
- ✅ **ALWAYS** pass Zod schema directly as 3rd parameter to server.tool()
- ✅ **ALWAYS** keep tool parameters simple and query-based
- ✅ Test with MCP Inspector when needed
- ✅ **ALWAYS call tools/list to discover available tools dynamically**
- ✅ **ALWAYS use generic tool handlers that call SDK methods**
- ✅ **ALWAYS parse tool descriptions from MCP server response**
