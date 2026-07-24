import { type NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  authErrorResponse,
  legacyRuntimeDisabledResponse,
} from "@/src/auth/http";
import type { UserRecord } from "@/src/types/index";

function deriveMaxTrade(riskProfile: string): number {
  if (riskProfile === "conservative") return 5;
  if (riskProfile === "aggressive") return 25;
  return 12;
}

function sanitizeUser(user: UserRecord): Omit<UserRecord, "proxyWallet"> & {
  proxyWalletAddress: string;
} {
  const { proxyWallet, ...rest } = user;
  return { ...rest, proxyWalletAddress: proxyWallet.address };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await authenticateRequest(request, { requireUser: true });
    if (!auth.ok) return auth.response;
    const authenticatedUserId = auth.auth.principal.userId;
    if (!authenticatedUserId) {
      return NextResponse.json({ error: "Onboarding required", code: "AUTH_USER_REQUIRED" }, { status: 403 });
    }
    const body = (await request.json()) as {
      userId?: unknown;
      riskProfile?: unknown;
      notifyPreference?: unknown;
      approvalMode?: unknown;
      cycleCount?: unknown;
      cyclePeriodMs?: unknown;
      goal?: unknown;
    };
    if (body.userId !== undefined && body.userId !== authenticatedUserId) {
      return NextResponse.json({ error: "User claim does not match session", code: "AUTH_FORBIDDEN" }, { status: 403 });
    }
    const disabled = legacyRuntimeDisabledResponse();
    if (disabled) return disabled;

    const validProfiles = ["conservative", "balanced", "aggressive"] as const;
    const validNotify = ["every_cycle", "trades_only", "daily"] as const;
    const validApproval = ["always", "trades_only", "auto"] as const;
    const riskProfile = typeof body.riskProfile === "string" ? body.riskProfile : undefined;
    const notifyPreference = typeof body.notifyPreference === "string" ? body.notifyPreference : undefined;
    const approvalMode = typeof body.approvalMode === "string" ? body.approvalMode : undefined;
    const cycleCount = typeof body.cycleCount === "number" ? body.cycleCount : undefined;
    const cyclePeriodMs = typeof body.cyclePeriodMs === "number" ? body.cyclePeriodMs : undefined;
    if (riskProfile && !validProfiles.includes(riskProfile as (typeof validProfiles)[number])) {
      return NextResponse.json({ error: "Invalid riskProfile", code: "INVALID_REQUEST" }, { status: 400 });
    }
    if (notifyPreference && !validNotify.includes(notifyPreference as (typeof validNotify)[number])) {
      return NextResponse.json({ error: "Invalid notifyPreference", code: "INVALID_REQUEST" }, { status: 400 });
    }
    if (approvalMode && !validApproval.includes(approvalMode as (typeof validApproval)[number])) {
      return NextResponse.json({ error: "Invalid approvalMode", code: "INVALID_REQUEST" }, { status: 400 });
    }
    if (cycleCount !== undefined && (!Number.isInteger(cycleCount) || cycleCount < -1 || cycleCount > 100)) {
      return NextResponse.json({ error: "Invalid cycleCount", code: "INVALID_REQUEST" }, { status: 400 });
    }
    if (cyclePeriodMs !== undefined && (!Number.isInteger(cyclePeriodMs) || cyclePeriodMs <= 0)) {
      return NextResponse.json({ error: "Invalid cyclePeriodMs", code: "INVALID_REQUEST" }, { status: 400 });
    }

    const patch: {
      agent?: Partial<UserRecord["agent"]>;
      telegram?: Partial<UserRecord["telegram"]>;
    } = {};
    const agentPatch: Partial<UserRecord["agent"]> = {};
    if (riskProfile) {
      agentPatch.riskProfile = riskProfile as UserRecord["agent"]["riskProfile"];
      agentPatch.maxTradePercent = deriveMaxTrade(riskProfile);
    }
    if (approvalMode) agentPatch.approvalMode = approvalMode as UserRecord["agent"]["approvalMode"];
    if (cycleCount !== undefined) {
      agentPatch.cycleCount = cycleCount;
      agentPatch.cyclesRemaining = cycleCount === -1 ? 0 : cycleCount;
      agentPatch.active = cycleCount !== 0;
    }
    if (cyclePeriodMs !== undefined) agentPatch.cyclePeriodMs = cyclePeriodMs;
    if (body.goal !== undefined) {
      if (typeof body.goal !== "string" || body.goal.trim().length > 280) {
        return NextResponse.json({ error: "Invalid goal", code: "INVALID_REQUEST" }, { status: 400 });
      }
      agentPatch.goal = body.goal.trim();
    }
    if (Object.keys(agentPatch).length > 0) patch.agent = agentPatch;
    if (notifyPreference) {
      patch.telegram = {
        notifyPreference: notifyPreference as UserRecord["telegram"]["notifyPreference"],
      };
    }
    const { updateUser } = await import("@/src/store/user-store");
    const updated = await updateUser(authenticatedUserId, patch);
    return NextResponse.json(sanitizeUser(updated));
  } catch (error) {
    return authErrorResponse(error, "legacy.configure");
  }
}
