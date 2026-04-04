import { NextResponse } from "next/server";
import { getUserById } from "@/src/store/user-store";
import { analyzeCycle, runCycle } from "@/src/agents/main-agent";
import { createPendingCycle, getPendingForUser } from "@/src/store/pending-cycles";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const approvalMode = user.agent.approvalMode ?? "always";

    if (approvalMode === "auto") {
      console.log(`[api] Auto-approve cycle for user ${user.id}`);
      const result = await runCycle(user);
      return NextResponse.json({
        cycleId: result.cycleId,
        specialists: result.specialists,
        debate: result.debate,
        decision: result.decision,
        seqNum: result.seqNum,
        hashscanUrl: result.hashscanUrl,
        timestamp: result.timestamp instanceof Date ? result.timestamp.toISOString() : result.timestamp,
      });
    }

    // Two-phase: analyze + pending
    const existing = await getPendingForUser(userId);
    if (existing) {
      return NextResponse.json(
        { error: "A pending cycle already exists", pendingId: existing.id },
        { status: 409 },
      );
    }

    console.log(`[api] Analyze cycle for user ${user.id} (approval: ${approvalMode})`);
    const analysis = await analyzeCycle(user);
    const timeoutMin = user.agent.approvalTimeoutMin ?? 10;
    const pending = await createPendingCycle(analysis, "ui", timeoutMin);

    return NextResponse.json({
      pendingId: pending.id,
      cycleNumber: pending.cycleNumber,
      status: pending.status,
      specialists: pending.specialists,
      debate: pending.debate,
      compactRecord: pending.compactRecord,
      expiresAt: pending.expiresAt,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
