# Cisco MCP Retail Server - Architecture & Code Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Project Structure](#project-structure)
4. [Core Components](#core-components)
5. [MCP Protocol Implementation](#mcp-protocol-implementation)
6. [File-by-File Breakdown](#file-by-file-breakdown)
7. [Data Flow](#data-flow)
8. [Testing Strategy](#testing-strategy)
9. [Deployment Architecture](#deployment-architecture)

---

## Overview

The Cisco MCP Retail Server is a **Model Context Protocol (MCP)** server that provides AI assistants (like ChatGPT, etc.) with the ability to interact with a Cisco API Gateway for retail customer management.

### What is MCP?
MCP (Model Context Protocol) is a standardized protocol that allows AI assistants to:
- Call tools/functions on external systems
- Access resources and data sources
- Maintain stateful sessions with backends

### What This Server Does
This server acts as a **bridge** between:
- **AI Assistants** (WxConnect, AI Desktop Client, etc.)
- **Cisco API Gateway** (your retail customer management system)

It exposes 5 tools that AI can use:
1. `get_customer` - Retrieve customer by phone/order ID
2. `get_all_customers` - List all customers with pagination
3. `create_customer` - Create new customer records
4. `update_customer` - Update customer information
5. `delete_customer` - Remove customer records

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         AI Assistant                             │
│                    (WxConnect, AI Agents, etc.)                     │
└─────────────────────┬───────────────────────────────────────────┘
                      │ MCP Protocol
                      │ (HTTP/SSE)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NGINX Reverse Proxy                           │
│          (ciscomcpretail/health/insurance.cxocoe.us)            │
│                                                                  │
│  Routes:                                                         │
│  /CiscoMCPRetail/mcp     → localhost:3010                       │
│  /CiscoMCPHealthcare/mcp → localhost:3011                       │
│  /CiscoMCPInsurance/mcp  → localhost:3012                       │
│                                                                  │
│  Authentication: Validates X-API-Key header                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              Cisco MCP Retail Server (Port 3010)                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Express.js HTTP Server                       │  │
│  │                                                           │  │
│  │  Authentication Middleware:                               │  │
│  │  • Validates X-API-Key header on all MCP endpoints   │  │
│  │  • Skips auth for health endpoint                        │  │
│  │                                                           │  │
│  │  Endpoints:                                               │  │
│  │  • POST /CiscoMCPRetail/mcp   - MCP requests             │  │
│  │  • GET  /CiscoMCPRetail/mcp   - SSE stream               │  │
│  │  • DELETE /CiscoMCPRetail/mcp - Session cleanup          │  │
│  │  • GET  /CiscoMCPRetail/health - Health check (no auth)  │  │
│  └──────────────────┬───────────────────────────────────────┘  │
│                     │                                            │
│  ┌──────────────────▼───────────────────────────────────────┐  │
│  │     StreamableHTTPServerTransport (MCP SDK)              │  │
│  │                                                           │  │
│  │  • Session Management (UUID-based)                       │  │
│  │  • Event Store (for resumability)                        │  │
│  │  • JSON Response Mode (enableJsonResponse: true)         │  │
│  └──────────────────┬───────────────────────────────────────┘  │
│                     │                                            │
│  ┌──────────────────▼───────────────────────────────────────┐  │
│  │              MCP Server Instance                          │  │
│  │                                                           │  │
│  │  Request Handlers:                                        │  │
│  │  • ListTools - Returns available tools                   │  │
│  │  • CallTool  - Executes tool calls                       │  │
│  │  • ListResources - Returns data resources                │  │
│  │  • ReadResource - Fetches resource data                  │  │
│  └──────────────────┬───────────────────────────────────────┘  │
│                     │                                            │
│  ┌──────────────────▼───────────────────────────────────────┐  │
│  │              Retail Client (retailClient.js)             │  │
│  │                                                           │  │
│  │  • Constructs API requests                               │  │
│  │  • Handles authentication (API Key or JWT)               │  │
│  │  • Manages error handling                                │  │
│  └──────────────────┬───────────────────────────────────────┘  │
└────────────────────┬┴───────────────────────────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cisco API Gateway                             │
│                 (apigateway.cxocoe.us)                          │
│                                                                  │
│  Endpoints:                                                      │
│  • GET    /customer/:number      - Get customer                 │
│  • GET    /customers?limit&skip  - List customers               │
│  • POST   /customer              - Create customer              │
│  • PUT    /customer/:number      - Update customer              │
│  • DELETE /customer/:number      - Delete customer              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
CiscoMCPRetail/
├── src/
│   ├── index.js           # Stdio transport (for Claude Desktop)
│   ├── server-http.js     # HTTP/SSE transport (for WxConnect) ⭐ MAIN
│   ├── server-sse.js      # Legacy SSE-only transport
│   ├── retailClient.js    # API client for Cisco Gateway
│   └── config.js          # Environment configuration
│
├── test-all-servers.js    # Test all 3 MCP servers
├── test-public-mcp.js     # Test public endpoints
├── test-server.js         # Comprehensive test suite
├── test-mcp-client.js     # Interactive MCP client with Anthropic AI integration
├── debug-init.js          # Debug MCP initialization
│
├── .env                   # Environment variables (API keys, URLs)
├── .env.example           # Template for environment setup
├── package.json           # Dependencies and npm scripts
├── README.md              # User documentation
├── ARCHITECTURE.md        # This file
└── nginx.conf.example     # NGINX reverse proxy config
```

---

## Core Components

### 1. **Configuration Layer** (`config.js`)

**Purpose:** Centralizes all environment-based configuration.

**What it does:**
- Loads environment variables from `.env`
- Validates required configuration
- Provides defaults for optional settings
- Exports a single `config` object used throughout the app

**Key Configuration:**
```javascript
{
  apiBaseUrl: 'https://apigateway.cxocoe.us',  // Cisco API Gateway
  authMode: 'apikey',                           // or 'jwt'
  apiKeyRetail: process.env.API_KEY_RETAIL,     // API Key
  jwtToken: process.env.JWT_TOKEN,              // JWT Token (alternative)
  serverPort: 3010,                             // HTTP server port
  serverPath: '/CiscoMCPRetail'                 // Base path
}
```

**Why it matters:**
- Makes it easy to switch between dev/staging/prod
- Keeps secrets in `.env` file (not in code)
- Single source of truth for configuration

---

### 2. **Retail Client** (`retailClient.js`)

**Purpose:** Abstracts all communication with the Cisco API Gateway.

**What it does:**
- Constructs proper HTTP requests to API Gateway
- Adds authentication headers (API Key or JWT)
- Handles API responses and errors
- Provides a clean JavaScript API for customer operations

**Key Methods:**

```javascript
// GET /customer/:number
getCustomer(number)
  → Returns: { customer object } or { error }

// GET /customers?limit=X&skip=Y
getAllCustomers(limit, skip)
  → Returns: { customers: [], total, limit, skip }

// POST /customer
createCustomer(customerData)
  → Returns: { success, customer }

// PUT /customer/:number
updateCustomer(number, updates)
  → Returns: { success, customer }

// DELETE /customer/:number
deleteCustomer(number)
  → Returns: { success, message }
```

**Authentication Flow:**
```javascript
const headers = {
  'Content-Type': 'application/json'
};

if (config.authMode === 'apikey') {
  headers['x-api-key'] = config.apiKeyRetail;
} else if (config.authMode === 'jwt') {
  headers['Authorization'] = `Bearer ${config.jwtToken}`;
}
```

**Error Handling:**
- Network errors are caught and returned as error objects
- HTTP error codes are preserved in responses
- All errors include helpful messages for debugging

---

### 3. **MCP Server** (`server-http.js`) ⭐ **MAIN FILE**

This is the **core of the application**. It implements the MCP protocol using the SDK.

#### **A. Express HTTP Server Setup**

```javascript
const app = express();
app.use(express.json());
app.use(cors({
  origin: '*',
  exposedHeaders: ['Mcp-Session-Id']
}));
```

**Why:**
- Express handles HTTP routing
- JSON middleware parses request bodies
- CORS allows cross-origin requests from AI clients
- We expose `Mcp-Session-Id` header for session management

#### **B. Session Management**

```javascript
const transports = {};  // Map of sessionId → transport instance

// When a new session is initialized:
onsessioninitialized: (sid) => {
  transports[sid] = transport;  // Store for reuse
}

// When session is closed:
onclose: () => {
  delete transports[sessionId];  // Clean up
}
```

**Why sessions matter:**
- AI clients may make multiple requests in a conversation
- Sessions maintain state between requests
- Event store allows reconnection after network issues

#### **C. Event Store (Resumability)**

```javascript
class InMemoryEventStore {
  constructor() {
    this.events = new Map();  // sessionId → [event1, event2, ...]
  }

  async getEventsAfter(sessionId, afterEventId) {
    // Returns events after a specific event ID
    // Used when client reconnects and says "give me events after X"
  }

  async addEvent(sessionId, event) {
    // Stores each MCP message for replay
  }
}
```

**Why:**
- If connection drops, client can reconnect and catch up
- Implements MCP's resumability feature
- Critical for reliable long-running conversations

#### **D. MCP Server Instance**

```javascript
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

  // Register handlers...
  return server;
}
```

**The server provides 4 types of handlers:**

1. **ListTools** - Tell AI what functions are available
2. **CallTool** - Execute a function when AI calls it
3. **ListResources** - Tell AI what data sources exist
4. **ReadResource** - Fetch data from a resource

#### **E. Tool Handlers**

**ListTools Handler:**
```javascript
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_customer',
        description: 'Get a retail customer by phone number or order ID...',
        inputSchema: {
          type: 'object',
          properties: {
            number: {
              type: 'string',
              description: 'Phone number (e.g., +13033249089) or order ID'
            }
          },
          required: ['number']
        }
      },
      // ... 4 more tools
    ]
  };
});
```

**What happens:**
- AI sends `tools/list` request
- Server responds with all available tools
- AI learns what functions it can call

**CallTool Handler:**
```javascript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'get_customer': {
      const result = await retailClient.getCustomer(args.number);
      return {
        content: [
          { type: 'text', text: JSON.stringify(result, null, 2) }
        ]
      };
    }
    // ... handle other tools
  }
});
```

**Flow:**
1. AI decides to call `get_customer` with `{ number: "+13033249089" }`
2. MCP sends: `{ method: "tools/call", params: { name: "get_customer", arguments: { number: "+13033249089" }}}`
3. Server calls `retailClient.getCustomer("+13033249089")`
4. API Gateway returns customer data
5. Server wraps it in MCP format and returns to AI
6. AI processes the data and responds to user

#### **F. HTTP Endpoints**

**POST /CiscoMCPRetail/mcp - Main MCP endpoint**
```javascript
app.post(`${config.serverPath}/mcp`, async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];

  if (sessionId && transports[sessionId]) {
    // Reuse existing session
    transport = transports[sessionId];
  } else if (!sessionId && isInitializeRequest(req.body)) {
    // New session - create transport
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      eventStore: new InMemoryEventStore(),
      enableJsonResponse: true,  // ⭐ Critical fix!
      onsessioninitialized: (sid) => {
        transports[sid] = transport;
      }
    });

    const server = createMCPServer();
    await server.connect(transport);
  } else {
    // Error: no session ID and not an init request
    return res.status(400).json({ error: 'Bad Request' });
  }

  await transport.handleRequest(req, res, req.body);
});
```

**Critical Detail: `enableJsonResponse: true`**

This was the **key fix** that solved the infinite loop issue!

- **Without it:** SDK defaults to SSE streaming, connection stays open
- **With it:** SDK returns JSON responses, connection closes properly
- **Result:** Works perfectly with WxConnect and other HTTP clients

**GET /CiscoMCPRetail/mcp - SSE stream endpoint**
```javascript
app.get(`${config.serverPath}/mcp`, async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];

  if (!sessionId || !transports[sessionId]) {
    return res.status(400).send('Invalid or missing session ID');
  }

  // Establish Server-Sent Events stream
  await transports[sessionId].handleRequest(req, res);
});
```

**When used:**
- After initialization, client can open SSE stream for push notifications
- Server can send updates to client without polling
- Optional feature - not required for basic operation

**DELETE /CiscoMCPRetail/mcp - Session cleanup**
```javascript
app.delete(`${config.serverPath}/mcp`, async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];

  // Clean up session and transport
  await transports[sessionId].handleRequest(req, res);
});
```

**GET /CiscoMCPRetail/health - Health check**
```javascript
app.get(`${config.serverPath}/health`, (req, res) => {
  res.json({
    status: 'healthy',
    service: 'cisco-mcp-retail',
    version: '1.0.0',
    transport: 'streamable-http',
    apiBaseUrl: config.apiBaseUrl,
    timestamp: new Date().toISOString()
  });
});
```

---

## MCP Protocol Implementation

### Protocol Flow: Initialize Session

```
Client                                    Server
  │                                         │
  │  POST /mcp                             │
  │  {                                     │
  │    "jsonrpc": "2.0",                   │
  │    "id": 1,                            │
  │    "method": "initialize",             │
  │    "params": {                         │
  │      "protocolVersion": "2024-11-05",  │
  │      "capabilities": {},               │
  │      "clientInfo": { ... }             │
  │    }                                   │
  │  }                                     │
  ├──────────────────────────────────────→ │
  │                                         │
  │                          Generate UUID  │
  │                       Create transport  │
  │                       Connect MCP server│
  │                                         │
  │                           200 OK        │
  │  {                                     │
  │    "result": {                         │
  │      "protocolVersion": "2024-11-05",  │
  │      "capabilities": { ... },          │
  │      "serverInfo": {                   │
  │        "name": "cisco-mcp-retail",     │
  │        "version": "1.0.0"              │
  │      }                                 │
  │    },                                  │
  │    "jsonrpc": "2.0",                   │
  │    "id": 1                             │
  │  }                                     │
  │  Headers:                              │
  │    Mcp-Session-Id: <uuid>              │
  │ ←──────────────────────────────────────┤
  │                                         │
  │  Save session ID for future requests   │
  │                                         │
