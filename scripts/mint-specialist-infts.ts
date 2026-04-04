// One-shot backfill: mint one ERC-7857 iNFT on the VaultMindAgent contract
// for every active row in `marketplace_agents` that doesn't have an
// inft_token_id yet. Each specialist iNFT is self-owning — the specialist's
// HD-derived wallet is both the NFT owner and the bound `agentWallet`.
//
// Idempotent: pre-checks `walletToToken` on-chain before minting. If a
// specialist is already minted (e.g., from a previous run), we just sync
// the tokenId back to the DB without spending gas.
//
// Usage: npm run mint:specialist-infts
//
// Prerequisites:
//   - OG_PRIVATE_KEY set in .env (deployer key, has contract owner role)
//   - INFT_CONTRACT_ADDRESS set in .env (VaultMindAgent at 0x73e3016D0…)
//   - marketplace_agents rows have wallet_address populated

import "dotenv/config";
import { readFileSync } from "node:fs";
import { getPrisma } from "../src/config/prisma";
import { mintSpecialistNFT, getAgentByWallet } from "../src/og/inft";

/**
 * Synthesize a fallback SOUL.md for specialists that don't have one yet.
 * The returned string is hashed into `soulHash` on-chain — it permanently
 * binds this iNFT to this personality blob, even if we later author a real
 * SOUL.md file. Keep it stable across runs for the same (name, tags) tuple.
 */
function synthesizeSoul(name: string, tags: readonly string[], skill: string): string {
  const tagLine = tags.length > 0 ? tags.join(", ") : "general analysis";
  return [
    `# ${name} — AlphaDawg specialist`,
    ``,
    `## Identity`,
    `I am ${name}, a ${skill || "market analysis"} specialist in the AlphaDawg swarm.`,
    ``,
    `## Tags`,
    tagLine,
    ``,
    `## Mission`,
    `I provide ${skill || "market signals"} to the Lead Dawg orchestrator via x402 nanopayments.`,
    `Every inference I return is sealed inside a TEE and attested on 0G Compute.`,
    ``,
    `## Economics`,
    `Price per call: $0.001 USDC via x402 on Arc.`,
    `My wallet accumulates earnings as my reputation grows.`,
    ``,
  ].join("\n");
}

function loadSoul(name: string, tags: readonly string[], skill: string): string {
  try {
    return readFileSync(`./openclaw/${name}-agent/SOUL.md`, "utf-8");
  } catch {
    return synthesizeSoul(name, tags, skill);
  }
}

async function main(): Promise<void> {
  if (!process.env.INFT_CONTRACT_ADDRESS) {
    console.error("INFT_CONTRACT_ADDRESS not set in .env — aborting");
    process.exit(1);
  }
  if (!process.env.OG_PRIVATE_KEY) {
    console.error("OG_PRIVATE_KEY not set in .env — aborting");
    process.exit(1);
  }

  const prisma = getPrisma();
  const specialists = await prisma.marketplaceAgent.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  console.log(`[mint-specialist-infts] Found ${specialists.length} active specialists\n`);

  let minted = 0;
  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const spec of specialists) {
    const label = spec.name.padEnd(20);

    if (spec.inftTokenId != null) {
      console.log(`  ✓ ${label} already has iNFT #${spec.inftTokenId} in DB`);
      skipped++;
      continue;
    }

    if (!spec.walletAddress || !/^0x[0-9a-fA-F]{40}$/.test(spec.walletAddress)) {
      console.log(`  ⊘ ${label} missing/invalid walletAddress — skipped`);
      skipped++;
      continue;
    }

    try {
      // Idempotency: if the on-chain contract already has this wallet bound,
      // don't mint a duplicate — just sync the tokenId into Supabase.
      const existingTokenId = await getAgentByWallet(spec.walletAddress);
      if (existingTokenId > 0) {
        await prisma.marketplaceAgent.update({
          where: { name: spec.name },
          data: { inftTokenId: existingTokenId },
        });
        console.log(`  ↻ ${label} already on-chain as iNFT #${existingTokenId} — synced DB`);
        synced++;
        continue;
      }

      const soulContent = loadSoul(spec.name, spec.tags, spec.specialistType ?? "");

      const { tokenId, txHash } = await mintSpecialistNFT(
        spec.name,
        spec.walletAddress,
        soulContent,
        {
          name: spec.name,
          tags: spec.tags,
          walletAddress: spec.walletAddress,
          skill: spec.specialistType ?? "",
          specialistType: "AlphaDawg specialist",
        },
      );

      await prisma.marketplaceAgent.update({
        where: { name: spec.name },
        data: { inftTokenId: tokenId },
      });

      console.log(
        `  ★ ${label} minted iNFT #${tokenId} tx=${txHash.slice(0, 20)}...`,
      );
      minted++;

      // 0G rate-limit buffer between sequential tx submissions
      await new Promise((r) => setTimeout(r, 3000));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  ✗ ${label} failed: ${msg.slice(0, 160)}`);
      failed++;
    }
  }

  console.log(
    `\n[mint-specialist-infts] Done: ${minted} minted, ${synced} synced, ${skipped} skipped, ${failed} failed`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
