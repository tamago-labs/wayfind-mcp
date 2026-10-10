import { createKeyPairSignerFromPrivateKeyBytes } from "@solana/kit";
import bs58 from "bs58";
import { validateEnvironment, type AppConfig } from "../config";

export class Agent {
  public walletAddress: string;
  private config: AppConfig;

  private constructor(walletAddress: string, config: AppConfig) {
    this.walletAddress = walletAddress;
    this.config = config;
  }

  static async create(): Promise<Agent> {
    const config = validateEnvironment();
    const decoded = bs58.decode(config.privateKey);
    const seed = decoded.slice(0, 32);
    const signer = await createKeyPairSignerFromPrivateKeyBytes(seed, false);
    return new Agent(signer.address, config);
  }

  async wayfindFetch(path: string, params?: Record<string, string>) {
    const url = new URL(`${this.config.wayfindApiUrl}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString(), {
      headers: { "x-api-key": this.config.wayfindApiKey },
    });
    return res.json();
  }
}
