#!/usr/bin/env node

/**
 * Cisco MCP Pods Server - Local Test Suite
 * Tests both SSE and Streamable HTTP transports, health checks, and tool connectivity
 */

const config = {
  serverUrl: 'http://localhost:1013',
  serverPath: '/CiscoMCPPods',
};

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

const symbols = {
  success: '✓',
  error: '✗',
  info: 'ℹ',
  rocket: '🚀',
  check: '🔍',
  server: '🖥️',
  warning: '⚠️',
  http: '📡',
  sse: '📨',
};

let testResults = {
  passed: 0,
  failed: 0,
  tests: [],
};

let detectedTransport = null; // Will be 'sse' or 'http'

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logTest(name, passed, details = '') {
  const symbol = passed ? symbols.success : symbols.error;
  const color = passed ? colors.green : colors.red;
  const status = passed ? 'PASS' : 'FAIL';

  log(`  ${symbol} ${name} - ${color}${status}${colors.reset}`, color);
  if (details) {
    log(`    ${colors.dim}${details}${colors.reset}`);
  }

  testResults.tests.push({ name, passed, details });
  if (passed) testResults.passed++;
  else testResults.failed++;
}

function printHeader(title) {
  const line = '═'.repeat(60);
  log(`\n${colors.cyan}${line}${colors.reset}`);
  log(`${colors.cyan}${colors.bright}  ${title}${colors.reset}`);
  log(`${colors.cyan}${line}${colors.reset}\n`);
}

function printSummary() {
  const total = testResults.passed + testResults.failed;
  const successRate = ((testResults.passed / total) * 100).toFixed(1);

  printHeader('Test Summary');

  log(`  Total Tests: ${colors.bright}${total}${colors.reset}`);
  log(`  ${colors.green}Passed: ${testResults.passed}${colors.reset}`);
  log(`  ${colors.red}Failed: ${testResults.failed}${colors.reset}`);
  log(`  Success Rate: ${colors.cyan}${successRate}%${colors.reset}`);

  if (testResults.failed === 0) {
    log(`\n  ${symbols.success} ${colors.green}${colors.bright}All tests passed!${colors.reset}\n`);
  } else {
    log(`\n  ${symbols.error} ${colors.red}${colors.bright}Some tests failed${colors.reset}\n`);
    log(`${colors.yellow}Failed Tests:${colors.reset}`);
    testResults.tests
      .filter(t => !t.passed)
      .forEach(t => log(`  - ${t.name}: ${t.details}`, colors.red));
    log('');
  }
}

async function testHealthEndpoint() {
  printHeader(`${symbols.check} Health Check Test`);

  try {
    const url = `${config.serverUrl}${config.serverPath}/health`;
    log(`  Testing: ${colors.dim}${url}${colors.reset}`);

    const response = await fetch(url);
    const data = await response.json();

    const healthOk = response.ok && data.status === 'healthy';
    logTest(
      'Health endpoint responding',
      healthOk,
      healthOk ? `Service: ${data.service}` : `Status: ${response.status}`
    );

    const hasCorrectService = data.service === 'cisco-mcp-retail';
    logTest(
      'Service name correct',
      hasCorrectService,
      `Expected: cisco-mcp-retail, Got: ${data.service}`
    );

    const hasApiUrl = !!data.apiBaseUrl;
    logTest(
      'API base URL configured',
      hasApiUrl,
      `URL: ${data.apiBaseUrl}`
    );

    // Detect transport type from health response
    if (data.transport) {
      if (data.transport === 'streamable-http') {
        detectedTransport = 'http';
        log(`\n  ${symbols.http} ${colors.cyan}Detected: Streamable HTTP transport${colors.reset}`);
      } else if (data.transport === 'sse') {
        detectedTransport = 'sse';
        log(`\n  ${symbols.sse} ${colors.cyan}Detected: SSE transport${colors.reset}`);
      }
    }

    return healthOk;
  } catch (error) {
    logTest('Health endpoint responding', false, error.message);
    return false;
  }
}

