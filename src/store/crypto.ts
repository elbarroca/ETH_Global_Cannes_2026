import crypto from "node:crypto";

const ALGO = "aes-256-cbc";

function getKey(): Buffer {
  const hex = process.env.SERVER_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("SERVER_ENCRYPTION_KEY must be a 32-byte hex string (64 chars)");
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(packed: string): string {
  const key = getKey();
  const [ivHex, encHex] = packed.split(":");
  if (!ivHex || !encHex) {
    throw new Error("Invalid encrypted format — expected 'iv_hex:ciphertext_hex'");
  }
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()]).toString("utf8");
}
