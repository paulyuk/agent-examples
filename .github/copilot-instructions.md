# 🤖 GitHub Copilot Workflow Instructions

## ⚠️ CRITICAL: Never Forget These Commands

### MCP Server Management
- **ONLY THE HUMAN** can start/stop the MCP server
- **Command**: `npm run mcp-server`
- **Port**: http://localhost:8080/mcp
- **Architecture**: Direct HTTP server with `createServer` (NO Express middleware)

### CLI Client Management  
- **Copilot should use**: `npm run dev` to start the CLI client
- **Never use**: `node dist/src/client/cli.js` directly
- **The CLI connects to the MCP server** at http://localhost:8080/mcp

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

## 🚨 DO NOT BREAK THE WORKING MCP SERVER ARCHITECTURE

The current MCP server architecture is working perfectly with MCP Inspector:

```typescript
// ✅ WORKING PATTERN - DO NOT CHANGE
import { createServer } from 'http';
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const httpServer = createServer(async (req, res) => {
  if (req.url !== '/mcp') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found. Use /mcp endpoint.' }));
    return;
  }
  
  await transport.handleRequest(req, res);
});
```

### Why This Works
- Direct Node.js HTTP server (no Express middleware)
- Raw request/response objects to transport
- No middleware interference with streaming protocol
- Proper session management with mcp-session-id headers

## 🔄 Standard Workflow

1. **Human starts MCP server**: `npm run mcp-server`
2. **Copilot tests CLI**: `npm run dev` 
3. **MCP Inspector can connect**: http://localhost:6274/?MCP_PROXY_AUTH_TOKEN=...

### ⚠️ Session Management Rules
- **Only ONE client can initialize** the MCP server at a time
- **If server says "already initialized"**: Restart server with `npm run mcp-server`  
- **Fresh server = fresh session** for proper CLI testing
- **Don't generate random session IDs** - server will reject them

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
- ❌ Don't use Express middleware with StreamableHTTPServerTransport
- ❌ Don't change the working server architecture
- ❌ Don't use `node dist/src/client/cli.js` directly
- ❌ Don't try to run CLI in background with `isBackground: true`
- ❌ Don't assume JSON responses - StreamableHTTPServerTransport uses SSE format
- ❌ Don't initialize new session for every tool call - reuse existing session
- ❌ **NEVER hardcode tool names, descriptions, or schemas anywhere**
- ❌ **NEVER use switch statements for tool handling**
- ❌ **NEVER skip the tools/list discovery step**

## 🧪 Regression Protection Tests

### Critical: Run These Tests Before Any Changes
```bash
# Quick check (30 seconds)
npm run test:regression

# Full integration test (2 minutes)  
npm run test:mcp-integration
```

### What The Tests Protect Against
- ✅ Hardcoded tool names in switch statements
- ✅ Missing MCP protocol calls (tools/list, tools/call)
- ✅ Incorrect Accept headers (must include text/event-stream)
- ✅ Missing dynamic tool registration pattern
- ✅ Missing generic tool handlers
- ✅ TypeScript compilation errors

### When Tests Fail
- **STOP** - Do not proceed with changes
- **FIX** - Address the failing check first
- **VERIFY** - Run tests again until all pass
- **ONLY THEN** - Continue with development

## ✅ What TO Do

- ✅ Use `npm run dev` for CLI testing
- ✅ Let human manage MCP server lifecycle
- ✅ Preserve the direct HTTP server architecture
- ✅ Test with MCP Inspector when needed
- ✅ Match Inspector's initialization pattern in CLI client
- ✅ Use Streamable HTTP MCP transport (responses are in SSE format)
- ✅ Initialize session ONCE and reuse for all tool calls
- ✅ Always include mcp-session-id header (required by StreamableHTTPServerTransport)
- ✅ Parse SSE format responses correctly (event: message, data: {...})
- ✅ **ALWAYS call tools/list to discover available tools dynamically**
- ✅ **ALWAYS use generic tool handlers that call tools/call endpoint**
- ✅ **ALWAYS parse tool descriptions from MCP server response**
