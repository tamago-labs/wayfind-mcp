import type { McpTool } from "../types";
import { GetWalletAddressTool } from "./shared/get_wallet_address_tool";
import { GetBalancesTool } from "./shared/get_balances_tool";
import { SendTokensTool } from "./shared/send_tokens_tool";
import { SolanaGetSwapQuoteTool } from "./solana/get_swap_quote_tool";
import { SolanaSwapTokensTool } from "./solana/swap_tokens_tool";
import { WayfindGetTokensTool } from "./wayfind/get_tokens_tool";
import { WayfindGetTokenizedStocksTool } from "./wayfind/get_tokenized_stocks_tool";
import { WayfindGetRiskProfileTool } from "./wayfind/get_risk_profile_tool";
import { WayfindGetMarketOverviewTool } from "./wayfind/get_market_overview_tool";
export const McpTools: Record<string, McpTool> = {
  GetWalletAddress: GetWalletAddressTool,
  GetBalances: GetBalancesTool,
  SendTokens: SendTokensTool,
  SolanaGetSwapQuote: SolanaGetSwapQuoteTool,
  SolanaSwapTokens: SolanaSwapTokensTool,
  WayfindGetTokens: WayfindGetTokensTool,
  WayfindGetTokenizedStocks: WayfindGetTokenizedStocksTool,
  WayfindGetRiskProfile: WayfindGetRiskProfileTool,
  WayfindGetMarketOverview: WayfindGetMarketOverviewTool,
};
