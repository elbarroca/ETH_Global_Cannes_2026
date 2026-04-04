import { NextResponse } from "next/server";
import { getLeaderboard } from "@/src/marketplace/reputation";
import { discoverSpecialists } from "@/src/marketplace/registry";
import { getPrisma } from "@/src/config/prisma";

export async function GET() {
  try {
    const prisma = getPrisma();
    const [leaderboard, available, hireRows, chainRows] = await Promise.all([
      getLeaderboard(10),
      discoverSpecialists(),
      // Per-agent aggregate: most recent SPECIALIST_HIRED plus paid-hire count.
      // Keyed by agent name so the downstream map() lookup is O(1).
      prisma.agentAction.groupBy({
        by: ["agentName"],
        where: { actionType: "SPECIALIST_HIRED" },
        _max: { createdAt: true },
        _count: { _all: true },
      }),
      // Real on-chain metadata: iNFT token id + wallet + 0G Storage root hash.
      // Every specialist has all three populated after the mint/store backfill:
      //   · inftTokenId  → ERC-7857 token on VaultMindAgent (0G Chain)
      //   · walletAddress → HD-derived receive wallet on Arc (x402 payout)
      //   · storageRootHash → 0G Storage Merkle root bound via updateMetadata
      prisma.marketplaceAgent.findMany({
        select: {
          name: true,
          inftTokenId: true,
          walletAddress: true,
          storageRootHash: true,
          storageUri: true,
        },
      }),
    ]);

    const hireByName = new Map<string, { lastHireAt: Date | null; hires: number }>();
    for (const row of hireRows) {
      if (!row.agentName) continue;
      hireByName.set(row.agentName, {
        lastHireAt: row._max.createdAt,
        hires: row._count._all,
      });
    }

    const chainByName = new Map<string, {
      inftTokenId: number | null;
      walletAddress: string | null;
      storageRootHash: string | null;
      storageUri: string | null;
    }>();
    for (const row of chainRows) {
      chainByName.set(row.name, {
        inftTokenId: row.inftTokenId,
        walletAddress: row.walletAddress,
        storageRootHash: row.storageRootHash,
        storageUri: row.storageUri,
      });
    }

    const agents = leaderboard.map((entry) => {
      const spec = available.find((a) => a.name === entry.name);
      const hire = hireByName.get(entry.name);
      const chain = chainByName.get(entry.name);
      return {
        name: entry.name,
        reputation: entry.reputation,
        accuracy: entry.accuracy,
        totalHires: entry.totalHires,
        tags: spec?.tags ?? [],
        price: spec?.price ?? "$0.001",
        active: !!spec,
        walletAddress: chain?.walletAddress ?? spec?.walletAddress ?? null,
        inftTokenId: chain?.inftTokenId ?? null,
        storageRootHash: chain?.storageRootHash ?? null,
        storageUri: chain?.storageUri ?? null,
        lastHireAt: hire?.lastHireAt ? hire.lastHireAt.toISOString() : null,
        recentHires: hire?.hires ?? 0,
      };
    });

    return NextResponse.json({ agents });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
