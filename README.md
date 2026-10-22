# Wayfind MCP

![NPM Version](https://img.shields.io/npm/v/@tamago-labs/wayfind-mcp)

**Wayfind MCP** is a Model Context Protocol server for multi-chain DeFi operations, tokenized stock data, and Circle Unified Balance. It provides wallet management, token transfers, Solana swaps, USDC cross-chain deposit/spend, and risk intelligence across **Solana** and **EVM** chains.

## Features

- **10 MCP tools** covering wallet management, balances, transfers, market data, risk analysis, and token swaps
- **Multi-chain agentic wallet** — single encrypted seed derives Solana and EVM keypairs across all supported chains
- **Multi-chain balances** — query SOL + SPL tokens, ETH/native + ERC-20 across 10 chains
- **Multi-chain transfers** — send native tokens and SPL/ERC-20 tokens to any address
- **OKX DEX integration** for swap quotes and end-to-end token swaps (Solana mainnet)
- **Tokenized stock data** from Wayfind API — prices, market overview
- **Risk portfolio analysis** — user risk profiles with factor breakdowns
- **Encrypted wallet** — seed encrypted at rest using PBKDF2-SHA256 (100k iterations) + libsodium secretbox
- **BIP39 mnemonic backup** — 12-word mnemonic stored separately in `~/.wayfind/BACKUP_AND_REMOVE.txt` for recovery

## Installation

```bash
npm install -g @tamago-labs/wayfind-mcp
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WALLET_PASSKEY` | Yes | — | Passphrase to encrypt wallet seed (min 12 characters) |
| `WAYFIND_NETWORK` | No | `testnet` | `testnet` or `mainnet` — controls which RPC pool to use |
| `WAYFIND_API_KEY` | No* | — | Wayfind API key — get from [wayfind.click](https://wayfind.click/) dashboard |

* `WAYFIND_API_KEY` is optional. Without it, risk profile calls return a demo profile. Get your own key from the Wayfind dashboard for live data.

### RPC Endpoints

The server uses built-in RPC pools per network (set via `WAYFIND_NETWORK`, default `testnet`). Each startup picks randomly for load balancing.

**Testnet (default):**

| Chain | RPC |
|-------|-----|
| Solana | `api.devnet.solana.com` |
| Arc | `rpc.testnet.arc.io` |
| Ethereum | `ethereum-sepolia-rpc.publicnode.com` |
| Base | `sepolia.base.org`, `base-sepolia-rpc.publicnode.com` |

**Mainnet:**

| Chain | RPC |
|-------|-----|
| Solana | `api.mainnet-beta.solana.com` |
| Arc | `rpc.mainnet.arc.io` |
| Ethereum | `singapore.rpc.blxrbdn.com`, `0xrpc.io/eth` |
| Base | `mainnet.base.org`, `8453.rpc.thirdweb.com` |
| Arbitrum | `arb1.arbitrum.io/rpc`, `arb-one-mainnet.gateway.tatum.io` |
| Polygon | `public.1rpc.io/matic`, `polygon.gateway.tenderly.co` |
| Avalanche | `avalanche-c-chain-rpc.publicnode.com`, `rpc.swiftnodes.io/rpc/avalanche` |
| Optimism | `mainnet.optimism.io`, `optimism.drpc.org` |
| World | `worldchain-mainnet.gateway.tenderly.co`, `worldchain-mainnet.g.alchemy.com/public` |
| Sei | `evm-rpc.sei-apis.com`, `1329.rpc.thirdweb.com` |

Switch to mainnet:

```bash
export WAYFIND_NETWORK=mainnet
```

### First Run

On first run with `WALLET_PASSKEY` set, the server generates a new wallet and saves to `~/.wayfind/`:

- **`.wayfind/.wallet.json`** — encrypted seed + salt + public addresses (mode `0o600`)
- **`~/.wayfind/BACKUP_AND_REMOVE.txt`** — BIP39 mnemonic for recovery (mode `0o600`)

The mnemonic is stored separately so you can back it up and delete it from the machine. View it with:

```bash
cat ~/.wayfind/BACKUP_AND_REMOVE.txt
```

Save the mnemonic somewhere secure — it can restore both Solana and EVM keys if `.wallet.json` is lost.

**Security tip:** After backing up the mnemonic, delete `BACKUP_AND_REMOVE.txt` from the machine to reduce exposure. The encrypted `.wallet.json` alone cannot be restored without the passkey.

Subsequent runs decrypt silently using your passkey.

### OpenCode

Add to `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "wayfind": {
        "type": "local",
        "command": ["npx", "-y", "@tamago-labs/wayfind-mcp"],
        "environment": {
          "WALLET_PASSKEY": "your-secure-passphrase-here"
        }
      }
    }
  }
}
```

### Claude Desktop

```json
{
  "mcpServers": {
    "wayfind": {
      "command": "npx",
      "args": ["-y", "@tamago-labs/wayfind-mcp"],
      "env": {
        "WALLET_PASSKEY": "your-secure-passphrase-here"
      }
    }
  }
}
```

### Cursor

```json
{
  "mcp": {
    "servers": {
      "wayfind": {
        "command": "npx",
        "args": ["-y", "@tamago-labs/wayfind-mcp"],
        "env": {
          "WALLET_PASSKEY": "your-secure-passphrase-here"
        }
      }
    }
  }
}
```

## Available Tools

### Wallet & Balances

| Tool Name | Description | Example Prompt |
|-----------|-------------|----------------|
| `get_wallet_address` | Get wallet addresses for all chains on the selected network | "What are my wallet addresses?" |
| `get_balances` | Get native and token balances for a specific chain (supports custom wallet address) | "Show my Solana balances" |

### Transfers & Swaps

| Tool Name | Description | Example Prompt |
|-----------|-------------|----------------|
| `send_tokens` | Send native tokens and SPL/ERC-20 tokens to any address. Auto-creates token accounts on Solana. | "Send 1 USDC to 0xABC..." |
| `get_transaction` | Get transaction details and status by chain and hash | "Check this Solana tx" |
| `solana_get_swap_quote` | Get an OKX DEX swap quote for a token pair | "How much USDC for 1 SOL?" |
| `solana_swap_tokens` | Swap tokens on Solana via OKX DEX (signs and sends, mainnet only) | "Swap 0.1 SOL to USDC" |

### Market Data

| Tool Name | Description | Example Prompt |
|-----------|-------------|----------------|
| `wayfind_get_tokens` | List all tokenized stocks with prices | "Show me all tokenized stocks" |
| `wayfind_get_tokenized_stocks` | Get all tokenized versions of a stock ticker across blockchains | "Get all AAPL tokens" |
| `wayfind_get_market_overview` | Get tokenized stock market stats: total cap, volume, gainers, losers, trending | "Show market overview" |

### Risk Analysis

| Tool Name | Description | Example Prompt |
|-----------|-------------|----------------|
| `wayfind_get_risk_profile` | Get the risk profile created from the Wayfind dashboard | "Show my risk profile" |

## Architecture

```
mcp/
├── package.json              # @tamago-labs/wayfind-mcp
├── tsconfig.json
├── tsup.config.ts            # Build: CJS + ESM + .d.ts
├── .gitignore
└── src/
    ├── index.ts              # MCP server bootstrap
    ├── config.ts             # Encrypted wallet: PBKDF2 + libsodium secretbox + BIP39, multi-chain RPCs
    ├── types.ts              # McpTool interface
    ├── agent/
    │   └── index.ts          # Agent class: multi-chain RPC, signer, balance queries, transfers, swaps
    ├── utils/
    │   ├── token-resolver.ts       # MINT_TO_SYMBOL / SYMBOL_TO_MINT maps
    │   └── chain-data.ts           # ChainData, ChainToken types + loadChainData()
    ├── data/
    │   ├── base-tokens.json       # Common token list (Solana mainnet + devnet)
    │   ├── rwa-v1-list.json       # RWA/tokenized stock data
    │   ├── pre-ipo-list.json      # Pre-IPO token data
    │   └── chains/                # Per-chain EVM token lists (mainnet + testnet)
    └── mcp/
        ├── index.ts                # Aggregates all tools
        ├── shared/                 # Cross-chain tools
        │   ├── get_wallet_address_tool.ts
        │   ├── get_balances_tool.ts
        │   ├── send_tokens_tool.ts
        │   └── get_transaction_tool.ts
        ├── solana/                 # Solana-specific tools
        │   ├── get_swap_quote_tool.ts
        │   └── swap_tokens_tool.ts
        └── wayfind/                # Wayfind API tools
            ├── get_tokens_tool.ts
            ├── get_tokenized_stocks_tool.ts
            ├── get_risk_profile_tool.ts
            └── get_market_overview_tool.ts
```

## Wallet Security

The wallet seed is encrypted at rest using Node.js crypto + sodium-native:

1. **PBKDF2-SHA256** (100,000 iterations) derives an encryption key from your passkey
2. **libsodium secretbox** (XSalsa20-Poly1305) encrypts the 64-byte seed
3. `{ encryptedSeed, salt, solanaPublicKey, evmAddress }` is stored in `~/.wayfind/.wallet.json` — **no plaintext keys, no mnemonic**
4. The BIP39 mnemonic (12 words) is stored separately in `~/.wayfind/BACKUP_AND_REMOVE.txt` for recovery
5. On startup, the seed is decrypted in memory and zeroized on process exit

**Security notes:**
- Choose a strong passkey (12+ characters, mixed entropy)
- Never share your passkey or mnemonic
- `~/.wayfind/.wallet.json` contains only encrypted data — protect it (mode `0600`, gitignored)
- `~/.wayfind/BACKUP_AND_REMOVE.txt` contains the plaintext mnemonic — back it up, then delete from machine
- If `.wallet.json` is lost, the mnemonic can fully restore both Solana and EVM keys

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@modelcontextprotocol/sdk` | ^1.10.2 | MCP server + StdioServerTransport |
| `@solana/kit` | ^3.0.3 | Solana SDK (RPC, keypairs, transactions) |
| `sodium-native` | ^4.3.1 | Encryption (libsodium secretbox) |
| `bip39` | ^3.1.0 | BIP39 mnemonic generation |
| `ethers` | ^6.17.0 | EVM wallet derivation |
| `bs58` | ^6.0.0 | Base58 encoding |
| `zod` | ^3.24.3 | Tool parameter schemas |
| `ws` | ^8.22.0 | WebSocket RPC subscriptions |

## Building

```bash
npm install
npm run build      # Outputs to dist/
npm start          # Run the server
```

## License

MIT
