import {
  createKeyPairSignerFromPrivateKeyBytes,
  createSolanaRpc,
  signTransaction,
  getTransactionDecoder,
  getTransactionEncoder,
} from "@solana/kit";
import bs58 from "bs58";
import { JsonRpcProvider, Contract, formatUnits, isAddress } from "ethers";
import { readFileSync } from "fs";
import { join } from "path";
import { validateEnvironment, type AppConfig, getNetwork, getSupportedChains } from "../config";
import baseTokens from "../data/base-tokens.json";
import rwaList from "../data/rwa-v1-list.json";
import preIpoList from "../data/pre-ipo-list.json";

const MINT_TO_SYMBOL: Record<string, string> = {};
for (const t of baseTokens as any[]) {
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

interface ChainToken {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
}

interface ChainData {
  chain: string;
  network: string;
  chainId: number;
  nativeCurrency: { symbol: string; name: string; decimals: number };
  tokens: ChainToken[];
}

function loadChainData(network: string): ChainData[] {
  const chains = ["ethereum", "base", "arbitrum", "polygon", "avalanche", "optimism", "world", "sei", "arc"];
  const result: ChainData[] = [];
  for (const chain of chains) {
    try {
      const file = join(process.cwd(), "src", "data", "chains", `${chain}-${network}.json`);
      const data = JSON.parse(readFileSync(file, "utf-8"));
      if (data.tokens.length > 0) {
        result.push(data);
      }
    } catch {}
  }
  return result;
}

const ERC20_BALANCE_ABI = ["function balanceOf(address) view returns (uint256)"];

export class Agent {
  public solanaWalletAddress: string;
  public evmWalletAddress: string;
  private config: AppConfig;
  private rpc: ReturnType<typeof createSolanaRpc>;
  private signer: Awaited<ReturnType<typeof createKeyPairSignerFromPrivateKeyBytes>>;
  private chainData: Record<string, ChainData> = {};

  private constructor(solanaAddress: string, evmAddress: string, config: AppConfig, signer: Awaited<ReturnType<typeof createKeyPairSignerFromPrivateKeyBytes>>) {
    this.solanaWalletAddress = solanaAddress;
    this.evmWalletAddress = evmAddress;
    this.config = config;
    this.signer = signer;
    this.rpc = createSolanaRpc(config.solanaRpcUrl);

    const network = getNetwork();
    const chains = loadChainData(network);
    for (const c of chains) {
      this.chainData[c.chain] = c;
    }
  }

  static async create(): Promise<Agent> {
    const config = await validateEnvironment();
    return new Agent(config.solanaPublicKey, config.evmAddress, config, config.solanaSigner);
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

  async getBalances(targetChain?: string, walletAddress?: string) {
    const network = getNetwork();
    const supported = getSupportedChains(network);
    const address = walletAddress || undefined;

    if (targetChain) {
      const chain = targetChain.toLowerCase();
      if (!supported.includes(chain)) {
        return {
          error: `Unsupported chain '${targetChain}' for network '${network}'. Supported: ${supported.join(", ")}`,
        };
      }
      return { network, chains: { [chain]: await this.queryChain(chain, address) } };
    }

    const chains: Record<string, any> = {};
    for (const chainName of supported) {
      const result = await this.queryChain(chainName, address);
      if (result) chains[chainName] = result;
    }
    return { network, chains };
  }

  private async queryChain(chainName: string, walletAddress?: string): Promise<any> {
    const network = getNetwork();
    const address = walletAddress || this.evmWalletAddress;

    if (chainName === "solana") {
      const chainId = network === "mainnet" ? 101 : 103;
      const solAddr = walletAddress || this.solanaWalletAddress;
      const solResult = await this.rpc.getBalance(solAddr).send();
      const solLamports = Number(solResult.value);

      const tokens: Array<{ address: string; symbol: string; name: string; balance: string; decimals: number }> = [];
      const programs = [
        "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
      ];

      for (const programId of programs) {
        try {
          const tokenResult = await this.rpc.getTokenAccountsByOwner(
            solAddr,
            { programId },
            { encoding: "jsonParsed" }
          ).send();
          for (const acc of tokenResult.value) {
            const info = acc.account.data?.parsed?.info;
            if (info?.tokenAmount?.uiAmount > 0) {
              const symbol = MINT_TO_SYMBOL[info.mint] || info.tokenAmount.uiTokenAmount?.symbol || "UNKNOWN";
              tokens.push({
                address: info.mint,
                symbol,
                name: symbol,
                balance: info.tokenAmount.uiAmount.toString(),
                decimals: info.tokenAmount.decimals,
              });
            }
          }
        } catch {}
      }

      return {
        chainId,
        native: { symbol: "SOL", balance: (solLamports / 1_000_000_000).toString(), lamports: solLamports },
        tokens,
      };
    }

    const chainInfo = this.chainData[chainName];
    if (!chainInfo) return null;

    const rpcUrl = this.config.evmRpcUrls[chainName];
    if (!rpcUrl) return null;

    const provider = new JsonRpcProvider(rpcUrl);
    const nativeBalance = await provider.getBalance(address);
    const nativeFormatted = formatUnits(nativeBalance, chainInfo.nativeCurrency.decimals);

    const tokens: Array<{ address: string; symbol: string; name: string; balance: string; decimals: number }> = [];
    for (const token of chainInfo.tokens) {
      if (!isAddress(token.address)) continue;
      try {
        const contract = new Contract(token.address, ERC20_BALANCE_ABI, provider);
        const bal = await contract.balanceOf(address);
        if (bal > 0n) {
          tokens.push({
            address: token.address,
            symbol: token.symbol,
            name: token.name,
            balance: formatUnits(bal, token.decimals),
            decimals: token.decimals,
          });
        }
      } catch {}
    }

    const result: any = {
      chainId: chainInfo.chainId,
      tokens,
    };

    if (chainName !== "arc") {
      result.native = { symbol: chainInfo.nativeCurrency.symbol, balance: nativeFormatted };
    }

    return result;
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
