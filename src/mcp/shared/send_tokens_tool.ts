import { z } from "zod";
import { Agent } from "../../agent";
import type { McpTool } from "../../types";

export const SendTokensTool: McpTool = {
  name: "send_tokens",
  description: "Send native and token assets (SOL, SPL tokens on Solana; native + ERC-20 on EVM chains). Returns the transaction signature.",
  schema: {
    chain: z.string().describe("Chain name (e.g., 'solana', 'ethereum', 'base', 'arbitrum', 'arc')"),
    token: z.string().describe("Token symbol (e.g., 'SOL', 'USDC', 'ETH', 'EURC')"),
    amount: z.string().describe("Amount to send (in base units/lamports)"),
    recipient: z.string().describe("Recipient wallet address"),
  },
  handler: async (agent: Agent, input: Record<string, any>) => {
    return agent.sendTokens({
      chain: input.chain,
      token: input.token,
      amount: input.amount,
      recipient: input.recipient,
    });
  },
};
