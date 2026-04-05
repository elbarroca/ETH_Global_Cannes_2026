import crypto from "node:crypto";
import { getDb } from "../config/database";
import { deriveUserAddress } from "../config/wallets";
import type { UserRecord } from "../types/index";

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
    agent: Object.assign(
      { approvalMode: "always" as const, approvalTimeoutMin: 10 },
      row.agent,
    ),
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
    approvalMode: "always" as const,
    approvalTimeoutMin: 10,
    // Auto-hunt is opt-in only. A fresh wallet has zero scheduled cycles; the
    // heartbeat loop filters on `cyclesRemaining > 0`, so these defaults mean
    // "do nothing until the user saves a cycle count on the dashboard".
    cycleCount: 0,
    cyclesRemaining: 0,
    // Persistent personalized hunt goal. Empty string = not yet set; the
    // cycle-analyze fallback chain will use the risk-profile template.
    goal: "",
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

/**
 * Decrement a user's `cyclesRemaining` by 1 after a cycle is committed.
 *
 * Called from THREE places:
 *   1. Heartbeat loop after `runCycle()` in auto-approval mode.
 *   2. Heartbeat loop after `commitCycle()` in the HOLD auto-approve path
 *      (approvalMode === "trades_only" with a HOLD decision).
 *   3. Approval routes (Next.js `/api/cycle/approve/[pendingId]` and the
 *      Telegram approve callback) after the user explicitly approves a
 *      pending cycle and `commitCycle()` succeeds.
 *
 * The invariant is: **the budget decrements once per committed cycle, never
 * per attempted cycle.** Rejected cycles do NOT decrement — the user's intent
 * ("give me N committed hunts") is preserved regardless of how many failures
 * or rejections occur along the way.
 *
 * Re-reads the user row to avoid stale-snapshot races when the caller passes
 * a user record fetched seconds earlier. Non-fatal — logs and continues on
 * error so a DB blip never blocks a successfully-committed cycle.
 *
 * Lives in user-store (not heartbeat) to avoid a circular dependency: the
 * Telegram bot approve callback needs to call this, and heartbeat.ts already
 * imports from bot.ts, so bot.ts can't import from heartbeat.ts.
 */
export async function decrementCyclesRemaining(userId: string): Promise<void> {
  try {
    const fresh = await getUserById(userId);
    if (!fresh || fresh.agent.cyclesRemaining == null) return;
    // Infinite mode (cycleCount === -1) — never decrement. The user opted
    // into "run forever every N minutes" and expects the heartbeat to keep
    // ticking until they explicitly stop.
    if (fresh.agent.cycleCount === -1) return;
    const newRemaining = Math.max(0, fresh.agent.cyclesRemaining - 1);
    await updateUser(userId, { agent: { cyclesRemaining: newRemaining } });
    if (newRemaining === 0) {
      console.log(`[cycle] User ${userId} completed all configured auto-hunt cycles — heartbeat will pause`);
    }
  } catch (err) {
    console.warn(`[cycle] Failed to decrement cyclesRemaining for ${userId}:`, err);
  }
}

export async function getActiveUsers(): Promise<UserRecord[]> {
  const sql = getDb();
  // Heartbeat eligibility requires THREE conditions, all consent-gated:
  //   1. agent.active = true (user toggled on)
  //   2. depositedUsdc > 0 (fund has balance)
  //   3. Either INFINITE mode (cycleCount = -1 → run forever) OR BOUNDED
  //      mode with budget remaining (cyclesRemaining > 0). Both modes are
  //      set via the dashboard "AUTO-HUNT" card.
  //
  // Edge cases handled by the COALESCE/NULLIF casts:
  //   - key missing         → `->>` returns NULL → COALESCE → 0
  //   - JSON null           → `->>` returns the string 'null' → NULLIF → NULL
  //     → COALESCE → 0 (without NULLIF the `::int` cast would throw and
  //     crash the entire heartbeat tick — see reviewer concern #6)
  //   - integer             → cast succeeds, compared as-is
  //   - float or non-number → cast throws; caller's try/catch swallows. We
  //     write only integers via decrementCyclesRemaining + configure, so
  //     this case is defensive rather than expected.
  const rows = await sql`
    SELECT * FROM users
    WHERE (agent->>'active')::boolean = true
      AND (fund->>'depositedUsdc')::numeric > 0
      AND (
        COALESCE(NULLIF(agent->>'cycleCount', 'null')::int, 0) = -1
        OR COALESCE(NULLIF(agent->>'cyclesRemaining', 'null')::int, 0) > 0
      )
  `;
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
