import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

async function testMCPServer() {
  try {
    console.log('🧪 Testing MCP Server via HTTP...');
    
    const mcpServerUrl = process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp';
    
    // Test MCP server by calling tools/list
    const response = await fetch(mcpServerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'test-' + Math.random().toString(36),
        method: 'tools/list'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    console.log('🧪 MCP Server response:', text);
    
    // Simple validation
    if (text.includes('get_azure_functions_samples')) {
      console.log('✅ Test PASSED: MCP server is working');
    } else {
      console.log('❌ Test FAILED: Expected tools not found');
    }
    
  } catch (error) {
    console.error('🧪 MCP Server test error:', error);
  }
  process.exit(0);
}

testMCPServer();
