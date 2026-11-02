#!/usr/bin/env node

/**
 * Entry point for Student Management System MCP Server.
 * Communicates via stdio transport for integration with MCP clients (Claude Desktop, Cursor, Antigravity, etc.).
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './server.js';
import { config } from './config.js';
import { ApiClient } from './apiClient.js';

async function main() {
  const apiClient = new ApiClient(config.apiBaseUrl);
  const server = createMcpServer({ apiClient });
  const transport = new StdioServerTransport();

  // All logs MUST be written to stderr to avoid corrupting stdio JSON-RPC protocol
  console.error(`[Student Management MCP] Initializing server version ${config.serverVersion}...`);
  console.error(`[Student Management MCP] Target Express API: ${config.apiBaseUrl}`);

  // Test API reachability in the background without blocking server startup
  apiClient.checkHealth()
    .then(() => console.error(`[Student Management MCP] Successfully verified API connection at ${config.apiBaseUrl}/health`))
    .catch((err) => console.error(`[Student Management MCP] Warning: Could not reach API backend (${err.message}). Ensure backend is running.`));

  await server.connect(transport);
  console.error('[Student Management MCP] Server connected to stdio transport and ready for tool calls.');

  const shutdown = async (signal) => {
    console.error(`[Student Management MCP] Received ${signal}. Shutting down...`);
    try {
      await server.close();
    } catch {
      // Ignore closing errors
    }
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((fatalError) => {
  console.error('[Student Management MCP] Fatal startup error:', fatalError);
  process.exit(1);
});
