import { z } from "zod";
import { Agent } from "../../agent";
import type { McpTool } from "../../types";

export const WayfindGetSwapQuoteTool: McpTool = {
  name: "wayfind_get_swap_quote",
  description: "Get a swap quote from OKX DEX for a token pair on Solana",
  schema: {
    fromSymbol: z.string().describe("Symbol of the token to swap from (e.g., 'SOL', 'USDC')"),
    toSymbol: z.string().describe("Symbol of the token to swap to (e.g., 'SOL', 'USDC')"),
    amount: z.string().describe("Amount of the from token to swap (in base units/lamports)"),
  },
  handler: async (agent: Agent, input: Record<string, any>) => {
    return agent.wayfindFetch("/swap-quote", {
      fromSymbol: input.fromSymbol,
      toSymbol: input.toSymbol,
      amount: input.amount,
    });
  },
};
