import type { IncomingMessage, ServerResponse } from "node:http";
import { WeComCrypto } from "./wxcrypto.js";
import { getWeComClient } from "./client.js";
import type { ReplyPayload } from "openclaw/plugin-sdk";
import { getWeComRuntime } from "./runtime.js";
import { KeyedTaskQueue } from "./queue.js";

// Queue for sequential processing of messages per user
const dispatchQueue = new KeyedTaskQueue();

// Cache for deduplicating messages (MsgId -> timestamp)
const processedMsgIds = new Map<string, number>();
const MSG_ID_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cleanupMsgIdCache() {
  const now = Date.now();
  for (const [id, timestamp] of processedMsgIds.entries()) {
    if (now - timestamp > MSG_ID_TTL_MS) {
      processedMsgIds.delete(id);
    }
  }
}

// Cleanup every hour
setInterval(cleanupMsgIdCache, 60 * 60 * 1000);

function getQuery(req: IncomingMessage): URLSearchParams {
  const url = req.url || "";
  const q = url.split("?")[1] || "";
  return new URLSearchParams(q);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function extractXmlField(xml: string, field: string): string | undefined {
  const regex = new RegExp(`<${field}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${field}>|<${field}>([\\s\\S]*?)<\\/${field}>`);
  const match = xml.match(regex);
  return match ? (match[1] || match[2]) : undefined;
}

export async function handleWeComWebhook(
  req: IncomingMessage,
  res: ServerResponse,
  params: {
    token: string;
    encodingAESKey: string;
    corpid: string;
    corpsecret: string;
    agentid: string;
    blockStreaming?: boolean;
  }
) {
  const query = getQuery(req);
  const msgSignature = query.get("msg_signature");
  const timestamp = query.get("timestamp");
  const nonce = query.get("nonce");
  const echostr = query.get("echostr");

  if (!msgSignature || !timestamp || !nonce) {
    res.statusCode = 400;
    res.end("Missing signature parameters");
    return;
  }

  const crypto = new WeComCrypto(params.token, params.encodingAESKey, params.corpid);

  console.log(`[WeCom] Received request: ${req.method} ${req.url}`);
  console.log(`[WeCom] Params: msg_signature=${msgSignature}, timestamp=${timestamp}, nonce=${nonce}, echostr=${echostr}`);

  // Verification request (GET)
  if (req.method === "GET" && echostr) {
    const signature = crypto.getSignature(timestamp, nonce, echostr);
    console.log(`[WeCom] Calculated signature: ${signature}`);
    
    if (signature !== msgSignature) {
      console.error(`[WeCom] Signature mismatch! Expected: ${msgSignature}, Calculated: ${signature}`);
      res.statusCode = 403;
      res.end("Invalid signature");
      return;
    }

    try {
      const { message } = crypto.decrypt(echostr);
      console.log(`[WeCom] Decrypted echostr: ${message}`);
      res.statusCode = 200;
      res.end(message);
    } catch (err) {
      console.error(`[WeCom] Decryption failed: ${String(err)}`);
      res.statusCode = 403;
      res.end("Decryption failed");
    }
    return;
  }

  // Message request (POST)
  if (req.method === "POST") {
    const body = await readBody(req);
    console.log(`[WeCom] POST body length: ${body.length}`);
    
    const encrypt = extractXmlField(body, "Encrypt");

    if (!encrypt) {
      console.error("[WeCom] Missing Encrypt field in XML");
      res.statusCode = 400;
      res.end("Missing Encrypt field");
      return;
    }

    const signature = crypto.getSignature(timestamp, nonce, encrypt);
    console.log(`[WeCom] POST Calculated signature: ${signature}`);

    if (signature !== msgSignature) {
      console.error(`[WeCom] Signature mismatch! Expected: ${msgSignature}, Calculated: ${signature}`);
      res.statusCode = 403;
      res.end("Invalid signature");
      return;
    }

    try {
      const { message: decryptedXml } = crypto.decrypt(encrypt);
      console.log(`[WeCom] Decrypted message: ${decryptedXml}`);
      
      const content = extractXmlField(decryptedXml, "Content");
      const fromUser = extractXmlField(decryptedXml, "FromUserName");
      const msgType = extractXmlField(decryptedXml, "MsgType");
      const msgId = extractXmlField(decryptedXml, "MsgId");

      if (msgType !== "text" || !content || !fromUser) {
          console.log("[WeCom] Ignored non-text message or missing fields");
          res.statusCode = 200;
          res.end("success");
          return;
      }

      // Deduplication check
      if (msgId && processedMsgIds.has(msgId)) {
        console.log(`[WeCom] Duplicate message ignored (MsgId: ${msgId})`);
        res.statusCode = 200;
        res.end("success");
        return;
      }

      if (msgId) {
        processedMsgIds.set(msgId, Date.now());
      }

      // Send response immediately to prevent WeCom retries
      res.statusCode = 200;
      res.end("success");

      // Initialize Client
      const client = getWeComClient(params.corpid, params.corpsecret, params.agentid);

      // Dispatch to Moltbot
      const runtime = getWeComRuntime();
      const config = runtime.config.loadConfig();
      
      const agentId = "default"; // Default agent

      const ctxPayload = {
          From: fromUser,
          Body: content,
          channel: "wecom",
          channelData: {
              wecom: {
                  corpid: params.corpid,
                  agentid: params.agentid,
                  msgId
              }
          }
      };

      // Process in background (sequentially per user)
      dispatchQueue.enqueue(fromUser, async () => {
        let sentText = "";
        let buffer = "";
        let debounceTimer: NodeJS.Timeout | null = null;
        
        const flushBuffer = async () => {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
                debounceTimer = null;
            }
            if (!buffer) return;
            
            let textToSend = buffer;
            const originalBuffer = buffer;
            buffer = "";
            
            // If this is the first packet, trim start to avoid leading newlines
            if (sentText.length === 0) {
                textToSend = textToSend.trimStart();
            }

            // We must update sentText with the ORIGINAL buffer content 
            // because sentText tracks the raw LLM stream for offsetting later.
            sentText += originalBuffer;
            
            if (!textToSend) {
                 // Buffer was only whitespace, skipping send
                return;
            }
            
            console.log(`[WeCom] Flushing buffer for ${fromUser}, len=${textToSend.length}`);
            try {
                await client.sendText(fromUser, textToSend);
            } catch (err) {
                console.error(`[WeCom] CRITICAL: Failed to send buffer to ${fromUser} after retries. Error: ${String(err)}`);
            }
        };

        try {
            await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
                ctx: ctxPayload,
                cfg: config,
                dispatcherOptions: {
                    responsePrefix: runtime.channel.reply.resolveEffectiveMessagesConfig(config, agentId).responsePrefix,
                    deliver: async (payload: ReplyPayload, info: any) => {
                        const kind = info.kind as "tool" | "block" | "final";
                        const text = payload.text || "";
                        if (!text) return;

                        console.log(`[WeCom] deliver() called for ${fromUser}, kind=${kind}, text len=${text.length}`);

                        if (kind === "block") {
                            buffer += text;
                            
                            // Flush if buffer is large enough
                            if (buffer.length > 1000) {
                                await flushBuffer();
                            } else {
                                // Debounce flush for short messages
                                if (debounceTimer) clearTimeout(debounceTimer);
                                debounceTimer = setTimeout(() => {
                                    debounceTimer = null;
                                    void flushBuffer();
                                }, 1000); // 1 second debounce
                            }
                        } else if (kind === "final") {
                            // Flush any pending block buffer immediately
                            await flushBuffer();
                            
                            // Calculate remaining text to send
                            let remaining = text;
                            if (text.startsWith(sentText)) {
                                remaining = text.slice(sentText.length);
                            } else {
                                // Fallback for safety
                                if (sentText.length > 0) {
                                    console.warn(`[WeCom] Final text mismatch. Sent: ${sentText.length}, Final: ${text.length}`);
                                }
                            }

                            // If nothing has been tracked in sentText yet, this is the first content.
                            // Trim leading whitespace.
                            if (sentText.length === 0) {
                                remaining = remaining.trimStart();
                            }

                            if (remaining.trim()) {
                                console.log(`[WeCom] Sending final remaining text for ${fromUser}, len=${remaining.length}`);
                                try {
                                    await client.sendText(fromUser, remaining);
                                    sentText += remaining;
                                } catch (err) {
                                    console.error(`[WeCom] CRITICAL: Failed to send final reply to ${fromUser}: ${String(err)}`);
                                }
                            }
                        } else {
                             // Tool output or other kinds - flush immediately
                             await flushBuffer(); 
                             try {
                                await client.sendText(fromUser, text);
                             } catch (err) {
                                console.error(`[WeCom] CRITICAL: Failed to send other reply to ${fromUser}: ${String(err)}`);
                             }
                        }
                    },
                    onError: (err: any) => {
                        console.error(`[WeCom] Dispatch error: ${err}`);
                    }
                },
                replyOptions: {
                    // Always enable streaming to capture blocks for buffering
                    disableBlockStreaming: false
                }
            });
        } finally {
            // Ensure any pending buffer is flushed at the end
            if (buffer) {
                await flushBuffer();
            }
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
        }
      });

    } catch (err) {
      console.error("[WeCom] Message processing error:", err);
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.end("Internal error");
      }
    }
    return;
  }

  res.statusCode = 405;
  res.end("Method not allowed");
}
