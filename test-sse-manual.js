#!/usr/bin/env node

/**
 * Manual SSE Test - sends raw MCP protocol messages
 */

const BASE_URL = 'http://localhost:1013/CiscoMCPPods';

async function testSSE() {
  console.log('Testing MCP SSE Server');
  console.log('='.repeat(50));
  console.log('');

  // Step 1: Test health endpoint
  console.log('1️⃣  Testing health endpoint...');
  try {
    const healthResponse = await fetch(`${BASE_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health:', JSON.stringify(healthData, null, 2));
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return;
  }
  console.log('');

  // Step 2: Send initialize message to messages endpoint
  console.log('2️⃣  Sending initialize message...');
  try {
    const initResponse = await fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
        id: 0,
      }),
    });

    console.log('Response status:', initResponse.status);
    const initData = await initResponse.text();
    console.log('Response:', initData);
  } catch (error) {
    console.error('❌ Initialize failed:', error.message);
    return;
  }
  console.log('');

  // Step 3: Send tools/list request
  console.log('3️⃣  Requesting tools list...');
  try {
    const toolsResponse = await fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 1,
      }),
    });

    const toolsData = await toolsResponse.text();
    console.log('Tools response:', toolsData);
  } catch (error) {
    console.error('❌ Tools list failed:', error.message);
  }
  console.log('');

  console.log('='.repeat(50));
  console.log('Test completed!');
}

testSSE();
