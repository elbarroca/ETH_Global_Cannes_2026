import { NextResponse } from "next/server";
import { authenticateRequest } from "@/src/auth/http";
import { kernelErrorResponse, readBoundedKernelJson } from "@/src/kernel/http";
import {
  attachAgentWallet,
  createAgentDraft,
  listAgentLifecycle,
  publishWalletAgentVersion,
} from "@/src/kernel/lifecycle";
import { parseAgentAction, parseAgentListFilters, parseIdempotencyKey } from "@/src/kernel/policy";
import { domainHash } from "@/src/kernel/canonical";
import { walletProviderKernelError } from "@/src/kernel/errors";

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
    if (action.action === "ATTACH_AGENT_WALLET") {
      const observedAt = new Date().toISOString();
      const version = await attachAgentWallet(
        principal.userId,
        action.versionId,
        {
          idempotencyKey,
          signal: request.signal,
          provider: {
            provisionAgentWallet: async ({ agentId, idempotencyKey: providerKey }, signal) => {
              if (signal.aborted) throw new Error("KERNEL_WALLET_PROVIDER_ABORTED");
              const { CircleAgentWalletError, createAgentWallet } =
                await import("@/src/payments/circle-wallet");
              let wallet;
              try {
                wallet = await createAgentWallet(agentId, providerKey);
              } catch (error) {
                if (error instanceof CircleAgentWalletError) {
                  throw walletProviderKernelError(error.reason);
                }
                throw error;
              }
              if (signal.aborted) throw new Error("KERNEL_WALLET_PROVIDER_ABORTED");
              const identity = { ...wallet, state: "LIVE" as const, observedAt };
              return {
                ...identity,
                evidenceHash: domainHash("circle-agent-wallet-evidence", identity),
              };
            },
          },
        },
      );
      return NextResponse.json({ action: action.action, version });
    }
    const version = await publishWalletAgentVersion(principal.userId, action.versionId, {
      idempotencyKey,
      releaseSha: /^[0-9a-f]{40}$/.test(process.env.VERCEL_GIT_COMMIT_SHA ?? "")
        ? process.env.VERCEL_GIT_COMMIT_SHA
        : "0".repeat(40),
    });
    return NextResponse.json({ action: action.action, version });
  } catch (error) {
    return kernelErrorResponse(error, "kernel.agents.publish");
  }
}
