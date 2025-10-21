// Quick test of public MCP endpoints
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper function to load MCP_API_KEY from a specific .env file
function loadApiKey(envPath) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/MCP_API_KEY=(.+)/);
    return match ? match[1].trim() : null;
  } catch (error) {
    console.error(`Warning: Could not load ${envPath}`);
    return null;
  }
}

// Load API keys from each server's .env file
const podsApiKey = loadApiKey(join(__dirname, '.env'));
const retailApiKey = loadApiKey(join(__dirname, '../CiscoMCPRetail/.env'));
const healthApiKey = loadApiKey(join(__dirname, '../CiscoMCPHealthcare/.env'));
const insuranceApiKey = loadApiKey(join(__dirname, '../CiscoMCPInsurance/.env'));

const SERVERS = [
  {
    name: 'Pods',
    hostname: 'ciscomcppods.cxocoe.us',
    path: '/CiscoMCPPods',
    apiKey: podsApiKey
  },
  {
    name: 'Retail',
    hostname: 'ciscomcpretail.cxocoe.us',
    path: '/CiscoMCPRetail',
    apiKey: retailApiKey
  },
  {
    name: 'Healthcare',
    hostname: 'ciscomcphealth.cxocoe.us',
    path: '/CiscoMCPHealthcare',
    apiKey: healthApiKey
  },
  {
    name: 'Insurance',
    hostname: 'ciscomcpinsurance.cxocoe.us',
    path: '/CiscoMCPInsurance',
    apiKey: insuranceApiKey
  },
];

async function testPublicMCP(server) {
  console.log(`\nTesting ${server.name}...`);
  try {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };

    // Add API key if available
    if (server.apiKey) {
      headers['x-api-key'] = server.apiKey;
    }

    const response = await fetch(`http://${server.hostname}${server.path}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' },
        },
      }),
      signal: AbortSignal.timeout(5000),
    });

    const sessionId = response.headers.get('mcp-session-id');
    const data = await response.json();

    console.log(`  Status: ${response.status}`);
    console.log(`  Session ID: ${sessionId ? sessionId.substring(0, 16) + '...' : 'NONE'}`);
    console.log(`  Result: ${data.result ? 'SUCCESS' : 'FAILED'}`);
    if (data.result) {
      console.log(`  Server: ${data.result.serverInfo.name} v${data.result.serverInfo.version}`);
    }
    if (data.error) {
      console.log(`  Error: ${data.error.message}`);
    }

    return !!data.result && !!sessionId;
  } catch (error) {
    console.log(`  ERROR: ${error.message}`);
    return false;
  }
}

(async () => {
  console.log('🧪 Testing Public MCP Endpoints via NGINX\n');
  console.log(`Domain: cxocoe.us\n`);
  console.log('━'.repeat(50));

  const results = {};
  for (const server of SERVERS) {
    results[server.name.toLowerCase()] = await testPublicMCP(server);
  }

  console.log('\n' + '━'.repeat(50));
  console.log('\n📊 Summary:\n');
  console.log(`  Retail:     ${results.retail ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  Healthcare: ${results.healthcare ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  Insurance:  ${results.insurance ? '✓ PASS' : '✗ FAIL'}`);

  if (results.retail && results.healthcare && results.insurance) {
    console.log('\n✅ All servers ready for WxConnect registration!\n');
    console.log('Use these URLs with x-mcp-api-key header:');
    SERVERS.forEach(server => {
      console.log(`  ${server.name}: http://${server.hostname}${server.path}/mcp`);
    });
  } else {
    console.log('\n⚠️  Some servers failed. Check configuration and API keys.');
  }
  console.log('');
})();
