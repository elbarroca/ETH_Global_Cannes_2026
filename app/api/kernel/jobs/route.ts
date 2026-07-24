import { NextResponse } from "next/server";
import { authenticateRequest } from "@/src/auth/http";
import { kernelErrorResponse } from "@/src/kernel/http";
import { isKernelUuid, parseIdempotencyKey, parseJobSubmission } from "@/src/kernel/policy";
import { getBuyerJobDetail, listBuyerJobs, submitJob } from "@/src/kernel/service";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const result = await authenticateRequest(request, { requireUser: true });
    if (!result.ok) return result.response;
    const userId = result.auth.principal.userId;
    if (!userId) {
      return NextResponse.json({ error: "Onboarding required", code: "AUTH_USER_REQUIRED" }, { status: 403 });
    }
    const jobId = new URL(request.url).searchParams.get("jobId");
    if (jobId) {
      if (!isKernelUuid(jobId)) {
        return NextResponse.json(
          { error: "jobId must be a UUID", code: "KERNEL_INVALID_REQUEST" },
          { status: 400 },
        );
      }
      const job = await getBuyerJobDetail(userId, jobId);
      if (!job) {
        return NextResponse.json(
          { error: "Job not found", code: "KERNEL_NOT_FOUND" },
          { status: 404 },
        );
      }
      return NextResponse.json({ job });
    }
    return NextResponse.json({ jobs: await listBuyerJobs(userId) });
  } catch (error) {
    return kernelErrorResponse(error, "kernel.jobs.read");
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const result = await authenticateRequest(request, { requireUser: true });
    if (!result.ok) return result.response;
    const userId = result.auth.principal.userId;
    if (!userId) {
      return NextResponse.json({ error: "Onboarding required", code: "AUTH_USER_REQUIRED" }, { status: 403 });
    }
    const body = (await request.json()) as unknown;
    const submission = parseJobSubmission(body);
    const idempotencyKey = parseIdempotencyKey(request.headers.get("idempotency-key"));
    const job = await submitJob(userId, {
      agentVersionId: submission.agentVersionId,
      idempotencyKey,
      task: submission.input,
    });
    return NextResponse.json({ job }, { status: job.replayed ? 200 : 201 });
  } catch (error) {
    return kernelErrorResponse(error, "kernel.jobs.submit");
  }
}
