import { z } from "zod";
import type { Agent } from "../../agent";
import type { McpTool } from "../../types";

export const SpendUnifiedTool: McpTool = {
  name: "circle_spend_unified",
  description: "Spend USDC from your Circle Unified Balance to a recipient on any chain.",
  schema: {
    amount: z.string().describe("Amount of USDC to spend"),
    recipient: z.string().describe("Recipient wallet address"),
    targetChain: z.string().describe("Chain to receive USDC (e.g., 'solana', 'arc', 'ethereum', 'base', 'arbitrum')"),
  },
  handler: async (agent: Agent, input: Record<string, any>) => {
    return agent.spendUnified(input.amount, input.recipient, input.targetChain);
  },
};
