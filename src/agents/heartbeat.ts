import { getActiveUsers, updateUser } from "../store/user-store";
import { analyzeCycle, commitCycle, runCycle } from "./main-agent";
import { notifyUser, sendApprovalNotification } from "../telegram/bot";
import { scheduleNextHeartbeat } from "../hedera/scheduler";
import { createPendingCycle, getPendingForUser } from "../store/pending-cycles";
import { getPrisma } from "../config/prisma";
import { evaluatePickPerformance } from "../marketplace/pick-tracker";

const INTERVAL_MS = 1 * 60 * 1000; // 1 minute tick — per-user timing checked inside
const DEFAULT_PERIOD_MS = 5 * 60 * 1000; // 5 minutes default

// Naryo heartbeat throttling — emit on-chain proof of cadence every Nth tick
// so Hashscan / the Naryo audit log shows a HeartbeatEmitted event cluster
// without burning gas on every 1-minute tick. 6 ticks = ~6 minutes between
// on-chain heartbeats. Counter persists across ticks via module scope.
const NARYO_HEARTBEAT_EVERY_TICKS = 6;
let heartbeatTickCount = 0;

export interface HeartbeatOptions {
  /**
   * Soft time budget in milliseconds. When set, the heartbeat checks the
   * deadline BEFORE starting each user's cycle work and short-circuits if
   * exceeded. Used by the Vercel cron route to fit within the 60s Hobby
   * function cap. Unset = no budget (local `npm run backend` behavior).
   *
   * A cycle that has already started will NOT be interrupted — the budget
   * only guards the decision to begin the NEXT user's cycle.
   */
  budgetMs?: number;
}

export interface HeartbeatResult {
  totalUsers: number;
  processed: number;
  skippedBudget: number;
  skippedTiming: number;
  durationMs: number;
  budgetExceeded: boolean;
}

