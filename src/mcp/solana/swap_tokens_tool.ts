import { z } from "zod";
import { Agent } from "../../agent";
import type { McpTool } from "../../types";

export const SolanaSwapTokensTool: McpTool = {
  name: "solana_swap_tokens",
  description: "Swap tokens on Solana via OKX DEX. Gets swap instruction, signs with private key, and sends the transaction. Returns the transaction signature.",
  schema: {
    fromSymbol: z.string().describe("Symbol of the token to swap from (e.g., 'SOL', 'USDC')"),
    toSymbol: z.string().describe("Symbol of the token to swap to (e.g., 'SOL', 'USDC')"),
    amount: z.string().describe("Amount of the from token to swap (in base units/lamports)"),
    slippagePercent: z.string().optional().describe("Slippage tolerance percentage (default: 0.5)"),
  },
  handler: async (agent: Agent, input: Record<string, any>) => {
    return agent.swapTokens({
      fromSymbol: input.fromSymbol,
      toSymbol: input.toSymbol,
      amount: input.amount,
      slippagePercent: input.slippagePercent ?? "0.5",
    });
  },
};
