import { NextResponse } from "next/server";
import { authenticateRequest } from "@/src/auth/http";
import { kernelErrorResponse } from "@/src/kernel/http";
import { parseAgentInput } from "@/src/kernel/policy";
import { listPublishedAgents, publishAgent } from "@/src/kernel/service";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const result = await authenticateRequest(request, { requireUser: true });
    if (!result.ok) return result.response;
    const userId = result.auth.principal.userId;
    if (!userId) {
      return NextResponse.json({ error: "Onboarding required", code: "AUTH_USER_REQUIRED" }, { status: 403 });
    }
    const agents = await listPublishedAgents({ viewerUserId: userId });
    return NextResponse.json({ agents });
  } catch (error) {
    return kernelErrorResponse(error, "kernel.agents.list");
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const result = await authenticateRequest(request, { requireUser: true });
    if (!result.ok) return result.response;
    const principal = result.auth.principal;
    if (!principal.userId) {
      return NextResponse.json({ error: "Onboarding required", code: "AUTH_USER_REQUIRED" }, { status: 403 });
    }
    const body = (await request.json()) as unknown;
    const input = parseAgentInput(body, principal.walletAddress);
    const agent = await publishAgent(
      { userId: principal.userId, walletAddress: principal.walletAddress },
      input.manifest,
    );
    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    return kernelErrorResponse(error, "kernel.agents.publish");
  }
}
