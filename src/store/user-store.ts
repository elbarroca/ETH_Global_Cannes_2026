import crypto from "node:crypto";
import { getDb } from "../config/database.js";
import { deriveUserAddress } from "../config/wallets.js";
import type { UserRecord } from "../types/index.js";

// ── Row ↔ UserRecord mapping ───────────────────────────────────────

interface UserRow {
  id: string;
  wallet_address: string;
  proxy_wallet: { walletId: string; address: string };
  telegram: UserRecord["telegram"];
  agent: UserRecord["agent"];
  fund: UserRecord["fund"];
  hot_wallet_index: number | null;
  hot_wallet_address: string | null;
  inft_token_id: number | null;
  created_at: string;
  updated_at: string;
}

function rowToUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    walletAddress: row.wallet_address,
    proxyWallet: row.proxy_wallet,
    telegram: row.telegram,
    agent: row.agent,
    fund: row.fund,
    hotWalletIndex: row.hot_wallet_index,
    hotWalletAddress: row.hot_wallet_address,
    inftTokenId: row.inft_token_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

// ── Exports (same signatures as before) ─────────────────────────────

export function loadStore(): void {
  // No-op — database connection is lazy via getDb()
}

export async function createUser(
  walletAddress: string,
  proxyWallet: { walletId: string; address: string },
  userId?: string,
): Promise<UserRecord> {
  const sql = getDb();
  const id = userId ?? crypto.randomUUID();
  const now = new Date().toISOString();

  const telegram = {
    chatId: null,
    username: null,
    verified: false,
    notifyPreference: "every_cycle" as const,
  };

  const agent = {
    active: false,
    riskProfile: "balanced" as const,
    maxTradePercent: 10,
    lastCycleId: 0,
    lastCycleAt: null,
  };

  const fund = {
    depositedUsdc: 0,
    htsShareBalance: 0,
    currentNav: 0,
  };

  // Derive HD hot wallet for x402 signing — auto-increment index from sequence
  const [{ nextval: hotWalletIndex }] = await sql`SELECT nextval('hot_wallet_index_seq')`;
  const hwIndex = Number(hotWalletIndex);
  let hotWalletAddress: string | null = null;
  try {
    hotWalletAddress = deriveUserAddress(hwIndex);
  } catch {
    // AGENT_MNEMONIC not set — hot wallet will be null (x402 payments disabled)
  }

  const rows = await sql`
    INSERT INTO users (id, wallet_address, proxy_wallet, telegram, agent, fund, hot_wallet_index, hot_wallet_address, created_at, updated_at)
    VALUES (${id}, ${walletAddress.toLowerCase()}, ${sql.json(proxyWallet)}, ${sql.json(telegram)}, ${sql.json(agent)}, ${sql.json(fund)}, ${hwIndex}, ${hotWalletAddress}, ${now}, ${now})
    RETURNING *
  `;

  return rowToUser(rows[0] as unknown as UserRow);
}

export async function getUserById(id: string): Promise<UserRecord | undefined> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM users WHERE id = ${id}`;
  if (rows.length === 0) return undefined;
  return rowToUser(rows[0] as unknown as UserRow);
}

export async function getUserByWallet(walletAddress: string): Promise<UserRecord | undefined> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM users WHERE wallet_address = ${walletAddress.toLowerCase()}`;
  if (rows.length === 0) return undefined;
  return rowToUser(rows[0] as unknown as UserRow);
}

export async function getUserByChatId(chatId: string): Promise<UserRecord | undefined> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM users WHERE telegram->>'chatId' = ${chatId}`;
  if (rows.length === 0) return undefined;
  return rowToUser(rows[0] as unknown as UserRow);
}

export async function getActiveUsers(): Promise<UserRecord[]> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM users WHERE (agent->>'active')::boolean = true AND (fund->>'depositedUsdc')::numeric > 0`;
  return (rows as unknown as UserRow[]).map(rowToUser);
}

interface UserPatch {
  telegram?: Partial<UserRecord["telegram"]>;
  agent?: Partial<UserRecord["agent"]>;
  fund?: Partial<UserRecord["fund"]>;
  inftTokenId?: number | null;
}

export async function updateUser(id: string, patch: UserPatch): Promise<UserRecord> {
  const sql = getDb();

  // Atomic JSONB merge in SQL — no read-then-write race condition
  const telegramPatch = patch.telegram ? sql.json(patch.telegram) : null;
  const agentPatch = patch.agent ? sql.json(patch.agent) : null;
  const fundPatch = patch.fund ? sql.json(patch.fund) : null;
  const hasInftUpdate = patch.inftTokenId !== undefined;

  const rows = await sql`
    UPDATE users
    SET telegram = CASE WHEN ${telegramPatch}::jsonb IS NOT NULL
                        THEN telegram || ${telegramPatch}::jsonb
                        ELSE telegram END,
        agent = CASE WHEN ${agentPatch}::jsonb IS NOT NULL
                     THEN agent || ${agentPatch}::jsonb
                     ELSE agent END,
        fund = CASE WHEN ${fundPatch}::jsonb IS NOT NULL
                    THEN fund || ${fundPatch}::jsonb
                    ELSE fund END,
        inft_token_id = CASE WHEN ${hasInftUpdate}
                             THEN ${patch.inftTokenId ?? null}
                             ELSE inft_token_id END,
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  if (rows.length === 0) throw new Error(`User ${id} not found`);
  return rowToUser(rows[0] as unknown as UserRow);
}

export async function getAllUsers(): Promise<UserRecord[]> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM users`;
  return (rows as unknown as UserRow[]).map(rowToUser);
}
