import type { McpTool } from "../types";
import { GetWalletAddressTool } from "./solana/get_wallet_address_tool";

export const SolanaMcpTools: Record<string, McpTool> = {
  GetWalletAddressTool,
};
