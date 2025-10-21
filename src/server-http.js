#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { podsClient } from './podsClient.js';
import { config } from './config.js';

// In-memory event store for resumability
class InMemoryEventStore {
  constructor() {
    this.events = new Map();
  }

  async getEventsAfter(sessionId, afterEventId) {
    const sessionEvents = this.events.get(sessionId) || [];
    if (!afterEventId) {
      return sessionEvents;
    }
    const afterIndex = sessionEvents.findIndex(e => e.id === afterEventId);
    return afterIndex === -1 ? sessionEvents : sessionEvents.slice(afterIndex + 1);
  }

  async addEvent(sessionId, event) {
    if (!this.events.has(sessionId)) {
      this.events.set(sessionId, []);
    }
    this.events.get(sessionId).push(event);
  }

  async clearSession(sessionId) {
    this.events.delete(sessionId);
  }
}

// Create Express app
const app = express();
app.use(express.json());
app.use(cors({
  origin: '*',
  exposedHeaders: ['Mcp-Session-Id']
}));

// Authentication middleware
function authenticateApiKey(req, res, next) {
  // Skip auth for health endpoint
  if (req.path === `${config.serverPath}/health` || req.path === '/') {
    return next();
  }

  // If no API key configured, allow all requests (backward compatibility)
  if (!config.mcpApiKey) {
    return next();
  }

  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Unauthorized: Missing X-API-Key header',
      },
      id: null,
    });
  }

  if (apiKey !== config.mcpApiKey) {
    return res.status(403).json({
      jsonrpc: '2.0',
      error: {
        code: -32002,
        message: 'Forbidden: Invalid API key',
      },
      id: null,
    });
  }

  next();
}

// Apply authentication to all MCP endpoints
app.use(authenticateApiKey);

// Map to store transports by session ID
const transports = {};

// Create MCP server instance
function createMCPServer() {
  const server = new Server(
    {
      name: 'cisco-mcp-pods',
      version: '1.0.0',
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  // Define tools for pod management
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'get_pod_keyword',
          description: 'Get the pod keyword/password record. Returns the current keyword configuration.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'update_pod_keyword',
          description: 'Update the pod keyword/password record with a new value.',
          inputSchema: {
            type: 'object',
            properties: {
              keyword: { type: 'string', description: 'New keyword/password value (e.g., Cisco1234!)' },
            },
            required: ['keyword'],
          },
        },
        {
          name: 'get_all_pods',
          description: 'Get all pods from a specific collection. Works with any collection name like ciscolivepods, coelabpods, testpods, etc.',
          inputSchema: {
            type: 'object',
            properties: {
              collection: { type: 'string', description: 'Collection name (e.g., ciscolivepods, coelabpods)' },
            },
            required: ['collection'],
          },
        },
        {
          name: 'get_pod_by_number',
          description: 'Get a specific pod by its number from a collection.',
          inputSchema: {
            type: 'object',
            properties: {
              collection: { type: 'string', description: 'Collection name' },
              number: { type: 'number', description: 'Pod number' },
            },
            required: ['collection', 'number'],
          },
        },
        {
          name: 'create_pod',
          description: 'Create a new pod in a collection.',
          inputSchema: {
            type: 'object',
            properties: {
              collection: { type: 'string', description: 'Collection name' },
              Number: { type: 'number', description: 'Unique pod number' },
              POD: { type: 'string', description: 'Pod name' },
              AdminLogin: { type: 'string', description: 'Admin email login' },
              AgentLogin: { type: 'string', description: 'Agent email login' },
              SupervisorLogin: { type: 'string', description: 'Supervisor email login' },
              Password: { type: 'string', description: 'Pod password' },
              TelephoneNumber: { type: 'number', description: 'Telephone number' },
              SMSNumber: { type: 'number', description: 'SMS number' },
              Status: { type: 'string', description: 'Pod status' },
              CRMLogin: { type: 'string', description: 'CRM username' },
              CRMPassword: { type: 'string', description: 'CRM password' },
              "Test Date": { type: 'string', description: 'Test date (optional)' },
              "Test Status": { type: 'string', description: 'Test status (optional)' },
            },
            required: ['collection', 'Number', 'POD', 'AdminLogin', 'AgentLogin', 'SupervisorLogin', 'Password', 'TelephoneNumber', 'SMSNumber', 'Status', 'CRMLogin', 'CRMPassword'],
          },
        },
        {
          name: 'update_pod',
          description: 'Update an existing pod in a collection.',
          inputSchema: {
            type: 'object',
            properties: {
              collection: { type: 'string', description: 'Collection name' },
              number: { type: 'number', description: 'Pod number' },
              updates: {
                type: 'object',
                description: 'Fields to update',
                properties: {
                  Status: { type: 'string' },
                  "Test Date": { type: 'string' },
                  "Test Status": { type: 'string' },
                  Password: { type: 'string' },
                  CRMPassword: { type: 'string' },
                },
              },
            },
            required: ['collection', 'number', 'updates'],
          },
        },
        {
          name: 'delete_pod',
          description: 'Delete a pod from a collection.',
          inputSchema: {
            type: 'object',
            properties: {
              collection: { type: 'string', description: 'Collection name' },
              number: { type: 'number', description: 'Pod number' },
            },
            required: ['collection', 'number'],
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'get_pod_keyword': {
          const result = await podsClient.getPodKeyword();
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        }
        case 'update_pod_keyword': {
          const result = await podsClient.updatePodKeyword(args.keyword);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        }
        case 'get_all_pods': {
          const result = await podsClient.getAllPods(args.collection);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        }
        case 'get_pod_by_number': {
          const result = await podsClient.getPodByNumber(args.collection, args.number);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        }
        case 'create_pod': {
          const { collection, ...podData } = args;
          const result = await podsClient.createPod(collection, podData);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        }
        case 'update_pod': {
          const result = await podsClient.updatePod(args.collection, args.number, args.updates);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        }
        case 'delete_pod': {
          const result = await podsClient.deletePod(args.collection, args.number);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        }
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error.message,
              details: 'Failed to execute API request.',
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  // Define resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'pods://keyword',
          mimeType: 'application/json',
          name: 'Pod Keyword',
          description: 'Current pod keyword/password configuration',
        },
        {
          uri: 'pods://config',
          mimeType: 'application/json',
          name: 'API Configuration',
          description: 'Current API Gateway configuration and connection status',
        },
      ],
    };
  });

  // Handle resource reads
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    try {
      switch (uri) {
        case 'pods://keyword': {
          const result = await podsClient.getPodKeyword();
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }
        case 'pods://config': {
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({
                  baseUrl: config.apiBaseUrl,
                  authMode: config.authMode,
                  hasApiKey: !!config.apiKeyPods,
                  hasJwtToken: !!config.jwtToken,
                  status: 'Connected',
                }, null, 2),
              },
            ],
          };
        }
        default:
          throw new Error(`Unknown resource: ${uri}`);
      }
    } catch (error) {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              error: error.message,
              details: 'Failed to fetch resource.',
            }, null, 2),
          },
        ],
      };
    }
  });

  return server;
}

