import { NextResponse } from "next/server";
import { authenticateRequest } from "@/src/auth/http";
import {
  getAugmentedLayerPolicy,
  parseGoalPolicyV2,
  patchAugmentedLayerPolicy,
} from "@/src/kernel/augmented-layer-policy";
import { kernelErrorResponse, readBoundedKernelJson } from "@/src/kernel/http";
import { parseIdempotencyKey } from "@/src/kernel/policy";

export const runtime = "nodejs";

async function userId(request: Request): Promise<
  { ok: true; value: string } | { ok: false; response: NextResponse }
> {
  const auth = await authenticateRequest(request, { requireUser: true });
  if (!auth.ok) return auth;
  if (!auth.auth.principal.userId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Onboarding required", code: "AUTH_USER_REQUIRED" },
        { status: 403 },
      ),
    };
  }
  return { ok: true, value: auth.auth.principal.userId };
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const principal = await userId(request);
    if (!principal.ok) return principal.response;
    return NextResponse.json({ policy: await getAugmentedLayerPolicy(principal.value) });
  } catch (error) {
    return kernelErrorResponse(error, "kernel.augmented-layer-policy.read");
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const principal = await userId(request);
    if (!principal.ok) return principal.response;
    const idempotencyKey = parseIdempotencyKey(request.headers.get("idempotency-key"));
    const policy = parseGoalPolicyV2(await readBoundedKernelJson(request));
    return NextResponse.json(
      await patchAugmentedLayerPolicy(principal.value, policy, idempotencyKey),
    );
  } catch (error) {
    return kernelErrorResponse(error, "kernel.augmented-layer-policy.update");
  }
}
