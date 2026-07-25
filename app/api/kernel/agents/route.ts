import { NextResponse } from "next/server";
import { authenticateRequest } from "@/src/auth/http";
import { kernelErrorResponse } from "@/src/kernel/http";
import {
  bindAgentName,
  createAgentDraft,
  listAgentLifecycle,
  prepareAgentEnsWrite,
  publishAgentVersion,
} from "@/src/kernel/lifecycle";
import { parseAgentAction } from "@/src/kernel/policy";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const result = await authenticateRequest(request, { requireUser: true });
    if (!result.ok) return result.response;
    const userId = result.auth.principal.userId;
    if (!userId) {
      return NextResponse.json({ error: "Onboarding required", code: "AUTH_USER_REQUIRED" }, { status: 403 });
    }
    return NextResponse.json(await listAgentLifecycle(userId));
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
    const action = parseAgentAction(body, principal.walletAddress);
    if (action.action === "CREATE_DRAFT") {
      const version = await createAgentDraft(
        { userId: principal.userId, walletAddress: principal.walletAddress },
        action.manifest,
        { agentId: action.agentId },
      );
      return NextResponse.json({ action: action.action, version }, { status: 201 });
    }
    if (action.action === "BIND_NAME") {
      const version = await bindAgentName(principal.userId, action.versionId, action.binding);
      return NextResponse.json({ action: action.action, version });
    }
    if (action.action === "PREPARE_ENS_WRITE") {
      const prepared = await prepareAgentEnsWrite(principal.userId, action.versionId);
      return NextResponse.json({ action: action.action, ...prepared });
    }
    const version = await publishAgentVersion(principal.userId, action.versionId);
    return NextResponse.json({ action: action.action, version });
  } catch (error) {
    return kernelErrorResponse(error, "kernel.agents.publish");
  }
}
