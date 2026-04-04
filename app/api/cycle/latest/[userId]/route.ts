import { NextResponse } from "next/server";
import { getUserById } from "@/src/store/user-store";
import { getHistoryForUser } from "@/src/hedera/hcs";

export async function GET(
  _request: Request,
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

    const history = await getHistoryForUser(topicId, user.id, 1);
    if (history.length === 0) {
      return NextResponse.json(null);
    }

    return NextResponse.json(history[0]);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
