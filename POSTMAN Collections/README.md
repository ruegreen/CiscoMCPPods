# Cisco MCP Servers - Postman Test Collection

This folder contains a comprehensive Postman collection for testing all three Cisco MCP servers (Retail, Healthcare, and Insurance) in both production and local environments.

## Collection File

**File:** `Cisco-MCP-Servers-Complete-Test-Suite.postman_collection.json`

## Features

### Coverage
- **3 MCP Servers:** Retail, Healthcare, Insurance
- **2 Environments:** Production (public URLs) and Local (localhost)
- **Complete MCP Protocol Testing:**
  - Health checks
  - Session initialization
  - List tools
  - Call tools with examples
  - List resources
  - Read resources

### Automated Tests
Each request includes automated test scripts that validate:
- HTTP status codes
- Response structure
- Session management
- Server information
- Tool availability

### Session Management
The collection automatically:
- Captures session IDs from initialization responses
- Stores them in collection variables
- Includes them in subsequent requests
- Manages separate sessions for production and local environments

## How to Use

### 1. Import Collection

1. Open Postman
2. Click **Import** button
3. Select the `Cisco-MCP-Servers-Complete-Test-Suite.postman_collection.json` file
4. Click **Import**

### 2. Verify Collection Variables

The collection includes pre-configured API keys for all three servers:

- `retail_mcp_api_key` - Authentication for Retail MCP server
- `healthcare_mcp_api_key` - Authentication for Healthcare MCP server
- `insurance_mcp_api_key` - Authentication for Insurance MCP server

These are automatically loaded from your `.env` files.

**To view/edit variables:**
1. Right-click the collection
2. Select **Edit**
3. Go to **Variables** tab

### 3. Run Individual Requests

**Recommended workflow for each server:**

1. **Health Check** - Verify server is running
2. **Initialize Session** - Create new session and capture session ID
3. **List Tools** - See available tools
4. **Call Tool** - Execute a sample tool call
5. **List Resources** - View available resources

### 4. Run Entire Collection

Use Postman's **Collection Runner** for automated testing:

1. Click the collection name
2. Click **Run** button
3. Select which folder to run (or run all)
4. Click **Run Cisco MCP Servers**
5. View test results

### 5. Test Production vs Local

**Production Endpoints:**
- Retail: `http://ciscomcpretail.cxocoe.us/CiscoMCPRetail/mcp`
- Healthcare: `http://ciscomcphealth.cxocoe.us/CiscoMCPHealthcare/mcp`
- Insurance: `http://ciscomcpinsurance.cxocoe.us/CiscoMCPInsurance/mcp`

**Local Endpoints:**
- Retail: `http://localhost:3010/CiscoMCPRetail/mcp`
- Healthcare: `http://localhost:3011/CiscoMCPHealthcare/mcp`
- Insurance: `http://localhost:3012/CiscoMCPInsurance/mcp`

**Note:** For local testing, ensure the respective servers are running locally:
```bash
# In each server directory:
npm run start:http
```

## Collection Structure

```
Cisco MCP Servers - Complete Test Suite/
├── Retail Server/
│   ├── Production (ciscomcpretail.cxocoe.us)/
│   │   ├── Health Check
│   │   ├── Initialize Session
│   │   ├── List Tools
│   │   ├── Call Tool - Get All Customers
│   │   └── List Resources
│   └── Local (localhost:3010)/
│       ├── Health Check
│       ├── Initialize Session
│       └── List Tools
├── Healthcare Server/
│   ├── Production (ciscomcphealth.cxocoe.us)/
│   │   ├── Health Check
│   │   ├── Initialize Session
│   │   ├── List Tools
│   │   └── Call Tool - Get All Patients
│   └── Local (localhost:3011)/
│       ├── Health Check
│       ├── Initialize Session
│       └── List Tools
└── Insurance Server/
    ├── Production (ciscomcpinsurance.cxocoe.us)/
    │   ├── Health Check
    │   ├── Initialize Session
    │   ├── List Tools
    │   └── Call Tool - Get All Claims
    └── Local (localhost:3012)/
        ├── Health Check
        ├── Initialize Session
        └── List Tools
```

