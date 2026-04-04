import dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";
import { readFileSync } from "node:fs";

const RPC = process.env.HEDERA_JSON_RPC_URL ?? "https://testnet.hashio.io/api";

/**
 * Deploys AlphaDawgAuditLog.sol to Hedera Testnet EVM.
 *
 * Prerequisites:
 *   1. Run `npx hardhat compile` first
 *   2. Set HEDERA_EVM_PRIVATE_KEY in .env (ECDSA key from setup-hedera-evm.ts)
 */
async function main(): Promise<void> {
  const key = process.env.HEDERA_EVM_PRIVATE_KEY;
  if (!key) {
    console.error("ERROR: Set HEDERA_EVM_PRIVATE_KEY in .env");
    console.error("Run: npx tsx scripts/setup-hedera-evm.ts");
    process.exit(1);
  }

  const pk = key.startsWith("0x") ? key : `0x${key}`;
  const provider = new ethers.JsonRpcProvider(RPC);
  const deployer = new ethers.Wallet(pk, provider);

  console.log("Deployer:", deployer.address);

  // Check balance via Mirror Node (JSON-RPC relay may not resolve the alias immediately)
  const accountId = process.env.HEDERA_EVM_ACCOUNT_ID;
  if (accountId) {
    try {
      const balRes = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/balances?account.id=${accountId}`);
      const balData = await balRes.json() as { balances?: Array<{ balance: number }> };
      const tinybar = balData.balances?.[0]?.balance ?? 0;
      console.log("Balance:", (tinybar / 1e8).toFixed(2), "HBAR (via mirror node)");
      if (tinybar === 0) {
        console.error("ERROR: No HBAR. Fund the account first.");
        process.exit(1);
      }
    } catch {
      console.warn("Could not check balance via mirror node, proceeding anyway...");
    }
  }

  // Load compiled artifact
  const artifact = JSON.parse(
    readFileSync("./artifacts/contracts/AlphaDawgAuditLog.sol/AlphaDawgAuditLog.json", "utf-8"),
  );

  // Deploy
  console.log("\nDeploying AlphaDawgAuditLog to Hedera Testnet EVM...");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);

  // Hedera EVM needs explicit gas limit
  const contract = await factory.deploy({ gasLimit: 3_000_000 });
  await contract.waitForDeployment();
  const contractAddr = await contract.getAddress();

  console.log("AlphaDawgAuditLog deployed:", contractAddr);

  // Verify with a test event
  console.log("\nEmitting test HeartbeatEmitted event...");
  const auditLog = new ethers.Contract(contractAddr, artifact.abi, deployer);
  const tx = await auditLog.emitHeartbeat(0, { gasLimit: 100_000 });
  await tx.wait();
  console.log("Test event emitted, tx:", tx.hash);

  // Print .env values
  console.log("\n════════════════════════════════════════");
  console.log("Add to .env:");
  console.log(`NARYO_AUDIT_CONTRACT_ADDRESS=${contractAddr}`);
  console.log("════════════════════════════════════════");
  console.log(`\nHashscan: https://hashscan.io/testnet/contract/${contractAddr}`);
}

main().catch((err) => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
