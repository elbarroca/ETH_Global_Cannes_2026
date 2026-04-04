import { NextResponse } from "next/server";
import { getUserById } from "@/src/store/user-store";
import { commitCycle, rejectCycle } from "@/src/agents/main-agent";
import { getPendingCycle, resolvePendingCycle } from "@/src/store/pending-cycles";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ pendingId: string }> },
) {
  try {
    const { pendingId } = await params;
    const pending = await getPendingCycle(pendingId);
    if (!pending) {
      return NextResponse.json({ error: "Pending cycle not found" }, { status: 404 });
    }

    // Auth: verify caller owns this pending cycle
    const body = await request.json().catch(() => ({}));
    const callerId = (body as { userId?: string }).userId;
    if (!callerId || callerId !== pending.userId) {
      return NextResponse.json({ error: "Not authorized to approve this cycle" }, { status: 403 });
    }

    const user = await getUserById(pending.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Validate modifiedPct bounds
    const modifiedPct = (body as { modifiedPct?: number }).modifiedPct;
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
      specialists: pending.specialists,
      debate: pending.debate,
      compactRecord: pending.compactRecord,
    };

    try {
      const result = await commitCycle(analysis, user, modifiedPct);
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
      console.error("[api] commitCycle failed after resolve, cleaning up:", commitErr);
      await rejectCycle(analysis, user, "commit_failed").catch(() => {});
      return NextResponse.json({ error: "Commit failed after approval. Cycle logged as failed." }, { status: 500 });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
