export class WeComClient {
  private corpid: string;
  private corpsecret: string;
  private agentid: string;
  private accessToken: string = "";
  private tokenExpiresAt: number = 0;
  // Per-user queues to prevent head-of-line blocking across users
  private userQueues = new Map<string, Promise<void>>();

  constructor(corpid: string, corpsecret: string, agentid: string) {
    this.corpid = corpid;
    this.corpsecret = corpsecret;
    this.agentid = agentid;
  }

  updateSecret(corpsecret: string) {
    if (this.corpsecret !== corpsecret) {
      this.corpsecret = corpsecret;
      this.accessToken = ""; // Reset token as secret changed
      this.tokenExpiresAt = 0;
    }
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${this.corpid}&corpsecret=${this.corpsecret}`;
    const resp = await fetch(url);
    const data = await resp.json() as any;

    if (data.errcode !== 0) {
      throw new Error(`Failed to get access token: ${data.errmsg}`);
    }

    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in - 200) * 1000; // buffer
    return this.accessToken;
  }

  async sendText(toUser: string, content: string): Promise<void> {
    // 1. Chunking to avoid 2048 byte limit
    // WeCom limit is 2048 bytes. UTF-8 chars can be 3-4 bytes. 
    // 600 chars * 3 bytes = 1800 bytes, safe margin.
    const CHUNK_SIZE = 600; 
    const chunks: string[] = [];
    if (content.length === 0) {
        chunks.push("");
    } else {
        for (let i = 0; i < content.length; i += CHUNK_SIZE) {
            chunks.push(content.slice(i, i + CHUNK_SIZE));
        }
    }

    // 2. Queueing per user
    const previous = this.userQueues.get(toUser) || Promise.resolve();

    const task = async () => {
      for (const [idx, chunk] of chunks.entries()) {
        if (chunks.length > 1) {
             console.log(`[WeCom] Sending chunk ${idx + 1}/${chunks.length} to ${toUser}`);
        }
        await this.sendChunkWithRetry(toUser, chunk);
      }
    };

    // Chain
    const next = previous.then(task, task);
    this.userQueues.set(toUser, next);

    // Cleanup queue entry when done (optional optimization)
    next.then(() => {
        if (this.userQueues.get(toUser) === next) {
            this.userQueues.delete(toUser);
        }
    }).catch(() => {
        if (this.userQueues.get(toUser) === next) {
            this.userQueues.delete(toUser);
        }
    });

    return next;
  }

  private async sendChunkWithRetry(toUser: string, content: string): Promise<void> {
    const MAX_RETRIES = 3;
    let lastErr: unknown;
    
    for (let i = 0; i <= MAX_RETRIES; i++) {
        try {
            await this.doSendText(toUser, content);
            return;
        } catch (err) {
            lastErr = err;
            console.error(`[WeCom] Send error (attempt ${i + 1}/${MAX_RETRIES + 1}) to ${toUser}:`, err);
            if (i < MAX_RETRIES) {
                const delay = 1000 * Math.pow(2, i); // 1s, 2s, 4s
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    throw lastErr;
  }

  private async doSendText(toUser: string, content: string): Promise<void> {
    const token = await this.getAccessToken();
    const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`;
    
    const payload = {
      touser: toUser,
      msgtype: "text",
      agentid: this.agentid,
      text: {
        content: content
      }
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    const data = await resp.json() as any;
    if (data.errcode !== 0) {
      // 40014 = invalid access token, 42001 = access_token expired
      if (data.errcode === 40014 || data.errcode === 42001) {
         this.accessToken = ""; // Force refresh on next retry
      }
      throw new Error(`WeCom API error ${data.errcode}: ${data.errmsg}`);
    }
  }
}

const clients = new Map<string, WeComClient>();

export function getWeComClient(corpid: string, corpsecret: string, agentid: string): WeComClient {
  const key = `${corpid}:${agentid}`;
  let client = clients.get(key);
  
  if (!client) {
    client = new WeComClient(corpid, corpsecret, agentid);
    clients.set(key, client);
  } else {
    client.updateSecret(corpsecret);
  }
  
  return client;
}
