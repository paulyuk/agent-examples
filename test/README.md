# Test Files

This directory contains various test files for debugging and validating different components of the Azure OpenAI MCP Agent.

## Test Files

### JavaScript Test Files (.js)
- **test-debug.js** - General debugging test for agent functionality
- **test-mcp.js** - Tests the MCP (Model Context Protocol) server directly
- **test-openai.js** - Tests Azure OpenAI connection and basic functionality
- **test-tools.js** - Tests tool calling functionality with Azure OpenAI

### ES Module Test Files (.mjs)
- **quick-test.mjs** - Quick test with mock tool for basic agent functionality
- **test-mcp-only.mjs** - Focused test for MCP server functionality only
- **test-cosmos-identity.mjs** - Test Cosmos DB with Azure AD identity authentication

## Running Tests

You can run individual test files using the npm scripts:

```bash
# JavaScript tests
npm run test:debug    # Run debugging test
npm run test:mcp      # Run MCP server test
npm run test:openai   # Run Azure OpenAI connection test
npm run test:tools    # Run tool calling test

# ES Module tests  
npm run test:quick    # Run quick test with mock tools
npm run test:mcp-only # Run MCP-only focused test
npm run test:cosmos-identity # Test Cosmos DB identity authentication
```

Or run them directly:

```bash
# JavaScript tests
node test/test-debug.js
node test/test-mcp.js
node test/test-openai.js
node test/test-tools.js

# ES Module tests
node test/quick-test.mjs
node test/test-mcp-only.mjs
node test/test-cosmos-identity.mjs
```

## Prerequisites

Make sure you have:
1. Built the project: `npm run build`
2. Set up your `.env` file with the required Azure OpenAI credentials
3. Installed dependencies: `npm install`
