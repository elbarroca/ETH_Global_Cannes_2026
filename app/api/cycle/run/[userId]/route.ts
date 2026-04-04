import { NextResponse } from "next/server";
import { getUserById } from "@/src/store/user-store";
import { analyzeCycle, runCycle } from "@/src/agents/main-agent";
import { createPendingCycle, getPendingForUser } from "@/src/store/pending-cycles";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Accept an optional user-authored goal from the dashboard. Heartbeat and
    // Telegram triggers send nothing and fall back to the default goal string
    // inside analyzeCycle.
    const body = await request.json().catch(() => ({}));
    const goal = typeof (body as { goal?: unknown }).goal === "string"
      ? (body as { goal: string }).goal
      : undefined;

    const approvalMode = user.agent.approvalMode ?? "always";

    if (approvalMode === "auto") {
      console.log(`[api] Auto-approve cycle for user ${user.id}`);
      const result = await runCycle(user, goal);
      return NextResponse.json({
        cycleId: result.cycleId,
        goal: result.goal,
        specialists: result.specialists,
        debate: result.debate,
        decision: result.decision,
        payments: result.payments,
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
    const analysis = await analyzeCycle(user, goal);
    const timeoutMin = user.agent.approvalTimeoutMin ?? 10;
    const pending = await createPendingCycle(analysis, "ui", timeoutMin);

    return NextResponse.json({
      pendingId: pending.id,
      cycleNumber: pending.cycleNumber,
      goal: pending.goal,
      status: pending.status,
      specialists: pending.specialists,
      debate: pending.debate,
      compactRecord: pending.compactRecord,
      expiresAt: pending.expiresAt,
      specialistPath: analysis.specialistPath ?? "direct_x402",
      openclawGatewayStatus: analysis.openclawGatewayStatus ?? "offline",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
