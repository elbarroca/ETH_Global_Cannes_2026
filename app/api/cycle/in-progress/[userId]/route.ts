import { NextResponse } from "next/server";
import { getPrisma } from "@/src/config/prisma";
import { getPendingForUser } from "@/src/store/pending-cycles";

/**
 * GET /api/cycle/in-progress/[userId]
 *
 * Returns the state of the currently-running cycle for a user, derived from
 * the `agent_actions` audit log (not the `cycles` table). This closes the
 * dashboard UX gap where cycles take ~6 minutes to commit but the main hunt
 * feed only shows COMMITTED rows — for 90% of a cycle's lifetime, the UI
 * looks frozen at the previous hunt while the backend is actively running
 * specialist hires, adversarial debate, HCS writes, and 0G storage uploads.
 *
 * Response shape:
 *   null                           → no cycle in flight
 *   { cycleNumber, startedAt, phase, elapsedMs, specialists, flags }
 *
 * Phase is derived from which agent_action rows exist since the CYCLE_STARTED:
 *   hiring    → 0-3 SPECIALIST_HIRED rows (still negotiating x402 payments)
 *   debating  → 4 hires in + DEBATE_ALPHA/RISK/EXECUTOR not all done
 *   sealing   → debate complete; commit pipeline running (0G + HCS)
 *   awaiting_approval → two-phase mode: analysis done, user has not approved yet
 *   committing → HCS_LOGGED done, final Cycle row insert imminent
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    const prisma = getPrisma();

    // 1. Find the latest CYCLE_STARTED for this user
    const started = await prisma.agentAction.findFirst({
      where: { userId, actionType: "CYCLE_STARTED" },
      orderBy: { createdAt: "desc" },
    });
    if (!started) return NextResponse.json(null);

    const payload = started.payload as { cycleNumber?: number } | null;
    const cycleNumber = typeof payload?.cycleNumber === "number" ? payload.cycleNumber : null;
    if (cycleNumber == null) return NextResponse.json(null);

    // 2. If a Cycle row with this cycleNumber exists for this user, the cycle
    //    already committed — no in-progress state to surface.
    const committed = await prisma.cycle.findFirst({
      where: { userId, cycleNumber },
      select: { id: true },
    });
    if (committed) return NextResponse.json(null);

    // 3. Gather all events since the start of this cycle
    const events = await prisma.agentAction.findMany({
      where: { userId, createdAt: { gte: started.createdAt } },
      orderBy: { createdAt: "asc" },
      select: {
        actionType: true,
        agentName: true,
        status: true,
        payload: true,
        createdAt: true,
      },
    });

    // 4. Parse specialists from SPECIALIST_HIRED rows
    interface SpecialistInProgress {
      name: string;
      signal: string | null;
      confidence: number | null;
      hiredBy: string | null;
      hiredAt: string;
    }
    const specialists: SpecialistInProgress[] = [];
    let hasAlpha = false;
    let hasRisk = false;
    let hasExecutor = false;
    let hasStorage = false;
    let hasHcs = false;

    const pendingRow = await getPendingForUser(userId);
    const awaitingApproval =
      pendingRow != null &&
      pendingRow.cycleNumber === cycleNumber &&
      pendingRow.status === "PENDING_APPROVAL";

    for (const e of events) {
      if (e.actionType === "SPECIALIST_HIRED" && e.agentName) {
        const p = e.payload as { signal?: string; confidence?: number; hiredBy?: string } | null;
        specialists.push({
          name: e.agentName,
          signal: p?.signal ?? null,
          confidence: typeof p?.confidence === "number" ? p.confidence : null,
          hiredBy: p?.hiredBy ?? null,
          hiredAt: e.createdAt.toISOString(),
        });
      } else if (e.actionType === "DEBATE_ALPHA") {
        hasAlpha = true;
      } else if (e.actionType === "DEBATE_RISK") {
        hasRisk = true;
      } else if (e.actionType === "DEBATE_EXECUTOR") {
        hasExecutor = true;
      } else if (e.actionType === "STORAGE_UPLOADED") {
        hasStorage = true;
      } else if (e.actionType === "HCS_LOGGED") {
        hasHcs = true;
      }
    }

    // 5. Derive phase
    let phase: "hiring" | "debating" | "sealing" | "committing" | "awaiting_approval";
    if (hasHcs) phase = "committing";
    else if (awaitingApproval && hasExecutor && !hasStorage) phase = "awaiting_approval";
    else if (hasStorage || hasExecutor) phase = "sealing";
    else if (hasAlpha || specialists.length >= 3) phase = "debating";
    else phase = "hiring";

    const startedAtMs = started.createdAt.getTime();
    const elapsedMs = Date.now() - startedAtMs;

    return NextResponse.json({
      cycleNumber,
      startedAt: started.createdAt.toISOString(),
      phase,
      elapsedMs,
      specialists,
      flags: { hasAlpha, hasRisk, hasExecutor, hasStorage, hasHcs },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
