import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  registerEntitySecretCiphertext,
  initiateDeveloperControlledWalletsClient,
} from "@circle-fin/developer-controlled-wallets";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "..", "output");

async function main() {
  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey) throw new Error("CIRCLE_API_KEY not set in .env");

  const entitySecret = process.env.CIRCLE_ENTITY_SECRET ?? crypto.randomBytes(32).toString("hex");
  const isNew = !process.env.CIRCLE_ENTITY_SECRET;

  // Step 1 — register entity secret (skip gracefully if already registered)
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log("Registering entity secret...");
  try {
    await registerEntitySecretCiphertext({
      apiKey,
      entitySecret,
      recoveryFileDownloadPath: OUTPUT_DIR,
    });
    console.log("✅ Entity secret registered. Recovery file saved to ./output/");
  } catch (err: unknown) {
    const code = (err as { code?: number }).code;
    if (code === 156015) {
      console.log("ℹ️  Entity secret already registered — continuing.");
    } else {
      throw err;
    }
  }

  // Step 2 — create wallet set
  console.log("\nCreating VaultMind wallet set...");
  const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
  const res = await client.createWalletSet({ name: "VaultMind Agents" });
  const id = res.data?.walletSet?.id;
  if (!id) {
    console.error("Failed:", JSON.stringify(res, null, 2));
    process.exit(1);
  }

  console.log("\n✅ Done! Add these to your .env:\n");
  if (isNew) console.log(`CIRCLE_ENTITY_SECRET=${entitySecret}`);
  console.log(`CIRCLE_WALLET_SET_ID=${id}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
