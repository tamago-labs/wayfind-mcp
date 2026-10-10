import { z } from "zod";
import { Agent } from "../../agent";
import type { McpTool } from "../../types";

export const WayfindGetTokenizedStocksTool: McpTool = {
  name: "wayfind_get_tokenized_stocks",
  description: "Get all tokenized versions of a stock ticker across blockchains (e.g. 'AAPL' returns AAPL on Solana, Ethereum, etc.)",
  schema: {
    ticker: z.string().describe("Stock ticker symbol (e.g., 'AAPL', 'GOOG', 'TSLA')"),
  },
  handler: async (agent: Agent, input: Record<string, any>) => {
    return agent.wayfindFetch(`/tokens/${encodeURIComponent(input.ticker)}`);
  },
};
