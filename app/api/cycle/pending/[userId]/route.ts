import { NextResponse } from "next/server";
import { getPendingForUser } from "@/src/store/pending-cycles";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    const pending = await getPendingForUser(userId);
    if (!pending) {
      return NextResponse.json(null);
    }

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
