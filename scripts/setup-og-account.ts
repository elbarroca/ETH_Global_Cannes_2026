import dotenv from "dotenv";
dotenv.config();

import { getBroker } from "../src/config/og-compute.js";

const PROVIDER = process.env.OG_PROVIDER_ADDRESS!;

async function main(): Promise<void> {
  console.log("Setting up 0G compute account...");
  const broker = await getBroker();

  // Deposit funds to ledger
  console.log("Depositing 10 to ledger...");
  await broker.ledger.depositFund(10);
  console.log("Deposit complete.");

  // Transfer to provider for inference
  console.log(`Transferring to provider ${PROVIDER}...`);
  await broker.ledger.transferFund(PROVIDER, "inference", BigInt(3) * BigInt(10 ** 18));
  console.log("Transfer complete.");

  // List available services
  console.log("\nAvailable providers:");
  const services = await broker.inference.listService();
  for (const svc of services) {
    console.log(`  ${svc.provider} — ${svc.model}`);
  }

  console.log("\nDone. Set OG_PROVIDER_ADDRESS in .env if needed.");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
