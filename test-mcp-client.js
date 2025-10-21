#!/usr/bin/env node

/**
 * MCP Client + Claude API Integration
 *
 * This script demonstrates a full AI agent flow:
 * 1. Connect to MCP server with X-API-Key authentication
 * 2. Discover available tools
 * 3. Send prompts to Claude API
 * 4. Claude uses MCP tools to fulfill requests
 * 5. Display full conversation
 */

import Anthropic from '@anthropic-ai/sdk';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// MCP Server Configuration
const MCP_SERVERS = {
  pods: {
    name: 'Cisco Pods MCP',
    url: 'http://ciscomcppods.cxocoe.us/CiscoMCPPods/mcp',
    apiKey: process.env.MCP_API_KEY || 'your-mcp-api-key-here'
  },
  retail: {
    name: 'Cisco Retail MCP',
    url: 'http://ciscomcpretail.cxocoe.us/CiscoMCPRetail/mcp',
    apiKey: 'b4ae5b83b412a620f5d509a9ed1d0ed02718f7fef6ed2cd72a4090ae0d9f4b79'
  },
  healthcare: {
    name: 'Cisco Healthcare MCP',
    url: 'http://ciscomcphealth.cxocoe.us/CiscoMCPHealthcare/mcp',
    apiKey: '4e1ae90d9ffddbb9940a8e2b80d9b40e0c7ff7fc7f21625ea99226c612a74066'
  },
  insurance: {
    name: 'Cisco Insurance MCP',
    url: 'http://ciscomcpinsurance.cxocoe.us/CiscoMCPInsurance/mcp',
    apiKey: 'b0b702567dcf095da6b939f6f77319b18c6dbb1bf9f84c3cee2b3a459d6b2031'
  }
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
};

class MCPClient {
  constructor(config) {
    this.name = config.name;
    this.url = config.url;
    this.apiKey = config.apiKey;
    this.sessionId = null;
    this.tools = [];
  }

  async sendRequest(method, params = {}) {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'X-API-Key': this.apiKey,
        ...(this.sessionId && { 'Mcp-Session-Id': this.sessionId })
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params
      }),
      signal: AbortSignal.timeout(10000)
    });

    // Capture session ID from response
    const newSessionId = response.headers.get('mcp-session-id');
    if (newSessionId) {
      this.sessionId = newSessionId;
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`MCP Error: ${data.error.message}`);
    }

    return data.result;
  }

  async initialize() {
    console.log(`${colors.cyan}Initializing ${this.name}...${colors.reset}`);

    const result = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-mcp-client',
        version: '1.0.0'
      }
    });

    console.log(`${colors.green}✓ Connected${colors.reset} (Session: ${this.sessionId.substring(0, 12)}...)`);
    console.log(`${colors.dim}  Server: ${result.serverInfo.name} v${result.serverInfo.version}${colors.reset}\n`);

    return result;
  }

  async listTools() {
    console.log(`${colors.cyan}Fetching tools from ${this.name}...${colors.reset}`);

    const result = await this.sendRequest('tools/list', {});
    this.tools = result.tools;

    console.log(`${colors.green}✓ Found ${this.tools.length} tools:${colors.reset}`);
    this.tools.forEach(tool => {
      console.log(`${colors.dim}  - ${tool.name}: ${tool.description}${colors.reset}`);
    });
    console.log('');

    return this.tools;
  }

  async callTool(toolName, args) {
    console.log(`${colors.yellow}Calling tool: ${toolName}${colors.reset}`);
    console.log(`${colors.dim}  Args: ${JSON.stringify(args, null, 2)}${colors.reset}\n`);

    const result = await this.sendRequest('tools/call', {
      name: toolName,
      arguments: args
    });

    return result;
  }

  // Convert MCP tools to Claude API tool format
  getClaudeTools() {
    return this.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema
    }));
  }
}

class ClaudeMCPAgent {
  constructor(anthropicApiKey, mcpClients) {
    this.anthropic = new Anthropic({ apiKey: anthropicApiKey });
    this.mcpClients = mcpClients;
    this.conversationHistory = [];
    this.toolMapping = {}; // Maps prefixed tool names to {client, originalName}
  }

  getAllTools() {
    // Combine tools from all MCP servers
    const allTools = [];
    this.toolMapping = {}; // Reset mapping

    for (const client of this.mcpClients) {
      const tools = client.getClaudeTools();
      // Prefix tool names with server identifier to avoid conflicts
      for (const tool of tools) {
        const prefixedName = `${client.name.toLowerCase().replace(/\s+/g, '_')}_${tool.name}`;

        // Store mapping separately
        this.toolMapping[prefixedName] = {
          client: client,
          originalName: tool.name
        };

        // Add clean tool (no extra fields)
        allTools.push({
          name: prefixedName,
          description: tool.description,
          input_schema: tool.input_schema
        });
      }
    }
    return allTools;
  }

