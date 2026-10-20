import baseTokens from "../data/base-tokens.json";
import rwaList from "../data/rwa-v1-list.json";
import preIpoList from "../data/pre-ipo-list.json";

export const MINT_TO_SYMBOL: Record<string, string> = {};
export const SYMBOL_TO_MINT: Record<string, string> = {};

for (const t of baseTokens as any[]) {
  MINT_TO_SYMBOL[t.address] = t.symbol;
  SYMBOL_TO_MINT[t.symbol.toUpperCase()] = t.address;
}

for (const asset of (rwaList as any).assets ?? []) {
  for (const token of asset.tokens ?? []) {
    const mint = token.addresses?.solana ?? token.mint;
    if (mint && token.symbol) {
      MINT_TO_SYMBOL[mint] = token.symbol;
      SYMBOL_TO_MINT[token.symbol.toUpperCase()] = mint;
    }
  }
}

for (const asset of (preIpoList as any).assets ?? []) {
  if (asset.mint && asset.symbol) {
    MINT_TO_SYMBOL[asset.mint] = asset.symbol;
    SYMBOL_TO_MINT[asset.symbol.toUpperCase()] = asset.mint;
  }
}
