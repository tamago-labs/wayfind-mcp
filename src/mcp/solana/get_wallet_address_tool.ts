import { z } from "zod";
import { Agent } from "../../agent";
import type { McpTool } from "../../types";

export const GetWalletAddressTool: McpTool = {
  name: "solana_get_wallet_address",
  description: "Get the Solana wallet address derived from the configured private key",
  schema: {},
  handler: async (agent: Agent, _input: Record<string, any>) => {
    return {
      walletAddress: agent.walletAddress,
    };
  },
};
