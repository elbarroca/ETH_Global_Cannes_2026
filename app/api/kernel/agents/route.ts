import { NextResponse } from "next/server";
import { authenticateRequest } from "@/src/auth/http";
import { kernelErrorResponse, readBoundedKernelJson } from "@/src/kernel/http";
import {
  bindAgentName,
  createAgentDraft,
  listAgentLifecycle,
  prepareAgentEnsWrite,
  publishAgentVersion,
} from "@/src/kernel/lifecycle";
import { parseAgentAction, parseAgentListFilters, parseIdempotencyKey } from "@/src/kernel/policy";
import { createProductionEnsPublicationAuthority } from "@/src/kernel/publication-authority";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const result = await authenticateRequest(request, { requireUser: true });
    if (!result.ok) return result.response;
    const userId = result.auth.principal.userId;
    if (!userId) {
      return NextResponse.json({ error: "Onboarding required", code: "AUTH_USER_REQUIRED" }, { status: 403 });
    }
    const filters = parseAgentListFilters(new URL(request.url));
    const resultView = await listAgentLifecycle(userId, { filters });
    if (!filters.active) return NextResponse.json(resultView);
    const last = resultView.agents.at(-1);
    const nextCursor = resultView.agents.length === filters.limit && last
      ? Buffer.from(`${last.publishedAt}|${last.versionId}`, "utf8").toString("base64url")
      : null;
    return NextResponse.json({ ...resultView, nextCursor });
  } catch (error) {
    return kernelErrorResponse(error, "kernel.agents.list");
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await readBoundedKernelJson(request);
    const idempotencyKey = parseIdempotencyKey(request.headers.get("idempotency-key"));
    const result = await authenticateRequest(request, { requireUser: true });
    if (!result.ok) return result.response;
    const principal = result.auth.principal;
    if (!principal.userId) {
      return NextResponse.json({ error: "Onboarding required", code: "AUTH_USER_REQUIRED" }, { status: 403 });
    }
    const action = parseAgentAction(body, principal.walletAddress);
    if (action.action === "CREATE_DRAFT") {
      const version = await createAgentDraft(
        { userId: principal.userId, walletAddress: principal.walletAddress },
        action.manifest,
        { agentId: action.agentId, idempotencyKey },
      );
      return NextResponse.json({ action: action.action, version }, { status: 201 });
    }
    if (action.action === "BIND_NAME") {
      const version = await bindAgentName(
        principal.userId,
        action.versionId,
        action.binding,
        { idempotencyKey },
      );
      return NextResponse.json({ action: action.action, version });
    }
    if (action.action === "PREPARE_ENS_WRITE") {
      const prepared = await prepareAgentEnsWrite(
        principal.userId,
        action.versionId,
        { idempotencyKey },
      );
      return NextResponse.json({ action: action.action, ...prepared });
    }
    const version = await publishAgentVersion(principal.userId, action.versionId, {
      authority: createProductionEnsPublicationAuthority(),
      idempotencyKey,
    });
    return NextResponse.json({ action: action.action, version });
  } catch (error) {
    return kernelErrorResponse(error, "kernel.agents.publish");
  }
}
