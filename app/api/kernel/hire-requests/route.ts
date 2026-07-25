import { NextResponse } from "next/server";
import { authenticateRequest } from "@/src/auth/http";
import { createHireRequest, listHireRequests } from "@/src/kernel/hire-requests";
import { kernelErrorResponse, readBoundedKernelJson } from "@/src/kernel/http";
import {
  isKernelUuid,
  parseHireRequestInput,
  parseIdempotencyKey,
} from "@/src/kernel/policy";
import { KernelError } from "@/src/kernel/errors";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const result = await authenticateRequest(request, { requireUser: true });
    if (!result.ok) return result.response;
    const userId = result.auth.principal.userId;
    if (!userId) {
      return NextResponse.json({ error: "Onboarding required", code: "AUTH_USER_REQUIRED" }, { status: 403 });
    }
    const url = new URL(request.url);
    for (const key of url.searchParams.keys()) {
      if (!["id", "limit"].includes(key) || url.searchParams.getAll(key).length !== 1) {
        throw new KernelError("KERNEL_INVALID_REQUEST", "Invalid hire request filter", 400);
      }
    }
    const id = url.searchParams.get("id");
    if (id !== null && !isKernelUuid(id)) {
      throw new KernelError("KERNEL_INVALID_REQUEST", "id must be a UUID", 400);
    }
    const rawLimit = url.searchParams.get("limit");
    const limit = rawLimit === null ? 50 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new KernelError("KERNEL_INVALID_REQUEST", "limit must be an integer from 1 to 100", 400);
    }
    return NextResponse.json({ hireRequests: await listHireRequests(userId, {
      hireRequestId: id ?? undefined,
      limit,
    }) });
  } catch (error) {
    return kernelErrorResponse(error, "kernel.hire-requests.list");
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = parseHireRequestInput(await readBoundedKernelJson(request));
    const idempotencyKey = parseIdempotencyKey(request.headers.get("idempotency-key"));
    const result = await authenticateRequest(request, { requireUser: true });
    if (!result.ok) return result.response;
    const userId = result.auth.principal.userId;
    if (!userId) {
      return NextResponse.json({ error: "Onboarding required", code: "AUTH_USER_REQUIRED" }, { status: 403 });
    }
    const hireRequest = await createHireRequest(userId, { ...body, idempotencyKey });
    return NextResponse.json({ hireRequest }, { status: hireRequest.replayed ? 200 : 202 });
  } catch (error) {
    return kernelErrorResponse(error, "kernel.hire-requests.create");
  }
}
