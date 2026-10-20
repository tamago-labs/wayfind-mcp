import { z } from "zod";
import type { Agent } from "../../agent";
import type { McpTool } from "../../types";

export const DepositUnifiedTool: McpTool = {
  name: "circle_deposit_unified",
  description: "Deposit USDC from a source chain into your Circle Unified Balance. Source chain must be valid for the current network.",
  schema: {
    sourceChain: z.string().describe("Chain to deposit from (e.g., 'ethereum', 'base', 'arbitrum')"),
    amount: z.string().describe("Amount of USDC to deposit"),
  },
  handler: async (agent: Agent, input: Record<string, any>) => {
    return agent.depositUnified(input.sourceChain, input.amount);
  },
};