## Understanding the Tests

### Health Check Tests
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Service name is correct", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.service).to.eql('cisco-mcp-retail');
});
```

### Initialize Session Tests
```javascript
pm.test("Response has session ID in headers", function () {
    pm.expect(pm.response.headers.get('Mcp-Session-Id')).to.exist;
    pm.collectionVariables.set('retail_prod_session_id',
                                pm.response.headers.get('Mcp-Session-Id'));
});
```

### List Tools Tests
```javascript
pm.test("Has expected retail tools", function () {
    var jsonData = pm.response.json();
    var toolNames = jsonData.result.tools.map(t => t.name);
    pm.expect(toolNames).to.include('get_customer');
    pm.expect(toolNames).to.include('get_all_customers');
});
```

## Troubleshooting

### Issue: "Could not get any response"
**Cause:** Server is not running or URL is incorrect
**Solution:**
- For local: Ensure server is running (`npm run start:http`)
- For production: Verify server URL and network connectivity

### Issue: "401 Unauthorized" or "403 Forbidden"
**Cause:** Invalid or missing API key
**Solution:**
- Check collection variables have correct API keys
- Verify `X-API-Key` header is included in request
- Ensure API key matches the server's `.env` file

### Issue: "Session ID required but not provided"
**Cause:** Session not initialized or session ID not captured
**Solution:**
1. Run "Initialize Session" request first
2. Verify session ID was captured (check collection variables)
3. Ensure subsequent requests include `Mcp-Session-Id` header

### Issue: Tests failing
**Cause:** Response format changed or server error
**Solution:**
- Check response body in Postman
- Verify server logs for errors
- Update test scripts if needed

## Advanced Usage

### Create Environment Variables

Instead of using collection variables, you can create Postman environments:

1. Click **Environments** in left sidebar
2. Click **+** to create new environment
3. Add variables:
   ```
   retail_mcp_api_key
   healthcare_mcp_api_key
   insurance_mcp_api_key
   base_url_prod (http://ciscomcpretail.cxocoe.us)
   base_url_local (http://localhost:3010)
   ```
4. Select environment before running requests

### Export Test Results

After running collection:
1. Click **Export Results** in Collection Runner
2. Choose format (JSON, CSV, etc.)
3. Save for reporting or CI/CD integration

### Integrate with CI/CD

Use Newman (Postman CLI) for automated testing:

```bash
# Install Newman
npm install -g newman

# Run collection
newman run "Cisco-MCP-Servers-Complete-Test-Suite.postman_collection.json"

# Run with environment
newman run collection.json -e environment.json

# Generate HTML report
newman run collection.json --reporters cli,html
```

## MCP Protocol Reference

### Initialize Request
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "Postman Test Client",
      "version": "1.0.0"
    }
  }
}
```

### List Tools Request
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

### Call Tool Request
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "get_customer",
    "arguments": {
      "number": "+13033249089"
    }
  }
}
```

## API Keys

The collection includes the following pre-configured API keys (from .env files):

- **Retail:** `b4ae5b83b412a620f5d509a9ed1d0ed02718f7fef6ed2cd72a4090ae0d9f4b79`
- **Healthcare:** `4e1ae90d9ffddbb9940a8e2b80d9b40e0c7ff7fc7f21625ea99226c612a74066`
- **Insurance:** `b0b702567dcf095da6b939f6f77319b18c6dbb1bf9f84c3cee2b3a459d6b2031`

**Security Note:** These API keys authenticate clients to the MCP servers. Keep them secure and rotate regularly for production use.

## Support

For issues or questions:
1. Check server logs
2. Verify API keys are correct
3. Ensure servers are running
4. Review Postman console for detailed request/response data

## Related Documentation

- Main README: `../README.md`
- Architecture Guide: `../ARCHITECTURE.md`
- Test Scripts: `../test-*.js`

---

**Last Updated:** October 2025
**Version:** 1.0.0
