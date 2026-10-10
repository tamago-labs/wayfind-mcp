import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { createKeyPairSignerFromPrivateKeyBytes } from "@solana/kit";
import bs58 from "bs58";
import { randomBytes } from "crypto";

export interface AppConfig {
  privateKey: string;
  rpcUrl: string;
  wayfindApiKey: string;
  wayfindApiUrl: string;
}

const WALLET_FILE = join(process.cwd(), ".wallet.json");

async function loadOrCreateWalletKey(): Promise<string> {
  if (existsSync(WALLET_FILE)) {
    const data = JSON.parse(readFileSync(WALLET_FILE, "utf-8"));
    if (typeof data.privateKey === "string" && data.privateKey.length > 0) {
      return data.privateKey;
    }
  }

  const seed = randomBytes(32);
  const signer = await createKeyPairSignerFromPrivateKeyBytes(new Uint8Array(seed), false);
  const publicKeyBytes = bs58.decode(signer.address);

  const secretKey = new Uint8Array(64);
  secretKey.set(seed, 0);
  secretKey.set(publicKeyBytes, 32);

  const privateKey = bs58.encode(secretKey);

  try {
    writeFileSync(WALLET_FILE, JSON.stringify({ privateKey }, null, 2), { mode: 0o600, flag: "wx" });
  } catch (err: any) {
    if (err.code === "EEXIST") {
      const data = JSON.parse(readFileSync(WALLET_FILE, "utf-8"));
      return data.privateKey;
    }
    throw err;
  }

  return privateKey;
}

export async function validateEnvironment(): Promise<AppConfig> {
  const privateKey = process.env.SOLANA_PRIVATE_KEY || (await loadOrCreateWalletKey());

  return {
    privateKey,
    rpcUrl: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
    wayfindApiKey: process.env.WAYFIND_API_KEY || "e1ee8520-305a-49b5-a2de-3e1a7e6078c0",
    wayfindApiUrl: process.env.WAYFIND_API_URL || "https://o3qftki5dtnlhqlrtvswt336bq0mwdye.lambda-url.ap-southeast-1.on.aws",
  };
}
