import { NextResponse } from "next/server";
import {
  authenticateRequest,
  authErrorResponse,
  legacyRuntimeDisabledResponse,
} from "@/src/auth/http";
import { AuthError } from "@/src/auth/errors";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    const auth = await authenticateRequest(request, { requireUser: true, claimedUserId: userId });
    if (!auth.ok) return auth.response;
    const disabled = legacyRuntimeDisabledResponse();
    if (disabled) return disabled;
    const [{ getUserById }, { analyzeCycle }, pendingStore] = await Promise.all([
      import("@/src/store/user-store"),
      import("@/src/agents/main-agent"),
      import("@/src/store/pending-cycles"),
    ]);
    const { createPendingCycle, getPendingForUser } = pendingStore;
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AuthError("AUTH_INVALID_REQUEST", "Malformed JSON body", 400);
    }
    const goal = typeof (body as { goal?: unknown }).goal === "string"
      ? (body as { goal: string }).goal
      : undefined;

    // Guard: reject if user already has a pending cycle
    const existing = await getPendingForUser(userId);
    if (existing) {
      return NextResponse.json(
        { error: "A pending cycle already exists", pendingId: existing.id },
        { status: 409 },
      );
    }

    console.log(JSON.stringify({ level: "info", context: "legacy.cycle.analyze" }));
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
    });
  } catch (err) {
    return authErrorResponse(err, "legacy.cycle.analyze");
  }
}
