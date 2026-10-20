import { z } from "zod";
import type { Agent } from "../../agent";
import type { McpTool } from "../../types";

export const GetUnifiedBalanceTool: McpTool = {
  name: "circle_get_unified_balance",
  description: "Get aggregated USDC unified balance across all supported chains (EVM + Solana)",
  schema: {},
  handler: async (agent: Agent) => {
    return agent.getUnifiedBalance();
  },
};
