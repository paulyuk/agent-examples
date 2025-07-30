import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import fetch from "node-fetch";
import express, { Request, Response } from 'express';

// Tool schemas using Zod (matching official MCP SDK pattern)
const GET_AZURE_FUNCTIONS_SAMPLES_SCHEMA = {
  query: z.string().describe("Search query for Azure Functions samples").optional(),
  language: z.string().describe("Programming language filter (e.g., 'javascript', 'python', 'csharp')").optional(),
  category: z.string().describe("Category filter (e.g., 'http', 'timer', 'blob')").optional()
};

// Type for a sample in the gallery
type GallerySample = {
  title: string;
  description: string;
  preview: string;
  authorUrl: string;
  author: string;
  source: string;
  tags: string[];
  azureServices: string[];
  id: string;
  languages: string[];
};

// Type for the gallery JSON
type Gallery = {
  samples: GallerySample[];
};

// Helper to fetch and parse the Awesome AZD Gallery JSON
async function fetchAwesomeAzdGallery(query?: string, language?: string, category?: string): Promise<Gallery> {
  const url = "https://raw.githubusercontent.com/Azure/awesome-azd/main/website/static/templates.json";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch gallery: ${res.status}`);
  // The JSON is an array of samples, not wrapped in { samples: ... }
  const arr = await res.json() as any[];
  // Defensive: ensure each sample has azureServices and languages as arrays
  const samples: GallerySample[] = arr.map((s: any) => ({
    title: s.title,
    description: s.description,
    preview: s.preview,
    authorUrl: s.authorUrl,
    author: s.author,
    source: s.source,
    tags: Array.isArray(s.tags) ? s.tags : [],
    azureServices: Array.isArray(s.azureServices) ? s.azureServices : [],
    id: s.id,
    languages: Array.isArray(s.languages) ? s.languages : [],
  }));
  
  // Filter samples to only those where azureServices contains 'functions'
  let filteredSamples = samples.filter(s => Array.isArray(s.azureServices) && s.azureServices.includes("functions"));
  
  // Apply additional filters if provided
  if (query) {
    const queryLower = query.toLowerCase();
    filteredSamples = filteredSamples.filter(sample => 
      sample.title.toLowerCase().includes(queryLower) ||
      sample.description.toLowerCase().includes(queryLower) ||
      sample.tags.some(tag => tag.toLowerCase().includes(queryLower))
    );
  }
  
  if (language) {
    const languageLower = language.toLowerCase();
    filteredSamples = filteredSamples.filter(sample => 
      sample.languages.some(lang => lang.toLowerCase().includes(languageLower))
    );
  }
  
  if (category) {
    const categoryLower = category.toLowerCase();
    filteredSamples = filteredSamples.filter(sample => 
      sample.tags.some(tag => tag.toLowerCase().includes(categoryLower)) ||
      sample.azureServices.some(service => service.toLowerCase().includes(categoryLower))
    );
  }
  
  const gallery: Gallery = { samples: filteredSamples };
  return gallery;
}

// Function to create and configure the MCP server (stateless approach from official example)
const getServer = () => {
  const server = new McpServer({
    name: "azure-functions-sample-finder",
    version: "1.0.0",
  }, { 
    capabilities: { 
      logging: {} 
    } 
  });

  // Register the Azure Functions samples tool
  server.tool(
    "get_azure_functions_samples",
    "Search and retrieve Azure Functions samples from the Awesome AZD Gallery",
    GET_AZURE_FUNCTIONS_SAMPLES_SCHEMA,
    async ({ query, language, category }) => {
      // Convert empty strings to undefined for filtering
      const cleanQuery = query && query.trim() ? query.trim() : undefined;
      const cleanLanguage = language && language.trim() ? language.trim() : undefined;
      const cleanCategory = category && category.trim() ? category.trim() : undefined;
      
      const gallery = await fetchAwesomeAzdGallery(cleanQuery, cleanLanguage, cleanCategory);
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              query: cleanQuery || "all",
              language: cleanLanguage || "all",
              category: cleanCategory || "all",
              count: gallery.samples.length,
              samples: gallery.samples
            }, null, 2)
          }
        ]
      };
    }
  );

  return server;
};

// Create Express app following the official Anthropic pattern
const app = express();
app.use(express.json());

// Handle POST requests to /mcp (main MCP endpoint) - Official Anthropic pattern
app.post('/mcp', async (req: Request, res: Response) => {
  const server = getServer();
  try {
    const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('close', () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

// Handle GET requests to /mcp (method not allowed) - Official Anthropic pattern
app.get('/mcp', async (_req: Request, res: Response) => {
  res.writeHead(405).end(JSON.stringify({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed."
    },
    id: null
  }));
});

// Handle DELETE requests to /mcp (method not allowed) - Official Anthropic pattern
app.delete('/mcp', async (_req: Request, res: Response) => {
  res.writeHead(405).end(JSON.stringify({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed."
    },
    id: null
  }));
});

// Start the server - Official Anthropic pattern
const PORT = 8080;
app.listen(PORT, () => {
  console.log(`MCP Azure Functions Sample Finder Server listening on port ${PORT}`);
});

// Handle server shutdown - Official Anthropic pattern
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  process.exit(0);
});