export async function runHeartbeat(
  opts: HeartbeatOptions = {},
): Promise<HeartbeatResult> {
  const started = Date.now();
  const deadline = opts.budgetMs != null ? started + opts.budgetMs : Infinity;
  const result: HeartbeatResult = {
    totalUsers: 0,
    processed: 0,
    skippedBudget: 0,
    skippedTiming: 0,
    durationMs: 0,
    budgetExceeded: false,
  };

  const users = await getActiveUsers();
  result.totalUsers = users.length;
  if (users.length === 0) {
    console.log("[heartbeat] No active users — skipping");
    result.durationMs = Date.now() - started;
    return result;
  }

  console.log(
    `[heartbeat] Processing ${users.length} active user(s)${
      opts.budgetMs != null ? ` (budget ${opts.budgetMs}ms)` : ""
    }...`,
  );

  for (const user of users) {
    // Budget guard — skip remaining users if we're out of time. The in-flight
    // cycle (if any) has already completed by this point because we await it
    // sequentially; the deadline only gates the START of new work.
    if (Date.now() >= deadline) {
      result.budgetExceeded = true;
      result.skippedBudget += 1;
      console.warn(`[heartbeat] Budget exceeded — skipping user ${user.id}`);
      continue;
    }

    try {
      // Per-user timing: skip if not enough time has elapsed
      const periodMs = user.agent.cyclePeriodMs ?? DEFAULT_PERIOD_MS;
      const lastAt = user.agent.lastCycleAt ? new Date(user.agent.lastCycleAt).getTime() : 0;
      if (lastAt > 0 && Date.now() - lastAt < periodMs) {
        result.skippedTiming += 1;
        continue; // Not time yet for this user
      }

      // If cycleCount was configured, check remaining
      const remaining = user.agent.cyclesRemaining;
      if (remaining != null && remaining <= 0) {
        continue; // No cycles remaining
      }

      const approvalMode = user.agent.approvalMode ?? "always";

      if (approvalMode === "auto") {
        // Existing behavior — full cycle, no pause
        const cycleResult = await runCycle(user);
        notifyUser(user, cycleResult);
        await decrementCyclesRemaining(user.id);
        result.processed += 1;
        continue;
      }

      // Check for existing pending cycle — skip if one exists
      const existing = await getPendingForUser(user.id);
      if (existing) {
        console.log(`[heartbeat] User ${user.id} has pending cycle ${existing.id}, skipping`);
        continue;
      }

      // Analyze first
      const analysis = await analyzeCycle(user);
      const decision = analysis.compactRecord.d.act;

      // Determine if approval is needed
      const needsApproval = approvalMode === "always"
        || (approvalMode === "trades_only" && decision !== "HOLD");

      if (needsApproval) {
        const timeoutMin = user.agent.approvalTimeoutMin ?? 10;
        const pending = await createPendingCycle(analysis, "heartbeat", timeoutMin);

        // Send Telegram notification with approval buttons
        const msgId = await sendApprovalNotification(user, analysis, pending.id);
        if (msgId) {
          await getPrisma().pendingCycle.update({
            where: { id: pending.id },
            data: { telegramMsgId: msgId },
          }).catch(() => {});
        }

        console.log(`[heartbeat] Pending approval for user ${user.id}: ${pending.id}`);
        result.processed += 1;
      } else {
        // Auto-approve (HOLD in trades_only mode)
        const cycleResult = await commitCycle(analysis, user);
        notifyUser(user, cycleResult);
        await decrementCyclesRemaining(user.id);
        result.processed += 1;
      }
    } catch (err) {
      console.error(`[heartbeat] Cycle failed for user ${user.id}:`, err);
    }
  }

  // Schedule next heartbeat on Hedera (proof of cadence — non-fatal)
  try {
    const { scheduleId } = await scheduleNextHeartbeat(300);
    console.log(`[heartbeat] Scheduled next on Hedera: ${scheduleId}`);
  } catch (err) {
    console.warn("[heartbeat] Scheduler failed (non-fatal):", err instanceof Error ? err.message : String(err));
  }

  // Emit a Naryo HeartbeatEmitted event on Hedera EVM every Nth tick — throttled
  // so we don't burn gas on every 1-minute tick. Gives Naryo an on-chain proof
  // of the cadence loop that the dashboard feed can surface. Non-fatal, fire-
  // and-forget. Gated behind NARYO_AUDIT_CONTRACT_ADDRESS; skips entirely when
  // Naryo isn't configured.
  heartbeatTickCount += 1;
  if (
    process.env.NARYO_AUDIT_CONTRACT_ADDRESS &&
    heartbeatTickCount % NARYO_HEARTBEAT_EVERY_TICKS === 0
  ) {
    void (async () => {
      try {
        const { emitHeartbeatEvent } = await import("../naryo/emit-event");
        await emitHeartbeatEvent(users.length);
        console.log(`[heartbeat] Naryo HeartbeatEmitted event posted (tick ${heartbeatTickCount}, active ${users.length})`);
      } catch (err) {
        console.warn("[heartbeat] Naryo HeartbeatEmitted failed (non-fatal):", err instanceof Error ? err.message : String(err));
      }
    })();
  }

  // Score any specialist picks that have reached their evaluation window.
  // Non-fatal — failures here shouldn't block the main heartbeat loop.
  // See docs/LESSONS_AND_UI_DATA_FLOW.md §1.11 for the outcome-linked
  // reputation loop this closes.
  evaluatePickPerformance({ windowHours: 1, batchSize: 50 }).catch((err) => {
    console.warn("[heartbeat] pick evaluator tick failed (non-fatal):", err instanceof Error ? err.message : String(err));
  });

  result.durationMs = Date.now() - started;
  console.log(
    `[heartbeat] Done in ${result.durationMs}ms (processed=${result.processed}, skippedBudget=${result.skippedBudget}, skippedTiming=${result.skippedTiming})`,
  );
  return result;
}

async function decrementCyclesRemaining(userId: string): Promise<void> {
  try {
    // Re-read fresh value to avoid stale snapshot race
    const { getUserById } = await import("../store/user-store");
    const fresh = await getUserById(userId);
    if (!fresh || fresh.agent.cyclesRemaining == null) return;
    const newRemaining = Math.max(0, fresh.agent.cyclesRemaining - 1);
    await updateUser(userId, { agent: { cyclesRemaining: newRemaining } });
    if (newRemaining === 0) {
      console.log(`[heartbeat] User ${userId} completed all configured cycles`);
    }
  } catch (err) {
    console.warn(`[heartbeat] Failed to decrement cycles for ${userId}:`, err);
  }
}

export function startHeartbeatLoop(): void {
  console.log(`[heartbeat] Starting loop (interval: ${INTERVAL_MS / 1000}s)`);

  // Immediate first run
  runHeartbeat().catch((err) => {
    console.error("[heartbeat] Initial run failed:", err);
  });

  // Recurring
  setInterval(() => {
    runHeartbeat().catch((err) => {
      console.error("[heartbeat] Scheduled run failed:", err);
    });
  }, INTERVAL_MS);
}
