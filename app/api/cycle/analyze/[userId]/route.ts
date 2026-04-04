import { NextResponse } from "next/server";
import { getUserById } from "@/src/store/user-store";
import { analyzeCycle } from "@/src/agents/main-agent";
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

    // Guard: reject if user already has a pending cycle
    const existing = await getPendingForUser(userId);
    if (existing) {
      return NextResponse.json(
        { error: "A pending cycle already exists", pendingId: existing.id },
        { status: 409 },
      );
    }

    console.log(`[api] Analyze cycle for user ${user.id}`);
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
