import { getActiveUsers } from "../store/user-store";
import { analyzeCycle, commitCycle, runCycle } from "./main-agent";
import { notifyUser, sendApprovalNotification } from "../telegram/bot";
import { scheduleNextHeartbeat } from "../hedera/scheduler";
import { createPendingCycle, getPendingForUser } from "../store/pending-cycles";
import { getPrisma } from "../config/prisma";

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export async function runHeartbeat(): Promise<void> {
  const users = await getActiveUsers();
  if (users.length === 0) {
    console.log("[heartbeat] No active users — skipping");
    return;
  }

  console.log(`[heartbeat] Processing ${users.length} active user(s)...`);

  for (const user of users) {
    try {
      const approvalMode = user.agent.approvalMode ?? "auto";

      if (approvalMode === "auto") {
        // Existing behavior — full cycle, no pause
        const result = await runCycle(user);
        notifyUser(user, result);
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
