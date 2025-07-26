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

## 🚫 What NOT to Do

- ❌ Don't start MCP server from Copilot
- ❌ Don't use Express middleware with StreamableHTTPServerTransport
- ❌ Don't change the working server architecture
- ❌ Don't use `node dist/src/client/cli.js` directly
- ❌ Don't try to run CLI in background with `isBackground: true`
- ❌ Don't use SSE (Server-Sent Events) - use Streamable HTTP MCP only
- ❌ Don't initialize new session for every tool call - reuse existing session

## ✅ What TO Do

- ✅ Use `npm run dev` for CLI testing
- ✅ Let human manage MCP server lifecycle
- ✅ Preserve the direct HTTP server architecture
- ✅ Test with MCP Inspector when needed
- ✅ Match Inspector's initialization pattern in CLI client
- ✅ Use Streamable HTTP MCP transport (NOT SSE)
- ✅ Initialize session ONCE and reuse for all tool calls
