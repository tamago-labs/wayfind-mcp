import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { createKeyPairSignerFromPrivateKeyBytes } from "@solana/kit";
import { randomBytes, pbkdf2Sync } from "crypto";
import { Wallet } from "ethers";
import { WdkSecretManager } from "@tetherto/wdk-secret-manager";

const WALLET_FILE = join(process.cwd(), ".wallet.json");

type Network = "testnet" | "mainnet";

interface RpcPool {
  solana: string[];
  evm: Record<string, string[]>;
}

const RPC_POOLS: Record<Network, RpcPool> = {
  testnet: {
    solana: [
      "https://api.devnet.solana.com",
    ],
    evm: {
      arc: ["https://rpc.testnet.arc.io"],
      ethereum: ["https://ethereum-sepolia.gateway.tatum.io"],
      base: ["https://sepolia.base.org"],
    },
  },
  mainnet: {
    solana: [
      "https://api.mainnet-beta.solana.com",
      "https://rpc.ankr.com/solana",
    ],
    evm: {
      arc: ["https://rpc.mainnet.arc.io"],
      ethereum: [
        "https://singapore.rpc.blxrbdn.com",
        "https://0xrpc.io/eth",
      ],
      base: [
        "https://mainnet.base.org",
        "https://8453.rpc.thirdweb.com",
      ],
      arbitrum: [
        "https://arb1.arbitrum.io/rpc",
        "https://arb-one-mainnet.gateway.tatum.io",
      ],
      polygon: [
        "https://public.1rpc.io/matic",
        "https://polygon.gateway.tenderly.co",
      ],
      avalanche: [
        "https://avalanche-c-chain-rpc.publicnode.com",
        "https://rpc.swiftnodes.io/rpc/avalanche",
      ],
      optimism: [
        "https://mainnet.optimism.io",
        "https://optimism.drpc.org",
      ],
      world: ["https://worldchain-mainnet.gateway.tenderly.co" , "https://worldchain-mainnet.g.alchemy.com/public"],
      sei: ["https://evm-rpc.sei-apis.com" ,"https://1329.rpc.thirdweb.com"],
    },
  },
};

export function getNetwork(): Network {
  const network = process.env.WAYFIND_NETWORK?.toLowerCase();
  if (network === "mainnet") return "mainnet";
  if (network === "testnet") return "testnet";
  return "testnet";
}

function pickRpc(list: string[]): string {
  const valid = list.filter(url => url.length > 0);
  if (valid.length === 0) throw new Error("No RPC URL configured for this chain");
  return valid[Math.floor(Math.random() * valid.length)];
}

export function getSolanaRpc(): string {
  return pickRpc(RPC_POOLS[getNetwork()].solana);
}

export function getEvmRpc(chain: string): string {
  const list = RPC_POOLS[getNetwork()].evm[chain];
  if (!list) {
    throw new Error(`Unsupported EVM chain: ${chain}. Supported: ${Object.keys(RPC_POOLS[getNetwork()].evm).join(", ")}`);
  }
  return pickRpc(list);
}

export interface AppConfig {
  solanaSigner: Awaited<ReturnType<typeof createKeyPairSignerFromPrivateKeyBytes>>;
  solanaPublicKey: string;
  evmAddress: string;
  evmPrivateKey: string;
  solanaRpcUrl: string;
  evmRpcUrls: Record<string, string>;
  wayfindApiKey: string;
  wayfindApiUrl: string;
}

interface StoredWallet {
  encryptedSeed: string;
  salt: string;
  solanaPublicKey: string;
  evmAddress: string;
  mnemonic?: string;
}

async function deriveKeysFromSeed(seed: Uint8Array) {
  const solanaSeed = seed.slice(0, 32);
  const evmSeed = seed.slice(32, 64);

  const solanaSigner = await createKeyPairSignerFromPrivateKeyBytes(new Uint8Array(solanaSeed), false);
  const evmWallet = new Wallet(Buffer.from(evmSeed).toString("hex"));

  return {
    solanaSigner,
    solanaPublicKey: solanaSigner.address,
    evmAddress: evmWallet.address,
    evmPrivateKey: evmWallet.privateKey,
  };
}

async function loadOrCreateWalletKey(): Promise<{ seed: Uint8Array; mnemonic: string | null }> {
  if (existsSync(WALLET_FILE)) {
    const data: StoredWallet = JSON.parse(readFileSync(WALLET_FILE, "utf-8"));

    const passkey = process.env.WALLET_PASSKEY!;
    const salt = Buffer.from(data.salt, "base64");
    const sm = new WdkSecretManager(passkey, salt);
    const seed = sm.decrypt(Buffer.from(data.encryptedSeed, "base64")) as Buffer;
    sm.dispose();
    return { seed: new Uint8Array(seed), mnemonic: null };
  }

  const entropy = WdkSecretManager.generateSalt();
  const tempSm = new WdkSecretManager("temp", entropy);
  const randomEntropy = tempSm.generateRandomBuffer();
  tempSm.dispose();

  const passkey = process.env.WALLET_PASSKEY!;
  const sm = new WdkSecretManager(passkey, entropy);
  const mnemonic = sm.entropyToMnemonic(randomEntropy);
  sm.dispose();

  const seed = pbkdf2Sync(randomEntropy, Buffer.from("wayfind-seed-v1"), 100_000, 64, "sha512");

  const salt = WdkSecretManager.generateSalt();
  const saltB64 = Buffer.from(salt).toString("base64");
  const sm2 = new WdkSecretManager(passkey, salt);
  const encryptedSeed = sm2.encrypt(Buffer.from(seed), seed.byteLength);
  sm2.dispose();

  const keys = await deriveKeysFromSeed(seed);

  const stored: StoredWallet = {
    encryptedSeed: Buffer.from(encryptedSeed).toString("base64"),
    salt: saltB64,
    solanaPublicKey: keys.solanaPublicKey,
    evmAddress: keys.evmAddress,
    mnemonic,
  };

  writeFileSync(WALLET_FILE, JSON.stringify(stored, null, 2), { mode: 0o600 });

  return { seed: new Uint8Array(seed), mnemonic };
}

export async function validateEnvironment(): Promise<AppConfig> {
  const passkey = process.env.WALLET_PASSKEY;
  if (!passkey) {
    throw new Error(
      "WALLET_PASSKEY environment variable is required.\n" +
      "Set it before running the MCP server.\n" +
      "Example: export WALLET_PASSKEY=\"your-secure-passphrase\"\n" +
      "Must be at least 12 characters."
    );
  }

  const { seed, mnemonic } = await loadOrCreateWalletKey();
  const keys = await deriveKeysFromSeed(seed);

  const zeroize = (buf: Uint8Array) => buf.fill(0);
  process.on("exit", () => zeroize(seed));

  return {
    ...keys,
    solanaRpcUrl: getSolanaRpc(),
    evmRpcUrls: Object.fromEntries(
      Object.entries(RPC_POOLS[getNetwork()].evm).map(([chain, urls]) => [chain, pickRpc(urls)])
    ),
    wayfindApiKey: process.env.WAYFIND_API_KEY || "",
    wayfindApiUrl: process.env.WAYFIND_API_URL || "https://o3qftki5dtnlhqlrtvswt336bq0mwdye.lambda-url.ap-southeast-1.on.aws",
  };
}
