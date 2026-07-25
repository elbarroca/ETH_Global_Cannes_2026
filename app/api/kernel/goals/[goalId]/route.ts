import { NextResponse } from "next/server";
import { authenticateRequest } from "@/src/auth/http";
import {
  getGoal,
  parseGoalIdempotencyKey,
  parseGoalPatch,
  patchGoal,
} from "@/src/kernel/goals";
import { kernelErrorResponse, readBoundedKernelJson } from "@/src/kernel/http";
import { isKernelUuid } from "@/src/kernel/policy";
import { KernelError } from "@/src/kernel/errors";

export const runtime = "nodejs";

type Context = { params: Promise<{ goalId: string }> };

async function principal(request: Request): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const auth = await authenticateRequest(request, { requireUser: true });
  if (!auth.ok) return auth;
  const userId = auth.auth.principal.userId;
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Onboarding required", code: "AUTH_USER_REQUIRED" },
        { status: 403 },
      ),
    };
  }
  return { ok: true, userId };
}

async function goalIdFrom(context: Context): Promise<string> {
  const { goalId } = await context.params;
  if (!isKernelUuid(goalId)) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "goalId must be a UUID", 400);
  }
  return goalId;
}

export async function GET(request: Request, context: Context): Promise<NextResponse> {
  try {
    const auth = await principal(request);
    if (!auth.ok) return auth.response;
    const goalId = await goalIdFrom(context);
    const goal = await getGoal(auth.userId, goalId);
    if (!goal) {
      return NextResponse.json({ error: "Goal not found", code: "KERNEL_NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ goal });
  } catch (error) {
    return kernelErrorResponse(error, "kernel.goals.read");
  }
}

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  try {
    const auth = await principal(request);
    if (!auth.ok) return auth.response;
    const goalId = await goalIdFrom(context);
    const idempotencyKey = parseGoalIdempotencyKey(request.headers.get("idempotency-key"));
    const input = parseGoalPatch(await readBoundedKernelJson(request));
    return NextResponse.json({ goal: await patchGoal(auth.userId, goalId, input, idempotencyKey) });
  } catch (error) {
    return kernelErrorResponse(error, "kernel.goals.update");
  }
}
