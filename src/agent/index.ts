import { createKeyPairSignerFromPrivateKeyBytes } from "@solana/kit";
import bs58 from "bs58";
import { validateEnvironment } from "../config";

export class Agent {
  public walletAddress: string;

  private constructor(walletAddress: string) {
    this.walletAddress = walletAddress;
  }

  static async create(): Promise<Agent> {
    const config = validateEnvironment();
    const decoded = bs58.decode(config.privateKey);
    const seed = decoded.slice(0, 32);
    const signer = await createKeyPairSignerFromPrivateKeyBytes(seed, false);
    return new Agent(signer.address);
  }
}
