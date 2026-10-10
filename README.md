# Wayfind Solana MCP

![NPM Version](https://img.shields.io/npm/v/@tamago-labs/wayfind-mcp)

**Wayfind Solana MCP** is a Model Context Protocol (MCP) server for the Wayfind AI risk intelligence platform. It provides wallet operations, tokenized stock data, risk analysis, and OKX DEX swap integration for Solana wallets.

## Features

- **10 MCP tools** covering wallet management, market data, risk analysis, and token swaps
- **OKX DEX integration** for swap quotes and end-to-end token swaps (get instruction → sign → send)
- **Tokenized stock data** from Wayfind API — prices, market overview, pre-IPO markets
- **Risk portfolio analysis** — user risk profiles with factor breakdowns
- **Auto wallet generation** — creates and persists a Solana wallet if no private key is provided
- **Token symbol resolution** — maps mint addresses to symbols for base tokens, RWA stocks, and pre-IPO tokens

## Installation

```bash
npm install -g @tamago-labs/wayfind-mcp
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SOLANA_PRIVATE_KEY` | No* | Auto-generated | Base58-encoded Solana private key |
| `SOLANA_RPC_URL` | No | `https://api.mainnet-beta.solana.com` | Solana RPC endpoint |
| `WAYFIND_API_KEY` | No* | Demo default | Wayfind API key — get from [wayfind.click](https://wayfind.click/) dashboard. Omit for demo risk profile |

* If `SOLANA_PRIVATE_KEY` is not set, a new wallet is generated and saved to `.wallet.json`.
* `WAYFIND_API_KEY` uses a demo key by default which returns a sample risk profile. For your own risk profile, get your API key from the Wayfind dashboard.

### OpenCode

Add to `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "wayfind-solana": {
        "type": "local",
        "command": ["npx", "-y", "@tamago-labs/wayfind-mcp"],
        "environment": {
          "SOLANA_PRIVATE_KEY": "your_base58_key_here (omit to auto-create a new wallet)"
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
    "wayfind-solana": {
      "command": "npx",
      "args": [
        "-y",
        "@tamago-labs/wayfind-mcp"
      ],
      "env": {
        "SOLANA_PRIVATE_KEY": "your_base58_key_here (omit to auto-create)"
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
      "wayfind-solana": {
        "command": "npx",
        "args": ["-y", "@tamago-labs/wayfind-mcp"],
        "env": {
          "SOLANA_PRIVATE_KEY": "your_base58_key_here (omit to auto-create)"
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
| `solana_get_wallet_address` | Get the wallet address derived from the private key | "What's my wallet address?" |
| `solana_get_balance` | Get SOL and SPL token balances with symbol resolution | "Show my wallet balances" |
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
wayfind-mcp/
├── package.json              # @tamago-labs/wayfind-mcp
├── tsconfig.json
├── tsup.config.ts            # Build: CJS + ESM + .d.ts
├── .gitignore
└── src/
    ├── index.ts              # MCP server bootstrap
    ├── config.ts             # Env validation + auto-wallet creation
    ├── types.ts              # McpTool interface
    ├── agent/
    │   └── index.ts          # Agent class: RPC client, signer, symbol resolution
    └── mcp/
        ├── index.ts                # Aggregates all tools
        ├── solana/                 # Solana wallet + swap tools
        │   ├── get_wallet_address_tool.ts
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

## Wallet Auto-Creation

When `SOLANA_PRIVATE_KEY` is not set, the server generates a new Solana wallet:

1. Generates a 64-byte secret key using `@solana/kit`
2. Saves to `.wallet.json` in the working directory (gitignored, mode `0600`)
3. Reuses the saved key on subsequent restarts
4. Uses `flag: "wx"` to prevent overwriting an existing wallet

**Note:** Anyone with access to `.wallet.json` can control the wallet's funds. Do not expose this file.

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@modelcontextprotocol/sdk` | ^1.10.2 | MCP server + StdioServerTransport |
| `@solana/kit` | ^2.3.0 | Solana SDK (RPC, keypairs, transactions) |
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
