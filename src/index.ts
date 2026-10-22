#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpTools } from "./mcp";
import { Agent } from "./agent";

function createMcpServer(agent: Agent) {
  const server = new McpServer({
    name: "wayfind-mcp",
    version: "2.0.0",
  });

  for (const [_key, tool] of Object.entries(McpTools)) {
    server.tool(tool.name, tool.description, tool.schema, async (params: any): Promise<any> => {
      try {
        const result = await tool.handler(agent, params);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: error instanceof Error ? error.message : "Unknown error" }],
        };
      }
    });
  }

  return server;
}

async function main() {
  const agent = await Agent.create();
  const server = createMcpServer(agent);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