```

### Protocol Flow: List Tools

```
Client                                    Server
  │                                         │
  │  POST /mcp                             │
  │  Headers:                              │
  │    Mcp-Session-Id: <uuid>              │
  │  {                                     │
  │    "jsonrpc": "2.0",                   │
  │    "id": 2,                            │
  │    "method": "tools/list",             │
  │    "params": {}                        │
  │  }                                     │
  ├──────────────────────────────────────→ │
  │                                         │
  │               Look up transport by ID   │
  │               Call ListTools handler   │
  │                                         │
  │                           200 OK        │
  │  {                                     │
  │    "result": {                         │
  │      "tools": [                        │
  │        {                               │
  │          "name": "get_customer",       │
  │          "description": "...",         │
  │          "inputSchema": { ... }        │
  │        },                              │
  │        ...                             │
  │      ]                                 │
  │    },                                  │
  │    "jsonrpc": "2.0",                   │
  │    "id": 2                             │
  │  }                                     │
  │ ←──────────────────────────────────────┤
  │                                         │
```

### Protocol Flow: Call Tool

```
Client                                    Server
  │                                         │
  │  POST /mcp                             │
  │  Headers:                              │
  │    Mcp-Session-Id: <uuid>              │
  │  {                                     │
  │    "jsonrpc": "2.0",                   │
  │    "id": 3,                            │
  │    "method": "tools/call",             │
  │    "params": {                         │
  │      "name": "get_customer",           │
  │      "arguments": {                    │
  │        "number": "+13033249089"        │
  │      }                                 │
  │    }                                   │
  │  }                                     │
  ├──────────────────────────────────────→ │
  │                                         │
  │               Call CallTool handler     │
  │               Execute retailClient      │
  │               Call API Gateway ────────→ Cisco API
  │               Receive customer data ←──┤
  │                                         │
  │                           200 OK        │
  │  {                                     │
  │    "result": {                         │
  │      "content": [                      │
  │        {                               │
  │          "type": "text",               │
  │          "text": "{customer JSON}"     │
  │        }                               │
  │      ]                                 │
  │    },                                  │
  │    "jsonrpc": "2.0",                   │
  │    "id": 3                             │
  │  }                                     │
  │ ←──────────────────────────────────────┤
  │                                         │
