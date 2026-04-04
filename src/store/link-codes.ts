import crypto from "node:crypto";
import { getDb } from "../config/database";

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

function generateCode(): string {
  const bytes = crypto.randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CHARS[bytes[i] % CHARS.length];
  }
  return code;
}

/**
 * Generate a link code for a user and persist it in Supabase.
 * Both Next.js and Express processes can read from the same DB.
 */
export async function generateLinkCode(userId: string): Promise<string> {
  const sql = getDb();
  const code = generateCode();
  const expiresAt = Date.now() + TTL_MS;

  await sql`
    UPDATE users
    SET telegram = telegram || ${sql.json({ linkCode: code, linkCodeExpiresAt: expiresAt })}::jsonb,
        updated_at = NOW()
    WHERE id = ${userId}
  `;

  return code;
}

/**
 * Redeem a link code — returns userId if valid, null if expired/missing.
 * Atomically clears the code to prevent double-use.
 */
export async function redeemLinkCode(code: string): Promise<string | null> {
  const sql = getDb();
  const upperCode = code.toUpperCase();
  const now = Date.now();

  // Atomically find + clear the code
  const rows = await sql`
    UPDATE users
    SET telegram = telegram - 'linkCode' - 'linkCodeExpiresAt',
        updated_at = NOW()
    WHERE telegram->>'linkCode' = ${upperCode}
      AND (telegram->>'linkCodeExpiresAt')::bigint > ${now}
    RETURNING id
  `;

  if (rows.length === 0) return null;
  return (rows[0] as { id: string }).id;
}
