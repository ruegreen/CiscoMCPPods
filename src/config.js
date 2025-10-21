import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the project root
dotenv.config({ path: join(__dirname, '..', '.env') });

export const config = {
  apiBaseUrl: process.env.API_BASE_URL || 'http://apigateway.cxocoe.us',
  authMode: process.env.AUTH_MODE || 'apikey',
  apiKeyPods: process.env.API_KEY_PODS,
  jwtToken: process.env.JWT_TOKEN,
  serverPort: parseInt(process.env.SERVER_PORT) || 1013,
  serverPath: process.env.SERVER_PATH || '/CiscoMCPPods',
  mcpApiKey: process.env.MCP_API_KEY,
};

// Validate configuration
if (config.authMode === 'apikey' && !config.apiKeyPods) {
  console.error('Warning: API_KEY_PODS is not configured in .env file');
}

if (config.authMode === 'jwt' && !config.jwtToken) {
  console.error('Warning: JWT_TOKEN is not configured in .env file');
}

if (!config.mcpApiKey) {
  console.error('Warning: MCP_API_KEY is not configured in .env file - MCP server authentication will be disabled');
}
