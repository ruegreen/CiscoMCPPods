#!/usr/bin/env node

/**
 * MCP SSE Test Client
 * Tests the full MCP protocol over SSE transport
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const SSE_URL = 'http://localhost:1013/CiscoMCPPods';

async function testMCPServer() {
  console.log('🔌 Connecting to MCP Server via SSE...');
  console.log('URL:', SSE_URL);
  console.log('');

  try {
    // Create SSE transport
    const transport = new SSEClientTransport(new URL(SSE_URL + '/sse'));

    // Create MCP client
    const client = new Client(
      {
        name: 'test-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    // Connect to server
    await client.connect(transport);
    console.log('✅ Connected to MCP server!');
    console.log('');

    // List available tools
    console.log('📋 Listing available tools...');
    const tools = await client.listTools();
    console.log('Tools:', JSON.stringify(tools, null, 2));
    console.log('');

    // List available resources
    console.log('📚 Listing available resources...');
    const resources = await client.listResources();
    console.log('Resources:', JSON.stringify(resources, null, 2));
    console.log('');

    // Test calling a tool
    console.log('🔧 Testing get_all_customers tool...');
    const result = await client.callTool({
      name: 'get_all_customers',
      arguments: {
        limit: 5,
        skip: 0,
      },
    });
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('');

    console.log('✅ All tests passed!');
    console.log('');
    console.log('🎉 Your MCP server is working correctly over SSE!');

    // Close connection
    await client.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testMCPServer();
