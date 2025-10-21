#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { podsClient } from './podsClient.js';
import { config } from './config.js';

// Create server instance
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
            keyword: {
              type: 'string',
              description: 'New keyword/password value (e.g., Cisco1234!)',
            },
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
            collection: {
              type: 'string',
              description: 'Collection name (e.g., ciscolivepods, coelabpods, testpods)',
            },
          },
          required: ['collection'],
        },
      },
      {
        name: 'get_pod_by_number',
        description: 'Get a specific pod by its number from a collection. Returns pod details including login credentials, phone numbers, and status.',
        inputSchema: {
          type: 'object',
          properties: {
            collection: {
              type: 'string',
              description: 'Collection name (e.g., ciscolivepods)',
            },
            number: {
              type: 'number',
              description: 'Pod number (e.g., 1, 2, 3)',
            },
          },
          required: ['collection', 'number'],
        },
      },
      {
        name: 'create_pod',
        description: 'Create a new pod in a collection. All required fields must be provided.',
        inputSchema: {
          type: 'object',
          properties: {
            collection: {
              type: 'string',
              description: 'Collection name to add the pod to',
            },
            Number: {
              type: 'number',
              description: 'Unique pod number',
            },
            POD: {
              type: 'string',
              description: 'Pod name (e.g., Pod1, TestPod1)',
            },
            AdminLogin: {
              type: 'string',
              description: 'Admin email login (e.g., admin1@coelab.wbx.ai)',
            },
            AgentLogin: {
              type: 'string',
              description: 'Agent email login',
            },
            SupervisorLogin: {
              type: 'string',
              description: 'Supervisor email login',
            },
            Password: {
              type: 'string',
              description: 'Pod password',
            },
            TelephoneNumber: {
              type: 'number',
              description: 'Telephone number (e.g., 16692845001)',
            },
            SMSNumber: {
              type: 'number',
              description: 'SMS number (e.g., 14085386001)',
            },
            Status: {
              type: 'string',
              description: 'Pod status (e.g., unassigned, assigned)',
            },
            CRMLogin: {
              type: 'string',
              description: 'CRM username',
            },
            CRMPassword: {
              type: 'string',
              description: 'CRM password',
            },
            TestDate: {
              type: 'string',
              description: 'Test date (optional)',
            },
            TestStatus: {
              type: 'string',
              description: 'Test status (optional)',
            },
          },
          required: ['collection', 'Number', 'POD', 'AdminLogin', 'AgentLogin', 'SupervisorLogin', 'Password', 'TelephoneNumber', 'SMSNumber', 'Status', 'CRMLogin', 'CRMPassword'],
        },
      },
      {
        name: 'update_pod',
        description: 'Update an existing pod in a collection. Can update status, credentials, test information, etc.',
        inputSchema: {
          type: 'object',
          properties: {
            collection: {
              type: 'string',
              description: 'Collection name',
            },
            number: {
              type: 'number',
              description: 'Pod number to update',
            },
            updates: {
              type: 'object',
              description: 'Fields to update',
              properties: {
                Status: { type: 'string' },
                TestDate: { type: 'string' },
                TestStatus: { type: 'string' },
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
        description: 'Delete a pod from a collection by its number.',
        inputSchema: {
          type: 'object',
          properties: {
            collection: {
              type: 'string',
              description: 'Collection name',
            },
            number: {
              type: 'number',
              description: 'Pod number to delete',
            },
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
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'update_pod_keyword': {
        const result = await podsClient.updatePodKeyword(args.keyword);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'get_all_pods': {
        const result = await podsClient.getAllPods(args.collection);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'get_pod_by_number': {
        const result = await podsClient.getPodByNumber(args.collection, args.number);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'create_pod': {
        const { collection, ...podData } = args;
        const result = await podsClient.createPod(collection, podData);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'update_pod': {
        const result = await podsClient.updatePod(args.collection, args.number, args.updates);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'delete_pod': {
        const result = await podsClient.deletePod(args.collection, args.number);
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
            details: 'Failed to fetch resource. Check if the API Gateway is running.',
          }, null, 2),
        },
      ],
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Cisco MCP Pods Server running');
  console.error(`API Base URL: ${config.apiBaseUrl}`);
  console.error(`Auth Mode: ${config.authMode}`);
  console.error('Ready to handle requests...');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
