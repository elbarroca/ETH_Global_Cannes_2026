import crypto from "node:crypto";

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

interface LinkEntry {
  userId: string;
  expiresAt: number;
}

const codes = new Map<string, LinkEntry>();

function generateCode(): string {
  const bytes = crypto.randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CHARS[bytes[i] % CHARS.length];
  }
  return code;
}

export function generateLinkCode(userId: string): string {
  // Clean expired codes
  const now = Date.now();
  for (const [k, v] of codes) {
    if (v.expiresAt < now) codes.delete(k);
  }

  const code = generateCode();
  codes.set(code, { userId, expiresAt: now + TTL_MS });
  return code;
}

export function redeemLinkCode(code: string): string | null {
  const entry = codes.get(code.toUpperCase());
  if (!entry) return null;
  codes.delete(code.toUpperCase());
  if (entry.expiresAt < Date.now()) return null;
  return entry.userId;
}
