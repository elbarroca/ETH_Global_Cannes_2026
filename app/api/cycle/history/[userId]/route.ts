import { type NextRequest, NextResponse } from "next/server";
import { getUserById } from "@/src/store/user-store";
import { getHistoryForUser } from "@/src/hedera/hcs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const topicId = process.env.HCS_AUDIT_TOPIC_ID ?? "";
    if (!topicId) {
      return NextResponse.json({ error: "HCS_AUDIT_TOPIC_ID not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 10), 100);
    const history = await getHistoryForUser(topicId, user.id, limit);

    return NextResponse.json(history);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
