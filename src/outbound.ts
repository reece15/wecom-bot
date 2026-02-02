import type { ChannelOutboundAdapter, ChannelOutboundContext, OutboundDeliveryResult } from "openclaw/plugin-sdk";
import { getWeComClient } from "./client.js";
import type { WeComConfig } from "./types.js";

export const wecomOutbound: ChannelOutboundAdapter = {
  deliveryMode: "direct", // WeCom prefers complete messages (no streaming/editing)
  
  sendText: async (ctx: ChannelOutboundContext): Promise<OutboundDeliveryResult> => {
    const { to, text, accountId, deps } = ctx;
    
    // Resolve configuration
    const cfg = deps?.cfg?.channels?.wecom as WeComConfig | undefined;
    if (!cfg) {
      throw new Error("WeCom configuration not found");
    }

    // Find account
    let account = null;
    if (accountId && cfg[accountId]) {
      account = cfg[accountId];
    } else {
      // Fallback to first enabled account
      account = Object.values(cfg).find((a) => a.enabled);
    }

    if (!account) {
      throw new Error(`WeCom account not found (accountId=${accountId || "any"})`);
    }

    const client = getWeComClient(account.corpid, account.corpsecret, String(account.agentid));
    
    try {
      await client.sendText(to, text);
      return {
        channel: "wecom",
        successful: true,
      };
    } catch (err) {
      return {
        channel: "wecom",
        successful: false,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  },
};
