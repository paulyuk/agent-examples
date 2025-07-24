import { CosmosClient, Container } from '@azure/cosmos';
import { ConversationSession, ChatMessage, CosmosConfig } from '../types/index.js';

/**
 * Simple Cosmos DB service for persisting conversation history
 */
export class CosmosService {
  private client: CosmosClient;
  private container: Container;

  constructor(config: CosmosConfig) {
    this.client = new CosmosClient({
      endpoint: config.endpoint,
      key: config.key,
    });

    this.container = this.client
      .database(config.databaseId)
      .container(config.containerId);
  }

  /**
   * Save conversation session to Cosmos DB
   */
  async saveSession(session: ConversationSession): Promise<void> {
    try {
      await this.container.items.upsert(session);
      console.log(`💾 Saved session ${session.sessionId} to Cosmos DB`);
    } catch (error) {
      console.error('❌ Failed to save session to Cosmos DB:', error);
      throw error;
    }
  }

  /**
   * Load conversation session from Cosmos DB
   */
  async loadSession(sessionId: string): Promise<ConversationSession | null> {
    try {
      const querySpec = {
        query: 'SELECT * FROM c WHERE c.sessionId = @sessionId',
        parameters: [{ name: '@sessionId', value: sessionId }],
      };

      const { resources } = await this.container.items.query(querySpec).fetchAll();
      
      if (resources.length === 0) {
        return null;
      }

      console.log(`📂 Loaded session ${sessionId} from Cosmos DB`);
      return resources[0] as ConversationSession;
    } catch (error) {
      console.error('❌ Failed to load session from Cosmos DB:', error);
      return null;
    }
  }

  /**
   * Add message to existing session
   */
  async addMessageToSession(sessionId: string, message: ChatMessage): Promise<void> {
    try {
      const session = await this.loadSession(sessionId);
      if (session) {
        session.messages.push(message);
        session.updatedAt = new Date();
        await this.saveSession(session);
      }
    } catch (error) {
      console.error('❌ Failed to add message to session:', error);
    }
  }
}
