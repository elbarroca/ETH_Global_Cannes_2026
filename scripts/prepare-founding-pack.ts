import postgres from "postgres";
import { FOUNDING_PACK } from "../src/agents/founding-pack";
import { isLoopbackDatabaseUrl } from "../src/config/env";
import { parseEnsBinding } from "../src/kernel/policy";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

async function main(): Promise<void> {
  if (process.argv.some((argument) => argument === "--apply" || argument.startsWith("--apply="))) {
    throw new Error("FOUNDING_PACK_APPLY_FORBIDDEN");
  }
  const databaseUrl = required("DATABASE_URL");
  if (!isLoopbackDatabaseUrl(databaseUrl)) throw new Error("FOUNDING_PACK_LOOPBACK_DATABASE_REQUIRED");
  const creatorUserId = required("FOUNDING_CREATOR_USER_ID");
  const creatorWallet = required("FOUNDING_CREATOR_WALLET").toLowerCase();
  const creatorParent = required("FOUNDING_CREATOR_PARENT");
  parseEnsBinding({ creatorParent, agentLabel: "founding-dry-run" });

  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    const creator = await sql.begin(async (transaction) => {
      await transaction`SET TRANSACTION READ ONLY`;
      const rows = await transaction<{ present: number }[]>`
        SELECT 1::int AS present FROM users
        WHERE id = ${creatorUserId} AND wallet_address = ${creatorWallet}
        LIMIT 1
      `;
      return rows[0] ?? null;
    });
    if (!creator) throw new Error("FOUNDING_CREATOR_NOT_ONBOARDED");

    const payloads = FOUNDING_PACK.templates.flatMap((template, index) => {
      const suffix = String(index + 1).padStart(2, "0");
      const versionRef = `<versionId:${template.id}>`;
      const label = `${template.id}-${suffix}`;
      return [
        {
          order: index * 4 + 1,
          idempotencyKey: `founding:${template.id}:draft`,
          payload: {
            action: "CREATE_DRAFT",
            templateId: template.id,
            name: template.name,
            description: `Founding ${template.name} protected catalog version.`,
          },
        },
        {
          order: index * 4 + 2,
          idempotencyKey: `founding:${template.id}:bind`,
          payload: { action: "BIND_NAME", versionId: versionRef, creatorParent, agentLabel: label },
        },
        {
          order: index * 4 + 3,
          idempotencyKey: `founding:${template.id}:prepare`,
          payload: { action: "PREPARE_ENS_WRITE", versionId: versionRef },
        },
        {
          order: index * 4 + 4,
          idempotencyKey: `founding:${template.id}:publish`,
          payload: { action: "PUBLISH_VERSION", versionId: versionRef },
        },
      ];
    });
    process.stdout.write(`${JSON.stringify({ mode: "DRY_RUN", payloads }, null, 2)}\n`);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "FOUNDING_PACK_DRY_RUN_FAILED"}\n`);
  process.exitCode = 1;
});
