import "dotenv/config";
import { getPrisma } from "../src/config/prisma";
import { deriveSpecialistAddress } from "../src/config/wallets";

const SPECIALIST_INDEX: Record<string, number> = {
  "sentiment": 0,
  "whale": 1,
  "momentum": 2,
  "memecoin-hunter": 3,
  "twitter-alpha": 4,
  "defi-yield": 5,
  "news-scanner": 6,
  "onchain-forensics": 7,
  "options-flow": 8,
  "macro-correlator": 9,
};

async function main() {
  const prisma = getPrisma();
  const agents = await prisma.marketplaceAgent.findMany();
  console.log(`[wallets] Found ${agents.length} marketplace agents`);

  let updated = 0;
  for (const agent of agents) {
    const specIndex = SPECIALIST_INDEX[agent.name];
    if (specIndex === undefined) {
      console.log(`  ? ${agent.name} — no index mapping, skipped`);
      continue;
    }

    const walletAddress = deriveSpecialistAddress(specIndex);

    if (agent.walletAddress === walletAddress) {
      console.log(`  ✓ ${agent.name} already has wallet ${walletAddress.slice(0, 10)}...`);
      continue;
    }

    try {
      await prisma.marketplaceAgent.update({
        where: { id: agent.id },
        data: { walletAddress },
      });
      console.log(`  → ${agent.name} wallet set to ${walletAddress.slice(0, 10)}...`);
      updated++;
    } catch (err) {
      console.warn(`  ✗ ${agent.name} update failed:`, err instanceof Error ? err.message : String(err));
    }
  }

  console.log(`\n[wallets] Done: ${updated} updated, ${agents.length - updated} skipped`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
