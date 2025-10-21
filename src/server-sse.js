#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { retailClient } from './retailClient.js';
import { config } from './config.js';

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Create MCP server instance
function createMCPServer() {
  const server = new Server(
    {
      name: 'cisco-mcp-retail',
      version: '1.0.0',
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  // Define tools for retail customer management
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'get_customer',
          description: 'Get a retail customer by phone number or order ID. Returns customer details including delivery status, product info, and contact information.',
          inputSchema: {
            type: 'object',
            properties: {
              number: {
                type: 'string',
                description: 'Phone number (e.g., +13033249089) or order ID (e.g., ORD-001) to look up',
              },
            },
            required: ['number'],
          },
        },
        {
          name: 'get_all_customers',
          description: 'Get all retail customers with pagination support. Returns a list of customers with their details.',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Number of customers to return (default: 100)',
                default: 100,
              },
              skip: {
                type: 'number',
                description: 'Number of customers to skip for pagination (default: 0)',
                default: 0,
              },
            },
          },
        },
        {
          name: 'create_customer',
          description: 'Create a new retail customer record with order and delivery information.',
          inputSchema: {
            type: 'object',
            properties: {
              orderId: {
                type: 'string',
                description: 'Unique order identifier',
              },
              phoneNumber: {
                type: 'string',
                description: 'Customer phone number (e.g., +13033249089)',
              },
              fName: {
                type: 'string',
                description: 'Customer first name',
              },
              lName: {
                type: 'string',
                description: 'Customer last name',
              },
              productName: {
                type: 'string',
                description: 'Name of the product ordered',
              },
              deliveryAddress: {
                type: 'string',
                description: 'Full delivery address',
              },
              deliveryETA: {
                type: 'string',
                description: 'Estimated delivery time/date',
              },
              deliveryStatus: {
                type: 'string',
                description: 'Current delivery status (e.g., Processing, In Transit, Delivered)',
              },
              safeLocation: {
                type: 'string',
                description: 'Safe delivery location preference',
              },
              timeZone: {
                type: 'string',
                description: 'Customer timezone (e.g., America/New_York, America/Los_Angeles)',
              },
              consentSMS: {
                type: 'boolean',
                description: 'SMS consent for notifications (default: true)',
                default: true,
              },
              altDate1: {
                type: 'string',
                description: 'Alternative delivery date option 1',
              },
              altDate2: {
                type: 'string',
                description: 'Alternative delivery date option 2',
              },
            },
            required: ['orderId', 'phoneNumber', 'fName', 'lName'],
          },
        },
        {
          name: 'update_customer',
          description: 'Update an existing retail customer record. Can update delivery status, address, contact info, etc.',
          inputSchema: {
            type: 'object',
            properties: {
              number: {
                type: 'string',
                description: 'Phone number or order ID of customer to update',
              },
              updates: {
                type: 'object',
                description: 'Fields to update (can include deliveryStatus, deliveryAddress, deliveryETA, safeLocation, altDate1, altDate2, etc.)',
                properties: {
                  deliveryStatus: { type: 'string' },
                  deliveryAddress: { type: 'string' },
                  deliveryETA: { type: 'string' },
                  safeLocation: { type: 'string' },
                  timeZone: { type: 'string' },
                  altDate1: { type: 'string' },
                  altDate2: { type: 'string' },
                  consentSMS: { type: 'boolean' },
                  productName: { type: 'string' },
                  fName: { type: 'string' },
                  lName: { type: 'string' },
                },
              },
            },
            required: ['number', 'updates'],
          },
        },
        {
          name: 'delete_customer',
          description: 'Delete a retail customer record by phone number or order ID.',
          inputSchema: {
            type: 'object',
            properties: {
              number: {
                type: 'string',
                description: 'Phone number or order ID of customer to delete',
              },
            },
            required: ['number'],
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
        case 'get_customer': {
          const result = await retailClient.getCustomer(args.number);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'get_all_customers': {
          const limit = args.limit || 100;
          const skip = args.skip || 0;
          const result = await retailClient.getAllCustomers(limit, skip);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'create_customer': {
          const result = await retailClient.createCustomer(args);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'update_customer': {
          const result = await retailClient.updateCustomer(args.number, args.updates);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'delete_customer': {
          const result = await retailClient.deleteCustomer(args.number);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
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
              details: 'Failed to execute API request. Check if the API Gateway is running and authentication is configured correctly.',
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
          uri: 'retail://customers/all',
          mimeType: 'application/json',
          name: 'All Retail Customers',
          description: 'Complete list of all retail customers (first 100)',
        },
        {
          uri: 'retail://config',
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
        case 'retail://customers/all': {
          const result = await retailClient.getAllCustomers(100, 0);
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

        case 'retail://config': {
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({
                  baseUrl: config.apiBaseUrl,
                  authMode: config.authMode,
                  hasApiKey: !!config.apiKeyRetail,
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
              details: 'Failed to fetch resource. Check if the API Gateway is running.',
            }, null, 2),
          },
        ],
      };
    }
  });

  return server;
}

// Health check endpoint
app.get(`${config.serverPath}/health`, (req, res) => {
  res.json({
    status: 'healthy',
    service: 'cisco-mcp-retail',
    version: '1.0.0',
    apiBaseUrl: config.apiBaseUrl,
    timestamp: new Date().toISOString(),
  });
});

// SSE endpoint for MCP
app.get(`${config.serverPath}/sse`, async (req, res) => {
  console.log('New SSE connection established');

  const transport = new SSEServerTransport(`${config.serverPath}/messages`, res);
  const server = createMCPServer();

  await server.connect(transport);

  // Handle client disconnect
  req.on('close', () => {
    console.log('SSE connection closed');
  });
});

// POST endpoint for messages (required by SSE transport)
app.post(`${config.serverPath}/messages`, async (req, res) => {
  // This endpoint is handled by the SSE transport internally
  res.status(200).end();
});

// Root endpoint with server info
app.get('/', (req, res) => {
  res.json({
    name: 'Cisco MCP Retail Server',
    version: '1.0.0',
    transport: 'SSE',
    endpoints: {
      health: `${config.serverPath}/health`,
      sse: `${config.serverPath}/sse`,
      messages: `${config.serverPath}/messages`,
    },
    documentation: 'See README.md for usage instructions',
  });
});

// Start the server
const PORT = config.serverPort;
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 Cisco MCP Retail Server (SSE Transport)');
  console.log('='.repeat(60));
  console.log(`📡 Server listening on port: ${PORT}`);
  console.log(`🔗 SSE Endpoint: http://localhost:${PORT}${config.serverPath}/sse`);
  console.log(`❤️  Health Check: http://localhost:${PORT}${config.serverPath}/health`);
  console.log(`📨 Messages: http://localhost:${PORT}${config.serverPath}/messages`);
  console.log('='.repeat(60));
  console.log(`🌐 API Gateway: ${config.apiBaseUrl}`);
  console.log(`🔐 Auth Mode: ${config.authMode}`);
  console.log('='.repeat(60));
  console.log('✅ Server ready for connections from WxConnect AI Agent');
  console.log('');
});
