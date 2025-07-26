import * as readline from 'readline';
import { AgentLoop } from '../agent/loop.js';
import fetch from 'node-fetch';
import { AgentLoopConfig } from '../types/index.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Interactive CLI client for the Azure OpenAI MCP Agent
 * Provides async chat interface with the agent loop
 */
export class CLIClient {
  private agent: AgentLoop;
  private mcpSessionId: string | null = null;
  private mcpUrl: string = 'http://localhost:8080/mcp';
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

    this.setupMCPTools();
  }

  /**
   * Setup MCP tools integration with the agent
   */
  private setupMCPTools(): void {
    // Register the Azure Functions chat tool to call the remote MCP server using streamable HTTP transport
    this.agent.registerMCPTool('azure-functions-chat', async (args: any) => {
      try {
        // Initialize session only once on first call
        if (!this.mcpSessionId) {
          await this.initializeMCPSession();
        }

        // Debug: Log what OpenAI actually sends
        console.log('[CLI] Raw args from OpenAI:', JSON.stringify(args, null, 2));
        
        // Only allow params defined in the inputSchema for find-azfunc-samples
        const allowedKeys = ['query', 'question', 'context', 'author', 'azureService'];
        const filteredArgs: Record<string, any> = {};
        if (args && typeof args === 'object') {
          for (const key of allowedKeys) {
            if (key in args && args[key] !== undefined) filteredArgs[key] = args[key];
          }
        }
        
        console.log('[CLI] Filtered args to send:', JSON.stringify(filteredArgs, null, 2));

        // Call the remote MCP tool (find-azfunc-samples) using existing session
        const mcpReq = {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'find-azfunc-samples',
            arguments: filteredArgs
          },
          id: Date.now()
        };
        console.log('[CLI] MCP request:', JSON.stringify(mcpReq, null, 2));
        console.log('[CLI] Using session ID:', this.mcpSessionId);
        
        // Build headers - only include session ID if we have one
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        };
        if (this.mcpSessionId) {
          headers['mcp-session-id'] = this.mcpSessionId;
        }
        
        const res = await fetch(this.mcpUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(mcpReq)
        });
        console.log('[CLI] MCP response status:', res.status);
        
        // Get response text for debugging 406 errors
        const responseText = await res.text();
        console.log('[CLI] MCP response text:', responseText);
        
        if (!res.ok) {
          console.log('[CLI] Full response headers:', [...res.headers.entries()]);
          throw new Error(`MCP server error: ${res.status} - ${responseText}`);
        }
        
        const data = JSON.parse(responseText);
        console.log('[CLI] MCP response data:', JSON.stringify(data, null, 2));
        if (data.error) {
          return {
            content: [{ type: 'text', text: `MCP error: ${data.error.message}` }]
          };
        }
        // The result is in data.result.content
        return {
          content: data.result && data.result.content ? data.result.content : [{ type: 'text', text: 'No content returned from MCP tool.' }]
        };
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
   * Initialize MCP session (only called once)
   */
  private async initializeMCPSession(): Promise<void> {
    console.log(`[CLI] Initializing MCP session...`);
    
    try {
      // Start a new session by POSTing with no session header
      // ✅ Match Inspector's exact initialization pattern
      const initRes = await fetch(this.mcpUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify({
          "jsonrpc": "2.0",
          "id": 0,
          "method": "initialize",
          "params": {
            "protocolVersion": "2025-06-18",
            "capabilities": {
              "sampling": {},
              "elicitation": {},
              "roots": {
                "listChanged": true
              }
            },
            "clientInfo": {
              "name": "azure-functions-cli",
              "version": "1.0.0"
            }
          }
        })
      });
      
      console.log('[CLI] Init response status:', initRes.status);
      
      if (!initRes.ok) {
        const errorText = await initRes.text();
        console.log('[CLI] Init failed with response:', errorText);
        
        // If server already initialized, that's actually OK - just don't have a session ID
        if (errorText.includes('Server already initialized')) {
          console.log('[CLI] Server already initialized, will use no session ID');
          this.mcpSessionId = null; // Use no session ID for subsequent calls
          return;
        }
        
        throw new Error(`Failed to initialize MCP session: ${initRes.status} - ${errorText}`);
      }
      
      // Get session ID from response headers
      const sid = initRes.headers.get('mcp-session-id');
      console.log('[CLI] Received session ID:', sid);
      
      // Parse the streamable HTTP response (should be JSON, not SSE)
      const responseText = await initRes.text();
      console.log('[CLI] Init response body:', responseText);
      
      // For Streamable HTTP MCP, response should be JSON not SSE
      const initData = JSON.parse(responseText);
      if (initData.error) {
        throw new Error(`MCP initialization error: ${initData.error.message}`);
      }
      
      this.mcpSessionId = sid;
      console.log('[CLI] Successfully initialized MCP session:', this.mcpSessionId);
      
    } catch (error) {
      console.error('[CLI] Failed to initialize MCP session:', error);
      throw error;
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
