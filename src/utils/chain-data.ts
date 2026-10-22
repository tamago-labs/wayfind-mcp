import arbitrumMainnet from "../data/chains/arbitrum-mainnet.json";
import arcTestnet from "../data/chains/arc-testnet.json";
import bnbMainnet from "../data/chains/bnb-mainnet.json";
import ethereumMainnet from "../data/chains/ethereum-mainnet.json";
import ethereumTestnet from "../data/chains/ethereum-testnet.json";

export interface ChainToken {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
}

export interface ChainData {
  chain: string;
  network: string;
  chainId: number;
  nativeCurrency: { symbol: string; name: string; decimals: number };
  tokens: ChainToken[];
}

const CHAIN_CONFIGS: Record<string, ChainData> = {
  "arbitrum-mainnet": arbitrumMainnet,
  "arc-testnet": arcTestnet,
  "bnb-mainnet": bnbMainnet,
  "ethereum-mainnet": ethereumMainnet,
  "ethereum-testnet": ethereumTestnet,
};

export function loadChainData(network: string): ChainData[] {
  return Object.values(CHAIN_CONFIGS).filter((c) => c.network === network);
}