```

---

## Data Flow

### Complete Request Flow (Get Customer Example)

```
User asks AI Agent: "What's the status of order ORD-123?"
                                    │
                                    ▼
                          AI Agent decides to call tool
                                    │
                                    ▼
          ┌─────────────────────────────────────────────┐
          │  AI Agent sends MCP request:                │
          │  POST http://ciscomcpretail.cxocoe.us/     │
          │       CiscoMCPRetail/mcp                   │
          │  Headers:                                   │
          │    X-API-Key: <your-mcp-api-key>       │
          │                                             │
          │  {                                          │
          │    "method": "tools/call",                  │
          │    "params": {                              │
          │      "name": "get_customer",                │
          │      "arguments": { "number": "ORD-123" }   │
          │    }                                        │
          │  }                                          │
          └──────────────────┬──────────────────────────┘
                             │
                             ▼
          ┌─────────────────────────────────────────────┐
          │  NGINX reverse proxy                        │
          │  Forwards to localhost:3010/                │
          │              CiscoMCPRetail/mcp            │
          └──────────────────┬──────────────────────────┘
                             │
                             ▼
          ┌─────────────────────────────────────────────┐
          │  Express server (server-http.js)            │
          │  app.post('/CiscoMCPRetail/mcp', ...)      │
          │                                             │
          │  • Extracts session ID from headers         │
          │  • Finds existing transport                 │
          │  • Calls transport.handleRequest()          │
          └──────────────────┬──────────────────────────┘
                             │
                             ▼
          ┌─────────────────────────────────────────────┐
          │  StreamableHTTPServerTransport              │
          │  • Parses JSON-RPC request                  │
          │  • Routes to MCP Server                     │
          └──────────────────┬──────────────────────────┘
                             │
                             ▼
          ┌─────────────────────────────────────────────┐
          │  MCP Server                                 │
          │  • Finds CallTool handler                   │
          │  • Calls handler with:                      │
          │    - name: "get_customer"                   │
          │    - args: { number: "ORD-123" }            │
          └──────────────────┬──────────────────────────┘
                             │
                             ▼
          ┌─────────────────────────────────────────────┐
          │  CallTool Handler (server-http.js)          │
          │  switch(name) {                             │
          │    case 'get_customer':                     │
          │      const result = await                   │
          │        retailClient.getCustomer("ORD-123"); │
          │  }                                          │
          └──────────────────┬──────────────────────────┘
                             │
                             ▼
          ┌─────────────────────────────────────────────┐
          │  retailClient.getCustomer() (retailClient.js)│
          │                                             │
          │  const response = await fetch(              │
          │    'https://apigateway.cxocoe.us/           │
          │     customer/ORD-123',                      │
          │    {                                        │
          │      headers: {                             │
          │        'x-api-key': config.apiKeyRetail     │
          │      }                                      │
          │    }                                        │
          │  );                                         │
          └──────────────────┬──────────────────────────┘
                             │
                             ▼
          ┌─────────────────────────────────────────────┐
          │  Cisco API Gateway                          │
          │  GET /customer/ORD-123                      │
          │                                             │
          │  Returns:                                   │
          │  {                                          │
          │    "orderId": "ORD-123",                    │
          │    "phoneNumber": "+13033249089",           │
          │    "fName": "John",                         │
          │    "lName": "Doe",                          │
          │    "deliveryStatus": "In Transit",          │
          │    ...                                      │
          │  }                                          │
          └──────────────────┬──────────────────────────┘
                             │
                    ◄────────┘ Response flows back up
                             │
          ┌─────────────────▼────────────────────────────┐
          │  CallTool Handler                            │
          │  return {                                    │
          │    content: [                                │
          │      {                                       │
          │        type: 'text',                         │
          │        text: JSON.stringify(result, null, 2) │
          │      }                                       │
          │    ]                                         │
          │  };                                          │
          └──────────────────┬──────────────────────────┘
                             │
                             ▼
          ┌─────────────────────────────────────────────┐
          │  MCP Server wraps in JSON-RPC response      │
          │  {                                          │
          │    "result": {                              │
          │      "content": [...]                       │
          │    },                                       │
          │    "jsonrpc": "2.0",                        │
          │    "id": 3                                  │
          │  }                                          │
          └──────────────────┬──────────────────────────┘
                             │
                             ▼
          ┌─────────────────────────────────────────────┐
          │  StreamableHTTPServerTransport              │
          │  • Serializes to JSON                       │
          │  • Sets content-type: application/json      │
          │  • Returns HTTP 200                         │
          └──────────────────┬──────────────────────────┘
                             │
                             ▼
          ┌─────────────────────────────────────────────┐
          │  Express sends response to client           │
          └──────────────────┬──────────────────────────┘
                             │
                             ▼
          ┌─────────────────────────────────────────────┐
          │  NGINX forwards back to AI Agent            │
          └──────────────────┬──────────────────────────┘
                             │
                             ▼
          ┌─────────────────────────────────────────────┐
          │  AI Agent receives customer data            │
          │  • Parses JSON                              │
          │  • Understands order status                 │
          │  • Formulates natural language response     │
          └──────────────────┬──────────────────────────┘
                             │
                             ▼
                    User sees: "Order ORD-123 is currently
                    In Transit. It's being delivered to
                    John Doe at [address]..."