async function testStreamableHTTP() {
  printHeader(`${symbols.http} Streamable HTTP Tests`);

  // Load API key from .env file
  let apiKey = null;
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    const match = envContent.match(/MCP_API_KEY=(.+)/);
    apiKey = match ? match[1].trim() : null;
  } catch (error) {
    log(`  ${symbols.warning} ${colors.yellow}Could not load API key from .env${colors.reset}`);
  }

  try {
    // Test 1: Initialize session
    const initUrl = `${config.serverUrl}${config.serverPath}/mcp`;
    log(`  Testing: ${colors.dim}POST ${initUrl}${colors.reset}`);

    const initHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };

    // Add API key if available
    if (apiKey) {
      initHeaders['X-API-Key'] = apiKey;
    }

    const initResponse = await fetch(initUrl, {
      method: 'POST',
      headers: initHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
      }),
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    const initData = await initResponse.json();
    const sessionId = initResponse.headers.get('mcp-session-id');

    const initOk = initResponse.ok && initData.result;
    logTest(
      'MCP initialization',
      initOk,
      initOk ? `Protocol: ${initData.result.protocolVersion}` : `Status: ${initResponse.status}`
    );

    const hasSessionId = !!sessionId;
    logTest(
      'Session ID assigned',
      hasSessionId,
      hasSessionId ? `Session: ${sessionId.substring(0, 8)}...` : 'No session ID in response'
    );

    if (!sessionId) {
      log(`  ${symbols.warning} ${colors.yellow}Cannot continue Streamable HTTP tests without session ID${colors.reset}\n`);
      return false;
    }

    // Test 2: List tools with session
    const toolsUrl = `${config.serverUrl}${config.serverPath}/mcp`;
    const toolsHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Mcp-Session-Id': sessionId,
    };

    // Add API key if available
    if (apiKey) {
      toolsHeaders['X-API-Key'] = apiKey;
    }

    const toolsResponse = await fetch(toolsUrl, {
      method: 'POST',
      headers: toolsHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      }),
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    const toolsData = await toolsResponse.json();
    const toolsOk = toolsResponse.ok && toolsData.result && toolsData.result.tools;
    logTest(
      'Tools list request (with session)',
      toolsOk,
      toolsOk ? `Found ${toolsData.result.tools.length} tools` : `Status: ${toolsResponse.status}`
    );

    // Test 3: SSE stream connection
    const sseController = new AbortController();
    const sseTimeout = setTimeout(() => sseController.abort(), 3000);

    try {
      const sseHeaders = {
        'Accept': 'text/event-stream',
        'Mcp-Session-Id': sessionId,
      };

      // Add API key if available
      if (apiKey) {
        sseHeaders['X-API-Key'] = apiKey;
      }

      const sseResponse = await fetch(`${config.serverUrl}${config.serverPath}/mcp`, {
        method: 'GET',
        headers: sseHeaders,
        signal: sseController.signal,
      });

      clearTimeout(sseTimeout);
      const sseOk = sseResponse.ok;
      logTest(
        'SSE stream connection',
        sseOk,
        sseOk ? 'Stream established' : `Status: ${sseResponse.status}`
      );
      sseController.abort();
    } catch (error) {
      clearTimeout(sseTimeout);
      if (error.name !== 'AbortError') {
        logTest('SSE stream connection', false, error.message);
      }
    }

    return initOk;
  } catch (error) {
    logTest('Streamable HTTP tests', false, error.message);
    return false;
  }
}

