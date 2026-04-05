/**
 * scripts/fire-naryo-og-proof.ts
 *
 * Emits a single MetadataUpdated event on the VaultMindAgent iNFT
 * contract (0G Chain). The Naryo og-chain-node polls 0G blocks every
 * 5s, its og-metadata-filter matches this event, and the og-metadata
 * broadcaster POSTs the decoded event to:
 *
 *   http://host.docker.internal:3000/api/naryo/events/og-metadata
 *
 * After this runs, GET /api/naryo/feed should flip from
 * pipeline:"mirror" to pipeline:"buffer+db" with source:"og-metadata".
 *
 * Usage:
 *   npx tsx scripts/fire-naryo-og-proof.ts [tokenId]
 */
import "dotenv/config";
import { updateAgentMetadata, getAgentInfo } from "../src/og/inft.js";

async function main() {
  const tokenId = Number(process.argv[2] ?? 1);
  console.log(`[naryo-proof] Looking up tokenId=${tokenId} on 0G Chain...`);
  const info = await getAgentInfo(tokenId);
  if (!info) {
    console.error(`[naryo-proof] No agent at tokenId=${tokenId}. Try a different id.`);
    process.exit(1);
  }
  console.log(`[naryo-proof] Found: owner=${info.owner.slice(0, 10)}... cycles=${info.cycles}`);

  const proofTag = `naryo-ship-proof-${Date.now()}`;
  console.log(`[naryo-proof] Calling updateAgentMetadata(${tokenId}, "${proofTag}")...`);
  const txHash = await updateAgentMetadata(tokenId, proofTag);
  console.log(`[naryo-proof] tx=${txHash}`);
  console.log(`[naryo-proof] Wait ~5-10s then: curl http://localhost:3000/api/naryo/feed`);
}

main().catch((e) => {
  console.error("[naryo-proof] Failed:", e);
  process.exit(1);
});
