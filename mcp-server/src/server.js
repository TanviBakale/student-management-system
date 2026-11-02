import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from './tools.js';
import { ApiClient } from './apiClient.js';
import { config } from './config.js';

/**
 * Creates and initializes the MCP Server with registered tools.
 * @param {Object} [options]
 * @param {ApiClient} [options.apiClient] - Custom or mocked API client
 * @param {string} [options.name] - Server name
 * @param {string} [options.version] - Server version
 * @returns {McpServer}
 */
export function createMcpServer(options = {}) {
  const name = options.name || config.serverName;
  const version = options.version || config.serverVersion;
  const apiClient = options.apiClient || new ApiClient(config.apiBaseUrl);

  const server = new McpServer({
    name,
    version
  });

  registerTools(server, apiClient);

  return server;
}

export default createMcpServer;
