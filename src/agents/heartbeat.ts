import { getActiveUsers, updateUser } from "../store/user-store";
import { analyzeCycle, commitCycle, runCycle } from "./main-agent";
import { notifyUser, sendApprovalNotification } from "../telegram/bot";
import { scheduleNextHeartbeat } from "../hedera/scheduler";
import { createPendingCycle, getPendingForUser } from "../store/pending-cycles";
import { getPrisma } from "../config/prisma";

const INTERVAL_MS = 1 * 60 * 1000; // 1 minute tick — per-user timing checked inside
const DEFAULT_PERIOD_MS = 5 * 60 * 1000; // 5 minutes default

export async function runHeartbeat(): Promise<void> {
  const users = await getActiveUsers();
  if (users.length === 0) {
    console.log("[heartbeat] No active users — skipping");
    return;
  }

  console.log(`[heartbeat] Processing ${users.length} active user(s)...`);

  for (const user of users) {
    try {
      // Per-user timing: skip if not enough time has elapsed
      const periodMs = user.agent.cyclePeriodMs ?? DEFAULT_PERIOD_MS;
      const lastAt = user.agent.lastCycleAt ? new Date(user.agent.lastCycleAt).getTime() : 0;
      if (lastAt > 0 && Date.now() - lastAt < periodMs) {
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
        const result = await runCycle(user);
        notifyUser(user, result);
        await decrementCyclesRemaining(user.id);
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
      } else {
        // Auto-approve (HOLD in trades_only mode)
        const result = await commitCycle(analysis, user);
        notifyUser(user, result);
        await decrementCyclesRemaining(user.id);
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

  console.log("[heartbeat] Done.");
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
