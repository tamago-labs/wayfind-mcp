import {
  createKeyPairSignerFromPrivateKeyBytes,
  createSolanaRpc,
  signTransaction,
  getTransactionDecoder,
  getTransactionEncoder,
  createTransactionMessage,
  setTransactionMessageLifetimeUsingBlockhash,
  setTransactionMessageFeePayer,
  appendTransactionMessageInstructions,
  compileTransaction,

  address,
  Address,
  AccountRole,
  IInstruction,
  getU64Codec,
  getProgramDerivedAddress,
  isProgramDerivedAddress,
} from "@solana/kit";
import { getU8Codec } from "@solana/kit";
import bs58 from "bs58";
import { JsonRpcProvider, Contract, Wallet, formatUnits, isAddress } from "ethers";
import { validateEnvironment, type AppConfig, getNetwork, getSupportedChains } from "../config";
import { MINT_TO_SYMBOL, SYMBOL_TO_MINT } from "../utils/token-resolver";
import { loadChainData, type ChainData } from "../utils/chain-data";

const ERC20_BALANCE_ABI = ["function balanceOf(address) view returns (uint256)"];
const ERC20_TRANSFER_ABI = ["function transfer(address to, uint256 amount) returns (bool)"];

const SYSTEM_PROGRAM = address("11111111111111111111111111111111");
const TOKEN_PROGRAM = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM = address("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const RENT_SYSVAR = address("SysvarRent111111111111111111111111111111111");

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

  async sendTokens(input: { chain: string; token: string; amount: string; recipient: string; walletAddress?: string }) {
    const network = getNetwork();
    const supported = getSupportedChains(network);
    const chain = input.chain.toLowerCase();

    if (!supported.includes(chain)) {
      return { error: `Unsupported chain '${input.chain}' for network '${network}'. Supported: ${supported.join(", ")}` };
    }

    if (chain === "solana") {
      return this.sendSolanaToken(chain, input.token, input.amount, input.recipient, input.walletAddress);
    }

    return this.sendEvmToken(chain, input.token, input.amount, input.recipient, input.walletAddress);
  }

  private async sendSolanaToken(chain: string, token: string, amount: string, recipient: string, walletAddress?: string) {
    const sender = walletAddress || this.solanaWalletAddress;
    const isNativeSol = token.toUpperCase() === "SOL";

    const network = getNetwork();
    const instructions: IInstruction[] = [];

    if (isNativeSol) {
      const data = new Uint8Array(12);
      data.set([2, 0, 0, 0], 0);
      const amountBigInt = BigInt(amount);
      const view = new DataView(data.buffer, 4, 8);
      view.setBigUint64(0, amountBigInt, true);

      instructions.push({
        programAddress: SYSTEM_PROGRAM,
        accounts: [
          { address: address(sender), role: AccountRole.WRITABLE_SIGNER },
          { address: address(recipient), role: AccountRole.WRITABLE },
        ],
        data,
      });
    } else {
      const mint = SYMBOL_TO_MINT[token.toUpperCase()] || token;

      const senderTokens = await this.rpc.getTokenAccountsByOwner(sender, { programId: TOKEN_PROGRAM }, { encoding: "jsonParsed" }).send();
      const senderTa = senderTokens.value.find((acc: any) => acc.account.data.parsed.info.mint === mint);
      if (!senderTa) return { error: `No token account found for ${token}` };

      let recvTa;
      try {
        const recvTokens = await this.rpc.getTokenAccountsByOwner(recipient, { programId: TOKEN_PROGRAM }, { encoding: "jsonParsed" }).send();
        recvTa = recvTokens.value.find((acc: any) => acc.account.data?.parsed?.info?.mint === mint);
      } catch {
        // recipient has no token accounts
      }

      if (!recvTa) {
        const [ata] = await getProgramDerivedAddress({
          programAddress: ASSOCIATED_TOKEN_PROGRAM,
          seeds: [
            bs58.decode(recipient),
            bs58.decode(TOKEN_PROGRAM as string),
            bs58.decode(mint),
          ],
        });

        instructions.push({
          programAddress: ASSOCIATED_TOKEN_PROGRAM,
          accounts: [
            { address: address(sender), role: AccountRole.WRITABLE_SIGNER },
            { address: ata, role: AccountRole.WRITABLE },
            { address: address(recipient), role: AccountRole.READONLY },
            { address: address(mint), role: AccountRole.READONLY },
            { address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
            { address: TOKEN_PROGRAM, role: AccountRole.READONLY },
          ],
          data: new Uint8Array(0),
        });

        recvTa = { pubkey: ata };
      }

      const tokenDecimals = 6;
      const data = new Uint8Array(10);
      data[0] = 12;
      const amountBigInt = BigInt(amount);
      const view = new DataView(data.buffer, 1, 8);
      view.setBigUint64(0, amountBigInt, true);
      data[9] = tokenDecimals;

      instructions.push({
        programAddress: TOKEN_PROGRAM,
        accounts: [
          { address: address(senderTa.pubkey), role: AccountRole.WRITABLE },
          { address: address(mint), role: AccountRole.READONLY },
          { address: address(recvTa.pubkey), role: AccountRole.WRITABLE },
          { address: address(sender), role: AccountRole.WRITABLE_SIGNER },
        ],
        data,
      });

    }

    try {
      const { value: blockhash } = await this.rpc.getLatestBlockhash().send();
      const txMsg = createTransactionMessage({ version: "legacy" });
      const txWithFeePayer = setTransactionMessageFeePayer(address(sender), txMsg);
      const txWithBlockhash = setTransactionMessageLifetimeUsingBlockhash(blockhash, txWithFeePayer);
      const txWithInstructions = appendTransactionMessageInstructions(instructions, txWithBlockhash);
      const compiledTx = compileTransaction(txWithInstructions);
      const signedTx = await signTransaction([this.signer.keyPair], compiledTx);
      const txBytesOut = getTransactionEncoder().encode(signedTx);
      const encoded = Buffer.from(txBytesOut).toString("base64");
      const sim = await this.rpc.simulateTransaction(encoded, { encoding: "base64" }).send();
      if (sim.value.err) {
        const logs = sim.value.logs?.join("\n") ?? "";
        return { error: `Simulation failed: ${JSON.stringify(sim.value.err)}\n${logs}` };
      }
      const signature = await this.rpc.sendTransaction(encoded, { encoding: "base64" }).send();

      return {
        signature,
        chain: "solana",
        token,
        amount,
        recipient,
        explorer: `https://explorer.solana.com/tx/${signature}?cluster=${network === "testnet" ? "devnet" : "mainnet"}`,
      };
    } catch (err: any) {
      return { error: `${err?.message || "Solana transfer failed"}\n${err?.logs?.join("\n") || ""}` };
    }
  }

  private async sendEvmToken(chain: string, token: string, amount: string, recipient: string, walletAddress?: string) {
    const chainInfo = this.chainData[chain];
    const rpcUrl = this.config.evmRpcUrls[chain];
    if (!rpcUrl) return { error: `No RPC URL for chain '${chain}'` };

    const provider = new JsonRpcProvider(rpcUrl);
    const wallet = new Wallet(this.config.evmPrivateKey, provider);
    const isNative = token.toUpperCase() === chainInfo.nativeCurrency.symbol.toUpperCase();

    if (isNative) {
      const tx = await wallet.sendTransaction({
        to: recipient,
        value: BigInt(amount),
      });
      const receipt = await tx.wait();
      return {
        signature: receipt?.hash,
        chain,
        token,
        amount,
        recipient,
        explorer: this.getExplorerUrl(chain, receipt?.hash),
      };
    }

    const tokenInfo = chainInfo.tokens.find((t) => t.symbol.toUpperCase() === token.toUpperCase());
    const tokenAddress = tokenInfo?.address || token;
    const contract = new Contract(tokenAddress, ERC20_TRANSFER_ABI, wallet);
    const tx = await contract.transfer(recipient, BigInt(amount));
    const receipt = await tx.wait();

    return {
      signature: receipt?.hash,
      chain,
      token,
      amount,
      recipient,
      explorer: this.getExplorerUrl(chain, receipt?.hash),
    };
  }

  async getTransaction(chain: string, txHash: string): Promise<any> {
    const network = getNetwork();

    if (chain === "solana") {
      try {
        const tx = await this.rpc.getTransaction(txHash, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }).send();
        if (!tx) return { error: "Transaction not found" };

        const meta = tx.meta;
        const status = meta?.err ? "failed" : "confirmed";
        const slot = tx.slot;

        const transfers: Array<{ mint: string; symbol: string; amount: string; direction: string; accountIndex: number }> = [];
        if (meta?.postTokenBalances && meta?.preTokenBalances) {
          for (const post of meta.postTokenBalances) {
            const pre = meta.preTokenBalances.find((p: any) => p.accountIndex === post.accountIndex);
            if (pre && pre.uiTokenAmount.uiAmount !== post.uiTokenAmount.uiAmount) {
              const mint = post.mint;
              const symbol = MINT_TO_SYMBOL[mint] || post.uiTokenAmount?.symbol || "UNKNOWN";
              const preAmt = Number(pre.uiTokenAmount.uiAmount);
              const postAmt = Number(post.uiTokenAmount.uiAmount);
              const diff = postAmt - preAmt;
              transfers.push({
                mint,
                symbol,
                amount: Math.abs(diff).toString(),
                direction: diff > 0 ? "in" : "out",
                accountIndex: post.accountIndex,
              });
            }
          }
        }

        return {
          chain,
          txHash,
          status,
          slot: slot?.toString(),
          blockTime: tx.blockTime?.toString(),
          fee: meta?.fee ? `${Number(meta.fee) / 1_000_000_000} SOL` : "0",
          transfers: transfers.length > 0 ? transfers : undefined,
          explorer: this.getExplorerUrl(chain, txHash),
        };
      } catch (err: any) {
        return { error: err?.message || "Failed to fetch transaction" };
      }
    }

    const rpcUrl = this.config.evmRpcUrls[chain];
    if (!rpcUrl) return { error: `Unsupported chain '${chain}'` };

    try {
      const provider = new JsonRpcProvider(rpcUrl);
      const tx = await provider.getTransaction(txHash);
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!receipt) {
        return {
          chain,
          txHash,
          status: "pending",
          from: tx?.from || "unknown",
          to: tx?.to || "unknown",
          explorer: this.getExplorerUrl(chain, txHash),
        };
      }

      return {
        chain,
        txHash,
        status: receipt.status === 1 ? "confirmed" : "failed",
        blockNumber: receipt.blockNumber,
        blockTimestamp: tx?.timestamp,
        from: receipt.from,
        to: receipt.to,
        value: tx?.value ? formatUnits(tx.value, 18) : "0",
        gasUsed: receipt.gasUsed?.toString(),
        explorer: this.getExplorerUrl(chain, txHash),
      };
    } catch (err: any) {
      return { error: err?.message || "Failed to fetch transaction" };
    }
  }

  private getExplorerUrl(chain: string, hash?: string): string {
    if (!hash) return "";
    const network = getNetwork();
    const explorers: Record<string, Record<string, string>> = {
      solana: { mainnet: "https://explorer.solana.com/tx/", testnet: "https://explorer.solana.com/tx/" },
      ethereum: { mainnet: "https://etherscan.io/tx/", testnet: "https://sepolia.etherscan.io/tx/" },
      base: { mainnet: "https://basescan.org/tx/", testnet: "https://sepolia.basescan.org/tx/" },
      arbitrum: { mainnet: "https://arbiscan.io/tx/", testnet: "https://sepolia.arbiscan.io/tx/" },
      polygon: { mainnet: "https://polygonscan.com/tx/", testnet: "https://amoy.polygonscan.com/tx/" },
      avalanche: { mainnet: "https://snowtrace.io/tx/", testnet: "https://testnet.snowtrace.io/tx/" },
      optimism: { mainnet: "https://optimistic.etherscan.io/tx/", testnet: "https://sepolia-optimism.etherscan.io/tx/" },
      world: { mainnet: "https://worldchain.blockscout.com/tx/", testnet: "https://worldchain-sepolia.blockscout.com/tx/" },
      sei: { mainnet: "https://seistream.app/tx/", testnet: "https://seistream.app/tx/" },
      arc: { mainnet: "https://explorer.arc.io/tx/", testnet: "https://explorer.testnet.arc.io/tx/" },
    };
    const base = explorers[chain]?.[network] || "";
    if (chain === "solana" && network === "testnet") return `${base}${hash}?cluster=devnet`;
    return base + hash;
  }
}
