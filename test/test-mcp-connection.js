/**
 * Test MCP connection directly to debug the initialization issue
 */
import fetch from 'node-fetch';

async function testMCPConnection() {
  console.log('🧪 Testing MCP connection...');
  
  const mcpUrl = 'http://localhost:3000/mcp';
  
  try {
    console.log('📡 Sending initialization request...');
    const initRes = await fetch(mcpUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {} }, id: 1 })
    });
    
    console.log('📊 Response status:', initRes.status);
    console.log('📝 Response headers:', [...initRes.headers.entries()]);
    
    const responseText = await initRes.text();
    console.log('📄 Response body:', responseText);
    
    if (initRes.ok) {
      const sessionId = initRes.headers.get('mcp-session-id');
      console.log('✅ Got session ID:', sessionId);
      
      if (sessionId) {
        console.log('🔧 Testing tool call...');
        const toolRes = await fetch(mcpUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'mcp-session-id': sessionId
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'find-azfunc-samples',
              arguments: { question: 'test query' }
            },
            id: 2
          })
        });
        
        console.log('🔧 Tool response status:', toolRes.status);
        const toolResponseText = await toolRes.text();
        console.log('🔧 Tool response body:', toolResponseText);
      }
    } else {
      console.error('❌ Initialization failed');
    }
    
  } catch (error) {
    console.error('💥 Connection error:', error);
  }
}

testMCPConnection().catch(console.error);
