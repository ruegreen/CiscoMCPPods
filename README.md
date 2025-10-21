# Cisco MCP Pods Server

An MCP (Model Context Protocol) server that connects to the Cisco API Gateway pods endpoints. This server enables AI agents (like Claude Desktop or Webex Connect) to interact with pod management data, manage pod configurations, update pod credentials, and perform complete CRUD operations through natural language.

## Table of Contents

- [Deployment Modes](#deployment-modes)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage: Claude Desktop (Local)](#usage-claude-desktop-local)
- [Usage: Cloud Deployment (WxConnect)](#usage-cloud-deployment-wxconnect)
- [Testing](#testing)
- [API Endpoints Mapping](#api-endpoints-mapping)
- [Troubleshooting](#troubleshooting)

## Deployment Modes

This server supports **three transport modes**:

### 1. stdio (Standard I/O) - For Claude Desktop
- **File:** `src/index.js`
- **Communication:** stdin/stdout
- **Usage:** Runs locally as a child process
- **Perfect for:** Claude Desktop application
- **Remote Access:** ❌ Cannot be accessed remotely
- **Command:** `npm start`

### 2. SSE (Server-Sent Events) - For Remote AI Agents
- **File:** `src/server-sse.js`
- **Port:** 1013
- **Endpoint:** `/CiscoMCPPods/sse`
- **Usage:** HTTP server with one-way streaming
- **Perfect for:** Legacy remote AI agents
- **Remote Access:** ✅ Can be deployed in the cloud
- **Command:** `npm run start:sse`

### 3. Streamable HTTP - For Modern Remote AI Agents (Recommended)
- **File:** `src/server-http.js`
- **Port:** 1013
- **Endpoint:** `/CiscoMCPPods/mcp`
- **Usage:** HTTP server with bidirectional communication, session management, and resumability
- **Perfect for:** WxConnect and modern AI agents that support the latest MCP spec
- **Remote Access:** ✅ Can be deployed in the cloud
- **Features:** Session-based, event replay, connection resumability
- **Command:** `npm run start:http`

### Which Transport Should I Use?

| Scenario | Recommended Transport | Why |
|----------|----------------------|-----|
| Claude Desktop (local) | stdio | Fastest, most efficient for local use |
| WxConnect (cloud) | Streamable HTTP | Modern protocol with resumability and better error handling |
| Legacy AI agents | SSE | Older protocol, widely supported |
| Testing locally | Any | All modes support local testing |

## Features

### Tools (7 available)
- **get_pod_keyword** - Get the pod keyword/password record
- **update_pod_keyword** - Update the pod keyword/password with a new value
- **get_all_pods** - Get all pods from a specific collection (ciscolivepods, coelabpods, etc.)
- **get_pod_by_number** - Get a specific pod by its number from a collection
- **create_pod** - Create new pod records in a collection
- **update_pod** - Update existing pod information (status, credentials, test data, etc.)
- **delete_pod** - Delete pod records from a collection

### Resources (2 available)
- **pods://keyword** - Access the current pod keyword configuration
- **pods://config** - View current API configuration and connection status

## Prerequisites

1. **Node.js** >= 18.0.0 (for built-in fetch support and ES modules)
2. **Cisco API Gateway** - Remote: `http://apigateway.cxocoe.us` or Local: `http://localhost:3002`
3. Valid **API Key** or **JWT token** for authentication

## Installation

```bash
# Clone or navigate to the project directory
cd CiscoMCPPods

# Install dependencies
npm install
```

## Configuration

### Environment Variables

Copy the example environment file and edit it:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Cisco API Gateway Configuration
API_BASE_URL=http://apigateway.cxocoe.us

# Authentication (API Key recommended)
API_KEY_PODS=f42a9c8e3d7b1f6a2c5e8d4b9f3a6c1e7b5d2f9a8c4e1b6d3f7a2c5e8b1d4f9a3c6
AUTH_MODE=apikey

# MCP Server Configuration (for SSE/HTTP transport modes only)
SERVER_PORT=1013
SERVER_PATH=/CiscoMCPPods

# Public hostname (for deployment)
PUBLIC_HOSTNAME=ciscomcppods.cxocoe.us

# MCP Server Authentication
# API key required for client connections to this MCP server
# Generate a secure random key: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
MCP_API_KEY=your-mcp-api-key-here

# Anthropic API Key (optional - for test-mcp-client.js only)
# Required for the interactive MCP client tester with Anthropic AI integration
# Get your key from: https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

**Important:**
- The `API_BASE_URL` points to your **Cisco API Gateway** (backend), not the MCP server itself.
- The `MCP_API_KEY` is used to authenticate clients connecting to this MCP server (not the API Gateway).

---

## Usage: Claude Desktop (Local)

Claude Desktop is a desktop application that can run MCP servers locally on your computer.

### Step 1: Locate Configuration File

On macOS:
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

On Windows:
```
%APPDATA%/Claude/claude_desktop_config.json
```

### Step 2: Edit Configuration

Open the file and add your MCP server configuration:

```json
{
  "mcpServers": {
    "cisco-pods": {
      "command": "/Users/YOUR_USERNAME/.nvm/versions/node/v18.20.8/bin/node",
      "args": [
        "/FULL/PATH/TO/CiscoMCPPods/src/index.js"
      ]
    }
  }
}
```

**Important Notes:**
- Replace `/Users/YOUR_USERNAME/` with your actual user path
- Replace `/FULL/PATH/TO/` with the actual path to your project
- Use **full absolute paths**, not relative paths
- Point to Node.js 18+ (not the system default if it's older)
- Use `src/index.js` for stdio mode, **NOT** `src/server-sse.js` or `src/server-http.js`

### Step 3: Find Your Node.js Path

If using nvm:
```bash
which node
# or
nvm which 18
```

If using system Node.js:
```bash
which node
```

Use the full path in the config file.

### Step 4: Restart Claude Desktop

1. **Quit Claude Desktop completely** (Cmd+Q on Mac, or close completely on Windows)
2. **Reopen Claude Desktop**
3. The MCP server will start automatically

### Step 5: Verify Connection

In Claude Desktop, try these prompts:

```
What tools do you have access to?
```

```
Get all pods from the ciscolivepods collection
```

```
Get pod keyword configuration
```

If connected successfully, AI agent will list the 7 pods tools and be able to execute them.

### Troubleshooting Claude Desktop

**If you see "Server disconnected":**

1. **Check the logs:**
   ```bash
   tail -f ~/Library/Logs/Claude/mcp-server-cisco-pods.log
   ```

2. **Common issues:**
   - **Wrong Node.js version**: Must be 18+, check logs for syntax errors
   - **.env not loading**: Check that `.env` file exists in project root
   - **API key missing**: Check logs for "API_KEY_PODS is not configured"
   - **Path errors**: Make sure all paths in config are absolute, not relative

3. **Verify Node version:**
   ```bash
   /path/to/your/node --version
   # Should output v18.x.x or higher
   ```

---

## Usage: Cloud Deployment (WxConnect)

Deploy the server to the cloud for remote AI agents like Webex Connect.

### Step 1: Choose Your Transport Mode

**Streamable HTTP (Recommended for WxConnect):**
- Modern protocol with session management
- Automatic reconnection and event replay
- Better error handling
- Use `npm run start:http`

**SSE (Legacy):**
- Simpler protocol
- One-way streaming
- Use `npm run start:sse`

**For this guide, we'll use Streamable HTTP as it's the recommended approach.**

### Step 2: Prepare for Deployment

1. **Update `.env` for production:**
   ```env
   API_BASE_URL=http://apigateway.cxocoe.us
   API_KEY_RETAIL=your-production-api-key
   AUTH_MODE=apikey
   SERVER_PORT=3010
   SERVER_PATH=/CiscoMCPRetail
   ```

2. **Ensure .gitignore excludes `.env`:**
   ```bash
   # Check .gitignore includes:
   .env
   node_modules/
   ```

### Step 3: Deploy to Your Server

**Via SCP/SFTP:**
```bash
# Copy project to server
scp -r CiscoMCPRetail user@your-server:/path/to/apps/
```

**Via Git:**
```bash
# On your server
cd /path/to/apps
git clone your-repo-url CiscoMCPRetail
cd CiscoMCPRetail
npm install
cp .env.example .env
nano .env  # Edit with your settings
```

### Step 4: Run Server

**For testing:**
```bash
# Streamable HTTP (Recommended)
npm run start:http

# OR SSE (Legacy)
npm run start:sse
```

**For production (with PM2):**
```bash
# Install PM2 globally
npm install -g pm2

# Start server with Streamable HTTP
pm2 start npm --name "mcp-retail-http" -- run start:http

# OR with SSE
pm2 start npm --name "mcp-retail-sse" -- run start:sse

# Save PM2 process list
pm2 save

# Set PM2 to start on boot
pm2 startup
```

**For production (with systemd):**

Create `/etc/systemd/system/mcp-retail.service`:
```ini
[Unit]
Description=MCP Retail Server (Streamable HTTP)
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/CiscoMCPRetail
ExecStart=/usr/bin/node src/server-http.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable mcp-retail
sudo systemctl start mcp-retail
sudo systemctl status mcp-retail
```

### Step 5: Configure NGINX Reverse Proxy (Optional)

For Streamable HTTP, create NGINX configuration:

```nginx
server {
    listen 80;
    server_name ciscomcppods.cxocoe.us ciscomcpretail.cxocoe.us ciscomcphealth.cxocoe.us ciscomcpinsurance.cxocoe.us;

    # Pods MCP Server (Streamable HTTP)
    location /CiscoMCPPods/ {
        proxy_pass http://localhost:1013;
        proxy_http_version 1.1;

        # Required for Streamable HTTP
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header Mcp-Session-Id $http_mcp_session_id;
        proxy_set_header Last-Event-Id $http_last_event_id;

        # Required for API key authentication
        proxy_set_header X-API-Key $http_x_api_key;

        # Timeouts for long-lived connections
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_connect_timeout 75s;

        # SSE specific
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/mcp-retail /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 6: Test Cloud Deployment

**Test health endpoint:**
```bash
curl http://ciscomcppods.cxocoe.us/CiscoMCPPods/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "cisco-mcp-pods",
  "version": "1.0.0",
  "transport": "streamable-http",
  "apiBaseUrl": "http://apigateway.cxocoe.us",
  "timestamp": "2025-10-18T00:00:00.000Z"
}
```

**Test MCP endpoint (with authentication):**
```bash
curl -X POST http://ciscomcppods.cxocoe.us/CiscoMCPPods/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "X-API-Key: your-mcp-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test-client", "version": "1.0.0"}
    }
  }'
```

### Step 7: Register with WxConnect

Once deployed, register your MCP server with Webex Connect:

**For Streamable HTTP:**
- **Endpoint URL:** `http://ciscomcppods.cxocoe.us/CiscoMCPPods/mcp`
- **Transport Type:** Streamable HTTP
- **Authentication:** Include `X-API-Key` header with your MCP API key

**For SSE (Legacy):**
- **Endpoint URL:** `http://ciscomcppods.cxocoe.us/CiscoMCPPods/sse`
- **Transport Type:** SSE (Server-Sent Events)
- **Authentication:** Include `X-API-Key` header with your MCP API key

WxConnect will validate the connection and start using your MCP server.

---

## Testing

### Local Testing (stdio mode)

Use Claude Desktop - see [Usage: Claude Desktop](#usage-claude-desktop-local)

### Cloud Testing (HTTP/SSE modes)

#### 1. Health Check
```bash
curl http://localhost:1013/CiscoMCPPods/health
```

#### 2. Server Info
```bash
curl http://localhost:1013/
```

#### 3. Streamable HTTP Connection Test
```bash
# Initialize session
curl -X POST http://localhost:1013/CiscoMCPPods/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test", "version": "1.0.0"}
    }
  }'
```

#### 4. SSE Connection Test
```bash
curl -N http://localhost:1013/CiscoMCPPods/sse
```

#### 5. Automated Test Script

Run the included test script:
```bash
npm test
```

This comprehensive test suite includes:
- Server status check
- Health endpoint validation
- SSE connection test
- Message endpoint test
- Beautiful colored output with test results

#### 6. Interactive MCP Client with Anthropic AI (NEW!)

Test your MCP server end-to-end with a full AI agent integration:

```bash
npm run test:client
```

This interactive test tool:
- ✅ Connects to your production MCP server with X-API-Key authentication
- ✅ Integrates with Anthropic AI to demonstrate real agent-tool interaction
- ✅ Provides an interactive chat interface - ask questions in natural language
- ✅ AI agent automatically discovers and uses your MCP tools
- ✅ See real-time tool execution and results
- ✅ Validates the complete MCP workflow before WxConnect integration

**Requirements:**
- `ANTHROPIC_API_KEY` in your `.env` file (get one at https://console.anthropic.com/)
- Production MCP server running (or use localhost for testing)

**Example session:**
```
You: Show me all pods from ciscolivepods collection
[AI agent uses get_all_pods tool and displays results]

You: Get pod number 1 from ciscolivepods
[AI agent uses get_pod_by_number tool with the collection and number]

You: What's the pod keyword?
[AI agent uses get_pod_keyword tool]

You: quit
[Exits the interactive session]
```

This is the closest simulation to how WxConnect will use your MCP server!

#### 7. MCP Inspector (Official Tool)

For Streamable HTTP:
```bash
npx @modelcontextprotocol/inspector http http://localhost:1013/CiscoMCPPods/mcp
```

For SSE:
```bash
npx @modelcontextprotocol/inspector sse http://localhost:1013/CiscoMCPPods/sse
```

This opens a web UI where you can:
- View all available tools
- Test each tool with different parameters
- View resources
- See JSON-RPC message flow
- Monitor session state (for Streamable HTTP)

---

## API Endpoints Mapping

This MCP server connects to the following Cisco API Gateway endpoints:

| MCP Tool | API Endpoint | Method |
|----------|-------------|---------|
| get_pod_keyword | `/api/v2/pods/keyword` | GET |
| update_pod_keyword | `/api/v2/pods/keyword` | PATCH |
| get_all_pods | `/api/v2/pods/{collection}` | GET |
| get_pod_by_number | `/api/v2/pods/{collection}/{number}` | GET |
| create_pod | `/api/v2/pods/{collection}` | POST |
| update_pod | `/api/v2/pods/{collection}/{number}` | PATCH |
| delete_pod | `/api/v2/pods/{collection}/{number}` | DELETE |

---

## Project Structure

```
CiscoMCPPods/
├── src/
│   ├── index.js          # MCP server (stdio mode for Claude Desktop)
│   ├── server-sse.js     # MCP server (SSE mode for legacy AI agents)
│   ├── server-http.js    # MCP server (Streamable HTTP for modern AI agents)
│   ├── podsClient.js     # API client for pods endpoints
│   └── config.js         # Configuration management
├── .env                  # Environment variables (not in git)
├── .env.example          # Environment template
├── test-server.js        # Comprehensive test suite
├── nginx.conf.example    # NGINX reverse proxy configuration
├── package.json          # Project configuration
├── .gitignore           # Git ignore rules
└── README.md            # Documentation
```

---

## Troubleshooting

### Claude Desktop Issues

**Server Disconnected:**
```bash
# Check logs
tail -f ~/Library/Logs/Claude/mcp-server-cisco-retail.log

# Common fixes:
# 1. Use Node.js 18+ (check path in config)
# 2. Use absolute paths in claude_desktop_config.json
# 3. Ensure .env file exists with API_KEY_RETAIL
```

**API Authentication Errors:**
- Check `.env` file exists in project root
- Verify `API_KEY_PODS` is set correctly
- Check `API_BASE_URL` points to Cisco API Gateway

### Cloud Deployment Issues

**Port Already in Use:**
```bash
# Find what's using port 1013
lsof -i :1013
# or
netstat -tulpn | grep 1013

# Kill the process or use different port
```

**Health Check Fails:**
```bash
# Check if server is running
ps aux | grep server-http.js

# Check server logs
journalctl -u mcp-retail -f  # if using systemd
pm2 logs mcp-retail          # if using PM2
```

**Session Issues (Streamable HTTP):**
- Verify `Mcp-Session-Id` header is being sent correctly
- Check server logs for session initialization messages
- Ensure NGINX passes through session headers

**NGINX Issues:**
```bash
# Test NGINX config
sudo nginx -t

# Check NGINX error log
sudo tail -f /var/log/nginx/error.log

# Restart NGINX
sudo systemctl restart nginx
```

**Firewall Issues:**
```bash
# Allow port 3010 (if not using NGINX)
sudo ufw allow 3010/tcp

# Allow port 80 (if using NGINX)
sudo ufw allow 80/tcp
```

### API Gateway Connection Issues

**Cannot reach API Gateway:**
- Verify `API_BASE_URL` in `.env`
- Test connection manually:
  ```bash
  curl http://apigateway.cxocoe.us/api/v2/pods/keyword \
    -H "x-api-key: YOUR_API_KEY"
  ```

**Authentication Failures:**
- Verify API key matches your Cisco API Gateway configuration
- Check if API key has 'pods' permissions
- Try with master API key for testing

---

## Running Multiple MCP Servers

To run Pods, Healthcare, Insurance, and Retail MCP servers together:

1. **Each server has its own directory:**
   ```
   CiscoMCPPods/       (Port 1013)
   CiscoMCPRetail/     (Port 3010)
   CiscoMCPHealthcare/ (Port 3011)
   CiscoMCPInsurance/  (Port 3012)
   ```

2. **Each has unique configuration in `.env`:**
   ```env
   # Pods
   SERVER_PORT=1013
   SERVER_PATH=/CiscoMCPPods
   API_KEY_PODS=f42a9c8e3d7b1f6a2c5e8d4b9f3a6c1e7b5d2f9a8c4e1b6d3f7a2c5e8b1d4f9a3c6

   # Healthcare
   SERVER_PORT=3011
   SERVER_PATH=/CiscoMCPHealthcare
   API_KEY_HEALTH=b81108cab4b0d0db3beccc9c2a71888d43d4d7acddc7b9024ee715c15474a856

   # Insurance
   SERVER_PORT=3012
   SERVER_PATH=/CiscoMCPInsurance
   API_KEY_INSURANCE=e64d49daa3709f4ebaa60d6cd0513162b3216860961315a34646e99666900b0a
   ```

3. **Update NGINX to proxy all four** (add location blocks for each)

4. **Register each with WxConnect (with API key authentication):**
   - Pods: `http://ciscomcppods.cxocoe.us/CiscoMCPPods/mcp`
   - Retail: `http://ciscomcpretail.cxocoe.us/CiscoMCPRetail/mcp`
   - Healthcare: `http://ciscomcphealth.cxocoe.us/CiscoMCPHealthcare/mcp`
   - Insurance: `http://ciscomcpinsurance.cxocoe.us/CiscoMCPInsurance/mcp`

   **Important:** Include `X-API-Key` header with each server's unique API key

---

## Security Considerations

**For Production Deployment:**

1. **Use HTTPS** - Update NGINX config with SSL certificates
2. **Firewall** - Only expose necessary ports (1013 for Pods)
3. **API Keys** - Store in environment variables, never commit to git
4. **NGINX** - Use as reverse proxy instead of exposing Node.js directly
5. **Rate Limiting** - Configure in NGINX
6. **Monitoring** - Set up health check monitoring
7. **Session Security** - For Streamable HTTP, consider implementing session timeout policies

---

## Transport Comparison

| Feature | stdio | SSE | Streamable HTTP |
|---------|-------|-----|-----------------|
| Local Use | ✅ Best | ❌ Not needed | ❌ Not needed |
| Remote Use | ❌ No | ✅ Yes | ✅ Yes |
| Session Management | N/A | ❌ No | ✅ Yes |
| Resumability | N/A | ❌ No | ✅ Yes |
| Event Replay | N/A | ❌ No | ✅ Yes |
| Bidirectional | ✅ Yes | ❌ One-way | ✅ Yes |
| Connection Recovery | N/A | ⚠️ Manual | ✅ Automatic |
| WxConnect Support | ❌ No | ✅ Yes (Legacy) | ✅ Yes (Recommended) |

---

## Author

**Rue Green**
Customer Care Architect and Developer
Cisco Systems, INC.

---

## License

MIT

---

## Support

For issues or questions:
1. Check logs (Claude Desktop or server logs)
2. Verify `.env` configuration
3. Test API Gateway connection directly
4. Review error messages for specific issues
5. Run `npm test` to verify server functionality

**Version:** 1.0.0
**Last Updated:** October 2025
