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
      goal?: string;
    };

    const { userId, riskProfile, notifyPreference, approvalMode, cycleCount, cyclePeriodMs, goal } = body;

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

    if (cycleCount != null && cycleCount >= -1) {
      agentPatch.cycleCount = cycleCount;
      // The AUTO-HUNT dropdown on the dashboard is the single source of truth
      // for enrolling the user in the heartbeat loop. Three modes:
      //   cycleCount === -1  → INFINITE (run forever every `cyclePeriodMs`,
      //                        `cyclesRemaining` is unused)
      //   cycleCount  >  0   → BOUNDED (heartbeat decrements once per commit,
      //                        pauses when cyclesRemaining hits 0)
      //   cycleCount === 0   → OPT OUT (active=false, heartbeat skips user)
      // The deposit route no longer flips `active`, so this is the ONLY place
      // (besides Telegram /stop which sets active=false) where `active` is
      // mutated.
      if (cycleCount === -1) {
        // Infinite mode — clear the budget so the heartbeat only checks
        // `cycleCount === -1` and never a stale `cyclesRemaining` value.
        agentPatch.cyclesRemaining = 0;
      } else {
        agentPatch.cyclesRemaining = cycleCount;
      }
      agentPatch.active = cycleCount !== 0;
    }

    if (cyclePeriodMs != null && cyclePeriodMs > 0) {
      agentPatch.cyclePeriodMs = cyclePeriodMs;
    }

    // Persistent per-user hunt goal. Empty string clears the saved value
    // (fall back to risk-profile template). Non-empty is trimmed + length-
    // capped so specialist prompts can't be spam-stuffed.
    if (goal != null) {
      const trimmed = String(goal).trim();
      if (trimmed.length > 280) {
        return NextResponse.json(
          { error: "goal must be 280 characters or fewer" },
          { status: 400 },
        );
      }
      agentPatch.goal = trimmed;
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
