import "dotenv/config";
import { ethers } from "ethers";
import { getAllUsers, updateUser } from "../src/store/user-store";
import { mintAgentNFT, getAgentByWallet } from "../src/og/inft";

async function main() {
  if (!process.env.INFT_CONTRACT_ADDRESS) {
    console.error("INFT_CONTRACT_ADDRESS not set in .env — aborting");
    process.exit(1);
  }

  const users = await getAllUsers();
  console.log(`[backfill-inft] Found ${users.length} users`);

  let minted = 0;
  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    const label = `${user.walletAddress.slice(0, 10)}...`;

    if (user.inftTokenId) {
      console.log(`  ✓ ${label} already has iNFT #${user.inftTokenId}`);
      skipped++;
      continue;
    }

    // Skip users with invalid proxy wallet addresses (test/placeholder data)
    if (!user.proxyWallet.address || !/^0x[0-9a-fA-F]{40}$/.test(user.proxyWallet.address)) {
      console.log(`  ⊘ ${label} invalid proxy wallet "${user.proxyWallet.address?.slice(0, 16)}..." — skipped`);
      skipped++;
      continue;
    }

    try {
      // Check if already minted on-chain (prevents duplicate mints)
      const existingTokenId = await getAgentByWallet(user.proxyWallet.address);
      if (existingTokenId > 0) {
        await updateUser(user.id, { inftTokenId: existingTokenId });
        console.log(`  ↻ ${label} found on-chain iNFT #${existingTokenId} — synced to DB`);
        synced++;
        continue;
      }

      // Mint new iNFT — normalize addresses to prevent ethers ENS resolution on 0G Chain
      const { tokenId, txHash } = await mintAgentNFT(
        ethers.getAddress(user.walletAddress),
        ethers.getAddress(user.proxyWallet.address),
        user.agent.riskProfile,
      );

      if (tokenId > 0) {
        await updateUser(user.id, { inftTokenId: tokenId });
        console.log(`  ★ ${label} minted iNFT #${tokenId} tx=${txHash.slice(0, 16)}...`);
        minted++;
      } else {
        console.warn(`  ✗ ${label} mint returned tokenId=0`);
        failed++;
      }
    } catch (err) {
      console.warn(`  ✗ ${label} failed:`, err instanceof Error ? err.message : String(err));
      failed++;
    }

    // 2s delay between mints to respect 0G rate limits (30 req/min)
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log(`\n[backfill-inft] Done: ${minted} minted, ${synced} synced, ${skipped} skipped, ${failed} failed`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
