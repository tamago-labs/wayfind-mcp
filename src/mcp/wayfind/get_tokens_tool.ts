import { z } from "zod";
import { Agent } from "../../agent";
import type { McpTool } from "../../types";

export const WayfindGetTokensTool: McpTool = {
  name: "wayfind_get_tokens",
  description: "List all tokenized stocks with prices and market data",
  schema: {
    chain: z.string().optional().describe("Filter by blockchain (e.g., 'solana', 'ethereum')"),
  },
  handler: async (agent: Agent, input: Record<string, any>) => {
    return agent.wayfindFetch("/tokens", input?.chain ? { chain: input.chain } : undefined);
  },
};
