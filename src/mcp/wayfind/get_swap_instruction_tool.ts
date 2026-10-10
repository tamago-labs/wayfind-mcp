import { z } from "zod";
import { Agent } from "../../agent";
import type { McpTool } from "../../types";

export const WayfindGetSwapInstructionTool: McpTool = {
  name: "wayfind_get_swap_instruction",
  description: "Get swap instruction from OKX DEX for wallet signing",
  schema: {
    fromSymbol: z.string().describe("Symbol of the token to swap from (e.g., 'SOL', 'USDC')"),
    toSymbol: z.string().describe("Symbol of the token to swap to (e.g., 'SOL', 'USDC')"),
    amount: z.string().describe("Amount of the from token to swap (in base units/lamports)"),
    slippagePercent: z.string().optional().describe("Slippage tolerance percentage (default: 0.5)"),
  },
  handler: async (agent: Agent, input: Record<string, any>) => {
    return agent.wayfindFetch("/swap-instruction", {
      fromSymbol: input.fromSymbol,
      toSymbol: input.toSymbol,
      amount: input.amount,
      userWalletAddress: agent.walletAddress,
      slippagePercent: input.slippagePercent ?? "0.5",
    });
  },
};