```

---

## Testing Strategy

### Test Files Overview

| File | Purpose | Use Case |
|------|---------|----------|
| `test-all-servers.js` | Tests all 3 servers (local + public) | Daily verification |
| `test-public-mcp.js` | Tests public endpoints only | Cloud deployment testing |
| `test-mcp-client.js` | Interactive MCP client with Anthropic AI | End-to-end AI agent testing |
| `debug-init.js` | Deep debug of initialization | Troubleshooting connections |
| `test-server.js` | Full test suite with UI | Comprehensive testing |

### Test Coverage

**Health Check Tests:**
- Server is running
- Health endpoint responds
- Service name is correct
- Transport type is declared

**MCP Protocol Tests:**
- Session initialization
- Session ID generation
- Tools list retrieval
- Tool execution
- Resource listing
- Resource reading

**Network Tests:**
- Local endpoint accessibility
- Public endpoint via NGINX
- CORS headers
- Session management across requests

**Integration Tests:**
- Full flow from initialize → list tools → call tool
- API Gateway connectivity
- Authentication (API key/JWT)
- Error handling

### Running Tests

```bash
# Interactive MCP client with Anthropic AI (requires ANTHROPIC_API_KEY)
npm run test:client

# Quick test all servers
npm run test:all

# Test public endpoints only
npm run test:public

