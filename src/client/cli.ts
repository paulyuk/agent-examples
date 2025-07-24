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
    // Register the Azure Functions chat tool from MCP server
    this.agent.registerMCPTool('azure-functions-chat', async (args: any) => {
      return await this.mcpServer.handleAzureFunctionsChat(args);
    });
  }

  /**
   * Start the interactive chat session
   */
  async start(): Promise<void> {
    console.log('🚀 Azure OpenAI MCP Agent Started!');
    console.log('💡 Ask me anything about Azure Functions development');
    console.log('📝 Available commands: /help, /clear, /history, /tools, /exit');
    console.log('');

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
        const response = await this.agent.processMessage(trimmedInput);
        
        if (response.error) {
          console.log(`❌ Error: ${response.error}`);
        } else {
          console.log(`🤖 ${response.message}`);
          
          if (response.toolCalls && response.toolCalls.length > 0) {
            console.log(`🔧 Used tools: ${response.toolCalls.map(tc => tc.name).join(', ')}`);
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
    console.log('📚 Available Commands:');
    console.log('  /help     - Show this help message');
    console.log('  /clear    - Clear conversation history');
    console.log('  /history  - Show conversation history');
    console.log('  /tools    - Show registered tools');
    console.log('  /exit     - Exit the application');
    console.log('');
    console.log('💡 Example questions:');
    console.log('  - How do I create a timer trigger in Azure Functions?');
    console.log('  - What are the best practices for Azure Functions performance?');
    console.log('  - How do I implement Durable Functions?');
    console.log('  - Show me how to use Azure Functions with Cosmos DB');
    console.log('  - What are the different hosting plans for Azure Functions?');
    console.log('  - How do I secure my Azure Functions?');
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
   * Stop the client
   */
  async stop(): Promise<void> {
    this.rl.close();
    await this.mcpServer.stop();
  }
}
