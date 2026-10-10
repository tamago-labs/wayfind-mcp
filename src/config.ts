export interface AppConfig {
  privateKey: string;
  rpcUrl: string;
  wayfindApiKey: string;
  wayfindApiUrl: string;
}

export function validateEnvironment(): AppConfig {
  const privateKey = process.env.SOLANA_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Missing required env: SOLANA_PRIVATE_KEY (base58 encoded, standard Solana format)");
  }
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const wayfindApiKey = process.env.WAYFIND_API_KEY || "e1ee8520-305a-49b5-a2de-3e1a7e6078c0";
  const wayfindApiUrl = process.env.WAYFIND_API_URL || "https://o3qftki5dtnlhqlrtvswt336bq0mwdye.lambda-url.ap-southeast-1.on.aws";
  return { privateKey, rpcUrl, wayfindApiKey, wayfindApiUrl };
}
