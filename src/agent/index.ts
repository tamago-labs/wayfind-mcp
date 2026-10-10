import {
  createKeyPairSignerFromPrivateKeyBytes,
  createSolanaRpc,
  signTransaction,
  getTransactionDecoder,
  getTransactionEncoder,
} from "@solana/kit";
import bs58 from "bs58";
import { validateEnvironment, type AppConfig } from "../config";

export class Agent {
  public walletAddress: string;
  private config: AppConfig;
  private rpc: ReturnType<typeof createSolanaRpc>;
  private signer: Awaited<ReturnType<typeof createKeyPairSignerFromPrivateKeyBytes>>;

  private constructor(walletAddress: string, config: AppConfig, signer: Awaited<ReturnType<typeof createKeyPairSignerFromPrivateKeyBytes>>) {
    this.walletAddress = walletAddress;
    this.config = config;
    this.signer = signer;
    this.rpc = createSolanaRpc(config.rpcUrl);
  }

  static async create(): Promise<Agent> {
    const config = validateEnvironment();
    const decoded = bs58.decode(config.privateKey);
    const seed = decoded.slice(0, 32);
    const signer = await createKeyPairSignerFromPrivateKeyBytes(seed, false);
    return new Agent(signer.address, config, signer);
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
    const solResult = await this.rpc.getBalance(this.walletAddress).send();
    const solLamports = Number(solResult.value);

    let tokens: Array<{ mint: string; symbol: string; amount: number; decimals: number }> = [];
    try {
      const tokenResult = await this.rpc.getTokenAccountsByOwner(
        this.walletAddress,
        { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        { encoding: "jsonParsed" }
      ).send();
      tokens = tokenResult.value
        .filter((acc: any) => acc.account.data?.parsed?.info?.tokenAmount?.uiAmount > 0)
        .map((acc: any) => ({
          mint: acc.account.data.parsed.info.mint,
          symbol: acc.account.data.parsed.info.tokenAmount.uiTokenAmount?.symbol || "UNKNOWN",
          amount: acc.account.data.parsed.info.tokenAmount.uiAmount,
          decimals: acc.account.data.parsed.info.tokenAmount.decimals,
        }));
    } catch {
      // Token accounts not available on this RPC
    }

    return {
      solBalance: solLamports / 1_000_000_000,
      solLamports,
      tokens,
    };
  }

  async swapTokens(input: { fromSymbol: string; toSymbol: string; amount: string; slippagePercent: string }) {
    const swapData = await this.wayfindFetch("/swap-instruction", {
      fromSymbol: input.fromSymbol,
      toSymbol: input.toSymbol,
      amount: input.amount,
      userWalletAddress: this.walletAddress,
      slippagePercent: input.slippagePercent,
    });

    if (swapData.error) {
      throw new Error(swapData.error);
    }

    const txBase58 = swapData.data?.base58Transaction;
    if (!txBase58) {
      throw new Error("No transaction data in swap instruction response");
    }

    const txBytes = bs58.decode(txBase58);
    const tx = getTransactionDecoder().decode(txBytes);
    const signedTx = await signTransaction([this.signer.keyPair], tx);
    const txBytesOut = getTransactionEncoder().encode(signedTx);
    const encoded = bs58.encode(txBytesOut);
    const signature = await this.rpc.sendTransaction(encoded).send();

    return {
      signature,
      fromSymbol: input.fromSymbol,
      toSymbol: input.toSymbol,
      amount: input.amount,
      explorer: `https://explorer.solana.com/tx/${signature}`,
    };
  }
}
