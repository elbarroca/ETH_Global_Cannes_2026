/**
 * Deep inspection of the latest cycle (which ran just before this session).
 * Validates:
 *   a) 0G Storage round-trip — can we loadMemory(storageHash) and get a rich record?
 *   b) HCS mirror node — does the latest topic message contain `g` (goal) + `sh` (CID)?
 *   c) agent_actions join — do we have SPECIALIST_HIRED rows with the right shape?
 *   d) /api/cycle/latest enrichment shape — what does the route currently return?
 *
 * Usage: npx tsx scripts/inspect-cycle-29.ts
 */
import "dotenv/config";
import { getPrisma } from "../src/config/prisma";
import { loadMemory } from "../src/og/storage";

const MIRROR = "https://testnet.mirrornode.hedera.com/api/v1";

async function main() {
  const prisma = getPrisma();

  const cycle = await prisma.cycle.findFirst({
    orderBy: { createdAt: "desc" },
    include: {
      actions: {
        where: { actionType: "SPECIALIST_HIRED" },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!cycle) throw new Error("no cycles found");
  console.log(`Inspecting cycle #${cycle.cycleNumber} (${cycle.id})`);
  console.log(`  goal:        ${cycle.goal}`);
  console.log(`  storageHash: ${cycle.storageHash}`);
  console.log(`  hcsSeqNum:   ${cycle.hcsSeqNum}`);
  console.log(`  hashscanUrl: ${cycle.hashscanUrl}`);
  console.log(`  payments:    ${JSON.stringify(cycle.payments)}`);
  console.log();

  console.log("═══ a) 0G Storage round-trip ═══");
  if (!cycle.storageHash) {
    console.log("  ⏭  no storage hash, skipping");
  } else {
    try {
      const rich = await loadMemory(cycle.storageHash) as {
        userId?: string;
        data?: {
          version?: number;
          cycleId?: number;
          goal?: string;
          specialists?: Array<{ name: string; hiredBy?: string; paymentTxHash?: string; attestationHash?: string }>;
          debate?: unknown;
          payments?: Array<unknown>;
          swap?: unknown;
        };
      };
      console.log(`  ✅ downloaded from 0G indexer`);
      console.log(`     userId (wrapper): ${rich.userId}`);
      const d = rich.data ?? {};
      console.log(`     version: ${d.version}`);
      console.log(`     cycleId: ${d.cycleId}`);
      console.log(`     goal: "${d.goal}"`);
      console.log(`     specialists: ${d.specialists?.length ?? 0} (has hiredBy: ${d.specialists?.some((s) => s.hiredBy != null) ?? false})`);
      console.log(`     payments: ${d.payments?.length ?? 0}`);
      console.log(`     debate? ${d.debate != null}`);
      console.log(`     swap? ${d.swap != null}`);
      if (d.specialists && d.specialists.length > 0) {
        console.log(`     sample specialist: ${JSON.stringify(d.specialists[0])}`);
      }
      if (d.payments && d.payments.length > 0) {
        console.log(`     sample payment: ${JSON.stringify(d.payments[0])}`);
      }
      const looksLikeCompact = "c" in (d as Record<string, unknown>) && "adv" in (d as Record<string, unknown>);
      if (looksLikeCompact) {
        console.log(`  ⚠️  the stored record looks like a CompactCycleRecord, not a RichCycleRecord`);
        console.log(`     (this means commitCycle stored the compact version — rich record wasn't built)`);
      }
    } catch (err) {
      console.log(`  ❌ 0G fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log();

  console.log("═══ b) HCS mirror node ═══");
  const topicId = process.env.HCS_AUDIT_TOPIC_ID;
  if (!topicId) {
    console.log("  ⏭  HCS_AUDIT_TOPIC_ID not set");
  } else {
    try {
      const url = `${MIRROR}/topics/${topicId}/messages?limit=5&order=desc`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`mirror node ${res.status}`);
      const body = (await res.json()) as { messages: Array<{ sequence_number: number; consensus_timestamp: string; message: string }> };
      console.log(`  ✅ fetched ${body.messages.length} most recent messages`);
      for (const msg of body.messages.slice(0, 3)) {
        const decoded = Buffer.from(msg.message, "base64").toString("utf8");
        try {
          const parsed = JSON.parse(decoded) as Record<string, unknown>;
          const keys = Object.keys(parsed);
          const hasGoal = "g" in parsed;
          const hasSh = "sh" in parsed;
          console.log(`    seq=${msg.sequence_number} keys=[${keys.join(",")}] g=${hasGoal} sh=${hasSh}`);
          if (hasGoal) console.log(`      g: "${parsed.g}"`);
          if (hasSh) console.log(`      sh: ${parsed.sh}`);
          if (msg.sequence_number === cycle.hcsSeqNum) {
            console.log(`      ← this matches cycle #${cycle.cycleNumber}`);
          }
        } catch {
          console.log(`    seq=${msg.sequence_number} (could not decode JSON)`);
        }
      }
    } catch (err) {
      console.log(`  ❌ mirror node failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log();

  console.log("═══ c) agent_actions SPECIALIST_HIRED join ═══");
  console.log(`  ${cycle.actions.length} SPECIALIST_HIRED rows linked to cycle #${cycle.cycleNumber}`);
  const byHirer = new Map<string, number>();
  for (const a of cycle.actions) {
    const p = (a.payload ?? {}) as { hiredBy?: string };
    byHirer.set(p.hiredBy ?? "—", (byHirer.get(p.hiredBy ?? "—") ?? 0) + 1);
  }
  console.log(`  by hiredBy:`);
  for (const [k, v] of byHirer) console.log(`    ${k}: ${v}`);
  if (cycle.actions[0]) {
    const a = cycle.actions[0];
    console.log(
      `  sample: agent=${a.agentName} tx=${a.paymentTxHash} att=${a.attestationHash?.slice(0, 10)} payload=${JSON.stringify(a.payload).slice(0, 120)}`,
    );
  }
  console.log();

  console.log("═══ d) enrichCycleRow() output shape ═══");
  const { enrichCycleRow } = await import("../src/store/enrich-cycle");
  const enriched = await enrichCycleRow(cycle);
  console.log(`  cycleId: ${enriched.cycleId}`);
  console.log(`  goal: "${enriched.goal}"`);
  console.log(`  specialists: ${enriched.specialists.length} (hiredBy distinct: ${[...new Set(enriched.specialists.map((s) => s.hiredBy))].join(",")})`);
  console.log(`  payments: ${enriched.payments.length}`);
  console.log(`  debate.alpha: ${enriched.debate.alpha.action} ${enriched.debate.alpha.pct}%`);
  console.log(`  debate.risk: max ${enriched.debate.risk.maxPct}%`);
  console.log(`  debate.executor: ${enriched.debate.executor.action} ${enriched.debate.executor.pct}%`);
  console.log(`  swap? ${enriched.swap != null}`);
  console.log(`  storageHash: ${enriched.storageHash}`);
  console.log(`  hashscanUrl: ${enriched.hashscanUrl}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
