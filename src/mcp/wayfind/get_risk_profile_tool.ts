import { Agent } from "../../agent";
import type { McpTool } from "../../types";

export const WayfindGetRiskProfileTool: McpTool = {
  name: "wayfind_get_risk_profile",
  description: "Get the user's portfolio risk profile including overall score, label, and answers",
  schema: {},
  handler: async (agent: Agent, _input: Record<string, any>) => {
    return agent.wayfindFetch("/risk-profile");
  },
};