  async chat(userMessage) {
    console.log(`${colors.bright}${colors.blue}User: ${userMessage}${colors.reset}\n`);

    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });

    let continueLoop = true;
    let response;

    while (continueLoop) {
      // Send request to Claude
      const allTools = this.getAllTools();

      response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: this.conversationHistory,
        tools: allTools
      });

      console.log(`${colors.magenta}Claude (stop reason: ${response.stop_reason}):${colors.reset}`);

      // Process response
      if (response.stop_reason === 'tool_use') {
        // Claude wants to use tools
        const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');
        const textBlocks = response.content.filter(block => block.type === 'text');

        // Display Claude's thinking
        if (textBlocks.length > 0) {
          textBlocks.forEach(block => {
            console.log(`${colors.dim}  ${block.text}${colors.reset}`);
          });
        }

        // Add assistant response to history
        this.conversationHistory.push({
          role: 'assistant',
          content: response.content
        });

        // Execute tool calls
        const toolResults = [];
        for (const toolUse of toolUseBlocks) {
          console.log(`\n${colors.yellow}Claude is using tool: ${toolUse.name}${colors.reset}`);

          // Look up which MCP client and original tool name to use
          const toolInfo = this.toolMapping[toolUse.name];
          if (!toolInfo) {
            throw new Error(`Unknown tool: ${toolUse.name}`);
          }

          try {
            const result = await toolInfo.client.callTool(toolInfo.originalName, toolUse.input);

            console.log(`${colors.green}✓ Tool result:${colors.reset}`);
            console.log(`${colors.dim}${JSON.stringify(result, null, 2)}${colors.reset}\n`);

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify(result)
            });
          } catch (error) {
            console.log(`${colors.red}✗ Tool error: ${error.message}${colors.reset}\n`);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: `Error: ${error.message}`,
              is_error: true
            });
          }
        }

        // Add tool results to history
        this.conversationHistory.push({
          role: 'user',
          content: toolResults
        });

      } else if (response.stop_reason === 'end_turn') {
        // Claude is done
        const textBlocks = response.content.filter(block => block.type === 'text');

        console.log(`${colors.bright}${colors.magenta}Claude's final response:${colors.reset}`);
        textBlocks.forEach(block => {
          console.log(`${block.text}\n`);
        });

        // Add to history
        this.conversationHistory.push({
          role: 'assistant',
          content: response.content
        });

        continueLoop = false;
      } else {
        // Unexpected stop reason
        console.log(`${colors.yellow}Unexpected stop reason: ${response.stop_reason}${colors.reset}`);
        continueLoop = false;
      }
    }

    return response;
  }
}

async function main() {
  console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════╗`);
  console.log(`║                                                    ║`);
  console.log(`║         MCP Client + Claude API Test              ║`);
  console.log(`║                                                    ║`);
  console.log(`╚════════════════════════════════════════════════════╝${colors.reset}\n`);

  // Check for Anthropic API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(`${colors.red}Error: ANTHROPIC_API_KEY not found in environment${colors.reset}`);
    console.log(`\nPlease add to your .env file:\nANTHROPIC_API_KEY=your-api-key-here\n`);
    process.exit(1);
  }

  console.log(`${colors.dim}API Key found: ${process.env.ANTHROPIC_API_KEY.substring(0, 20)}...${colors.reset}\n`);

  try {
    // Initialize MCP clients
    console.log(`${colors.bright}Step 1: Connect to MCP Servers${colors.reset}\n`);

    const mcpClients = [];

    // Connect to Pods server (current directory)
    const podsClient = new MCPClient(MCP_SERVERS.pods);
    await podsClient.initialize();
    await podsClient.listTools();
    mcpClients.push(podsClient);

    // Optionally connect to other servers
    // const retailClient = new MCPClient(MCP_SERVERS.retail);
    // await retailClient.initialize();
    // await retailClient.listTools();
    // mcpClients.push(retailClient);
    //
    // const healthcareClient = new MCPClient(MCP_SERVERS.healthcare);
    // await healthcareClient.initialize();
    // await healthcareClient.listTools();
    // mcpClients.push(healthcareClient);

    console.log(`${colors.bright}Step 2: Initialize Claude Agent${colors.reset}\n`);
    const agent = new ClaudeMCPAgent(process.env.ANTHROPIC_API_KEY, mcpClients);
    console.log(`${colors.green}✓ Agent ready with ${mcpClients.length} MCP server(s)${colors.reset}\n`);

    console.log(`${colors.bright}Step 3: Interactive Chat${colors.reset}\n`);
    console.log(`${colors.dim}Type your questions below. Type 'quit', 'exit', or press Ctrl+C to exit.${colors.reset}\n`);
    console.log('━'.repeat(60) + '\n');

    // Create readline interface
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Interactive loop
    const askQuestion = () => {
      rl.question(`${colors.bright}${colors.blue}You: ${colors.reset}`, async (userInput) => {
        const input = userInput.trim();

        // Exit commands
        if (input.toLowerCase() === 'quit' || input.toLowerCase() === 'exit' || input === '') {
          console.log(`\n${colors.green}✓ Goodbye!${colors.reset}\n`);
          rl.close();
          process.exit(0);
        }

        // Process the question
        try {
          console.log(''); // Empty line for spacing
          await agent.chat(input);
          console.log('\n' + '━'.repeat(60) + '\n');
        } catch (error) {
          console.error(`${colors.red}Error: ${error.message}${colors.reset}\n`);
        }

        // Ask next question
        askQuestion();
      });
    };

    // Start the conversation loop
    askQuestion();

  } catch (error) {
    console.error(`\n${colors.red}Error: ${error.message}${colors.reset}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Always run main
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
