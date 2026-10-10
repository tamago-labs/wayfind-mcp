import { Agent } from "../../agent";
import type { McpTool } from "../../types";

export const WayfindGetPreIpoTool: McpTool = {
  name: "wayfind_get_pre_ipo",
  description: "List pre-IPO markets with mark prices and valuations",
  schema: {},
  handler: async (agent: Agent, _input: Record<string, any>) => {
    return agent.wayfindFetch("/pre-ipo");
  },
};
