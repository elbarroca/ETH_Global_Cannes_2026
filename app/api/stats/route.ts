import { NextResponse } from "next/server";
import { getAllUsers, getActiveUsers } from "@/src/store/user-store";

export async function GET() {
  try {
    const all = await getAllUsers();
    const active = await getActiveUsers();
    const totalCycles = all.reduce((sum, u) => sum + u.agent.lastCycleId, 0);
    const totalValue = all.reduce((sum, u) => sum + u.fund.depositedUsdc, 0);

    return NextResponse.json({
      totalUsers: all.length,
      activeAgents: active.length,
      totalCyclesRun: totalCycles,
      totalValueLocked: totalValue,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
