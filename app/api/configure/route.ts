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
    const { userId, riskProfile, notifyPreference } = (await request.json()) as {
      userId?: string;
      riskProfile?: string;
      notifyPreference?: string;
    };

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

    const patch: {
      agent?: Partial<UserRecord["agent"]>;
      telegram?: Partial<UserRecord["telegram"]>;
    } = {};

    if (riskProfile) {
      patch.agent = {
        riskProfile: riskProfile as UserRecord["agent"]["riskProfile"],
        maxTradePercent: deriveMaxTrade(riskProfile),
      };
    }

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
