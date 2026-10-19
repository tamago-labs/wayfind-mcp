import {
  createKeyPairSignerFromPrivateKeyBytes,
  createSolanaRpc,
  signTransaction,
  getTransactionDecoder,
  getTransactionEncoder,
} from "@solana/kit";
import { validateEnvironment, type AppConfig } from "../config";
import baseTokens from "../data/base-tokens.json";
import rwaList from "../data/rwa-v1-list.json";
import preIpoList from "../data/pre-ipo-list.json";

const MINT_TO_SYMBOL: Record<string, string> = {};
for (const t of baseTokens) {
  MINT_TO_SYMBOL[t.address] = t.symbol;
}
for (const asset of (rwaList as any).assets ?? []) {
  for (const token of asset.tokens ?? []) {
    const mint = token.addresses?.solana ?? token.mint;
    if (mint && token.symbol) {
      MINT_TO_SYMBOL[mint] = token.symbol;
    }
  }
}
for (const asset of (preIpoList as any).assets ?? []) {
  if (asset.mint && asset.symbol) {
    MINT_TO_SYMBOL[asset.mint] = asset.symbol;
  }
}

export class Agent {
  public solanaWalletAddress: string;
  public evmWalletAddress: string;
  private config: AppConfig;
  private rpc: ReturnType<typeof createSolanaRpc>;
  private signer: Awaited<ReturnType<typeof createKeyPairSignerFromPrivateKeyBytes>>;

  private constructor(solanaAddress: string, evmAddress: string, config: AppConfig, signer: Awaited<ReturnType<typeof createKeyPairSignerFromPrivateKeyBytes>>) {
    this.solanaWalletAddress = solanaAddress;
    this.evmWalletAddress = evmAddress;
    this.config = config;
    this.signer = signer;
    this.rpc = createSolanaRpc(config.solanaRpcUrl);
  }

  static async create(): Promise<Agent> {
    const config = await validateEnvironment();
    return new Agent(config.solanaPublicKey, config.evmAddress, config, config.solanaSigner);
  }

  private resolveSymbol(mint: string): string {
    return MINT_TO_SYMBOL[mint] || "UNKNOWN";
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
    const solResult = await this.rpc.getBalance(this.solanaWalletAddress).send();
    const solLamports = Number(solResult.value);

    const allTokens: Array<{ mint: string; symbol: string; amount: number; decimals: number }> = [];
    const programs = [
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // SPL Token
      "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", // SPL Token 2022
    ];

    for (const programId of programs) {
      try {
        const tokenResult = await this.rpc.getTokenAccountsByOwner(
          this.solanaWalletAddress,
          { programId },
          { encoding: "jsonParsed" }
        ).send();
        for (const acc of tokenResult.value) {
          const info = acc.account.data?.parsed?.info;
          if (info?.tokenAmount?.uiAmount > 0) {
            allTokens.push({
              mint: info.mint,
              symbol: this.resolveSymbol(info.mint),
              amount: info.tokenAmount.uiAmount,
              decimals: info.tokenAmount.decimals,
            });
          }
        }
      } catch {
        // skip this program
      }
    }

    return {
      solBalance: solLamports / 1_000_000_000,
      solLamports,
      tokens: allTokens,
    };
  }

  async swapTokens(input: { fromSymbol: string; toSymbol: string; amount: string; slippagePercent: string }) {
    const swapData = await this.wayfindFetch("/swap-instruction", {
      fromSymbol: input.fromSymbol,
      toSymbol: input.toSymbol,
      amount: input.amount,
      userWalletAddress: this.solanaWalletAddress,
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
