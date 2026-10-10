export interface SolanaConfig {
  privateKey: string;
  rpcUrl: string;
}

export function validateEnvironment(): SolanaConfig {
  const privateKey = process.env.SOLANA_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Missing required env: SOLANA_PRIVATE_KEY (base58 encoded, standard Solana format)");
  }
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  return { privateKey, rpcUrl };
}