// Helper to check if request is an initialize request
function isInitializeRequest(body) {
  return body && body.method === 'initialize';
}

// Health check endpoint
app.get(`${config.serverPath}/health`, (req, res) => {
  res.json({
    status: 'healthy',
    service: 'cisco-mcp-pods',
    version: '1.0.0',
    transport: 'streamable-http',
    apiBaseUrl: config.apiBaseUrl,
    timestamp: new Date().toISOString(),
  });
});

// MCP POST endpoint for requests
app.post(`${config.serverPath}/mcp`, async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];

  if (sessionId) {
    console.log(`Received MCP request for session: ${sessionId}`);
  }

  try {
    let transport;

    if (sessionId && transports[sessionId]) {
      // Reuse existing transport
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request
      const eventStore = new InMemoryEventStore();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        eventStore,
        enableJsonResponse: true, // Return JSON instead of SSE streams for better compatibility
        onsessioninitialized: (sid) => {
          console.log(`Session initialized with ID: ${sid}`);
          transports[sid] = transport;
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          console.log(`Transport closed for session ${sid}`);
          delete transports[sid];
        }
      };

      const server = createMCPServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
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

// MCP GET endpoint for SSE streams
app.get(`${config.serverPath}/mcp`, async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];

  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  const lastEventId = req.headers['last-event-id'];
  if (lastEventId) {
    console.log(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
  } else {
    console.log(`Establishing new SSE stream for session ${sessionId}`);
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
});

// MCP DELETE endpoint for session termination
app.delete(`${config.serverPath}/mcp`, async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];

  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  console.log(`Received session termination request for session ${sessionId}`);

  try {
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error('Error handling session termination:', error);
    if (!res.headersSent) {
      res.status(500).send('Error processing session termination');
    }
  }
});

// Root endpoint with server info
app.get('/', (req, res) => {
  res.json({
    name: 'Cisco MCP Pods Server',
    version: '1.0.0',
    transport: 'streamable-http',
    endpoints: {
      health: `${config.serverPath}/health`,
      mcp: `${config.serverPath}/mcp`,
    },
    documentation: 'See README.md for usage instructions',
  });
});

// Start the server
const PORT = config.serverPort;
app.listen(PORT, (error) => {
  if (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
  console.log('='.repeat(60));
  console.log('🚀 Cisco MCP Pods Server (Streamable HTTP Transport)');
  console.log('='.repeat(60));
  console.log(`📡 Server listening on port: ${PORT}`);
  console.log(`🔗 MCP Endpoint: http://localhost:${PORT}${config.serverPath}/mcp`);
  console.log(`❤️  Health Check: http://localhost:${PORT}${config.serverPath}/health`);
  console.log('='.repeat(60));
  console.log(`🌐 API Gateway: ${config.apiBaseUrl}`);
  console.log(`🔐 Auth Mode: ${config.authMode}`);
  console.log('='.repeat(60));
  console.log('✅ Server ready for Streamable HTTP connections');
  console.log('');
});

// Handle server shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  for (const sessionId in transports) {
    try {
      console.log(`Closing transport for session ${sessionId}`);
      await transports[sessionId].close();
      delete transports[sessionId];
    } catch (error) {
      console.error(`Error closing transport for session ${sessionId}:`, error);
    }
  }
  console.log('Server shutdown complete');
  process.exit(0);
});
