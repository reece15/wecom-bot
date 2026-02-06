import type { ChannelOutboundAdapter, ChannelOutboundContext } from "openclaw/plugin-sdk";
import { getWeComClient } from "./client.js";
import type { WeComConfig } from "./types.js";

export const wecomOutbound: ChannelOutboundAdapter = {
  deliveryMode: "direct", // WeCom prefers complete messages (no streaming/editing)
  
  sendText: async (ctx: ChannelOutboundContext) => {
    const { to, text, accountId, cfg } = ctx;
    
    // Resolve configuration
    const wecomCfg = cfg?.channels?.["wecom-app"] as WeComConfig | undefined;
    if (!wecomCfg) {
      throw new Error("WeCom configuration not found");
    }

    // Find account
    let account = null;
    if (accountId && wecomCfg[accountId]) {
      account = wecomCfg[accountId];
    } else {
      // Fallback to first enabled account
      account = Object.values(wecomCfg).find((a) => a.enabled);
    }

    if (!account) {
      throw new Error(`WeCom account not found (accountId=${accountId || "any"})`);
    }

    const client = getWeComClient(account.corpid, account.corpsecret, String(account.agentid));
    
    try {
      await client.sendText(to, text);
      return {
        channel: "wecom-app",
        messageId: Date.now().toString(), // Dummy ID
      };
    } catch (err) {
      throw err;
    }
  },
};
