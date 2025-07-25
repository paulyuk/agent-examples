import * as dotenv from 'dotenv';
import OpenAI from 'openai';

// Load environment variables
dotenv.config();

async function testAzureOpenAI() {
  try {
    console.log('🧪 Testing Azure OpenAI connection...');
    console.log('Endpoint:', process.env.AZURE_OPENAI_ENDPOINT);
    console.log('Deployment:', process.env.AZURE_OPENAI_DEPLOYMENT_NAME);
    
    const client = new OpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
      defaultQuery: { 'api-version': '2024-02-01' },
      defaultHeaders: {
        'api-key': process.env.AZURE_OPENAI_API_KEY,
      },
    });

    console.log('🧪 Sending simple chat completion...');
    
    const response = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
      messages: [
        { role: 'user', content: 'Say hello' }
      ],
      max_tokens: 50,
    });

    console.log('🧪 Response:', response.choices[0]?.message?.content);
    
  } catch (error) {
    console.error('🧪 Azure OpenAI test error:', error);
  }
}

testAzureOpenAI();
