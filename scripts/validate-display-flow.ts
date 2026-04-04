/**
 * End-to-end validation of the "Surface the Agent Hiring Economy in the UI" refactor.
 *
 * Runs a REAL cycle against the live Fly.io swarm + 0G + HCS + Supabase,
 * then asserts every new field lands correctly:
 *   1. Swarm reachability (13 Fly.io /healthz + /analyze 200)
 *   2. DB schema — cycles.goal/payments + pending_cycles.goal/rich_record
 *   3. runCycle() with a USER-AUTHORED goal → CycleResult contains goal, payments, swap
 *   4. Prisma cycle row contains goal, payments JSON, storageHash, hcsSeqNum
 *   5. 0G loadMemory(storageHash) round-trips a RichCycleRecord
 *   6. HCS mirror record contains `g` (goal) and `sh` (storageHash CID)
 *   7. /api/cycle/latest returns EnrichedCycleResponse with all fields
 *
 * Environment overrides AGENT_URL_* to the live Fly.io swarm BEFORE importing
 * backend modules, so the backend hits the hosted agents regardless of any
 * local specialist servers that may be running on ports 4001-4010.
 *
 * Usage:
 *   DASHBOARD_URL=http://localhost:3000 npx tsx scripts/validate-display-flow.ts
 *   or
 *   npx tsx scripts/validate-display-flow.ts --user=<userId> --goal="Find a safe ETH entry"
 */

// STEP 0 — Override AGENT_URL_* env vars BEFORE any backend import reads them.
// The agent-registry reads process.env the first time it's imported, so this
// override MUST happen before the runCycle / getPrisma imports below.
const FLY_URLS: Record<string, string> = {
  SENTIMENT: "https://vm-sentiment.fly.dev",
  WHALE: "https://vm-whale.fly.dev",
  MOMENTUM: "https://vm-momentum.fly.dev",
  MEMECOIN_HUNTER: "https://vm-memecoin-hunter.fly.dev",
  TWITTER_ALPHA: "https://vm-twitter-alpha.fly.dev",
  DEFI_YIELD: "https://vm-defi-yield.fly.dev",
  NEWS_SCANNER: "https://vm-news-scanner.fly.dev",
  ONCHAIN_FORENSICS: "https://vm-onchain-forensics.fly.dev",
  OPTIONS_FLOW: "https://vm-options-flow.fly.dev",
  MACRO_CORRELATOR: "https://vm-macro-correlator.fly.dev",
  ALPHA: "https://vm-alpha.fly.dev",
  RISK: "https://vm-risk.fly.dev",
  EXECUTOR: "https://vm-executor.fly.dev",
};
for (const [key, url] of Object.entries(FLY_URLS)) {
  const envKey = `AGENT_URL_${key}`;
  if (!process.env[envKey]) process.env[envKey] = url;
}

import "dotenv/config";
import { runCycle } from "../src/agents/main-agent";
import { getUserById } from "../src/store/user-store";
import { getPrisma } from "../src/config/prisma";
import { loadMemory } from "../src/og/storage";
import { enrichCycleRow } from "../src/store/enrich-cycle";

// ─── Helpers ────────────────────────────────────────────────
let passed = 0;
let failed = 0;
let warned = 0;

