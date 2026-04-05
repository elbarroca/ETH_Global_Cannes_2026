/**
 * Cron heartbeat endpoint.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Replaces the setInterval loops in src/index.ts (startHeartbeatLoop +
 * startTimeoutChecker) for Vercel deployments. Triggered on a schedule by:
 *
 *   A. Vercel Cron — declared in vercel.json with `"path": "/api/cron/heartbeat"`.
 *      Vercel auto-injects `Authorization: Bearer $CRON_SECRET` when you set
 *      the CRON_SECRET env var on the project. Free tier (Hobby) cron is
 *      best-effort; Pro tier gets sub-minute guarantees.
 *
 *   B. External cron (cron-job.org, GitHub Actions, Upstash QStash) — point
 *      at this URL and send the same secret via either the `Authorization`
 *      bearer header or `X-Cron-Secret` custom header.
 *
 *   C. Manual — curl with the secret for debugging.
 *
 * The business logic (runHeartbeat, checkExpiredPendingCycles) is unchanged
 * from the local backend — we just unwrap the setInterval and run each
 * function once per invocation.
 *
 * On Vercel Hobby (60s maxDuration):
 *   - Timeout check is always fast (<1s).
 *   - Heartbeat can truncate if a user's cycle runs long. On truncation,
 *     the next tick picks up where we left off (lastCycleAt guards prevent
 *     double-runs, and Prisma writes are per-step so nothing is half-applied).
 * ─────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { runHeartbeat } from "@/src/agents/heartbeat";
import { checkExpiredPendingCycles } from "@/src/agents/timeout-checker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // No secret configured → open (for local dev only). Log loudly so this
    // is never mistaken for a production posture.
    console.warn("[cron] CRON_SECRET not set — endpoint is open (dev only)");
    return true;
  }

  // Vercel Cron auto-injects this header when CRON_SECRET env var is set.
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  // External crons (cron-job.org etc) may send via a custom header.
  const custom = request.headers.get("x-cron-secret");
  if (custom === secret) return true;

  return false;
}

// Soft budget passed to runHeartbeat() so it skips starting new user cycles
// when the deadline is near. Leaves ~8s of headroom under Vercel Hobby's 60s
// function cap for checkExpiredPendingCycles + response serialization + the
// in-flight cycle to finish committing.
const HEARTBEAT_BUDGET_MS = 50_000;

interface CronResult {
  ok: boolean;
  durationMs: number;
  heartbeat: {
    ok: boolean;
    error?: string;
    processed?: number;
    skippedBudget?: number;
    skippedTiming?: number;
    budgetExceeded?: boolean;
  };
  timeoutCheck: { ok: boolean; error?: string };
}

async function runCron(): Promise<CronResult> {
  const started = Date.now();
  const result: CronResult = {
    ok: true,
    durationMs: 0,
    heartbeat: { ok: true },
    timeoutCheck: { ok: true },
  };

  // 1. Resolve any expired pending cycles first — fast (<1s), always runs.
  //    Critical for the Telegram approval flow: without this, pending cycles
  //    never time out and users stay stuck on "waiting for approval".
  try {
    await checkExpiredPendingCycles();
  } catch (err) {
    console.error("[cron] timeout check failed:", err);
    result.timeoutCheck = { ok: false, error: err instanceof Error ? err.message : String(err) };
    result.ok = false;
  }

  // 2. Run a heartbeat tick with a time budget so we don't get killed by
  //    Vercel's 60s function cap. runHeartbeat processes as many users as
  //    fit in the budget; the next tick picks up where we left off (per-user
  //    lastCycleAt guards already prevent double-runs).
  try {
    const hb = await runHeartbeat({ budgetMs: HEARTBEAT_BUDGET_MS });
    result.heartbeat = {
      ok: true,
      processed: hb.processed,
      skippedBudget: hb.skippedBudget,
      skippedTiming: hb.skippedTiming,
      budgetExceeded: hb.budgetExceeded,
    };
  } catch (err) {
    console.error("[cron] heartbeat failed:", err);
    result.heartbeat = { ok: false, error: err instanceof Error ? err.message : String(err) };
    result.ok = false;
  }

  result.durationMs = Date.now() - started;
  return result;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runCron();
  console.log(`[cron] heartbeat tick complete in ${result.durationMs}ms`, result);
  return NextResponse.json(result);
}

// POST mirrors GET — some cron services (Upstash QStash) default to POST.
export async function POST(request: NextRequest): Promise<NextResponse> {
  return GET(request);
}
