import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { createKeyPairSignerFromPrivateKeyBytes } from "@solana/kit";
import { randomBytes, pbkdf2Sync } from "crypto";
import sodium from "sodium-native";
import * as bip39 from "bip39";
import { Wallet } from "ethers";

const WALLET_FILE = join(homedir(), ".wayfind", ".wallet.json");

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
      ethereum: ["https://ethereum-sepolia-rpc.publicnode.com"],
      },
  },
  mainnet: {
    solana: [
      "https://api.mainnet-beta.solana.com"
    ],
    evm: {
      ethereum: [
        "https://singapore.rpc.blxrbdn.com",
        "https://0xrpc.io/eth",
      ],
      arbitrum: [
        "https://arb1.arbitrum.io/rpc",
        "https://arb-one-mainnet.gateway.tatum.io",
      ],
      bnb: [
        "https://bsc-dataseed.bnbchain.org",
        "https://bsc-dataseed1.defibit.io",
      ],
    },
  },
};

export function getNetwork(): Network {
  const network = process.env.WAYFIND_NETWORK?.toLowerCase();
  if (network === "mainnet") return "mainnet";
  if (network === "testnet") return "testnet";
  return "testnet";
}

export function getSupportedChains(network?: Network): string[] {
  const net = network ?? getNetwork();
  const chains = ["solana", ...Object.keys(RPC_POOLS[net].evm)];
  return chains;
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
}

function deriveKeyFromPassKey(passkey: string, salt: Buffer): Buffer {
  return pbkdf2Sync(passkey, salt, 100_000, 32, "sha256");
}

function encryptBuffer(buffer: Buffer, key: Buffer): Buffer {
  if (buffer.byteLength < 16 || buffer.byteLength > 64) {
    throw new Error("Buffer size must be between 16 and 64");
  }

  const nonce = randomBytes(sodium.crypto_secretbox_NONCEBYTES);
  const plain = Buffer.alloc(1 + buffer.byteLength);
  plain[0] = buffer.byteLength;
  buffer.copy(plain, 1);

  const cipher = Buffer.alloc(plain.byteLength + sodium.crypto_secretbox_MACBYTES);
  sodium.crypto_secretbox_easy(cipher, plain, nonce, key);

  const payload = Buffer.alloc(1 + nonce.byteLength + cipher.byteLength);
  payload[0] = 0;
  nonce.copy(payload, 1);
  cipher.copy(payload, 1 + nonce.byteLength);

  return payload;
}

function decryptBuffer(payload: Buffer, key: Buffer): Buffer {
  const minLength = 1 + sodium.crypto_secretbox_NONCEBYTES + sodium.crypto_secretbox_MACBYTES + 1;
  if (payload.byteLength < minLength) {
    throw new Error("Invalid payload: too short");
  }
  if (payload[0] !== 0) {
    throw new Error("Invalid version");
  }

  const nonce = payload.subarray(1, 1 + sodium.crypto_secretbox_NONCEBYTES);
  const cipher = payload.subarray(1 + nonce.byteLength);

  const plain = Buffer.alloc(cipher.byteLength - sodium.crypto_secretbox_MACBYTES);
  if (!sodium.crypto_secretbox_open_easy(plain, cipher, nonce, key)) {
    throw new Error("Decryption failed");
  }

  const byteLength = plain[0];
  if (byteLength < 16 || byteLength > 64 || plain.byteLength < 1 + byteLength) {
    throw new Error("Invalid decrypted payload");
  }

  return Buffer.from(plain.subarray(1, 1 + byteLength));
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
    const raw: StoredWallet & { mnemonic?: string } = JSON.parse(readFileSync(WALLET_FILE, "utf-8"));

    if (raw.mnemonic) {
      const mnemonicFile = join(homedir(), ".wayfind", "BACKUP_AND_REMOVE.txt");
      if (!existsSync(mnemonicFile)) {
        writeFileSync(mnemonicFile, raw.mnemonic, { mode: 0o600 });
      }
    }

    const passkey = process.env.WALLET_PASSKEY!;
    const salt = Buffer.from(raw.salt, "base64");
    const key = deriveKeyFromPassKey(passkey, salt);
    const seed = decryptBuffer(Buffer.from(raw.encryptedSeed, "base64"), key);

    return { seed: new Uint8Array(seed), mnemonic: null };
  }

  const randomEntropy = randomBytes(16);
  const mnemonic = bip39.entropyToMnemonic(randomEntropy.toString("hex"));
  const seed = bip39.mnemonicToSeedSync(mnemonic);

  const salt = randomBytes(16);
  const passkey = process.env.WALLET_PASSKEY!;
  const key = deriveKeyFromPassKey(passkey, salt);
  const encryptedSeed = encryptBuffer(Buffer.from(seed), key);

  sodium.sodium_memzero(key);

  const keys = await deriveKeysFromSeed(new Uint8Array(seed));

  const walletDir = join(homedir(), ".wayfind");
  if (!existsSync(walletDir)) {
    mkdirSync(walletDir, { recursive: true, mode: 0o700 });
  }

  const mnemonicFile = join(walletDir, "BACKUP_AND_REMOVE.txt");
  if (!existsSync(mnemonicFile)) {
    writeFileSync(mnemonicFile, mnemonic, { mode: 0o600 });
  }

  const stored: StoredWallet = {
    encryptedSeed: encryptedSeed.toString("base64"),
    salt: salt.toString("base64"),
    solanaPublicKey: keys.solanaPublicKey,
    evmAddress: keys.evmAddress,
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

  const { seed } = await loadOrCreateWalletKey();
  const keys = await deriveKeysFromSeed(seed);

  const zeroize = (buf: Uint8Array) => buf.fill(0);
  process.on("exit", () => zeroize(seed));

  return {
    ...keys,
    solanaRpcUrl: getSolanaRpc(),
    evmRpcUrls: Object.fromEntries(
      Object.entries(RPC_POOLS[getNetwork()].evm).map(([chain, urls]) => [chain, pickRpc(urls)])
    ),
    wayfindApiKey: process.env.WAYFIND_API_KEY || "e1ee8520-305a-49b5-a2de-3e1a7e6078c0",
    wayfindApiUrl: process.env.WAYFIND_API_URL || "https://o3qftki5dtnlhqlrtvswt336bq0mwdye.lambda-url.ap-southeast-1.on.aws",
  };
}