function ok(label: string, detail?: string) {
  passed++;
  console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ""}`);
}
function bad(label: string, err: unknown) {
  failed++;
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`  ❌ ${label} — ${msg}`);
}
function warn(label: string, detail?: string) {
  warned++;
  console.log(`  ⚠️  ${label}${detail ? ` — ${detail}` : ""}`);
}
function section(name: string) {
  console.log(`\n═══ ${name} ═══`);
}

// Parse CLI flags: --user=<id> --goal="text" --dashboard=<url>
const args = new Map<string, string>();
for (const arg of process.argv.slice(2)) {
  const m = arg.match(/^--([a-z-]+)=(.*)$/i);
  if (m) args.set(m[1], m[2]);
}
const DASHBOARD_URL = args.get("dashboard") ?? process.env.DASHBOARD_URL ?? "http://localhost:3000";
const OVERRIDE_USER_ID = args.get("user");
const GOAL = args.get("goal") ?? "Find a safe ETH entry for this week — validate hierarchical flow";

// ─── Section 1: Swarm reachability ─────────────────────────────────────
async function validateSwarm() {
  section("1. FLY.IO SWARM REACHABILITY");
  const names = Object.entries(FLY_URLS).map(([key, url]) => ({ key: key.toLowerCase().replace(/_/g, "-"), url }));

  for (const { key, url } of names) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(`${url}/healthz`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) ok(`healthz ${key}`, `${res.status}`);
      else bad(`healthz ${key}`, `${res.status}`);
    } catch (err) {
      bad(`healthz ${key}`, err);
    }
  }

  // Test one specialist /analyze end-to-end (bonus sanity check)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const res = await fetch(`${FLY_URLS.SENTIMENT}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "preflight" }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const body = (await res.json()) as { signal?: string; attestationHash?: string };
      ok(`/analyze sentiment`, `signal=${body.signal ?? "?"} att=${body.attestationHash?.slice(0, 10) ?? "?"}`);
    } else {
      bad(`/analyze sentiment`, `${res.status}`);
    }
  } catch (err) {
    bad(`/analyze sentiment probe`, err);
  }

  // Test one debate agent /hire-and-analyze — expected to 404 if not deployed
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(`${FLY_URLS.ALPHA}/hire-and-analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userGoal: "probe", riskProfile: "balanced", marketVolatility: "medium", maxTradePercent: 10 }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      ok(`/hire-and-analyze alpha`, `hierarchical path deployed`);
    } else {
      warn(`/hire-and-analyze alpha`, `${res.status} — hierarchical not deployed to Fly yet, flat fallback will run`);
    }
  } catch (err) {
    warn(`/hire-and-analyze alpha`, String(err));
  }
}

// ─── Section 2: Schema ─────────────────────────────────────
async function validateSchema() {
  section("2. DB SCHEMA");
  const prisma = getPrisma();
  const cycleCols = (await prisma.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='cycles' AND column_name IN ('goal','payments','swap_tx_hash','storage_hash')
  `)) as Array<{ column_name: string }>;
  const have = new Set(cycleCols.map((c) => c.column_name));
  for (const col of ["goal", "payments", "swap_tx_hash", "storage_hash"]) {
    if (have.has(col)) ok(`cycles.${col}`);
    else bad(`cycles.${col}`, "MISSING");
  }
  const pCols = (await prisma.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='pending_cycles' AND column_name IN ('goal','rich_record')
  `)) as Array<{ column_name: string }>;
  const pHave = new Set(pCols.map((c) => c.column_name));
  for (const col of ["goal", "rich_record"]) {
    if (pHave.has(col)) ok(`pending_cycles.${col}`);
    else bad(`pending_cycles.${col}`, "MISSING");
  }
}

// ─── Section 3: Live cycle execution ─────────────────────────────────────
interface CycleSummary {
  dbCycleId: string;
  cycleNumber: number;
  storageHash?: string;
  hcsSeqNum?: number;
  swapTxHash?: string;
  payments: Array<{ hiredBy: string; to: string; txHash: string }>;
  goalStored: string | null;
}

async function validateLiveCycle(): Promise<CycleSummary | null> {
  section("3. LIVE CYCLE EXECUTION");
  const prisma = getPrisma();

  // Pick the richest funded user (or the one passed via --user=)
  const users = await prisma.user.findMany({
    select: { id: true, walletAddress: true, fund: true },
  });
  let chosen = users.find((u) => u.id === OVERRIDE_USER_ID);
  if (!chosen && users.length > 0) {
    // Pick the user with the highest depositedUsdc
    chosen = [...users].sort((a, b) => {
      const af = (a.fund as { depositedUsdc?: number }).depositedUsdc ?? 0;
      const bf = (b.fund as { depositedUsdc?: number }).depositedUsdc ?? 0;
      return bf - af;
    })[0];
  }
  if (!chosen) {
    bad("pick user", "no users in DB");
    return null;
  }
  const balance = (chosen.fund as { depositedUsdc?: number }).depositedUsdc ?? 0;
  ok(`picked user`, `${chosen.id.slice(0, 8)}… wallet=${chosen.walletAddress.slice(0, 10)}… balance=$${balance.toFixed(2)}`);

  // Load full user record
  const user = await getUserById(chosen.id);
  if (!user) {
    bad("getUserById", "missing");
    return null;
  }

  if (user.agent.approvalMode !== "auto") {
    warn("approvalMode", `${user.agent.approvalMode} — script runs runCycle() which commits immediately; expects 'auto'`);
  }

  console.log(`\n  Triggering runCycle(user, "${GOAL}")…`);
  console.log(`  This will hire specialists via x402, call 0G inference, write to HCS + 0G + Prisma.\n`);

  const start = Date.now();
  let result;
  try {
    result = await runCycle(user, GOAL);
  } catch (err) {
    bad("runCycle", err);
    return null;
  }
  const duration = Date.now() - start;
  ok("runCycle completed", `${(duration / 1000).toFixed(1)}s, cycleId=${result.cycleId}`);

  // ─── CycleResult shape assertions ───
  if (result.goal === GOAL) ok("CycleResult.goal matches input", `"${result.goal}"`);
  else bad("CycleResult.goal", `expected "${GOAL}" got "${result.goal}"`);

  if (result.specialists && result.specialists.length > 0) {
    ok("CycleResult.specialists non-empty", `${result.specialists.length}`);
    const withHiredBy = result.specialists.filter((s) => s.hiredBy).length;
    if (withHiredBy === result.specialists.length) ok("specialists[].hiredBy all set");
    else bad("specialists[].hiredBy", `only ${withHiredBy}/${result.specialists.length}`);
    const withPayment = result.specialists.filter((s) => s.paymentTxHash && s.paymentTxHash !== "no-payment").length;
    if (withPayment > 0) ok("specialists[].paymentTxHash populated", `${withPayment}/${result.specialists.length}`);
    else warn("specialists[].paymentTxHash", "all no-payment (x402 signing may have fallen back to unauth fetch)");
    const hirers = [...new Set(result.specialists.map((s) => s.hiredBy))];
    if (hirers.length === 1 && hirers[0] === "main-agent") warn("hierarchical path", "all hires tagged main-agent — /hire-and-analyze not deployed to Fly yet");
    else ok("hierarchical hiring ran", `hirers: ${hirers.join(", ")}`);
  } else {
    bad("CycleResult.specialists", "empty — swarm unreachable?");
  }

  if (result.payments && result.payments.length > 0) {
    ok("CycleResult.payments non-empty", `${result.payments.length}`);
  } else {
    warn("CycleResult.payments", "empty (all specialists returned no-payment — x402 payment rail not exercised)");
  }

  if (result.swapResult) {
    if (result.swapResult.success) ok("swap executed", `${result.swapResult.txHash?.slice(0, 12)}…`);
    else warn("swap not executed", result.swapResult.reason ?? "HOLD");
  } else {
    warn("swapResult", "undefined (probably HOLD decision)");
  }

  if (result.proofs.hcs) ok("proofs.hcs", `seq=${result.seqNum}`);
  else bad("proofs.hcs", "HCS write failed");

  if (result.proofs.storage) ok("proofs.storage", `hash=${result.storageHash?.slice(0, 12)}…`);
  else bad("proofs.storage", "0G write failed");

  if (result.proofs.inft) ok("proofs.inft");
  else warn("proofs.inft", "iNFT metadata update failed/skipped");

  // Resolve the DB cycle row we just wrote
  const latestRow = await prisma.cycle.findFirst({
    where: { userId: user.id, cycleNumber: result.cycleId },
  });
  if (!latestRow) {
    bad("prisma cycle row", "not found after runCycle");
    return null;
  }

  return {
    dbCycleId: latestRow.id,
    cycleNumber: result.cycleId,
    storageHash: result.storageHash,
    hcsSeqNum: result.seqNum,
    swapTxHash: result.swapResult?.txHash,
    payments: result.payments.map((p) => ({ hiredBy: p.hiredBy, to: p.to, txHash: p.txHash })),
    goalStored: latestRow.goal,
  };
}

// ─── Section 4: Prisma row assertions ─────────────────────────────────────
async function validatePrismaRow(summary: CycleSummary) {
  section("4. PRISMA cycles ROW");
  const prisma = getPrisma();
  const row = await prisma.cycle.findUnique({ where: { id: summary.dbCycleId } });
  if (!row) {
    bad("prisma cycle row", "not found");
    return;
  }

  if (row.goal === GOAL) ok("cycles.goal matches input");
  else bad("cycles.goal", `"${row.goal}"`);

  if (row.storageHash) ok("cycles.storage_hash", `${row.storageHash.slice(0, 12)}…`);
  else bad("cycles.storage_hash", "null");

  if (row.hcsSeqNum && row.hcsSeqNum > 0) ok("cycles.hcs_seq_num", `${row.hcsSeqNum}`);
  else bad("cycles.hcs_seq_num", "null or 0");

  const payments = row.payments as Array<{ hiredBy?: string; txHash?: string }> | null;
  if (Array.isArray(payments)) ok("cycles.payments is JSON array", `${payments.length} entries`);
  else if (payments == null) warn("cycles.payments", "null (flat path produced no tx hashes)");
  else bad("cycles.payments", `unexpected type: ${typeof payments}`);

  if (row.execAction) ok("cycles.exec_action", row.execAction);
  else warn("cycles.exec_action", "null");

  if (row.swapTxHash) ok("cycles.swap_tx_hash", `${row.swapTxHash.slice(0, 12)}…`);
  else warn("cycles.swap_tx_hash", "null (HOLD or skipped)");
}

// ─── Section 5: 0G round-trip ─────────────────────────────────────
async function validate0GRoundTrip(summary: CycleSummary) {
  section("5. 0G STORAGE ROUND-TRIP");
  if (!summary.storageHash) {
    bad("0G round-trip", "no storage hash");
    return;
  }
  try {
    const raw = (await loadMemory(summary.storageHash)) as {
      userId?: string;
      data?: {
        version?: number;
        cycleId?: number;
        goal?: string;
        specialists?: Array<{ name: string; hiredBy?: string; paymentTxHash?: string }>;
        payments?: unknown[];
        debate?: unknown;
      };
    };
    ok("downloaded from 0G indexer", `rootHash=${summary.storageHash.slice(0, 10)}…`);
    const d = raw.data ?? {};
    if (d.version === 1) ok("rich record v1");
    else bad("rich record version", `${d.version}`);
    if (d.cycleId === summary.cycleNumber) ok("rich record cycleId matches");
    else bad("rich record cycleId", `expected ${summary.cycleNumber} got ${d.cycleId}`);
    if (d.goal === GOAL) ok("rich record goal matches");
    else bad("rich record goal", `"${d.goal}"`);
    if (Array.isArray(d.specialists) && d.specialists.length > 0) {
      ok("rich record specialists[]", `${d.specialists.length}`);
      const withHiredBy = d.specialists.filter((s) => s.hiredBy).length;
      if (withHiredBy === d.specialists.length) ok("rich specialists[].hiredBy all set");
      else bad("rich specialists[].hiredBy", `${withHiredBy}/${d.specialists.length}`);
    } else {
      bad("rich record specialists[]", "empty/missing");
    }
    if (Array.isArray(d.payments)) ok("rich record payments[]", `${d.payments.length}`);
    else bad("rich record payments[]", "missing");
    if (d.debate) ok("rich record debate");
    else bad("rich record debate", "missing");
  } catch (err) {
    bad("0G fetch", err);
  }
}

// ─── Section 6: HCS mirror node ─────────────────────────────────────
async function validateHCS(summary: CycleSummary) {
  section("6. HEDERA HCS MIRROR");
  const topicId = process.env.HCS_AUDIT_TOPIC_ID;
  if (!topicId) {
    bad("HCS_AUDIT_TOPIC_ID", "not set");
    return;
  }
  if (!summary.hcsSeqNum) {
    bad("hcsSeqNum", "not set");
    return;
  }
  try {
    const url = `https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages/${summary.hcsSeqNum}`;
    const res = await fetch(url);
    if (!res.ok) {
      bad("mirror node fetch", `${res.status}`);
      return;
    }
    const body = (await res.json()) as { message: string; sequence_number: number };
    ok("mirror fetched", `seq=${body.sequence_number}`);
    const decoded = Buffer.from(body.message, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as Record<string, unknown>;
    const keys = Object.keys(parsed);
    console.log(`    keys: [${keys.join(", ")}]`);
    if (parsed.g) ok("HCS record has g (goal)", `"${String(parsed.g).slice(0, 60)}"`);
    else bad("HCS record g (goal)", "missing");
    if (parsed.sh) ok("HCS record has sh (storage CID)", `${String(parsed.sh).slice(0, 12)}…`);
    else bad("HCS record sh (storage CID)", "missing");
    if (parsed.c === summary.cycleNumber) ok("HCS record c (cycleId) matches");
    else bad("HCS record c", `expected ${summary.cycleNumber} got ${parsed.c}`);
  } catch (err) {
    bad("mirror node fetch", err);
  }
}

// ─── Section 7: /api/cycle/latest enrichment ─────────────────────────────────────
async function validateApiEnrichment(summary: CycleSummary, userId: string) {
  section("7. /api/cycle/latest ENRICHMENT");

  // Prefer hitting the live dashboard API if it's up. Fall back to calling
  // enrichCycleRow() directly against the row we just wrote.
  try {
    const res = await fetch(`${DASHBOARD_URL}/api/cycle/latest/${userId}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const body = (await res.json()) as Record<string, unknown>;
      ok("HTTP /api/cycle/latest", `${res.status}`);
      const keys = Object.keys(body);
      console.log(`    keys: [${keys.join(", ")}]`);
      for (const required of ["cycleId", "goal", "specialists", "debate", "payments", "decision", "storageHash"]) {
        if (required in body) ok(`response.${required}`);
        else bad(`response.${required}`, "missing");
      }
      const specialists = body.specialists as Array<{ hiredBy?: string }> | undefined;
      if (Array.isArray(specialists) && specialists.every((s) => "hiredBy" in s)) ok("specialists[].hiredBy in response");
      else warn("specialists[].hiredBy", "missing or incomplete");
      if (body.goal === GOAL) ok("response.goal matches");
      else bad("response.goal", `"${body.goal}"`);
      return;
    }
    warn("HTTP /api/cycle/latest", `${res.status} — falling back to direct enrichCycleRow()`);
  } catch (err) {
    warn("HTTP /api/cycle/latest", `${err instanceof Error ? err.message : String(err)} — dashboard may be down, falling back to enrichCycleRow()`);
  }

  // Direct call
  const prisma = getPrisma();
  const row = await prisma.cycle.findUnique({ where: { id: summary.dbCycleId } });
  if (!row) {
    bad("prisma cycle for enrichCycleRow", "not found");
    return;
  }
  const enriched = await enrichCycleRow(row);
  ok("enrichCycleRow() direct", `cycleId=${enriched.cycleId}`);
  if (enriched.goal === GOAL) ok("enriched.goal matches");
  else bad("enriched.goal", `"${enriched.goal}"`);
  if (enriched.specialists.length > 0) ok("enriched.specialists", `${enriched.specialists.length}`);
  else bad("enriched.specialists", "empty");
  if (Array.isArray(enriched.payments)) ok("enriched.payments", `${enriched.payments.length}`);
  else bad("enriched.payments", "not array");
  if (enriched.debate?.alpha && enriched.debate?.risk && enriched.debate?.executor) ok("enriched.debate 3 tiers");
  else bad("enriched.debate", "missing tier");
  if (enriched.storageHash) ok("enriched.storageHash");
  else bad("enriched.storageHash", "null");
  if (enriched.hashscanUrl) ok("enriched.hashscanUrl");
  else warn("enriched.hashscanUrl", "null");
}

// ─── Main ─────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║   AlphaDawg — Display-Flow E2E Validation                   ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(`  goal:      "${GOAL}"`);
  console.log(`  dashboard: ${DASHBOARD_URL}`);
  console.log(`  Fly URLs:  overridden in process.env (13 agents)`);

  await validateSwarm();
  await validateSchema();

  const summary = await validateLiveCycle();
  if (summary) {
    await validatePrismaRow(summary);
    await validate0GRoundTrip(summary);
    await validateHCS(summary);
    // Resolve userId for the API check
    const prisma = getPrisma();
    const row = await prisma.cycle.findUnique({ where: { id: summary.dbCycleId } });
    if (row) {
      await validateApiEnrichment(summary, row.userId);
    }
  }

  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║   Results: ${passed} passed · ${failed} failed · ${warned} warnings`.padEnd(63) + "║");
  console.log(`╚══════════════════════════════════════════════════════════════╝`);

  const prisma = getPrisma();
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("validation script crashed:", err);
  process.exit(1);
});
