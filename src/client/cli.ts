import * as readline from 'readline';
import { AgentLoop } from '../agent/loop.js';
import { AgentLoopConfig } from '../types/index.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Interactive CLI client for the Azure OpenAI MCP Agent
 * Provides async chat interface with the agent loop
 */
export class CLIClient {
  private agent: AgentLoop;
  private rl: readline.Interface;
  private streamingEnabled: boolean = true;
  private sessionId: string;
  private static LAST_SESSION_FILE = path.resolve('.last_session');

  constructor(config: AgentLoopConfig) {
    // Parse CLI args for session control and chain of thought
    const args = process.argv.slice(2);
    let sessionId: string | undefined = undefined;
    let forceNewSession = false;
    let chainOfThought = true; // default ON
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--session' && args[i + 1]) {
        sessionId = args[i + 1];
      }
      if (args[i] === '--new-session') {
        forceNewSession = true;
      }
      if (args[i] === '--no-chain-of-thought') {
        chainOfThought = false;
      }
    }

    // Try to load last session unless forced new
    if (!sessionId && !forceNewSession && fs.existsSync(CLIClient.LAST_SESSION_FILE)) {
      try {
        const lastSession = fs.readFileSync(CLIClient.LAST_SESSION_FILE, 'utf-8').trim();
        if (lastSession) sessionId = lastSession;
      } catch {}
    }
    // Always ensure sessionId is a string
    this.sessionId = sessionId || '';
    if (!this.sessionId) {
      // Generate a new sessionId using uuid if not provided
      this.sessionId = crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
    }
    // Set chainOfThought in config
    config.chainOfThought = chainOfThought;
    this.agent = new AgentLoop(config, this.sessionId);
    // this.mcpServer = new MCPServer(config.azureOpenAI, config.mcpServer);

    // Setup readline interface for interactive CLI
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '🤖 Azure Functions Assistant > ',
    });

    // Note: setupMCPTools is now async and will be called in start()
  }

  /**
   * Setup MCP tools integration with the agent
   */
  private async setupMCPTools(): Promise<void> {
    // Tools will be registered dynamically after MCP server discovery
    console.log("🔧 MCP tools will be registered dynamically after server discovery");
    
    // Initialize MCP tools by fetching their descriptions from the server
    // The agent loop will handle SDK client connection internally
    try {
      console.log("🔧 Initializing MCP tools...");
      // Pass empty string since SDK client doesn't use session IDs
      await this.agent.initializeMCPTools("");
      console.log("✅ MCP tools initialized successfully");
      
      // Register all discovered tools dynamically
      console.log("🔧 Registering discovered MCP tools...");
      this.agent.registerDiscoveredMCPTools("");
      console.log("✅ MCP tools registered successfully");
    } catch (error) {
      console.error("❌ Failed to initialize MCP tools:", error);
      console.log("⚠️  Continuing without MCP tools...");
    }
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
    await this.agent.initializeSession(); // Print on CLI start

    // Setup MCP tools and register them dynamically
    await this.setupMCPTools();

    // Save session ID for reuse
    try {
      fs.writeFileSync(CLIClient.LAST_SESSION_FILE, this.agent.getSessionId(), 'utf-8');
    } catch {}

    // Start the MCP server
    // MCP server is now a standalone process; no need to start it from the CLI

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
            if (finalResponse.message && finalResponse.toolCalls && finalResponse.toolCalls.length > 0) {
              console.log(`\n🤖 ${finalResponse.message}`);
            }
          }
          if (finalResponse.toolCalls && finalResponse.toolCalls.length > 0) {
            console.log(`\n🔧 Used tools: ${finalResponse.toolCalls.map(tc => tc.name).join(', ')}`);
          }
          console.log('');
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
        // Save session ID after each message (in case a new session was created)
        try {
          fs.writeFileSync(CLIClient.LAST_SESSION_FILE, this.agent.getSessionId(), 'utf-8');
        } catch {}
      } catch (error) {
        console.log(`❌ Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      console.log('');
      this.rl.prompt();
    });

    this.rl.on('close', () => {
      (async () => {
        await this.agent.saveFullSession(true); // Print on exit
        console.log('\n👋 Goodbye! Thanks for using the Azure Functions Assistant!');
        process.exit(0);
      })();
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
    // MCP server is now a standalone process; no need to stop it from the CLI
  }
}
