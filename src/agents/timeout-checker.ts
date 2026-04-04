import { getUserById } from "../store/user-store";
import { getExpiredPending, resolvePendingCycle } from "../store/pending-cycles";
import { commitCycle, rejectCycle } from "./main-agent";
import { notifyUser, editTelegramMessage } from "../telegram/bot";
import { formatTimedOutResult } from "../telegram/formatter";
import type { AnalysisResult } from "../types/index";

function getTimeoutAction(riskProfile: string): "approve" | "reject" {
  // Conservative users: auto-reject on timeout (safety first)
  // Balanced/Aggressive: auto-approve on timeout (don't miss opportunities)
  return riskProfile === "conservative" ? "reject" : "approve";
}

export async function checkExpiredPendingCycles(): Promise<void> {
  const expired = await getExpiredPending();
  if (expired.length === 0) return;

  console.log(`[timeout] Found ${expired.length} expired pending cycle(s)`);

  for (const pending of expired) {
    try {
      const user = await getUserById(pending.userId);
      if (!user) {
        console.warn(`[timeout] User ${pending.userId} not found, skipping`);
        continue;
      }

      const analysis: AnalysisResult = {
        userId: pending.userId,
        cycleId: pending.cycleNumber,
        specialists: pending.specialists,
        debate: pending.debate,
        compactRecord: pending.compactRecord,
      };

      const autoAction = getTimeoutAction(user.agent.riskProfile);

      if (autoAction === "approve") {
        // Atomically resolve FIRST to prevent double-commit
        const resolved = await resolvePendingCycle(pending.id, {
          status: "TIMED_OUT",
          resolvedBy: "timeout",
        });
        if (!resolved) {
          console.log(`[timeout] Pending ${pending.id} already resolved, skipping`);
          continue;
        }

        try {
          const result = await commitCycle(analysis, user);

          if (user.telegram.chatId && pending.telegramMsgId) {
            await editTelegramMessage(
              user.telegram.chatId,
              pending.telegramMsgId,
              formatTimedOutResult(analysis, "approved"),
            );
          }

          notifyUser(user, result);
          console.log(`[timeout] Auto-approved cycle ${pending.cycleNumber} for user ${user.id}`);
        } catch (commitErr) {
          // commitCycle failed AFTER resolve — advance lastCycleId to prevent reuse
          console.error(`[timeout] commitCycle failed for pending ${pending.id}, cleaning up:`, commitErr);
          await rejectCycle(analysis, user, "commit_failed").catch(() => {});
        }
      } else {
        const resolved = await resolvePendingCycle(pending.id, {
          status: "TIMED_OUT",
          resolvedBy: "timeout",
          rejectReason: "timeout_rejected",
        });
        if (!resolved) {
          console.log(`[timeout] Pending ${pending.id} already resolved, skipping`);
          continue;
        }

        await rejectCycle(analysis, user, "timeout_rejected");

        if (user.telegram.chatId && pending.telegramMsgId) {
          await editTelegramMessage(
            user.telegram.chatId,
            pending.telegramMsgId,
            formatTimedOutResult(analysis, "rejected"),
          );
        }

        console.log(`[timeout] Auto-rejected cycle ${pending.cycleNumber} for user ${user.id}`);
      }
    } catch (err) {
      console.error(`[timeout] Failed to resolve pending ${pending.id}:`, err);
    }
  }
}

const TIMEOUT_CHECK_INTERVAL_MS = 60_000; // 1 minute

export function startTimeoutChecker(): void {
  console.log(`[timeout] Starting checker (interval: ${TIMEOUT_CHECK_INTERVAL_MS / 1000}s)`);
  setInterval(() => {
    checkExpiredPendingCycles().catch((err) => {
      console.error("[timeout] Check failed:", err);
    });
  }, TIMEOUT_CHECK_INTERVAL_MS);
}