async function testSSEConnection() {
  printHeader(`${symbols.sse} SSE Connection Test`);

  return new Promise((resolve) => {
    const url = `${config.serverUrl}${config.serverPath}/sse`;
    log(`  Testing: ${colors.dim}${url}${colors.reset}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      logTest('SSE endpoint timeout', false, 'Connection timed out after 5s');
      resolve(false);
    }, 5000);

    fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/event-stream',
      },
    })
      .then(response => {
        clearTimeout(timeout);

        const connectionOk = response.ok;
        logTest(
          'SSE connection established',
          connectionOk,
          `Status: ${response.status}`
        );

        const hasCorrectType = response.headers.get('content-type')?.includes('text/event-stream');
        logTest(
          'SSE content-type header',
          hasCorrectType,
          `Content-Type: ${response.headers.get('content-type')}`
        );

        controller.abort();
        resolve(connectionOk);
      })
      .catch(error => {
        clearTimeout(timeout);
        if (error.name !== 'AbortError') {
          logTest('SSE connection established', false, error.message);
        }
        resolve(false);
      });
  });
}

async function testRootEndpoint() {
  printHeader(`${symbols.info} Server Info Test`);

  try {
    const url = `${config.serverUrl}/`;
    log(`  Testing: ${colors.dim}${url}${colors.reset}`);

    const response = await fetch(url);
    const data = await response.json();

    const rootOk = response.ok;
    logTest(
      'Root endpoint responding',
      rootOk,
      `Name: ${data.name}`
    );

    const hasEndpoints = data.endpoints && Object.keys(data.endpoints).length > 0;
    logTest(
      'Endpoint information available',
      hasEndpoints,
      hasEndpoints ? `Endpoints: ${Object.keys(data.endpoints).join(', ')}` : 'No endpoints found'
    );

    const hasTransport = !!data.transport;
    logTest(
      'Transport type declared',
      hasTransport,
      hasTransport ? `Transport: ${data.transport}` : 'No transport info'
    );

    return rootOk;
  } catch (error) {
    logTest('Root endpoint responding', false, error.message);
    return false;
  }
}

async function testMessageEndpoint() {
  printHeader(`${symbols.rocket} Message Endpoint Test (SSE)`);

  try {
    const url = `${config.serverUrl}${config.serverPath}/messages`;
    log(`  Testing: ${colors.dim}POST ${url}${colors.reset}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }),
    });

    const messageOk = response.ok;
    logTest(
      'Message endpoint accepting requests',
      messageOk,
      `Status: ${response.status}`
    );

    if (messageOk) {
      const data = await response.json();
      const hasTools = data.result && data.result.tools;
      logTest(
        'Tools list returned',
        hasTools,
        hasTools ? `Found ${data.result.tools.length} tools` : 'No tools in response'
      );
    }

    return messageOk;
  } catch (error) {
    logTest('Message endpoint accepting requests', false, error.message);
    return false;
  }
}

async function checkServerRunning() {
  printHeader(`${symbols.server} Server Status Check`);

  try {
    const response = await fetch(`${config.serverUrl}${config.serverPath}/health`, {
      signal: AbortSignal.timeout(3000),
    });

    if (response.ok) {
      log(`  ${symbols.success} ${colors.green}Server is running on port 3010${colors.reset}\n`);
      return true;
    } else {
      log(`  ${symbols.error} ${colors.red}Server responded with status ${response.status}${colors.reset}\n`);
      return false;
    }
  } catch (error) {
    log(`  ${symbols.error} ${colors.red}Server is not running or not reachable${colors.reset}`);
    log(`  ${colors.yellow}${symbols.info} Start the server with:${colors.reset}`);
    log(`     ${colors.cyan}npm run start:sse${colors.reset}  (for SSE transport)`);
    log(`     ${colors.cyan}npm run start:http${colors.reset} (for Streamable HTTP transport)${colors.reset}\n`);
    return false;
  }
}

async function runAllTests() {
  console.clear();

  log(`${colors.cyan}${colors.bright}`);
  log('╔═══════════════════════════════════════════════════════════╗');
  log('║                                                           ║');
  log('║        🚀 CISCO MCP RETAIL SERVER TEST SUITE 🚀          ║');
  log('║                                                           ║');
  log('╚═══════════════════════════════════════════════════════════╝');
  log(colors.reset);

  log(`${colors.dim}  Server: ${config.serverUrl}${config.serverPath}${colors.reset}`);
  log(`${colors.dim}  Time: ${new Date().toLocaleString()}${colors.reset}\n`);

  // Check if server is running first
  const serverRunning = await checkServerRunning();

  if (!serverRunning) {
    log(`${colors.red}${colors.bright}Cannot run tests - server is not running!${colors.reset}\n`);
    process.exit(1);
  }

  // Run common tests
  await testHealthEndpoint();
  await testRootEndpoint();

  // Run transport-specific tests based on detected transport
  if (detectedTransport === 'http') {
    log(`\n${colors.cyan}${colors.bright}Running Streamable HTTP transport tests...${colors.reset}`);
    await testStreamableHTTP();
  } else if (detectedTransport === 'sse') {
    log(`\n${colors.cyan}${colors.bright}Running SSE transport tests...${colors.reset}`);
    await testSSEConnection();
    await testMessageEndpoint();
  } else {
    log(`\n${colors.yellow}${symbols.warning} Could not detect transport type, running both test suites...${colors.reset}`);

    // Try SSE first
    await testSSEConnection();
    await testMessageEndpoint();

    // Then try Streamable HTTP
    await testStreamableHTTP();
  }

  // Print summary
  printSummary();

  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  log(`\n${symbols.error} ${colors.red}Test suite crashed: ${error.message}${colors.reset}\n`);
  process.exit(1);
});
