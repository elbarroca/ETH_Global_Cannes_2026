import { getActiveUsers } from "../store/user-store.js";
import { runCycle } from "./main-agent.js";
import { notifyUser } from "../telegram/bot.js";
import { scheduleNextHeartbeat } from "../hedera/scheduler.js";

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
      const result = await runCycle(user);
      notifyUser(user, result);
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