# Debug specific server
npm run debug

# Full test suite
npm test
```

### Interactive MCP Client (test-mcp-client.js)

The `test-mcp-client.js` script provides the most comprehensive end-to-end testing by integrating Anthropic AI with your MCP server:

**What it does:**
1. Connects to your MCP server with X-API-Key authentication
2. Discovers available tools via MCP protocol
3. Provides an interactive chat interface where you ask questions in natural language
4. Anthropic AI automatically decides which MCP tools to use
5. Executes tool calls and returns natural language responses

**Requirements:**
- `ANTHROPIC_API_KEY` in your `.env` file (get from https://console.anthropic.com/)
- MCP server running (local or production)

**Example workflow:**
```
You: Show me all retail customers
  → AI agent uses get_all_customers tool
  → Displays customer list in natural language

You: Look up customer with phone +13033249089
  → AI agent uses get_customer tool
  → Provides customer details

You: quit
  → Exits interactive session
```

This is the **closest simulation** to how WxConnect will use your MCP server in production!

---

## Deployment Architecture

### Local Development
```
Your Mac
  ├── Retail Server (localhost:3010)
  ├── Healthcare Server (localhost:3011)
  └── Insurance Server (localhost:3012)
```

### Cloud Production
```
Cloud Server (cxocoe.us domain with multiple hostnames)
  │
  ├── NGINX (Port 80)
  │   ├── ciscomcpretail.cxocoe.us/CiscoMCPRetail/* → localhost:3010
  │   ├── ciscomcphealth.cxocoe.us/CiscoMCPHealthcare/* → localhost:3011
  │   └── ciscomcpinsurance.cxocoe.us/CiscoMCPInsurance/* → localhost:3012
  │
  ├── PM2 Process Manager
  │   ├── retail-http (npm run start:http)
  │   ├── healthcare-http (npm run start:http)
  │   └── insurance-http (npm run start:http)
  │
  └── Node.js Servers
      ├── CiscoMCPRetail (Port 3010)
      ├── CiscoMCPHealthcare (Port 3011)
      └── CiscoMCPInsurance (Port 3012)
```

### NGINX Configuration Highlights

```nginx
location /CiscoMCPRetail/ {
    proxy_pass http://localhost:3010/CiscoMCPRetail/;

    # Critical headers for Streamable HTTP
    proxy_set_header Mcp-Session-Id $http_mcp_session_id;
    proxy_set_header Last-Event-Id $http_last_event_id;

    # Required for API key authentication
    proxy_set_header X-API-Key $http_x_api_key;

    # Disable buffering for streaming
    proxy_buffering off;
    proxy_cache off;

    # Long timeouts for persistent connections
    proxy_read_timeout 3600s;
}
```

**Why these settings matter:**
- `Mcp-Session-Id` - Pass session ID to backend
- `Last-Event-Id` - Enable resumability
- `X-API-Key` - Pass authentication header to backend
- `proxy_buffering off` - Allow streaming responses
- Long timeouts - Support long-running operations

### Environment Variables

**.env file:**
```bash
# API Configuration
API_BASE_URL=https://apigateway.cxocoe.us
AUTH_MODE=apikey

# Authentication
API_KEY_RETAIL=your-retail-api-key-here
JWT_TOKEN=your-jwt-token-here  # Alternative to API key

# Server Configuration
SERVER_PORT=3010
SERVER_PATH=/CiscoMCPRetail

# MCP Server Authentication
MCP_API_KEY=your-mcp-api-key-here

# Anthropic API Key (optional - for test-mcp-client.js only)
# Required for the interactive MCP client tester with Anthropic AI integration
# Get your key from: https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

**Security Notes:**
- Never commit `.env` to git (included in `.gitignore`)
- Use different API keys for dev/staging/prod
- Rotate keys regularly
- Use JWT tokens for enhanced security in production

---

## Common Issues & Solutions

### Issue: "Session ID required but not provided"
**Cause:** Client didn't include `Mcp-Session-Id` header in follow-up request.
**Solution:** Ensure client saves session ID from initialize response and includes it in subsequent requests.

### Issue: Requests timing out
**Cause:** `enableJsonResponse: false` (default SDK behavior).
**Solution:** Set `enableJsonResponse: true` in StreamableHTTPServerTransport config.

### Issue: CORS errors in browser
**Cause:** Missing CORS headers.
**Solution:** Verify CORS middleware is configured and `exposedHeaders` includes `Mcp-Session-Id`.

### Issue: 401/403 from API Gateway
**Cause:** Invalid or missing API key/JWT.
**Solution:** Check `.env` file, verify `AUTH_MODE` matches credential type.

### Issue: "Cannot find module" errors
**Cause:** Dependencies not installed.
**Solution:** Run `npm install` in project directory.

---

## Key Takeaways

1. **enableJsonResponse: true** - This single setting was critical for preventing infinite loops and making the server work with HTTP clients.

2. **Session Management** - The transport map (`transports` object) maintains state across requests, enabling stateful conversations.

3. **Event Store** - Provides resumability, allowing clients to reconnect and catch up after network interruptions.

4. **Separation of Concerns** -
   - `config.js` - Configuration
   - `retailClient.js` - API communication
   - `server-http.js` - MCP protocol implementation
   - Test files - Validation

5. **NGINX as Gateway** - Reverse proxy provides:
   - Single public IP for multiple services
   - SSL termination (when configured)
   - Load balancing (future)
   - Path-based routing

6. **MCP Protocol** - Standardized way for AI to:
   - Discover available tools
   - Call functions with type-safe schemas
   - Access data resources
   - Maintain sessions

---

## Next Steps

**For Production:**
1. Enable HTTPS in NGINX with SSL certificates
2. Implement rate limiting
3. Add request logging and monitoring
4. Set up PM2 for process management
5. Configure log rotation
6. Add health check monitoring

**For Features:**
1. Add more tools (e.g., analytics, reporting)
2. Implement webhooks for real-time updates
3. Add caching layer for frequently accessed data
4. Implement batch operations
5. Add admin dashboard

**For Security:**
1. Implement request signing
2. Add IP whitelisting
3. Enable audit logging
4. Implement role-based access control
5. Add request validation middleware

---

## Questions?

If you have questions about any part of this architecture:

1. Check the inline code comments in the specific file
2. Run the test scripts to see it in action
3. Use `debug-init.js` to inspect the protocol messages
4. Review MCP SDK documentation: https://modelcontextprotocol.io

**Happy coding!** 🚀
