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

The MCP server MUST use the official MCP SDK patterns only:

```typescript
// ✅ REQUIRED PATTERN - NEVER DEVIATE FROM THIS
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const server = new McpServer({ name: "...", version: "..." });

// ✅ CRITICAL: Tool schemas MUST use Zod, NOT JSON Schema
const TOOL_SCHEMA = {
  param1: z.string().describe("Description").optional(),
  param2: z.number().describe("Description").default(100),
  param3: z.boolean().describe("Description")
};

// ✅ Register tools using server.tool() with Zod schema as 3rd parameter
server.tool("tool-name", "description", TOOL_SCHEMA, async (params) => {
  // implementation
});

// Start server using StreamableHTTPServerTransport
async function main() {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    enableDnsRebindingProtection: true,
    allowedHosts: ['127.0.0.1', 'localhost', 'localhost:8080', '127.0.0.1:8080'],
  });
  
  await server.connect(transport);
  
  // Create HTTP server that delegates to the transport
  const httpServer = require('http').createServer(async (req, res) => {
    if (req.url !== '/mcp') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found. Use /mcp endpoint.' }));
      return;
    }
    await transport.handleRequest(req, res);
  });
  
  httpServer.listen(8080, () => {
    console.log(`MCP Server running on http://localhost:8080/mcp`);
  });
}
```

### 🔑 CRITICAL Tool Schema Rules (LESSON LEARNED)
- ✅ **MUST use Zod schemas** - `z.string().describe("...")` 
- ❌ **NEVER use JSON Schema objects** - `{ type: "string", description: "..." }`
- ✅ **Pass Zod schema directly** as 3rd parameter to `server.tool()`
- ❌ **NEVER wrap in `{ inputSchema: ... }`** - this prevents MCP Inspector from showing input fields
- ✅ **Use `.optional()`** for optional parameters
- ✅ **Use `.default(value)`** for parameters with defaults
- ✅ **Use `.describe("text")`** for parameter descriptions

### Why This Works
- Official MCP SDK transport (StreamableHTTPServerTransport)
- Proper server.tool() registration method
- **Zod schemas enable MCP Inspector parameter input fields**
- Standard HTTP communication protocol
- No custom HTTP servers or middleware outside the pattern

## 🔄 Standard Workflow

1. **Human starts MCP server**: `npm run mcp-server`
2. **Copilot tests CLI**: `npm run dev` 
3. **MCP Inspector can connect**: Via HTTP transport at localhost:8080/mcp

### ⚠️ Session Management Rules
- **Official SDK handles all session management automatically**
- **StreamableHTTPServerTransport manages sessions internally**
- **Reconnections work automatically with proper transport usage**

## 🔧 Critical Implementation Patterns

### SSE Response Parsing (REQUIRED)
```typescript
// ✅ CORRECT SSE parsing pattern
const text = await response.text();
const lines = text.split('\n');
let jsonData = null;

for (const line of lines) {
  if (line.startsWith('data: ')) {
    try {
      jsonData = JSON.parse(line.slice(6));
      break;
    } catch (e) {
      // Continue looking for valid JSON
    }
  }
}
```

### Dynamic Tool Registration (REQUIRED)
```typescript
// ✅ CORRECT generic tool handler pattern
const toolHandler = async (args: any) => {
  const response = await fetch('http://localhost:8080/mcp', {
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
```

## 🚫 What NOT to Do

- ❌ Don't start MCP server from Copilot
- ❌ **NEVER** create custom HTTP servers for MCP outside the SDK pattern
- ❌ **NEVER** use Express middleware with MCP
- ❌ **NEVER** use `createServer` from Node.js http module directly for MCP (use SDK pattern)
- ❌ Don't use `node dist/src/client/cli.js` directly
- ❌ Don't try to run CLI in background with `isBackground: true`
- ❌ **NEVER hardcode tool names, descriptions, or schemas anywhere**
- ❌ **NEVER use switch statements for tool handling**
- ❌ **NEVER skip the tools/list discovery step**
- ❌ **NEVER use JSON Schema objects for tool parameters** - use Zod schemas only
- ❌ **NEVER wrap schemas in `{ inputSchema: ... }`** - pass Zod schema directly

## ✅ What TO Do

- ✅ Use `npm run dev` for CLI testing
- ✅ Let human manage MCP server lifecycle
- ✅ **ALWAYS** use StreamableHTTPServerTransport with the official SDK pattern
- ✅ **ALWAYS** follow the official SDK sample pattern exactly
- ✅ **ALWAYS** use server.tool() method for registering tools
- ✅ **ALWAYS** use Zod schemas for tool parameters - enables MCP Inspector input fields
- ✅ **ALWAYS** pass Zod schema directly as 3rd parameter to server.tool()
- ✅ Test with MCP Inspector when needed
- ✅ **ALWAYS call tools/list to discover available tools dynamically**
- ✅ **ALWAYS use generic tool handlers that call tools/call endpoint**
- ✅ **ALWAYS parse tool descriptions from MCP server response**
