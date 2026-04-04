import { NextResponse } from "next/server";
import { getUserById } from "@/src/store/user-store";
import { runCycle } from "@/src/agents/main-agent";

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

    console.log(`[api] Manual cycle triggered for user ${user.id}`);
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
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
