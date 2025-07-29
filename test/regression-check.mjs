#!/usr/bin/env node

/**
 * Quick regression check script
 * Run with: node test/regression-check.mjs
 */

import { readFileSync } from 'fs';
import { join } from 'path';

console.log('🔍 Quick Regression Check for MCP Dynamic Tool Discovery\n');

const checks = [
  {
    name: 'No hardcoded switch statements for tools',
    file: 'src/agent/loop.ts',
    test: (content) => {
      const hasSwitch = content.includes('switch') && content.includes('find-azfunc-samples');
      return { pass: !hasSwitch, message: hasSwitch ? 'Found hardcoded switch statement' : 'OK' };
    }
  },
  {
    name: 'Contains tools/list MCP call',
    file: 'src/agent/loop.ts', 
    test: (content) => {
      const hasToolsList = content.includes('tools/list');
      return { pass: hasToolsList, message: hasToolsList ? 'OK' : 'Missing tools/list call' };
    }
  },
  {
    name: 'Contains tools/call MCP call',
    file: 'src/agent/loop.ts',
    test: (content) => {
      const hasToolsCall = content.includes('tools/call');
      return { pass: hasToolsCall, message: hasToolsCall ? 'OK' : 'Missing tools/call call' };
    }
  },
  {
    name: 'Uses proper MCP transport (SDK or SSE)',
    file: 'src/agent/loop.ts',
    test: (content) => {
      const hasSDK = content.includes('StreamableHTTPClientTransport');
      const hasSSE = content.includes('text/event-stream');
      return { pass: hasSDK || hasSSE, message: hasSDK ? 'OK (using SDK transport)' : hasSSE ? 'OK (using manual SSE)' : 'Missing proper transport' };
    }
  },
  {
    name: 'Uses dynamic tool registration',
    file: 'src/agent/loop.ts',
    test: (content) => {
      const hasDynamic = content.includes('registerDiscoveredMCPTools');
      return { pass: hasDynamic, message: hasDynamic ? 'OK' : 'Missing dynamic registration' };
    }
  },
  {
    name: 'Has generic tool handlers',
    file: 'src/agent/loop.ts',
    test: (content) => {
      const hasGeneric = content.includes('toolHandler = async (args: any)');
      return { pass: hasGeneric, message: hasGeneric ? 'OK' : 'Missing generic handlers' };
    }
  }
];

let passed = 0;
let failed = 0;

for (const check of checks) {
  try {
    const content = readFileSync(check.file, 'utf8');
    const result = check.test(content);
    
    if (result.pass) {
      console.log(`✅ ${check.name}: ${result.message}`);
      passed++;
    } else {
      console.log(`❌ ${check.name}: ${result.message}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${check.name}: Error reading file - ${error.message}`);
    failed++;
  }
}

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('🎉 All regression checks passed! Dynamic MCP tool discovery is properly implemented.');
} else {
  console.log('⚠️  Some checks failed. Please review the implementation.');
  process.exit(1);
}
