// One-shot backfill: for every minted specialist iNFT, upload a real memory
// blob to 0G Storage and bind the resulting rootHash into the iNFT's
// `encryptedURIs[tokenId]` via the VaultMindAgent `updateMetadata` call.
//
// After this script runs, each specialist iNFT has a complete on-chain path:
//
//   marketplace_agents.inft_token_id
//     → VaultMindAgent.getAgent(tokenId)
//       → encryptedURIs[tokenId]    = "0g-storage://{rootHash}"
//       → metadataHashes[tokenId]   = keccak256(rootHash)
//       → 0G Storage indexer        → download(rootHash) → memory JSON
//
// Each memory blob contains:
//   - The specialist's SOUL.md (real or synthesized, hashed into soulHash at mint)
//   - Metadata (name, tags, wallet, iNFT#)
//   - Provenance (mint tx, storage timestamp, 0G Compute provider)
//
// Usage: npm run store:specialist-memory
//
// Idempotent: skips specialists that already have a storage_root_hash in the DB.
// Re-run safe — to force a re-upload, NULL the storage_root_hash column first.

import "dotenv/config";
import { readFileSync } from "node:fs";
import { getPrisma } from "../src/config/prisma";
import { storeMemory } from "../src/og/storage";
import { updateAgentMetadata } from "../src/og/inft";

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
    console.error("INFT_CONTRACT_ADDRESS not set — aborting");
    process.exit(1);
  }
  if (!process.env.OG_PRIVATE_KEY) {
    console.error("OG_PRIVATE_KEY not set — aborting");
    process.exit(1);
  }
  if (!process.env.OG_STORAGE_INDEXER) {
    console.error("OG_STORAGE_INDEXER not set — aborting");
    process.exit(1);
  }

  const prisma = getPrisma();
  const specialists = await prisma.marketplaceAgent.findMany({
    where: { active: true, inftTokenId: { not: null } },
    orderBy: { inftTokenId: "asc" },
  });
  console.log(
    `[store-specialist-memory] Found ${specialists.length} minted specialists\n`,
  );

  let stored = 0;
  let skipped = 0;
  let failed = 0;

  for (const spec of specialists) {
    const label = spec.name.padEnd(20);

    if (spec.storageRootHash) {
      console.log(`  ✓ ${label} already has 0G Storage root ${spec.storageRootHash.slice(0, 20)}…`);
      skipped++;
      continue;
    }
    if (spec.inftTokenId == null) {
      console.log(`  ⊘ ${label} not minted — skipped`);
      skipped++;
      continue;
    }

    try {
      const soulContent = loadSoul(spec.name, spec.tags, spec.specialistType ?? "");

      // The canonical per-specialist memory payload. Hashing this → the
      // soulHash+metadataHash already stored on-chain at mint time. Uploading
      // it → a real 0G Storage root that the iNFT points at.
      const memoryBlob = {
        type: "alphadawg-specialist-memory",
        version: 1,
        specialist: {
          name: spec.name,
          tags: spec.tags,
          dataSources: spec.dataSources,
          specialistType: spec.specialistType,
          price: spec.price,
          walletAddress: spec.walletAddress,
        },
        inft: {
          contract: process.env.INFT_CONTRACT_ADDRESS,
          tokenId: spec.inftTokenId,
          mintTxHash: spec.mintTxHash ?? null,
          chainId: 16602,
          chain: "0g-galileo-testnet",
        },
        soul: soulContent,
        reputation: {
          eloScore: spec.reputation,
          totalHires: spec.totalHires,
          correctCalls: spec.correctCalls,
        },
        provenance: {
          storedBy: "AlphaDawg specialist memory backfill",
          storedAt: new Date().toISOString(),
          ogComputeProvider: process.env.OG_PROVIDER_ADDRESS ?? null,
        },
      };

      console.log(`  ⏳ ${label} uploading memory blob to 0G Storage…`);
      const rootHash = await storeMemory(spec.name, memoryBlob);
      const storageUri = `0g-storage://${rootHash}`;

      console.log(`  ⏳ ${label} binding rootHash on iNFT #${spec.inftTokenId}…`);
      const updateTxHash = await updateAgentMetadata(spec.inftTokenId, rootHash);

      await prisma.marketplaceAgent.update({
        where: { name: spec.name },
        data: {
          storageRootHash: rootHash,
          storageUri,
        },
      });

      console.log(
        `  ★ ${label} iNFT #${spec.inftTokenId} → ${rootHash.slice(0, 18)}… (update tx ${updateTxHash.slice(0, 14)}…)`,
      );
      stored++;

      // 0G rate-limit buffer between txs
      await new Promise((r) => setTimeout(r, 3000));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  ✗ ${label} failed: ${msg.slice(0, 180)}`);
      failed++;
    }
  }

  console.log(
    `\n[store-specialist-memory] Done: ${stored} stored, ${skipped} skipped, ${failed} failed`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
