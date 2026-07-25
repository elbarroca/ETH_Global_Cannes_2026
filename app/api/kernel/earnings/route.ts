import { NextResponse } from "next/server";
import { authenticateRequest } from "@/src/auth/http";
import { getOwnerEarnings } from "@/src/kernel/earnings";
import { KernelError } from "@/src/kernel/errors";
import { kernelErrorResponse } from "@/src/kernel/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await authenticateRequest(request, { requireUser: true });
    if (!auth.ok) return auth.response;
    const userId = auth.auth.principal.userId;
    if (!userId) {
      return NextResponse.json(
        { error: "Onboarding required", code: "AUTH_USER_REQUIRED" },
        { status: 403 },
      );
    }
    if ([...new URL(request.url).searchParams.keys()].length > 0) {
      throw new KernelError("KERNEL_INVALID_REQUEST", "Earnings filters are not supported", 400);
    }
    return NextResponse.json(await getOwnerEarnings(userId), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return kernelErrorResponse(error, "kernel.earnings.read");
  }
}
