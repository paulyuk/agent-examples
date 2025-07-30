import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import fetch from "node-fetch";
import express, { Request, Response } from 'express';

// Tool schemas using Zod (matching official MCP SDK pattern)
const GET_AZURE_FUNCTIONS_SAMPLES_SCHEMA = {
  query: z.string().describe("Search query for Azure Functions samples").optional(),
  language: z.string().describe("Programming language filter (e.g., 'dotnetCsharp', 'python', 'javascript', 'typescript', 'nodejs', 'java', 'powershell')").optional(),
  category: z.string().describe("Category filter (e.g., 'http', 'timer', 'blob', 'database', 'ai', 'event')").optional()
};

const GET_GITHUB_SOURCE_CODE_SCHEMA = {
  githubUrl: z.string().describe("GitHub repository URL (e.g., https://github.com/owner/repo)"),
  filePath: z.string().describe("Path to the source file in the repository (optional)").optional(),
  branch: z.string().describe("Git branch or commit hash (defaults to 'main')").optional()
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

// Helper to fetch source code from GitHub repository
async function fetchGitHubSourceCode(githubUrl: string, filePath?: string, branch?: string): Promise<{ files: Array<{ path: string; content: string; language: string }> }> {
  try {
    // Parse GitHub URL to extract owner and repo
    const urlMatch = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!urlMatch) {
      throw new Error("Invalid GitHub URL format. Expected: https://github.com/owner/repo");
    }
    
    const [, owner, repoName] = urlMatch;
    const repo = repoName.replace(/\.git$/, ''); // Remove .git suffix if present
    const gitBranch = branch || 'main';
    
    const results: Array<{ path: string; content: string; language: string }> = [];
    
    if (filePath) {
      // Fetch specific file
      const fileUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${gitBranch}/${filePath}`;
      const response = await fetch(fileUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} - ${response.statusText}`);
      }
      
      const content = await response.text();
      const language = getLanguageFromExtension(filePath);
      
      results.push({
        path: filePath,
        content: content,
        language: language
      });
    } else {
      // Fetch directory structure and look for Azure Functions files
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents?ref=${gitBranch}`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch repository contents: ${response.status} - ${response.statusText}`);
      }
      
      const contents = await response.json() as any[];
      
      // Look for common Azure Functions files
      const functionFiles = contents.filter((item: any) => {
        const name = item.name.toLowerCase();
        return item.type === 'file' && (
          name.includes('function') ||
          name === 'host.json' ||
          name === 'local.settings.json' ||
          name.endsWith('.cs') ||
          name.endsWith('.js') ||
          name.endsWith('.ts') ||
          name.endsWith('.py') ||
          name.endsWith('.json')
        );
      });
      
      // Fetch content for each relevant file (limit to 5 files to avoid overwhelming response)
      const filesToFetch = functionFiles.slice(0, 5);
      
      for (const file of filesToFetch) {
        try {
          const fileResponse = await fetch(file.download_url);
          if (fileResponse.ok) {
            const content = await fileResponse.text();
            const language = getLanguageFromExtension(file.name);
            
            results.push({
              path: file.name,
              content: content.length > 2000 ? content.substring(0, 2000) + '\n... (truncated)' : content,
              language: language
            });
          }
        } catch (error) {
          console.error(`Error fetching file ${file.name}:`, error);
        }
      }
    }
    
    return { files: results };
    
  } catch (error) {
    console.error('Error fetching GitHub source code:', error);
    throw error;
  }
}

// Helper to determine programming language from file extension
function getLanguageFromExtension(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'js': return 'javascript';
    case 'ts': return 'typescript';
    case 'py': return 'python';
    case 'cs': return 'csharp';
    case 'java': return 'java';
    case 'json': return 'json';
    case 'md': return 'markdown';
    case 'yml':
    case 'yaml': return 'yaml';
    case 'xml': return 'xml';
    case 'html': return 'html';
    case 'css': return 'css';
    default: return 'text';
  }
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

  // Register the GitHub source code fetcher tool
  server.tool(
    "get_github_source_code",
    "Fetch source code from a GitHub repository, particularly useful for viewing Azure Functions code",
    GET_GITHUB_SOURCE_CODE_SCHEMA,
    async ({ githubUrl, filePath, branch }) => {
      try {
        const result = await fetchGitHubSourceCode(githubUrl, filePath, branch);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                repository: githubUrl,
                branch: branch || "main",
                filePath: filePath || "auto-detected",
                filesCount: result.files.length,
                files: result.files
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to fetch GitHub source code",
                message: error instanceof Error ? error.message : String(error),
                repository: githubUrl,
                filePath: filePath || "auto-detected"
              }, null, 2)
            }
          ]
        };
      }
    }
  );

  // Create a resource for Azure Functions Gallery Samples
  server.resource(
    'azure-functions-gallery',
    'https://azure.github.io/awesome-azd/templates.json',
    { mimeType: 'application/json' },
    async (): Promise<ReadResourceResult> => {
      try {
        const gallery = await fetchAwesomeAzdGallery();
        return {
          contents: [
            {
              uri: 'https://azure.github.io/awesome-azd/templates.json',
              text: JSON.stringify({
                description: "Azure Functions samples from the Awesome AZD Gallery",
                lastUpdated: new Date().toISOString(),
                totalSamples: gallery.samples.length,
                samples: gallery.samples
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: 'https://azure.github.io/awesome-azd/templates.json',
              text: JSON.stringify({
                error: "Failed to fetch Azure Functions gallery",
                message: error instanceof Error ? error.message : String(error),
                lastAttempted: new Date().toISOString()
              }, null, 2),
            },
          ],
        };
      }
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
const PORT = process.env.MCP_SERVER_PORT ? parseInt(process.env.MCP_SERVER_PORT) : 3000;
app.listen(PORT, () => {
  console.log(`MCP Azure Functions Sample Finder Server listening on port ${PORT}`);
});

// Handle server shutdown - Official Anthropic pattern
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  process.exit(0);
});
