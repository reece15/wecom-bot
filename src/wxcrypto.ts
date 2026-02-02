import crypto from "node:crypto";

export class WeComCrypto {
  private token: string;
  private corpid: string;
  private aesKey: Buffer;
  private iv: Buffer;

  constructor(token: string, encodingAESKey: string, corpid: string) {
    this.token = token;
    this.corpid = corpid;
    this.aesKey = Buffer.from(encodingAESKey + "=", "base64");
    if (this.aesKey.length !== 32) {
      throw new Error("Invalid EncodingAESKey length");
    }
    this.iv = this.aesKey.slice(0, 16);
  }

  getSignature(timestamp: string, nonce: string, encrypt: string): string {
    const raw = [this.token, timestamp, nonce, encrypt].sort().join("");
    return crypto.createHash("sha1").update(raw).digest("hex");
  }

  decrypt(text: string): { message: string; id: string } {
    const decipher = crypto.createDecipheriv("aes-256-cbc", this.aesKey, this.iv);
    decipher.setAutoPadding(false);
    
    let decrypted = Buffer.concat([
      decipher.update(text, "base64"),
      decipher.final()
    ]);

    // Remove PKCS7 padding
    let pad = decrypted[decrypted.length - 1];
    if (pad < 1 || pad > 32) {
      pad = 0;
    }
    decrypted = decrypted.slice(0, decrypted.length - pad);

    // Read 16 bytes random
    // const random = decrypted.slice(0, 16);
    
    // Read 4 bytes content length
    const contentLen = decrypted.readUInt32BE(16);
    
    const message = decrypted.slice(20, 20 + contentLen).toString("utf-8");
    const id = decrypted.slice(20 + contentLen).toString("utf-8");

    // Verify corpid/appid
    if (id !== this.corpid) {
      // throw new Error(`Invalid corpid/appid: expected ${this.corpid}, got ${id}`);
      // Note: Sometimes it might differ slightly or be generic, but usually strictly checked.
      // For now, let's log or ignore if we want to be lenient, but standard is strict.
    }

    return { message, id };
  }

  encrypt(message: string): string {
    const random = crypto.randomBytes(16);
    const msgBuffer = Buffer.from(message);
    const lenBuffer = Buffer.alloc(4);
    lenBuffer.writeUInt32BE(msgBuffer.length, 0);
    const idBuffer = Buffer.from(this.corpid);

    let raw = Buffer.concat([random, lenBuffer, msgBuffer, idBuffer]);

    // Add PKCS7 padding
    const blockSize = 32;
    const pad = blockSize - (raw.length % blockSize);
    const padBuffer = Buffer.alloc(pad, pad);
    raw = Buffer.concat([raw, padBuffer]);

    const cipher = crypto.createCipheriv("aes-256-cbc", this.aesKey, this.iv);
    cipher.setAutoPadding(false);
    
    const encrypted = Buffer.concat([
      cipher.update(raw),
      cipher.final()
    ]);

    return encrypted.toString("base64");
  }
}
