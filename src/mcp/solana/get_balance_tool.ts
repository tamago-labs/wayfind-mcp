import { Agent } from "../../agent";
import type { McpTool } from "../../types";

export const SolanaGetBalanceTool: McpTool = {
  name: "solana_get_balance",
  description: "Get SOL and SPL token balances for the configured wallet",
  schema: {},
  handler: async (agent: Agent, _input: Record<string, any>) => {
    return agent.getBalance();
  },
};
