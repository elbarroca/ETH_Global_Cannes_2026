import { NextResponse } from "next/server";
import { getLeaderboard } from "@/src/marketplace/reputation";
import { discoverSpecialists } from "@/src/marketplace/registry";

export async function GET() {
  try {
    const [leaderboard, available] = await Promise.all([
      getLeaderboard(10),
      discoverSpecialists(),
    ]);

    const agents = leaderboard.map((entry) => {
      const spec = available.find((a) => a.name === entry.name);
      return {
        name: entry.name,
        reputation: entry.reputation,
        accuracy: entry.accuracy,
        totalHires: entry.totalHires,
        tags: spec?.tags ?? [],
        price: spec?.price ?? "$0.001",
        active: !!spec,
        walletAddress: spec?.walletAddress,
      };
    });

    return NextResponse.json({ agents });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
