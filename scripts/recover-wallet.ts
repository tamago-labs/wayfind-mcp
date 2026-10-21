#!/usr/bin/env node
/**
 * Wallet Recovery Script
 *
 * Recovers a wallet from a BIP39 mnemonic phrase and writes encrypted files to ~/.wayfind/
 *
 * Usage:
 *   WALLET_PASSKEY="new-passphrase" npx tsx scripts/recover-wallet.ts "your 12 word mnemonic here"
 *   WALLET_PASSKEY="new-passphrase" RECOVERY_MNEMONIC="your phrase" npx tsx scripts/recover-wallet.ts
 *
 * Output:
 *   ~/.wayfind/.wallet.json          — encrypted seed + salt + public addresses
 *   ~/.wayfind/BACKUP_AND_REMOVE.txt — mnemonic backup
 */

import { writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { randomBytes, pbkdf2Sync } from "crypto";
import sodium from "sodium-native";
import * as bip39 from "bip39";
import { Wallet } from "ethers";
import { createKeyPairSignerFromPrivateKeyBytes } from "@solana/kit";

const WALLET_DIR = join(homedir(), ".wayfind");
const WALLET_FILE = join(WALLET_DIR, ".wallet.json");
const MNEMONIC_FILE = join(WALLET_DIR, "BACKUP_AND_REMOVE.txt");

function deriveKeyFromPasskey(passkey: string, salt: Buffer): Buffer {
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

async function main() {
  const mnemonic = process.argv[2] || process.env.RECOVERY_MNEMONIC;
  if (!mnemonic) {
    console.error("Usage: WALLET_PASSKEY=\"...\" npx tsx scripts/recover-wallet.ts <mnemonic>");
    console.error("   or: WALLET_PASSKEY=\"...\" RECOVERY_MNEMONIC=\"...\" npx tsx scripts/recover-wallet.ts");
    process.exit(1);
  }

  const trimmedMnemonic = mnemonic.trim().toLowerCase();
  if (!bip39.validateMnemonic(trimmedMnemonic)) {
    console.error("Invalid mnemonic phrase. Make sure it's a valid BIP39 phrase (12 or 24 words).");
    process.exit(1);
  }

  const passkey = process.env.WALLET_PASSKEY;
  if (!passkey) {
    console.error("WALLET_PASSKEY environment variable is required.");
    process.exit(1);
  }
  if (passkey.length < 12) {
    console.error("WALLET_PASSKEY must be at least 12 characters long.");
    process.exit(1);
  }

  if (existsSync(WALLET_FILE)) {
    console.error(`\nWarning: ${WALLET_FILE} already exists.`);
    const raw = JSON.parse(readFileSync(WALLET_FILE, "utf-8"));
    console.error(`  Existing Solana address: ${raw.solanaPublicKey}`);
    console.error(`  Existing EVM address:     ${raw.evmAddress}`);
    console.error("\nThis will overwrite your existing wallet. Make sure you have the mnemonic backed up.");
    console.error("To confirm, set OVERWRITE_WALLET=1 and run again.\n");

    if (process.env.OVERWRITE_WALLET !== "1") {
      console.error("Aborted.");
      process.exit(1);
    }

    console.error("Overwrite confirmed.\n");
  }

  const seed = bip39.mnemonicToSeedSync(trimmedMnemonic);
  const keys = await deriveKeysFromSeed(new Uint8Array(seed));

  const salt = randomBytes(16);
  const key = deriveKeyFromPasskey(passkey, salt);
  const encryptedSeed = encryptBuffer(Buffer.from(seed), key);

  sodium.sodium_memzero(key);

  const { mkdirSync } = await import("fs");
  mkdirSync(WALLET_DIR, { recursive: true, mode: 0o700 });

  const stored = {
    encryptedSeed: encryptedSeed.toString("base64"),
    salt: salt.toString("base64"),
    solanaPublicKey: keys.solanaPublicKey,
    evmAddress: keys.evmAddress,
  };

  writeFileSync(WALLET_FILE, JSON.stringify(stored, null, 2), { mode: 0o600 });
  writeFileSync(MNEMONIC_FILE, trimmedMnemonic, { mode: 0o600 });

  console.log("Wallet recovered successfully!\n");
  console.log(`  Solana: ${keys.solanaPublicKey}`);
  console.log(`  EVM:    ${keys.evmAddress}`);
  console.log(`\nFiles written:`);
  console.log(`  ${WALLET_FILE}`);
  console.log(`  ${MNEMONIC_FILE}`);
  console.log(`\nSecurity: Back up BACKUP_AND_REMOVE.txt and delete it from this machine.`);
}

main();
