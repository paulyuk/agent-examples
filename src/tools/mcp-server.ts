import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import fetch from "node-fetch";
import crypto from "crypto";

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
async function fetchAwesomeAzdGallery(): Promise<Gallery> {
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
  const filteredSamples = samples.filter(s => Array.isArray(s.azureServices) && s.azureServices.includes("functions"));
  const gallery: Gallery = { samples: filteredSamples };
  return gallery;
}

const server = new McpServer({
  name: "azure-functions-sample-finder",
  version: "1.0.0"
});

// Register a resource for the Awesome AZD Gallery
server.registerResource(
  "awesome-azd-gallery-functions",
  "azd://gallery",
  {
    title: "Awesome AZD Gallery",
    description: "Official Microsoft Azure Developer (AZD) sample gallery filtered by Azure Functions"
  },
  async () => {
    const gallery = await fetchAwesomeAzdGallery();
    return {
      contents: [{
        uri: "azd://gallery",
        text: JSON.stringify(gallery, null, 2),
        mimeType: "application/json"
      }]
    };
  }
);

// Register a tool to search/filter the gallery
server.registerTool(
  "find-azfunc-samples",
  {
    title: "Find Azure Functions Samples",
    description: "Search the Awesome AZD Gallery for Azure Functions samples by query, author, or Azure service.",
    inputSchema: {
      query: z.string().optional(),
      question: z.string().optional(),
      context: z.string().optional(),
      author: z.string().optional(),
      azureService: z.string().optional()
    }
  },
  async (params: any) => {
    // Require at least one of query or question
    if (!params.query && !params.question) {
      return {
        content: [{
          type: "text",
          text: "Error: At least one of 'query' or 'question' is required."
        }]
      };
    }
    const query = params.query || params.question || "";
    const author = params.author;
    const azureService = params.azureService;
    const gallery: Gallery = await fetchAwesomeAzdGallery();
    const results = gallery.samples.filter((s: GallerySample) => {
      const matchesQuery = !query || s.title.toLowerCase().includes(query.toLowerCase()) || (s.description && s.description.toLowerCase().includes(query.toLowerCase()));
      const matchesAuthor = !author || (s.author && s.author.toLowerCase().includes(author.toLowerCase()));
      const matchesService = !azureService || (s.azureServices && s.azureServices.map(v => v.toLowerCase()).includes(azureService.toLowerCase()));
      return matchesQuery && matchesAuthor && matchesService;
    });
    return {
      content: [{
        type: "text",
        text: results.length
          ? results.map((s: GallerySample) => `* ${s.title} (${s.author || "unknown"})\n  ${s.description || ""}\n  Source: ${s.source}\n  Preview: ${s.preview}\n  Azure Services: ${s.azureServices.join(", ")}`).join("\n\n")
          : "No matching samples found."
      }]
    };
  }
);


// --- Direct HTTP Server with StreamableHTTPServerTransport ---
import { createServer } from 'http';

const PORT = 8080;

async function startServer() {
  console.log('[MCP] Creating StreamableHTTPServerTransport...');
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    enableDnsRebindingProtection: true,
    allowedHosts: ['127.0.0.1', 'localhost', 'localhost:8080', '127.0.0.1:8080'],
  });
  
  console.log('[MCP] Connecting server to transport...');
  await server.connect(transport);
  console.log('[MCP] Server connected successfully');
  
  // Create HTTP server that delegates to the transport
  const httpServer = createServer(async (req, res) => {
    console.log('[MCP] Incoming', req.method, req.url, 'headers:', req.headers);
    
    // Only handle requests to /mcp path
    if (req.url !== '/mcp') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found. Use /mcp endpoint.' }));
      return;
    }
    
    console.log('[MCP] Delegating to transport.handleRequest...');
    try {
      await transport.handleRequest(req, res);
      console.log('[MCP] transport.handleRequest completed successfully');
    } catch (error) {
      console.error('[MCP] Error in transport.handleRequest:', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error during request handling' },
          id: null,
        }));
      }
    }
  });
  
  httpServer.listen(PORT, () => {
    console.log(`MCP server with Awesome AZD Gallery is running (streamable HTTP) on http://localhost:${PORT}/mcp ...`);
  });
}

// Start the server
startServer().catch(error => {
  console.error('[MCP] Failed to start server:', error);
  process.exit(1);
});
