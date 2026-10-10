import type { McpTool } from "../types";
import { GetWalletAddressTool } from "./solana/get_wallet_address_tool";
import { WayfindGetTokensTool } from "./wayfind/get_tokens_tool";
import { WayfindGetTokenizedStocksTool } from "./wayfind/get_tokenized_stocks_tool";
import { WayfindGetRiskProfileTool } from "./wayfind/get_risk_profile_tool";
import { WayfindGetMarketOverviewTool } from "./wayfind/get_market_overview_tool";
import { WayfindGetPreIpoTool } from "./wayfind/get_pre_ipo_tool";

export const McpTools: Record<string, McpTool> = {
  SolanaGetWalletAddress: GetWalletAddressTool,
  WayfindGetTokens: WayfindGetTokensTool,
  WayfindGetTokenizedStocks: WayfindGetTokenizedStocksTool,
  WayfindGetRiskProfile: WayfindGetRiskProfileTool,
  WayfindGetMarketOverview: WayfindGetMarketOverviewTool,
  WayfindGetPreIpo: WayfindGetPreIpoTool,
};
