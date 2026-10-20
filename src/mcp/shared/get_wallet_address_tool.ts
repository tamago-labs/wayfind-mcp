import { Agent } from "../../agent";
import type { McpTool } from "../../types";
import { getNetwork } from "../../config";

const CHAIN_IDS: Record<string, Record<string, string | number>> = {
  testnet: {
    solana: "devnet",
    arc: 5042002,
    ethereum: 11155111,
    base: 84532,
  },
  mainnet: {
    solana: "mainnet-beta",
    arc: 5042,
    ethereum: 1,
    base: 8453,
    arbitrum: 42161,
    polygon: 137,
    avalanche: 43114,
    optimism: 10,
    world: 480,
    sei: 1329,
  },
};

export const GetWalletAddressTool: McpTool = {
  name: "get_wallet_address",
  description: "Get wallet addresses for all supported chains on the configured network",
  schema: {},
  handler: async (agent: Agent, _input: Record<string, any>) => {
    const network = getNetwork();
    const chainIds = CHAIN_IDS[network];

    const addresses: Record<string, { address: string; chainId: string | number }> = {};

    for (const [chain, chainId] of Object.entries(chainIds)) {
      if (chain === "solana") {
        addresses[chain] = { address: agent.solanaWalletAddress, chainId };
      } else {
        addresses[chain] = { address: agent.evmWalletAddress, chainId };
      }
    }

    return { network, addresses };
  },
};
