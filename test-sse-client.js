#!/usr/bin/env node

/**
 * Simple test client for SSE MCP server
 * Tests the connection and lists available tools
 */

const SSE_URL = 'http://localhost:1013/CiscoMCPPods/sse';

async function testSSEConnection() {
  console.log('Testing SSE connection to:', SSE_URL);
  console.log('');

  try {
    const response = await fetch(SSE_URL, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });

    console.log('✅ Connection successful!');
    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers));
    console.log('');
    console.log('SSE stream is open. Press Ctrl+C to exit.');
    console.log('');

    // Read the SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      console.log('Received:', chunk);
    }
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

testSSEConnection();
