import { z } from "zod";
import type { Agent } from "../../agent";
import type { McpTool } from "../../types";

export const GetTransactionTool: McpTool = {
  name: "get_transaction",
  description: "Get transaction details and status by chain and transaction hash",
  schema: {
    chain: z.string().describe("Chain name (e.g., 'solana', 'ethereum', 'base', 'arbitrum')"),
    txHash: z.string().describe("Transaction hash/signature"),
  },
  handler: async (agent: Agent, input: Record<string, any>) => {
    return agent.getTransaction(input.chain, input.txHash);
  },
};
