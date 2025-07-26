import { CosmosClient, Container } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { ConversationSession, ChatMessage, CosmosConfig } from '../types/index.js';

/**
 * Cosmos DB service for persisting conversation history
 * Supports both identity-based (recommended) and key-based authentication
 * 
 * Identity-based authentication uses DefaultAzureCredential which automatically
 * tries multiple authentication methods:
 * 1. Environment variables (service principal)
 * 2. Managed Identity (when running on Azure)
 * 3. Azure CLI (local development)
 * 4. Interactive browser (fallback)
 * 
 * @see COSMOS_IDENTITY.md for setup instructions
 */
export class CosmosService {
  private client: CosmosClient;
  private container: Container;

  constructor(config: CosmosConfig) {
    // Use identity-based authentication if no key is provided or useIdentity is explicitly true
    const useIdentity = config.useIdentity !== false && !config.key;
    
    if (useIdentity) {
      console.log('🔐 Initializing Cosmos DB with Azure Identity (keyless authentication)');
      const credential = new DefaultAzureCredential();
      this.client = new CosmosClient({
        endpoint: config.endpoint,
        aadCredentials: credential,
      });
    } else {
      console.log('🔑 Initializing Cosmos DB with key-based authentication');
      this.client = new CosmosClient({
        endpoint: config.endpoint,
        key: config.key!,
      });
    }

    this.container = this.client
      .database(config.databaseId)
      .container(config.containerId);
  }

  /**
   * Save conversation session to Cosmos DB
   */
  async saveSession(session: ConversationSession, debug = false): Promise<void> {
    try {
      await this.container.items.upsert(session);
      if (debug) {
        console.log(`💾 Saved session ${session.sessionId} to Cosmos DB`);
      }
    } catch (error) {
      if (debug) {
        console.error('❌ Failed to save session to Cosmos DB:', error);
      }
      throw error;
    }
  }

  /**
   * Load conversation session from Cosmos DB
   */
  async loadSession(sessionId: string, debug = false): Promise<ConversationSession | null> {
    try {
      const querySpec = {
        query: 'SELECT * FROM c WHERE c.sessionId = @sessionId',
        parameters: [{ name: '@sessionId', value: sessionId }],
      };

      const { resources } = await this.container.items.query(querySpec).fetchAll();
      
      if (resources.length === 0) {
        return null;
      }

      if (debug) {
        console.log(`📂 Loaded session ${sessionId} from Cosmos DB`);
      }
      return resources[0] as ConversationSession;
    } catch (error) {
      if (debug) {
        console.error('❌ Failed to load session from Cosmos DB:', error);
      }
      return null;
    }
  }

  /**
   * Add message to existing session
   */
  async addMessageToSession(sessionId: string, message: ChatMessage, debug = false): Promise<void> {
    try {
      let session = await this.loadSession(sessionId);
      if (session) {
        session.messages.push(message);
        session.updatedAt = new Date();
      } else {
        // Create a new session if it doesn't exist
        const now = new Date();
        session = {
          id: sessionId, // id field for CosmosDB
          sessionId,
          messages: [message],
          createdAt: now,
          updatedAt: now,
        };
      }
      await this.saveSession(session, debug);
    } catch (error) {
      if (debug) {
        console.error('❌ Failed to add message to session:', error);
      }
    }
  }
}
