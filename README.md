# Wayfind MCP

![NPM Version](https://img.shields.io/npm/v/@tamago-labs/wayfind-mcp)

**Wayfind MCP** is a Model Context Protocol (MCP) server for the Wayfind AI risk intelligence platform. It provides multi-chain wallet operations, tokenized stock data, risk analysis, and OKX DEX swap integration across **Solana** and **EVM** chains.

## Features

- **10 MCP tools** covering wallet management, market data, risk analysis, and token swaps
- **Multi-chain support** — single encrypted seed derives both Solana and EVM keypairs
- **OKX DEX integration** for swap quotes and end-to-end token swaps (get instruction → sign → send)
- **Tokenized stock data** from Wayfind API — prices, market overview, pre-IPO markets
- **Risk portfolio analysis** — user risk profiles with factor breakdowns
- **Encrypted wallet** — seed encrypted at rest using PBKDF2-SHA256 (100k iterations) + libsodium secretbox
- **BIP39 mnemonic backup** — 12-word mnemonic stored in `.wallet.json` for recovery
- **Token symbol resolution** — maps mint addresses to symbols for base tokens, RWA stocks, and pre-IPO tokens

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
| Ethereum | `ethereum-sepolia.gateway.tatum.io` |
| Base | `sepolia.base.org` |

**Mainnet:**

| Chain | RPC |
|-------|-----|
| Solana | `api.mainnet-beta.solana.com`, `rpc.ankr.com/solana` |
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

For production use, run your own RPC node or use a provider like Helius, QuickNode, or Alchemy to avoid rate limits.

### First Run

On first run with `WALLET_PASSKEY` set, the server generates a new wallet and saves:

- **`.wallet.json`** — encrypted seed + salt + public addresses + BIP39 mnemonic (mode `0o600`)

The mnemonic is stored inside `.wallet.json` for recovery. View it with:

```bash
cat .wallet.json | jq .mnemonic
```

Save the mnemonic somewhere secure — it can restore both Solana and EVM keys if `.wallet.json` is lost.

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

### Wallet Operations

| Tool Name | Description | Example Prompt |
|-----------|-------------|----------------|
| `get_wallet_address` | Get wallet addresses for all chains on the selected network | "What are my wallet addresses?" |
| `solana_get_balance` | Get SOL and SPL token balances with symbol resolution | "Show my Solana balances" |
| `solana_get_swap_quote` | Get an OKX DEX swap quote for a token pair | "How much USDC for 1 SOL?" |
| `solana_swap_tokens` | Swap tokens on Solana via OKX DEX (signs and sends) | "Swap 0.1 SOL to USDC" |

### Market Data

| Tool Name | Description | Example Prompt |
|-----------|-------------|----------------|
| `wayfind_get_tokens` | List all tokenized stocks with prices | "Show me all tokenized stocks" |
| `wayfind_get_tokenized_stocks` | Get all tokenized versions of a stock ticker across blockchains | "Get all AAPL tokens" |
| `wayfind_get_market_overview` | Get market stats: total cap, volume, gainers, losers, trending | "Show market overview" |
| `wayfind_get_pre_ipo` | List pre-IPO markets with mark prices and valuations | "Show pre-IPO markets" |

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
    ├── config.ts             # Encrypted wallet: PBKDF2 + libsodium secretbox + BIP39
    ├── types.ts              # McpTool interface
    ├── agent/
    │   └── index.ts          # Agent class: RPC client, multi-chain signer, symbol resolution
    └── mcp/
        ├── index.ts                # Aggregates all tools
        ├── shared/                 # Shared cross-chain tools
        │   └── get_wallet_address_tool.ts
        ├── solana/                 # Solana wallet + swap tools
        │   ├── get_balance_tool.ts
        │   ├── get_swap_quote_tool.ts
        │   └── swap_tokens_tool.ts
        └── wayfind/                # Wayfind API tools
            ├── get_tokens_tool.ts
            ├── get_tokenized_stocks_tool.ts
            ├── get_risk_profile_tool.ts
            ├── get_market_overview_tool.ts
            └── get_pre_ipo_tool.ts
```

## Wallet Security

The wallet seed is encrypted at rest using Node.js crypto + sodium-native:

1. **PBKDF2-SHA256** (100,000 iterations) derives an encryption key from your passkey
2. **libsodium secretbox** (XSalsa20-Poly1305) encrypts the 64-byte seed
3. `{ encryptedSeed, salt, solanaPublicKey, evmAddress, mnemonic }` is stored in `.wallet.json` — **no plaintext keys**
4. The BIP39 mnemonic (12 words) is stored in `.wallet.json` for recovery
5. On startup, the seed is decrypted in memory and zeroized on process exit

**Security notes:**
- Choose a strong passkey (12+ characters, mixed entropy)
- Never share your passkey or mnemonic
- `.wallet.json` contains the encrypted seed + plaintext mnemonic — protect it (mode `0600`, gitignored)
- If `.wallet.json` is lost, the mnemonic can fully restore both Solana and EVM keys

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@modelcontextprotocol/sdk` | ^1.10.2 | MCP server + StdioServerTransport |
| `@solana/kit` | ^2.3.0 | Solana SDK (RPC, keypairs, transactions) |
| `sodium-native` | ^4.3.1 | Encryption (libsodium secretbox) |
| `bip39` | ^3.1.0 | BIP39 mnemonic generation |
| `ethers` | ^6.17.0 | EVM wallet derivation |
| `bs58` | ^6.0.0 | Base58 encoding |
| `zod` | ^3.24.3 | Tool parameter schemas |

## Building

```bash
npm install
npm run build      # Outputs to dist/
npm start          # Run the server
```

## License

MIT
