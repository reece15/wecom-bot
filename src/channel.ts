import {
  buildChannelConfigSchema,
  registerPluginHttpRoute,
  type ChannelPlugin,
  type OpenClawConfig,
  type ChannelGatewayContext,
  deleteAccountFromConfigSection,
  setAccountEnabledInConfigSection,
} from "openclaw/plugin-sdk";
import { WeComConfigSchema, type ResolvedWeComAccount, type WeComConfig } from "./types.js";
import { handleWeComWebhook } from "./webhook.js";
import { wecomOutbound } from "./outbound.js";
import type { IncomingMessage, ServerResponse } from "node:http";

export const wecomPlugin: ChannelPlugin<ResolvedWeComAccount> = {
  id: "wecom-app",
  outbound: wecomOutbound,
  meta: {
    id: "wecom-app",
    label: "WeCom",
    selectionLabel: "WeCom (Enterprise WeChat)",
    detailLabel: "WeCom Bot",
    docsPath: "/channels/wecom-app",
    docsLabel: "wecom-app",
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
      
      const path = "/wecom-app/webhook";
      console.log(`[WeCom] Registering webhook at ${path}`);

      registerPluginHttpRoute({
        path,
        pluginId: "wecom-app",
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
    channel: "wecom-app",
    getStatus: async (ctx: any) => {
      const { cfg } = ctx;
      const wecom = cfg.channels?.["wecom-app"] as WeComConfig | undefined;
      const configured = Object.keys(wecom || {}).length > 0 || 
        (!!process.env.WECOM_CORPID && !!process.env.WECOM_CORPSECRET && !!process.env.WECOM_AGENTID);
      
      return {
        channel: "wecom-app",
        configured,
        statusLines: configured ? ["Configured"] : ["Not configured"],
      };
    },
    configure: async (ctx: any) => {
      const { prompter, cfg } = ctx;
      
      const corpid = await prompter.text({
        message: "WeCom CorpID",
        validate: (v: any) => v ? undefined : "Required",
      });
      
      const corpsecret = await prompter.text({
        message: "WeCom Secret",
        validate: (v: any) => v ? undefined : "Required",
      });

      const agentid = await prompter.text({
        message: "WeCom AgentID",
        validate: (v: any) => v ? undefined : "Required",
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
              "wecom-app": {
                  ...(cfg.channels?.["wecom-app"] as any),
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
  reload: { configPrefixes: ["channels.wecom-app"] },
  configSchema: buildChannelConfigSchema(WeComConfigSchema),
  config: {
    listAccountIds: (cfg: OpenClawConfig) => {
        const wecom = cfg.channels?.["wecom-app"] as WeComConfig | undefined;
        const ids = Object.keys(wecom || {});
        if (process.env.WECOM_CORPID && process.env.WECOM_CORPSECRET && process.env.WECOM_AGENTID) {
            if (!ids.includes("env")) ids.push("env");
        }
        return ids;
    },
    resolveAccount: (cfg: OpenClawConfig, accountId?: string | null) => {
        const id = accountId || "default";
        
        if (id === "env" && process.env.WECOM_CORPID) {
            return {
                id: "env",
                corpid: process.env.WECOM_CORPID!,
                corpsecret: process.env.WECOM_CORPSECRET || "",
                agentid: process.env.WECOM_AGENTID || "",
                token: process.env.WECOM_TOKEN,
                encodingAESKey: process.env.WECOM_AESKEY,
                enabled: true,
                blockStreaming: false
            };
        }
        const wecom = cfg.channels?.["wecom-app"] as WeComConfig | undefined;
        const acc = wecom?.[id];
        if (!acc) {
             throw new Error(`WeCom account not found: ${id}`);
        }
        
        // Fallback to environment variables if not configured
        const token = acc.token || process.env.WECOM_TOKEN;
        const encodingAESKey = acc.encodingAESKey || process.env.WECOM_AESKEY;

        return { ...acc, id: id, token, encodingAESKey };
    },
    defaultAccountId: (cfg: OpenClawConfig) => {
        if (process.env.WECOM_CORPID) return "env";
        const wecom = cfg.channels?.["wecom-app"] as WeComConfig | undefined;
        const keys = Object.keys(wecom || {});
        return keys.length > 0 ? keys[0] : "";
    },
    setAccountEnabled: ({ cfg, accountId, enabled }: { cfg: OpenClawConfig, accountId: string, enabled: boolean }) =>
      setAccountEnabledInConfigSection({
        cfg,
        sectionKey: "wecom-app",
        accountId,
        enabled,
        allowTopLevel: true,
      }),
    deleteAccount: ({ cfg, accountId }: { cfg: OpenClawConfig, accountId: string }) =>
      deleteAccountFromConfigSection({
        cfg,
        sectionKey: "wecom-app",
        accountId,
      }),
  },
};
