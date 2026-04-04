import "dotenv/config";
import { getAllUsers, updateUser } from "../src/store/user-store";

async function main() {
  const users = await getAllUsers();
  console.log(`[auto-approve] Found ${users.length} users`);

  let updated = 0;
  for (const user of users) {
    if (user.agent.approvalMode === "auto") {
      console.log(`  ✓ ${user.walletAddress.slice(0, 10)}... already auto`);
      continue;
    }
    try {
      await updateUser(user.id, { agent: { approvalMode: "auto" } });
      console.log(`  → ${user.walletAddress.slice(0, 10)}... set to auto (was "${user.agent.approvalMode}")`);
      updated++;
    } catch (err) {
      console.warn(`  ✗ ${user.walletAddress.slice(0, 10)}... failed:`, err instanceof Error ? err.message : String(err));
    }
  }

  console.log(`\n[auto-approve] Done: ${updated} updated, ${users.length - updated} skipped`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
