import { NextResponse } from "next/server";
import {
  authenticateRequest,
  authErrorResponse,
  legacyRuntimeDisabledResponse,
} from "@/src/auth/http";
import { AuthError } from "@/src/auth/errors";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ pendingId: string }> },
) {
  try {
    const auth = await authenticateRequest(request, { requireUser: true });
    if (!auth.ok) return auth.response;
    const { pendingId } = await params;
    let body: { userId?: unknown; modifiedPct?: unknown };
    try {
      body = (await request.json()) as { userId?: unknown; modifiedPct?: unknown };
    } catch {
      throw new AuthError("AUTH_INVALID_REQUEST", "Malformed JSON body", 400);
    }
    if (body.userId !== undefined && body.userId !== auth.auth.principal.userId) {
      return NextResponse.json({ error: "User claim does not match session", code: "AUTH_FORBIDDEN" }, { status: 403 });
    }
    const disabled = legacyRuntimeDisabledResponse();
    if (disabled) return disabled;
    const [userStore, mainAgent, pendingStore] = await Promise.all([
      import("@/src/store/user-store"),
      import("@/src/agents/main-agent"),
      import("@/src/store/pending-cycles"),
    ]);
    const { getUserById, decrementCyclesRemaining } = userStore;
    const { commitCycle, rejectCycle } = mainAgent;
    const { getPendingCycle, resolvePendingCycle } = pendingStore;
    const pending = await getPendingCycle(pendingId);
    if (!pending) {
      return NextResponse.json({ error: "Pending cycle not found" }, { status: 404 });
    }

    if (auth.auth.principal.userId !== pending.userId) {
      return NextResponse.json({ error: "Not authorized to approve this cycle" }, { status: 403 });
    }

    const user = await getUserById(pending.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Validate modifiedPct bounds
    const modifiedPct = typeof body.modifiedPct === "number" ? body.modifiedPct : undefined;
    if (modifiedPct !== undefined) {
      if (modifiedPct < 0 || modifiedPct > user.agent.maxTradePercent) {
        return NextResponse.json({ error: `modifiedPct must be 0-${user.agent.maxTradePercent}` }, { status: 400 });
      }
    }

    // Atomically resolve FIRST to prevent double-commit
    const resolved = await resolvePendingCycle(pendingId, {
      status: "APPROVED",
      resolvedBy: "user",
      modifiedPct,
    });
    if (!resolved) {
      return NextResponse.json({ error: "Already resolved by another session" }, { status: 409 });
    }

    // Safe to commit
    const analysis = {
      userId: pending.userId,
      cycleId: pending.cycleNumber,
      goal: pending.goal,
      specialists: pending.specialists,
      debate: pending.debate,
      compactRecord: pending.compactRecord,
      richRecord: pending.richRecord,
    };

    try {
      const result = await commitCycle(analysis, user, modifiedPct);
      // Budget decrement lives on the COMMIT path (not the heartbeat create-
      // pending path) so a user with approvalMode=always who sets
      // cycleCount=3 gets exactly 3 committed hunts regardless of how many
      // pending cycles were created along the way. Non-fatal.
      await decrementCyclesRemaining(pending.userId);
      return NextResponse.json({
        cycleId: result.cycleId,
        specialists: result.specialists,
        debate: result.debate,
        decision: result.decision,
        seqNum: result.seqNum,
        hashscanUrl: result.hashscanUrl,
        storageHash: result.storageHash,
        inftTokenId: result.inftTokenId,
        swapResult: result.swapResult,
        specialistPath: result.specialistPath,
        openclawGatewayStatus: result.openclawGatewayStatus,
        proofs: result.proofs,
        degraded: result.degraded,
        degradedReasons: result.degradedReasons,
        timestamp: result.timestamp instanceof Date ? result.timestamp.toISOString() : result.timestamp,
      });
    } catch (commitErr) {
      const code = commitErr instanceof Error ? commitErr.name : "UNKNOWN";
      console.error(JSON.stringify({ level: "error", context: "legacy.cycle.approve.commit", code }));
      try {
        await rejectCycle(analysis, user, "commit_failed");
      } catch (cleanupError) {
        const cleanupCode = cleanupError instanceof Error ? cleanupError.name : "UNKNOWN";
        console.error(JSON.stringify({ level: "error", context: "legacy.cycle.approve.cleanup", code: cleanupCode }));
      }
      return NextResponse.json({ error: "Commit failed after approval. Cycle logged as failed." }, { status: 500 });
    }
  } catch (err) {
    return authErrorResponse(err, "legacy.cycle.approve");
  }
}
