#!/usr/bin/env node

/**
 * Quick test for all three Cisco MCP servers
 * Tests health and basic functionality without infinite loops
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Load environment variables from all three server directories
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
    port: 1013,
    path: '/CiscoMCPPods',
    service: 'cisco-mcp-pods',
    apiKey: podsApiKey,
    hostname: 'ciscomcppods.cxocoe.us'
  },
  {
    name: 'Retail',
    port: 3010,
    path: '/CiscoMCPRetail',
    service: 'cisco-mcp-retail',
    apiKey: retailApiKey,
    hostname: 'ciscomcpretail.cxocoe.us'
  },
  {
    name: 'Healthcare',
    port: 3011,
    path: '/CiscoMCPHealthcare',
    service: 'cisco-mcp-healthcare',
    apiKey: healthApiKey,
    hostname: 'ciscomcphealth.cxocoe.us'
  },
  {
    name: 'Insurance',
    port: 3012,
    path: '/CiscoMCPInsurance',
    service: 'cisco-mcp-insurance',
    apiKey: insuranceApiKey,
    hostname: 'ciscomcpinsurance.cxocoe.us'
  },
];

const PUBLIC_HOSTNAME = 'cxocoe.us';

// Colors
const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

async function testServer(server) {
  console.log(`\n${c.cyan}━━━ Testing ${server.name} Server (Port ${server.port}) ━━━${c.reset}`);

  const results = {
    local: { health: false, init: false, tools: false },
    public: { health: false },
  };

  // Test 1: Local Health Check
  try {
    const url = `http://localhost:${server.port}${server.path}/health`;
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const data = await response.json();

    results.local.health = response.ok && data.status === 'healthy';
    console.log(`  Local Health:     ${results.local.health ? c.green + '✓ PASS' : c.red + '✗ FAIL'}${c.reset}`);
    console.log(`    ${c.dim}Service: ${data.service}, Transport: ${data.transport}${c.reset}`);
  } catch (error) {
    console.log(`  Local Health:     ${c.red}✗ FAIL${c.reset} - ${error.message}`);
  }

  // Test 2: Public Health Check
  try {
    const url = `http://${server.hostname}${server.path}/health`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await response.json();

    results.public.health = response.ok && data.status === 'healthy';
    console.log(`  Public Health:    ${results.public.health ? c.green + '✓ PASS' : c.red + '✗ FAIL'}${c.reset}`);
    console.log(`    ${c.dim}${url}${c.reset}`);
  } catch (error) {
    console.log(`  Public Health:    ${c.red}✗ FAIL${c.reset} - ${error.message}`);
  }

  // Test 3: MCP Initialize (Streamable HTTP)
  try {
    const url = `http://localhost:${server.port}${server.path}/mcp`;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };

    // Add API key if available
    if (server.apiKey) {
      headers['x-api-key'] = server.apiKey;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      }),
      signal: AbortSignal.timeout(5000),
    });

    const data = await response.json();
    const sessionId = response.headers.get('mcp-session-id');

    results.local.init = response.ok && data.result && sessionId;
    console.log(`  MCP Initialize:   ${results.local.init ? c.green + '✓ PASS' : c.red + '✗ FAIL'}${c.reset}`);
    if (sessionId) {
      console.log(`    ${c.dim}Session: ${sessionId.substring(0, 12)}...${c.reset}`);

      // Test 4: List Tools (only if init succeeded)
      try {
        const toolsHeaders = {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'Mcp-Session-Id': sessionId,
        };

        // Add API key if available
        if (server.apiKey) {
          toolsHeaders['x-api-key'] = server.apiKey;
        }

        const toolsResponse = await fetch(url, {
          method: 'POST',
          headers: toolsHeaders,
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list',
            params: {},
          }),
          signal: AbortSignal.timeout(5000),
        });

        const toolsData = await toolsResponse.json();
        results.local.tools = toolsResponse.ok && toolsData.result?.tools;
        console.log(`  Tools List:       ${results.local.tools ? c.green + '✓ PASS' : c.red + '✗ FAIL'}${c.reset}`);
        if (results.local.tools) {
          console.log(`    ${c.dim}Found ${toolsData.result.tools.length} tools${c.reset}`);
        }
      } catch (error) {
        console.log(`  Tools List:       ${c.red}✗ FAIL${c.reset} - ${error.message}`);
      }
    }
  } catch (error) {
    console.log(`  MCP Initialize:   ${c.red}✗ FAIL${c.reset} - ${error.message}`);
  }

  return results;
}

async function main() {
  console.clear();
  console.log(`${c.cyan}╔═══════════════════════════════════════════════════════╗`);
  console.log(`║                                                       ║`);
  console.log(`║     🚀 Cisco MCP Servers - Quick Test Suite 🚀      ║`);
  console.log(`║                                                       ║`);
  console.log(`╚═══════════════════════════════════════════════════════╝${c.reset}\n`);
  console.log(`${c.dim}Domain: ${PUBLIC_HOSTNAME}${c.reset}`);
  console.log(`${c.dim}Testing: Retail (3010), Healthcare (3011), Insurance (3012)${c.reset}`);

  const allResults = [];

  for (const server of SERVERS) {
    const results = await testServer(server);
    allResults.push({ server: server.name, results });
  }

  // Summary
  console.log(`\n${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
  console.log(`${c.cyan}Summary${c.reset}\n`);

  allResults.forEach(({ server, results }) => {
    const localOk = results.local.health && results.local.init && results.local.tools;
    const publicOk = results.public.health;

    console.log(`  ${server.padEnd(12)} Local: ${localOk ? c.green + '✓' : c.red + '✗'}${c.reset}  Public: ${publicOk ? c.green + '✓' : c.red + '✗'}${c.reset}`);
  });

  console.log(`\n${c.yellow}WxConnect Registration URLs (Streamable HTTP):${c.reset}`);
  console.log(`${c.dim}  Include x-mcp-api-key header with your API key${c.reset}\n`);
  SERVERS.forEach(server => {
    console.log(`  ${c.cyan}${server.name}:${c.reset} http://${server.hostname}${server.path}/mcp`);
  });

  console.log('');
}

main().catch(error => {
  console.error(`${c.red}Test failed: ${error.message}${c.reset}`);
  process.exit(1);
});
