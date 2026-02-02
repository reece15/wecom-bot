import {
  buildChannelConfigSchema,
  registerPluginHttpRoute,
  type ChannelPlugin,
  type MoltbotConfig,
  type PluginRuntime,
  type ChannelOnboardingAdapter,
  type ChannelOnboardingStatusContext,
  type ChannelOnboardingConfigureContext,
  type ChannelOnboardingResult,
  type ChannelOutboundContext,
  type OutboundDeliveryResult,
  type ChannelGatewayContext,
  deleteAccountFromConfigSection,
  setAccountEnabledInConfigSection,
} from "openclaw/plugin-sdk";
import { WeComConfigSchema, type ResolvedWeComAccount, type WeComConfig } from "./types.js";
import { getWeComClient } from "./client.js";
import { handleWeComWebhook } from "./webhook.js";
import { wecomOutbound } from "./outbound.js";
import type { IncomingMessage, ServerResponse } from "node:http";

export const wecomPlugin: ChannelPlugin<ResolvedWeComAccount> = {
  id: "wecom",
  outbound: wecomOutbound,
  meta: {
    id: "wecom",
    label: "WeCom",
    selectionLabel: "WeCom (Enterprise WeChat)",
    detailLabel: "WeCom Bot",
    docsPath: "/channels/wecom",
    docsLabel: "wecom",
    blurb: "Enterprise WeChat integration.",
    quickstartAllowFrom: true,
  },
  gateway: {
    startAccount: async (ctx: ChannelGatewayContext<ResolvedWeComAccount>) => {
      const { account } = ctx;
      console.log(`[WeCom] Starting account ${account.id} (corpid=${account.corpid})`);
      if (!account.token || !account.encodingAESKey) {
        console.log(`[WeCom] Missing token or encodingAESKey, skipping webhook registration`);
        return;
      }
      
      const path = "/wecom/webhook";
      console.log(`[WeCom] Registering webhook at ${path}`);

      registerPluginHttpRoute({
        path,
        pluginId: "wecom",
        accountId: account.id,
        log: (msg: string) => console.log(`[WeCom] ${msg}`),
        handler: async (req: IncomingMessage, res: ServerResponse) => {
           console.log(`[WeCom] Handler invoked for ${req.url}`);
           await handleWeComWebhook(req, res, {
             token: account.token!,
             encodingAESKey: account.encodingAESKey!,
             corpid: account.corpid,
             corpsecret: account.corpsecret,
             agentid: String(account.agentid),
             blockStreaming: account.blockStreaming
           });
        }
      });
    }
  },
  onboarding: {
    channel: "wecom",
    getStatus: async (ctx: ChannelOnboardingStatusContext) => {
      const { cfg } = ctx;
      const wecom = cfg.channels?.wecom as WeComConfig | undefined;
      const configured = Object.keys(wecom || {}).length > 0 || 
        (!!process.env.WECOM_CORPID && !!process.env.WECOM_CORPSECRET && !!process.env.WECOM_AGENTID);
      
      return {
        channel: "wecom",
        configured,
        statusLines: configured ? ["Configured"] : ["Not configured"],
      };
    },
    configure: async (ctx: ChannelOnboardingConfigureContext) => {
      const { prompter, cfg } = ctx;
      
      const corpid = await prompter.text({
        message: "WeCom CorpID",
        validate: (v) => v ? undefined : "Required",
      });
      
      const corpsecret = await prompter.text({
        message: "WeCom Secret",
        validate: (v) => v ? undefined : "Required",
      });

      const agentid = await prompter.text({
        message: "WeCom AgentID",
        validate: (v) => v ? undefined : "Required",
      });

      const token = await prompter.text({
        message: "Callback Token (optional)",
      });

      const encodingAESKey = await prompter.text({
        message: "EncodingAESKey (optional)",
      });
      
      const accountId = "default";
      
      const newCfg = {
          ...cfg,
          channels: {
              ...cfg.channels,
              wecom: {
                  ...(cfg.channels?.wecom as any),
                  [accountId]: {
                      corpid,
                      corpsecret,
                      agentid,
                      token: token || undefined,
                      encodingAESKey: encodingAESKey || undefined,
                      enabled: true
                  }
              }
          }
      };
      
      return { cfg: newCfg, accountId };
    },
  },
  pairing: {
    idLabel: "wecomUserId",
    normalizeAllowEntry: (entry) => entry.replace(/^wecom:/i, ""),
  },
  capabilities: {
    chatTypes: ["direct"],
    reactions: false,
    threads: false,
    media: false,
    nativeCommands: true,
    blockStreaming: true,
  },
  reload: { configPrefixes: ["channels.wecom"] },
  configSchema: buildChannelConfigSchema(WeComConfigSchema),
  config: {
    listAccountIds: (cfg: MoltbotConfig) => {
        const wecom = cfg.channels?.wecom as WeComConfig | undefined;
        const ids = Object.keys(wecom || {});
        if (process.env.WECOM_CORPID && process.env.WECOM_CORPSECRET && process.env.WECOM_AGENTID) {
            if (!ids.includes("env")) ids.push("env");
        }
        return ids;
    },
    resolveAccount: (cfg: MoltbotConfig, accountId: string) => {
        if (accountId === "env" && process.env.WECOM_CORPID) {
            return {
                id: "env",
                corpid: process.env.WECOM_CORPID,
                corpsecret: process.env.WECOM_CORPSECRET || "",
                agentid: process.env.WECOM_AGENTID || "",
                token: process.env.WECOM_TOKEN,
                encodingAESKey: process.env.WECOM_AESKEY,
                enabled: true
            };
        }
        const wecom = cfg.channels?.wecom as WeComConfig | undefined;
        const acc = wecom?.[accountId];
        if (!acc) return undefined;
        
        // Fallback to environment variables if not configured
        const token = acc.token || process.env.WECOM_TOKEN;
        const encodingAESKey = acc.encodingAESKey || process.env.WECOM_AESKEY;

        return { ...acc, id: accountId, token, encodingAESKey };
    },
    defaultAccountId: (cfg: MoltbotConfig) => {
        if (process.env.WECOM_CORPID) return "env";
        const wecom = cfg.channels?.wecom as WeComConfig | undefined;
        const keys = Object.keys(wecom || {});
        return keys.length > 0 ? keys[0] : undefined;
    },
    setAccountEnabled: ({ cfg, accountId, enabled }: { cfg: MoltbotConfig, accountId: string, enabled: boolean }) =>
      setAccountEnabledInConfigSection({
        cfg,
        sectionKey: "wecom",
        accountId,
        enabled,
        allowTopLevel: true,
      }),
    deleteAccount: ({ cfg, accountId }: { cfg: MoltbotConfig, accountId: string }) =>
      deleteAccountFromConfigSection({
        cfg,
        sectionKey: "wecom",
        accountId,
      }),
  },
  outbound: {
    deliveryMode: "direct",
    sendText: async (ctx: ChannelOutboundContext): Promise<OutboundDeliveryResult> => {
       const { cfg, accountId, to, text } = ctx;
       let account: ResolvedWeComAccount | undefined;
       const id = accountId || "default";
       
       if (id === "env" && process.env.WECOM_CORPID) {
            account = {
                id: "env",
                corpid: process.env.WECOM_CORPID,
                corpsecret: process.env.WECOM_CORPSECRET || "",
                agentid: process.env.WECOM_AGENTID || "",
                token: process.env.WECOM_TOKEN,
                encodingAESKey: process.env.WECOM_AESKEY,
                enabled: true
            };
       } else {
            const wecom = cfg.channels?.wecom as WeComConfig | undefined;
            const acc = wecom?.[id];
            if (acc) {
                account = { ...acc, id };
            }
       }
       
       if (!account) {
           throw new Error(`WeCom account ${id} not found`);
       }

       const client = getWeComClient(account.corpid, account.corpsecret, String(account.agentid));
       await client.sendText(to, text);
       
       return {
         channel: "wecom",
         messageId: Date.now().toString(),
         meta: { accountId: id }
       };
    }
  }
};
