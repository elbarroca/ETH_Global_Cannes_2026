import { NextResponse } from "next/server";
import { authenticateRequest } from "@/src/auth/http";
import {
  createGoalRun,
  listGoalRuns,
  parseGoalIdempotencyKey,
  parseRunCreate,
} from "@/src/kernel/goals";
import { kernelErrorResponse, readBoundedKernelJson } from "@/src/kernel/http";
import { isKernelUuid } from "@/src/kernel/policy";

export const runtime = "nodejs";

type Context = { params: Promise<{ goalId: string }> };

function limitFrom(request: Request): number {
  const raw = new URL(request.url).searchParams.get("limit");
  if (raw === null) return 50;
  if (!/^[1-9][0-9]?$/.test(raw) || Number(raw) > 50) return 0;
  return Number(raw);
}

async function authenticatedGoal(request: Request, context: Context): Promise<
  | { ok: true; userId: string; goalId: string }
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
  const { goalId } = await context.params;
  if (!isKernelUuid(goalId)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "goalId must be a UUID", code: "KERNEL_INVALID_REQUEST" },
        { status: 400 },
      ),
    };
  }
  return { ok: true, userId, goalId };
}

export async function GET(request: Request, context: Context): Promise<NextResponse> {
  try {
    const auth = await authenticatedGoal(request, context);
    if (!auth.ok) return auth.response;
    const limit = limitFrom(request);
    if (limit === 0) {
      return NextResponse.json({ error: "limit must be 1-50", code: "KERNEL_INVALID_REQUEST" }, { status: 400 });
    }
    return NextResponse.json({ runs: await listGoalRuns(auth.userId, auth.goalId, { limit }) });
  } catch (error) {
    return kernelErrorResponse(error, "kernel.goal-runs.list");
  }
}

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  try {
    const auth = await authenticatedGoal(request, context);
    if (!auth.ok) return auth.response;
    const idempotencyKey = parseGoalIdempotencyKey(request.headers.get("idempotency-key"));
    parseRunCreate(await readBoundedKernelJson(request));
    const result = await createGoalRun(auth.userId, auth.goalId, idempotencyKey);
    return NextResponse.json(result, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    return kernelErrorResponse(error, "kernel.goal-runs.create");
  }
}
