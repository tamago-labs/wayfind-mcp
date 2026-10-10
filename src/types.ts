import type { Agent } from "./agent";

export interface McpTool {
  name: string;
  description: string;
  schema: Record<string, any>;
  handler: (agent: Agent, input: Record<string, any>) => Promise<any>;
}
