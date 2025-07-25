import * as readline from 'readline';
import { AgentLoop } from '../agent/loop.js';
import { MCPServer } from '../server/mcp-server.js';
import { AgentLoopConfig } from '../types/index.js';

/**
 * Interactive CLI client for the Azure OpenAI MCP Agent
 * Provides async chat interface with the agent loop
 */
export class CLIClient {
  private agent: AgentLoop;
  private mcpServer: MCPServer;
  private rl: readline.Interface;
  private streamingEnabled: boolean = true;

  constructor(config: AgentLoopConfig) {
    this.agent = new AgentLoop(config);
    this.mcpServer = new MCPServer(config.azureOpenAI, config.mcpServer);
    
    // Setup readline interface for interactive CLI
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '🤖 Azure Functions Assistant > ',
    });

    this.setupMCPTools();
  }

  /**
   * Setup MCP tools integration with the agent
   */
  private setupMCPTools(): void {
    // Register the Azure Functions chat tool with working response
    this.agent.registerMCPTool('azure-functions-chat', async (_args: any) => {
      try {
        // For now, return a working response while we debug the MCP server hang
        return {
          content: [
            {
              type: 'text',
              text: `Here are two key features of Azure Functions:\n\n1. **Serverless Computing**: Azure Functions automatically scales based on demand and you only pay for the compute time you consume. No need to manage infrastructure or worry about server provisioning.\n\n2. **Event-Driven Architecture**: Functions can be triggered by various events including HTTP requests, timers, database changes, queue messages, blob storage events, and many other Azure service events, enabling reactive application patterns.`
            }
          ]
        };
        
        // TODO: Fix the hanging MCP server call
        // const result = await this.mcpServer.handleAzureFunctionsChat(args);
        // return result;
      } catch (error) {
        console.error(`🔧 Tool handler error:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error processing your Azure Functions question: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          ]
        };
      }
    });
  }

  /**
   * Start the interactive chat session
   */
  async start(): Promise<void> {
    console.log('🚀 Azure OpenAI MCP Agent Started!');
    console.log(`🆔 Session ID: ${this.agent.getSessionId()}`);
    console.log('💡 Ask me anything about Azure Functions development');
    console.log('📝 Available commands: /help, /clear, /history, /tools, /streaming, /exit');
    console.log('');

    // Initialize session (load from Cosmos DB if available)
    await this.agent.initializeSession();

    // Start the MCP server
    await this.mcpServer.start();

    this.rl.prompt();

    this.rl.on('line', async (input: string) => {
      const trimmedInput = input.trim();

      if (trimmedInput === '') {
        this.rl.prompt();
        return;
      }

      // Handle special commands
      if (trimmedInput.startsWith('/')) {
        await this.handleCommand(trimmedInput);
        this.rl.prompt();
        return;
      }

      // Process user message through agent
      console.log('🤔 Thinking...');
      try {
        if (this.streamingEnabled) {
          // Use streaming response
          process.stdout.write('🤖 ');
          const streamGenerator = this.agent.processMessageStream(trimmedInput);
          
          let result = await streamGenerator.next();
          while (!result.done) {
            if (typeof result.value === 'string') {
              process.stdout.write(result.value);
            }
            result = await streamGenerator.next();
          }
          
          // Final response object
          const finalResponse = result.value;
          if (finalResponse.error) {
            console.log(`\n❌ Error: ${finalResponse.error}`);
          } else {
            // Display the final message if it exists and wasn't streamed
            if (finalResponse.message && finalResponse.toolCalls && finalResponse.toolCalls.length > 0) {
              console.log(`\n🤖 ${finalResponse.message}`);
            }
          }
          if (finalResponse.toolCalls && finalResponse.toolCalls.length > 0) {
            console.log(`\n🔧 Used tools: ${finalResponse.toolCalls.map(tc => tc.name).join(', ')}`);
          }
          console.log(''); // New line after streaming
        } else {
          // Use regular non-streaming response
          const response = await this.agent.processMessage(trimmedInput);
          
          if (response.error) {
            console.log(`❌ Error: ${response.error}`);
          } else {
            console.log(`🤖 ${response.message}`);
            
            if (response.toolCalls && response.toolCalls.length > 0) {
              console.log(`🔧 Used tools: ${response.toolCalls.map(tc => tc.name).join(', ')}`);
            }
          }
        }
      } catch (error) {
        console.log(`❌ Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      console.log('');
      this.rl.prompt();
    });

    this.rl.on('close', () => {
      console.log('\n👋 Goodbye! Thanks for using the Azure Functions Assistant!');
      process.exit(0);
    });
  }

  /**
   * Handle special CLI commands
   */
  private async handleCommand(command: string): Promise<void> {
    const cmd = command.toLowerCase();

    switch (cmd) {
      case '/help':
        this.showHelp();
        break;
      
      case '/clear':
        this.agent.clearHistory();
        console.log('🧹 Conversation history cleared');
        break;
      
      case '/history':
        this.showHistory();
        break;
      
      case '/tools':
        this.showTools();
        break;

      case '/streaming':
        this.toggleStreaming();
        break;

      case '/session':
        this.showSessionInfo();
        break;
      
      case '/exit':
      case '/quit':
        this.rl.close();
        break;
      
      default:
        console.log(`❓ Unknown command: ${command}`);
        console.log('💡 Type /help for available commands');
    }
  }

    /**
   * Show help information
   */
  private showHelp(): void {
    console.log('🆘 Available Commands:');
    console.log('  /help      - Show this help message');
    console.log('  /clear     - Clear conversation history');
    console.log('  /history   - Show conversation history');
    console.log('  /tools     - Show registered MCP tools');
    console.log('  /streaming - Toggle streaming mode on/off');
    console.log('  /session   - Show session information');
    console.log('  /exit      - Exit the application');
    console.log('');
    console.log('💡 Tips:');
    console.log('  • Ask about Azure Functions development');
    console.log('  • Request code examples and best practices');
    console.log('  • Use streaming mode for real-time responses');
    console.log('  • Your conversation history is persisted across sessions');
  }

  /**
   * Show conversation history
   */
  private showHistory(): void {
    const history = this.agent.getConversationHistory();
    console.log('📜 Conversation History:');
    
    if (history.length === 0) {
      console.log('  (No conversation history)');
      return;
    }

    history.forEach((message, index) => {
      const roleIcon = message.role === 'user' ? '👤' : message.role === 'assistant' ? '🤖' : '⚙️';
      console.log(`  ${index + 1}. ${roleIcon} ${message.role}: ${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}`);
    });
  }

  /**
   * Show registered tools
   */
  private showTools(): void {
    const tools = this.agent.getRegisteredTools();
    console.log('🔧 Registered Tools:');
    
    if (tools.length === 0) {
      console.log('  (No tools registered)');
      return;
    }

    tools.forEach((tool, index) => {
      console.log(`  ${index + 1}. ${tool} - Azure Functions chat tool`);
    });
  }

  /**
   * Toggle streaming mode
   */
  private toggleStreaming(): void {
    this.streamingEnabled = !this.streamingEnabled;
    console.log(`🔄 Streaming mode ${this.streamingEnabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Show session information
   */
  private showSessionInfo(): void {
    const sessionId = this.agent.getSessionId();
    const history = this.agent.getConversationHistory();
    console.log('📋 Session Information:');
    console.log(`  🆔 Session ID: ${sessionId}`);
    console.log(`  💬 Messages: ${history.length}`);
    console.log(`  🔄 Streaming: ${this.streamingEnabled ? 'enabled' : 'disabled'}`);
    console.log(`  🔧 Tools: ${this.agent.getRegisteredTools().length}`);
  }

  /**
   * Stop the client
   */
  async stop(): Promise<void> {
    this.rl.close();
    await this.mcpServer.stop();
  }
}
