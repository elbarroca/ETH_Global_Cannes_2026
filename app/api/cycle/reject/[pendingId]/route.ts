import { NextResponse } from "next/server";
import {
  authenticateRequest,
  authErrorResponse,
  legacyRuntimeDisabledResponse,
} from "@/src/auth/http";
import { AuthError } from "@/src/auth/errors";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ pendingId: string }> },
) {
  try {
    const auth = await authenticateRequest(request, { requireUser: true });
    if (!auth.ok) return auth.response;
    const { pendingId } = await params;
    let body: { userId?: unknown; reason?: unknown };
    try {
      body = (await request.json()) as { userId?: unknown; reason?: unknown };
    } catch {
      throw new AuthError("AUTH_INVALID_REQUEST", "Malformed JSON body", 400);
    }
    if (body.userId !== undefined && body.userId !== auth.auth.principal.userId) {
      return NextResponse.json({ error: "User claim does not match session", code: "AUTH_FORBIDDEN" }, { status: 403 });
    }
    const disabled = legacyRuntimeDisabledResponse();
    if (disabled) return disabled;
    const [{ getUserById }, { rejectCycle }, pendingStore] = await Promise.all([
      import("@/src/store/user-store"),
      import("@/src/agents/main-agent"),
      import("@/src/store/pending-cycles"),
    ]);
    const { getPendingCycle, resolvePendingCycle } = pendingStore;
    const pending = await getPendingCycle(pendingId);
    if (!pending) {
      return NextResponse.json({ error: "Pending cycle not found" }, { status: 404 });
    }

    if (auth.auth.principal.userId !== pending.userId) {
      return NextResponse.json({ error: "Not authorized to reject this cycle" }, { status: 403 });
    }

    const user = await getUserById(pending.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const reason = typeof body.reason === "string" && body.reason.trim().length <= 120
      ? body.reason.trim() || "user_rejected"
      : "user_rejected";

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
    return authErrorResponse(err, "legacy.cycle.reject");
  }
}
