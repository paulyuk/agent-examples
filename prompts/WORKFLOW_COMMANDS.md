# 📋 WORKFLOW COMMANDS SUMMARY

## 🤖 For GitHub Copilot
```bash
# ✅ ONLY command Copilot should use for CLI testing
npm run dev
```

## 👨‍💻 For Humans
```bash
# Start MCP server (terminal 1)
npm run mcp-server

# Start CLI client (terminal 2) 
npm run dev

# Optional: Test with MCP Inspector
npx @modelcontextprotocol/inspector
```

## 🏗️ Build Commands
```bash
# Compile TypeScript
npm run build

# Run compiled version (production)
npm start
```

## 🧪 Test Commands
```bash
# Various test scripts
npm run test:quick
npm run test:mcp-only
npm run test:cosmos-identity
```

## 🚫 DO NOT USE
- `node dist/src/client/cli.js` (use `npm run dev` instead)
- `isBackground: true` for CLI commands
- Any MCP server management from Copilot

---

**Remember**: The MCP server architecture using direct `createServer` with `StreamableHTTPServerTransport` is what makes MCP Inspector work. Never change this working pattern!
