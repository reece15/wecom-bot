import { z } from "zod";

export const WeComAccountConfigSchema = z.object({
  corpid: z.string().describe("WeCom CorpID"),
  corpsecret: z.string().describe("WeCom App Secret"),
  agentid: z.union([z.string(), z.number()]).transform((v) => String(v)).describe("WeCom AgentID"),
  token: z.string().optional().describe("Callback Token (for receiving messages)"),
  encodingAESKey: z.string().optional().describe("Callback EncodingAESKey"),
  blockStreaming: z.boolean().default(false).describe("Enable block streaming (send partial messages). Default false (wait for full reply)."),
  enabled: z.boolean().default(true).describe("Enable this account"),
});

export const WeComConfigSchema = z.record(z.string(), WeComAccountConfigSchema);

export type WeComAccountConfig = z.infer<typeof WeComAccountConfigSchema>;

export type WeComConfig = Record<string, WeComAccountConfig>;

export type ResolvedWeComAccount = WeComAccountConfig & {
  id: string;
};
