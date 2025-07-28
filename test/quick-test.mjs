#!/usr/bin/env node
import * as dotenv from 'dotenv';
import { uuid } from 'uuidv4';
import fetch from 'node-fetch';
import { AgentLoop } from '../dist/agent/loop.js';
import { MCPServer } from '../dist/tools/mcp-server.js';

dotenv.config();

async function quickTest() {
  const config = {
    azureOpenAI: {
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    },
    mcpServer: {
      port: 3000,
      name: 'azure-functions-mcp-server',
      version: '1.0.0',
    },
    systemPrompt: 'You are a helpful Azure Functions expert assistant.',
  };

  const agent = new AgentLoop(config);
  const mcpServer = new MCPServer(config.azureOpenAI, config.mcpServer);
  
  agent.registerMCPTool('azure-functions-chat', async (args) => {
    console.log('🧪 Mock tool called with:', args);
    return {
      content: [
        {
          type: 'text',
          text: 'Mock response: Azure Functions has serverless computing and event-driven architecture.'
        }
      ]
    };
  });
  
  await agent.initializeSession();
  
  console.log('Sending message...');
  const response = await agent.processMessage('what are two features of functions');
  console.log('Final response:', response);
  process.exit(0);
}

quickTest().catch(console.error);
