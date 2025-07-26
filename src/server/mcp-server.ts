import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import express from "express";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import fetch from "node-fetch";

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


// --- Streamable HTTP Transport with Express and session management ---
const app = express();
app.use(express.json());

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

app.post('/mcp', async (req, res) => {
  console.log('[MCP] Incoming POST /mcp headers:', req.headers);
  console.log('[MCP] Incoming POST /mcp body:', req.body);
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  let transport: StreamableHTTPServerTransport;

  if (sessionId && transports[sessionId]) {
    transport = transports[sessionId];
  } else if (!sessionId) {
    // New initialization request
    let newSessionId: string | undefined;
    // Generate session ID and set header synchronously before any async/response work
    newSessionId = randomUUID();
    res.setHeader('mcp-session-id', newSessionId);
    console.log('[MCP] Generated new sessionId and set header:', newSessionId);
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => newSessionId!,
      onsessioninitialized: (sid) => {
        // Already set below, but keep for robustness
        transports[sid] = transport;
      },
      enableDnsRebindingProtection: true,
      allowedHosts: ['127.0.0.1', 'localhost', 'localhost:8080', '127.0.0.1:8080'],
    });
    // Store the transport immediately so it is available for the next request
    transports[newSessionId] = transport;
    transport.onclose = () => {
      if (transport.sessionId) {
        delete transports[transport.sessionId];
      }
    };
    await server.connect(transport);
    // Log outgoing headers after handleRequest
    res.on('finish', () => {
      console.log('[MCP] Response headers for session init:', res.getHeaders());
    });
  } else {
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
      id: null,
    });
    return;
  }

  await transport.handleRequest(req, res, req.body);
});

const handleSessionRequest = async (req: express.Request, res: express.Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }
  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
};

app.get('/mcp', handleSessionRequest);
app.delete('/mcp', handleSessionRequest);

const PORT = 8080;
app.listen(PORT, () => {
  console.log(`MCP server with Awesome AZD Gallery is running (streamable HTTP) on http://localhost:${PORT}/mcp ...`);
});
