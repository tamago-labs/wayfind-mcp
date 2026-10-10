import { createKeyPairSignerFromPrivateKeyBytes, createSolanaRpc } from "@solana/kit";
import bs58 from "bs58";
import { validateEnvironment, type AppConfig } from "../config";

export class Agent {
  public walletAddress: string;
  private config: AppConfig;
  private rpc: ReturnType<typeof createSolanaRpc>;

  private constructor(walletAddress: string, config: AppConfig) {
    this.walletAddress = walletAddress;
    this.config = config;
    this.rpc = createSolanaRpc(config.rpcUrl);
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

  async getBalance() {
    const solBalance = await this.rpc.getBalance({ address: this.walletAddress }).send();
    const tokenAccounts = await this.rpc.getParsedTokenAccountsByOwner(
      { owner: this.walletAddress },
      { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }
    ).send();

    const tokens = tokenAccounts.value
      .filter((acc: any) => acc.account.data.parsed.info.tokenAmount.uiAmount > 0)
      .map((acc: any) => ({
        mint: acc.account.data.parsed.info.mint,
        symbol: acc.account.data.parsed.info.tokenAmount.uiTokenAmount?.symbol || "UNKNOWN",
        amount: acc.account.data.parsed.info.tokenAmount.uiAmount,
        decimals: acc.account.data.parsed.info.tokenAmount.decimals,
      }));

    return {
      solBalance: Number(solBalance.value) / 1_000_000_000,
      solLamports: Number(solBalance.value),
      tokens,
    };
  }
}
