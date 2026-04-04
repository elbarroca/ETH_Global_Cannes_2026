import { type NextRequest, NextResponse } from "next/server";
import { updateUser } from "@/src/store/user-store";
import type { UserRecord } from "@/src/types/index";

function deriveMaxTrade(riskProfile: string): number {
  if (riskProfile === "conservative") return 5;
  if (riskProfile === "aggressive") return 25;
  return 12;
}

function sanitizeUser(user: UserRecord) {
  const { proxyWallet, ...rest } = user;
  return { ...rest, proxyWalletAddress: proxyWallet.address };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      riskProfile?: string;
      notifyPreference?: string;
      approvalMode?: string;
      cycleCount?: number;
      cyclePeriodMs?: number;
    };

    const { userId, riskProfile, notifyPreference, approvalMode, cycleCount, cyclePeriodMs } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const validProfiles = ["conservative", "balanced", "aggressive"];
    if (riskProfile && !validProfiles.includes(riskProfile)) {
      return NextResponse.json({ error: `riskProfile must be one of: ${validProfiles.join(", ")}` }, { status: 400 });
    }

    const validNotify = ["every_cycle", "trades_only", "daily"];
    if (notifyPreference && !validNotify.includes(notifyPreference)) {
      return NextResponse.json({ error: `notifyPreference must be one of: ${validNotify.join(", ")}` }, { status: 400 });
    }

    const validApproval = ["always", "trades_only", "auto"];
    if (approvalMode && !validApproval.includes(approvalMode)) {
      return NextResponse.json({ error: `approvalMode must be one of: ${validApproval.join(", ")}` }, { status: 400 });
    }

    const patch: {
      agent?: Partial<UserRecord["agent"]>;
      telegram?: Partial<UserRecord["telegram"]>;
    } = {};

    // Agent config
    const agentPatch: Partial<UserRecord["agent"]> = {};

    if (riskProfile) {
      agentPatch.riskProfile = riskProfile as UserRecord["agent"]["riskProfile"];
      agentPatch.maxTradePercent = deriveMaxTrade(riskProfile);
    }

    if (approvalMode) {
      agentPatch.approvalMode = approvalMode as UserRecord["agent"]["approvalMode"];
    }

    if (cycleCount != null && cycleCount >= 0) {
      agentPatch.cycleCount = cycleCount;
      agentPatch.cyclesRemaining = cycleCount;
    }

    if (cyclePeriodMs != null && cyclePeriodMs > 0) {
      agentPatch.cyclePeriodMs = cyclePeriodMs;
    }

    if (Object.keys(agentPatch).length > 0) {
      patch.agent = agentPatch;
    }

    // Telegram config
    if (notifyPreference) {
      patch.telegram = {
        notifyPreference: notifyPreference as UserRecord["telegram"]["notifyPreference"],
      };
    }

    const updated = await updateUser(userId, patch);
    return NextResponse.json(sanitizeUser(updated));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
