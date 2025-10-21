// Debug script to see what happens during initialize
import http from 'node:http';

const postData = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'debug-client', version: '1.0.0' },
  },
});

const options = {
  hostname: 'localhost',
  port: 1013,
  path: '/CiscoMCPPods/mcp',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'Content-Length': Buffer.byteLength(postData),
  },
};

console.log('Sending initialize request...\n');

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  console.log(`\n--- Response Body ---`);

  let body = '';
  let eventData = '';

  res.on('data', (chunk) => {
    const chunkStr = chunk.toString();
    body += chunkStr;

    console.log(`[Chunk ${body.length} bytes]:`, chunkStr.substring(0, 200));

    // Check if it's SSE data
    if (chunkStr.includes('data:')) {
      eventData += chunkStr;
    }
  });

  res.on('end', () => {
    console.log('\n--- Response Complete ---');
    if (eventData) {
      console.log('\nSSE Events detected:');
      console.log(eventData.substring(0, 500));
    } else if (body) {
      console.log('\nFull body:');
      console.log(body);
    } else {
      console.log('\nNo body received');
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error.message);
});

req.on('timeout', () => {
  console.log('\n⏱️  Request timed out (this is normal for SSE)');
  req.destroy();
});

// Set a reasonable timeout
req.setTimeout(10000);

req.write(postData);
req.end();

// Force exit after 12 seconds
setTimeout(() => {
  console.log('\n\n⏹️  Force exiting after 12 seconds');
  process.exit(0);
}, 12000);
