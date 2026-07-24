import { NextResponse } from "next/server";
import { authenticateRequest } from "@/src/auth/http";
import { kernelErrorResponse } from "@/src/kernel/http";
import { isKernelUuid } from "@/src/kernel/policy";
import { cancelBuyerJob } from "@/src/kernel/service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  try {
    const result = await authenticateRequest(request, { requireUser: true });
    if (!result.ok) return result.response;
    const userId = result.auth.principal.userId;
    if (!userId) {
      return NextResponse.json({ error: "Onboarding required", code: "AUTH_USER_REQUIRED" }, { status: 403 });
    }
    const { jobId } = await params;
    if (!isKernelUuid(jobId)) {
      return NextResponse.json(
        { error: "jobId must be a UUID", code: "KERNEL_INVALID_REQUEST" },
        { status: 400 },
      );
    }
    const bodyText = await request.text();
    if (bodyText.trim() !== "" && bodyText.trim() !== "{}") {
      return NextResponse.json(
        { error: "Cancellation does not accept authority fields", code: "KERNEL_INVALID_REQUEST" },
        { status: 400 },
      );
    }
    const job = await cancelBuyerJob(userId, jobId);
    return NextResponse.json({ job });
  } catch (error) {
    return kernelErrorResponse(error, "kernel.jobs.cancel");
  }
}
