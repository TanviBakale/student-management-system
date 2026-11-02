import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// Load .env relative to this package directory
const envPath = fileURLToPath(new URL('../.env', import.meta.url));
dotenv.config({ path: envPath });

// Ensure MongoDB credentials are NEVER loaded, exposed, or used by the MCP server
if ('MONGODB_URI' in process.env) {
  delete process.env.MONGODB_URI;
}

export const config = {
  apiBaseUrl: (process.env.API_BASE_URL || 'http://localhost:5000').replace(/\/+$/, ''),
  serverName: 'student-management-mcp-server',
  serverVersion: '1.0.0'
};

export default config;
