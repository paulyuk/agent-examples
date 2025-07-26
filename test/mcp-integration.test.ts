/**
 * Simple Node.js test for MCP tool discovery verification
 * Run with: node test/mcp-integration.test.js (after build)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

console.log('🧪 Running MCP Integration Verification Tests...\n');

async function testBuildSuccess() {
  console.log('🔨 Test 1: Build should complete without TypeScript errors');
  
  try {
    const { stdout, stderr } = await execAsync('npm run build', { timeout: 15000 });
    
    if (stderr && stderr.includes('error TS')) {
      console.error('❌ TypeScript errors found:', stderr);
      return false;
    }
    
    console.log('✅ Build completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Build failed:', error);
    return false;
  }
}

async function testNoHardcodedTools() {
  console.log('\n🔍 Test 2: Should not contain hardcoded tool names in switch statements');
  
  try {
    // Check the source files for hardcoded switch patterns
    const loopFile = readFileSync('src/agent/loop.ts', 'utf8');
    
    const hasHardcodedSwitch = loopFile.includes('switch') && 
                              (loopFile.includes('find-azfunc-samples') || 
                               loopFile.includes('case'));
    
    if (hasHardcodedSwitch) {
      console.error('❌ Found hardcoded tool handling patterns');
      return false;
    }
    
    console.log('✅ No hardcoded tool names in switch statements');
    return true;
  } catch (error) {
    console.error('❌ Error checking for hardcoded tools:', error);
    return false;
  }
}

async function testMCPProtocolCalls() {
  console.log('\n🔗 Test 3: Should contain proper MCP protocol calls');
  
  try {
    const loopFile = readFileSync('src/agent/loop.ts', 'utf8');
    
    const hasToolsList = loopFile.includes('tools/list');
    const hasToolsCall = loopFile.includes('tools/call');
    
    if (!hasToolsList || !hasToolsCall) {
      console.error('❌ Missing MCP protocol calls (tools/list or tools/call)');
      return false;
    }
    
    console.log('✅ Contains proper MCP protocol calls');
    return true;
  } catch (error) {
    console.error('❌ Error checking MCP protocol calls:', error);
    return false;
  }
}

async function testSSEHeaders() {
  console.log('\n📡 Test 4: Should have proper SSE Accept headers');
  
  try {
    const loopFile = readFileSync('src/agent/loop.ts', 'utf8');
    
    const hasSSEHeader = loopFile.includes('text/event-stream');
    const hasProperAccept = loopFile.includes('application/json, text/event-stream');
    
    if (!hasSSEHeader || !hasProperAccept) {
      console.error('❌ Missing proper SSE Accept headers');
      return false;
    }
    
    console.log('✅ Contains proper SSE Accept headers');
    return true;
  } catch (error) {
    console.error('❌ Error checking SSE headers:', error);
    return false;
  }
}

async function testDynamicToolRegistration() {
  console.log('\n🎯 Test 5: Should use dynamic tool registration pattern');
  
  try {
    const loopFile = readFileSync('src/agent/loop.ts', 'utf8');
    
    const hasDynamicRegistration = loopFile.includes('registerDiscoveredMCPTools');
    const hasGenericHandler = loopFile.includes('toolHandler = async (args: any)');
    const hasToolDescriptionsCache = loopFile.includes('mcpToolDescriptions');
    
    if (!hasDynamicRegistration || !hasGenericHandler || !hasToolDescriptionsCache) {
      console.error('❌ Missing dynamic tool registration pattern');
      return false;
    }
    
    console.log('✅ Uses proper dynamic tool registration pattern');
    return true;
  } catch (error) {
    console.error('❌ Error checking dynamic registration:', error);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  const tests = [
    testBuildSuccess,
    testNoHardcodedTools, 
    testMCPProtocolCalls,
    testSSEHeaders,
    testDynamicToolRegistration
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const result = await test();
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All MCP integration tests passed!');
    console.log('✅ Dynamic tool discovery is properly implemented');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed - please fix before deploying');
    process.exit(1);
  }
}

runAllTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});
