import { NextResponse } from "next/server";
import { authenticateRequest } from "@/src/auth/http";
import {
  createGoal,
  listGoals,
  parseGoalCreate,
  parseGoalIdempotencyKey,
} from "@/src/kernel/goals";
import { kernelErrorResponse, readBoundedKernelJson } from "@/src/kernel/http";

export const runtime = "nodejs";

function limitFrom(request: Request): number {
  const raw = new URL(request.url).searchParams.get("limit");
  if (raw === null) return 50;
  if (!/^[1-9][0-9]?$/.test(raw) || Number(raw) > 50) return 0;
  return Number(raw);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await authenticateRequest(request, { requireUser: true });
    if (!auth.ok) return auth.response;
    const userId = auth.auth.principal.userId;
    if (!userId) {
      return NextResponse.json({ error: "Onboarding required", code: "AUTH_USER_REQUIRED" }, { status: 403 });
    }
    const limit = limitFrom(request);
    if (limit === 0) {
      return NextResponse.json({ error: "limit must be 1-50", code: "KERNEL_INVALID_REQUEST" }, { status: 400 });
    }
    return NextResponse.json({ goals: await listGoals(userId, { limit }) });
  } catch (error) {
    return kernelErrorResponse(error, "kernel.goals.list");
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await authenticateRequest(request, { requireUser: true });
    if (!auth.ok) return auth.response;
    const userId = auth.auth.principal.userId;
    if (!userId) {
      return NextResponse.json({ error: "Onboarding required", code: "AUTH_USER_REQUIRED" }, { status: 403 });
    }
    const idempotencyKey = parseGoalIdempotencyKey(request.headers.get("idempotency-key"));
    const input = parseGoalCreate(await readBoundedKernelJson(request));
    const result = await createGoal(userId, input, idempotencyKey);
    return NextResponse.json(result, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    return kernelErrorResponse(error, "kernel.goals.create");
  }
}
