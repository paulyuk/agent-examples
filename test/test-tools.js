import * as dotenv from 'dotenv';
import OpenAI from 'openai';

// Load environment variables
dotenv.config();

async function testToolCalling() {
  try {
    console.log('🧪 Testing tool calling with Azure OpenAI...');
    
    const client = new OpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
      defaultQuery: { 'api-version': '2024-02-01' },
      defaultHeaders: {
        'api-key': process.env.AZURE_OPENAI_API_KEY,
      },
    });

    const tools = [{
      type: 'function',
      function: {
        name: 'azure-functions-chat',
        description: 'Chat tool specialized in Azure Functions development, best practices, and troubleshooting',
        parameters: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'Question about Azure Functions development',
            },
            context: {
              type: 'string',
              description: 'Optional context or code snippet for more specific help',
            },
          },
          required: ['question'],
        },
      },
    }];

    console.log('🧪 Sending request with tools...');
    
    const response = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
      messages: [
        { role: 'system', content: 'You are an Azure Functions expert. Use the azure-functions-chat tool to answer questions about Azure Functions.' },
        { role: 'user', content: 'What are two features of Azure Functions?' }
      ],
      tools: tools,
      tool_choice: 'auto',
      max_tokens: 500,
    });

    console.log('🧪 Response choice:', JSON.stringify(response.choices[0], null, 2));
    
  } catch (error) {
    console.error('🧪 Tool calling test error:', error);
  }
}

testToolCalling();
