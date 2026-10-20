import { Agent } from "../../agent";
import type { McpTool } from "../../types";

export const WayfindGetMarketOverviewTool: McpTool = {
  name: "wayfind_get_market_overview",
  description: "Get tokenized stock market overview including total market cap, 24h volume, gainers, losers, and trending tokens",
  schema: {},
  handler: async (agent: Agent, _input: Record<string, any>) => {
    return agent.wayfindFetch("/market-overview");
  },
};
