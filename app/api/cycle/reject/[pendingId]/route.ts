import { NextResponse } from "next/server";
import { getUserById } from "@/src/store/user-store";
import { rejectCycle } from "@/src/agents/main-agent";
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
      return NextResponse.json({ error: "Not authorized to reject this cycle" }, { status: 403 });
    }

    const user = await getUserById(pending.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const reason = ((body as { reason?: string }).reason) ?? "user_rejected";

    // Atomically resolve FIRST
    const resolved = await resolvePendingCycle(pendingId, {
      status: "REJECTED",
      resolvedBy: "user",
      rejectReason: reason,
    });
    if (!resolved) {
      return NextResponse.json({ error: "Already resolved by another session" }, { status: 409 });
    }

    await rejectCycle(
      {
        userId: pending.userId,
        cycleId: pending.cycleNumber,
        goal: pending.goal,
        specialists: pending.specialists,
        debate: pending.debate,
        compactRecord: pending.compactRecord,
        richRecord: pending.richRecord,
      },
      user,
      reason,
    );

    return NextResponse.json({ status: "rejected", pendingId });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
