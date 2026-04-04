import { updateUser } from "../store/user-store";
import { logAction, logCycleRecord } from "../store/action-logger";
import { runAdversarialDebate } from "./adversarial";
import { normalizeCot, compactVerdict } from "./prompts";
import { emitSwarmEvent, emitHireWithRichData, emitTurnWithRichData } from "./swarm-emit";
import { hireSpecialists } from "./hire-specialist";
import { selectSpecialists } from "../marketplace/hiring-strategy";
import { getAgent } from "../config/agent-registry";
import { logCycle } from "../hedera/hcs";
import { storeMemory } from "../og/storage";
import { updateAgentMetadata } from "../og/inft";
import { getUserPaymentFetch, getUserPrivateKey } from "../config/arc";
import { hireFromMarketplace } from "../marketplace/registry";
import { evaluateCycleSignals } from "../marketplace/reputation";
import { executeArcSwap, calculateSwapAmount } from "../execution/arc-swap";
import { prepareSwapFunds, computeHoldingsUpdate, ensureHotWalletFunded } from "../payments/fund-swap";
import { getTokenPrice } from "../payments/circle-wallet";
import { synthesizeCycleNarrative, type CycleNarrative } from "./narrative";
import { recordPickEntries } from "../marketplace/pick-tracker";
import { filterTradeablePicks, validateTradeableAsset } from "./data/pick-filter";
import { fetchCycleLiquidity } from "./data/liquidity-injector";
import { getPrisma } from "../config/prisma";
import { getGateway } from "../openclaw/gateway-client";
import type {
  UserRecord,
  SpecialistResult,
  CycleResult,
  CompactCycleRecord,
  RichCycleRecord,
  PaymentRecord,
  DebateResult,
  DebateStageResult,
  DebateAgentResponse,
  DebateTranscriptEntry,
  AnalysisResult,
  ArcSwapResult,
  CycleProofs,
  OpenClawGatewayStatus,
  SpecialistPath,
  RichHireData,
  RichTurnData,
  CycleLiquidity,
} from "../types/index";
import type { RiskProfile, MarketVolatility, DebateRole } from "./role-manifests";

const TOPIC_ID = process.env.HCS_AUDIT_TOPIC_ID!;

// Helper: build a RichHireData payload from a SpecialistResult. Used by both
// the flat and hierarchical hire paths to persist full input/output to 0G
// Storage alongside the compact HCS hire event. Captures the exact market
// data the LLM saw (rawDataSnapshot), the full parsed JSON, the untruncated
// cot steps, the full attestation hash, and the payment proof — everything
// needed for a judge/verifier to replay the specialist interaction byte-for-byte.
function buildRichHireData(
  sp: SpecialistResult,
  cycleId: number,
  userId: string,
  task: string,
): RichHireData {
  const parsed = (sp as unknown as { parsed?: Record<string, unknown> }).parsed ?? {};
  return {
    schemaVersion: 1,
    eventKind: "hire",
    cycleId,
    userId,
    timestamp: new Date().toISOString(),
    specialist: sp.name,
    hiredBy: sp.hiredBy ?? "main",
    input: {
      task,
      marketData: sp.rawDataSnapshot ?? null,
    },
    output: {
      signal: sp.signal,
      confidence: sp.confidence,
      parsed: parsed as Record<string, unknown>,
      reasoning: sp.reasoning ?? "",
      cot: normalizeCot((sp as unknown as { cot?: unknown }).cot, sp.reasoning),
      picks: sp.picks ?? null,
    },
    attestation: {
      hash: sp.attestationHash, // full, not truncated
      teeVerified: sp.teeVerified,
    },
    payment: {
      txHash: sp.paymentTxHash ?? "no-payment",
      priceUsd: sp.priceUsd ?? 0.001,
      network: sp.paymentTxHash && sp.paymentTxHash !== "no-payment" ? "arc" : "none",
    },
    durationMs: (sp as unknown as { durationMs?: number }).durationMs ?? 0,
  };
}

// Helper: build a RichTurnData payload for a hierarchical debate turn. The
// Fly.io agent ran the turn remotely and returned a DebateAgentResponse; we
// reconstruct the input context from the ctx we sent and capture the full
// response for 0G Storage persistence.
function buildRichTurnFromHierarchical(
  resp: DebateAgentResponse,
  turnNumber: number,
  phase: "opening" | "rebuttal" | "decision",
  from: string,
  to: string | undefined,
  cycleId: number,
  userId: string,
  ctx: DebateCallContext,
): RichTurnData {
  return {
    schemaVersion: 1,
    eventKind: "turn",
    cycleId,
    userId,
    timestamp: new Date().toISOString(),
    turnNumber,
    phase,
    from,
    to,
    input: {
      systemPromptName: from,
      userMessage: `[hierarchical] debate agent hired own specialists; see debateCtx for input context`,
      debateCtx: ctx as unknown as Record<string, unknown>,
    },
    output: {
      content: resp.content,
      parsed: resp.parsed,
      reasoning: resp.reasoning,
      cot: normalizeCot((resp.parsed as { cot?: unknown }).cot, resp.reasoning),
    },
    attestation: {
      hash: resp.attestationHash, // full hash
      teeVerified: resp.teeVerified,
    },
    durationMs: 0, // not tracked for hierarchical path
  };
}

// Hierarchical hiring: delegate debate decisions to Fly.io debate agents.
// Each debate agent autonomously hires its own specialists via x402 before
// running 0G sealed inference. Set USE_HIERARCHICAL_HIRING=false to fall back
// to the flat (legacy) path where main-agent hires everyone.
const USE_HIERARCHICAL_HIRING = process.env.USE_HIERARCHICAL_HIRING !== "false";

interface DebateCallContext {
  userGoal: string;
  userWalletIndex: number | null;
  riskProfile: RiskProfile;
  marketVolatility: MarketVolatility;
  maxTradePercent: number;
  /** Real-time liquidity snapshot — ground truth for % → USD conversion. */
  cycleLiquidity?: CycleLiquidity;
  alphaThesis?: string;
  alphaParsed?: Record<string, unknown>;
  riskChallenge?: string;
  riskParsed?: Record<string, unknown>;
}

// Call a remote debate agent's /hire-and-analyze endpoint.
// Returns the debate response (which includes specialists the agent hired).
async function callDebateAgent(
  role: DebateRole,
  ctx: DebateCallContext,
): Promise<DebateAgentResponse> {
  const agent = getAgent(role);
  if (!agent) throw new Error(`No URL registered for debate agent: ${role}`);

  const res = await fetch(`${agent.url}/hire-and-analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ctx),
    signal: AbortSignal.timeout(90_000), // 90s — accounts for 0G latency + parallel specialist hires
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${role} /hire-and-analyze returned ${res.status}: ${body.slice(0, 300)}`);
  }

  return (await res.json()) as DebateAgentResponse;
}

// Synthesize a DebateResult from three hierarchical-tier responses so downstream
// code (HCS compact record, Supabase cycle save, transcripts) can consume it
// unchanged.
function synthesizeDebateResult(
  alpha: DebateAgentResponse,
  risk: DebateAgentResponse,
  executor: DebateAgentResponse,
): DebateResult {
  const toStage = (r: DebateAgentResponse): DebateStageResult => ({
    content: r.content,
    parsed: r.parsed,
    reasoning: r.reasoning,
    attestationHash: r.attestationHash,
    teeVerified: r.teeVerified,
  });

  // Build synthetic transcripts mirroring the shape of the old in-process debate.
  const transcripts: DebateTranscriptEntry[] = [];
  let turn = 1;

  // Intelligence phase: one turn per hired specialist, attributed to the hirer
  for (const hirer of [alpha, risk, executor] as const) {
    for (const spec of hirer.specialists_hired ?? []) {
      transcripts.push({
        turnNumber: turn++,
        phase: "intelligence",
        fromAgent: hirer.name,
        toAgent: spec.name,
        messageContent: `Hired ${spec.name} for ${hirer.name} debate`,
        responseContent: `${spec.signal} (${spec.confidence}%)`,
        attestationHash: spec.attestation,
        teeVerified: false,
        durationMs: 0,
      });
    }
  }

  transcripts.push({
    turnNumber: turn++,
    phase: "opening",
    fromAgent: "main-orchestrator",
    toAgent: "alpha",
    messageContent: "Build bull thesis from your hired specialists",
    responseContent: alpha.content.slice(0, 2000),
    attestationHash: alpha.attestationHash,
    teeVerified: alpha.teeVerified,
    durationMs: 0,
  });
  transcripts.push({
    turnNumber: turn++,
    phase: "opening",
    fromAgent: "main-orchestrator",
    toAgent: "risk",
    messageContent: "Challenge Alpha using your defensive specialists",
    responseContent: risk.content.slice(0, 2000),
    attestationHash: risk.attestationHash,
    teeVerified: risk.teeVerified,
    durationMs: 0,
  });
  transcripts.push({
    turnNumber: turn++,
    phase: "decision",
    fromAgent: "main-orchestrator",
    toAgent: "executor",
    messageContent: "Make the final call",
    responseContent: executor.content.slice(0, 2000),
    attestationHash: executor.attestationHash,
    teeVerified: executor.teeVerified,
    durationMs: 0,
  });

  return {
    alpha: toStage(alpha),
    risk: toStage(risk),
    executor: toStage(executor),
    transcripts,
    totalTurns: transcripts.length,
  };
}

// Build the agent-to-agent payment graph from hierarchical-hiring metadata on
// the specialist list. Only entries with a real paymentTxHash are included.
function buildPaymentRecords(specialists: SpecialistResult[]): PaymentRecord[] {
  return specialists
    .filter((sp) => sp.hiredBy && sp.paymentTxHash && sp.paymentTxHash !== "no-payment")
    .map<PaymentRecord>((sp) => ({
      from: sp.hiredBy ?? "main-agent",
      to: sp.name,
      amount: "$0.001",
      txHash: sp.paymentTxHash ?? "",
      hiredBy: sp.hiredBy ?? "main-agent",
      chain: "arc",
    }));
}

// Truncate a string to at most `maxChars`, but never cut a word in half.
// Falls back to a hard slice only if the input has no spaces at all (e.g.
// weird single-token output). Adds "..." suffix when trimming actually
// happens. This replaces the old char-chopping behaviour that produced
// Hashscan strings like "The withdrawal of smart money and the la" — no
// trailing word break, mid-syllable cut, confusing to judges.
function wordTrim(raw: string | undefined, maxChars: number): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (cleaned.length <= maxChars) return cleaned || undefined;
  // Find the last space within the budget (leaving 3 chars for "...")
  const sliceLimit = maxChars - 3;
  const lastSpace = cleaned.lastIndexOf(" ", sliceLimit);
  const cut = lastSpace > 0 ? cleaned.slice(0, lastSpace) : cleaned.slice(0, sliceLimit);
  return cut + "...";
}

// Synthesize a single-sentence A2A dialogue narrative. Captures who argued
// what in a way readers of the HCS aggregate can understand at a glance
// WITHOUT fetching 0G. Complements (doesn't replace) the full turn-by-turn
// transcript that lives in per-event swarm records + 0G rich payloads.
//
// Format: "alpha <action> <asset> <pct>% (<thesis>); risk max <max_pct>% (<objection>); executor <action> <pct>%"
//
// Internal field widths are tuned so the full narrative stays ≤110 chars,
// leaving budget for per-agent reasoning excerpts in the same record.
function buildDialogueNarrative(
  alphaParsed: { action?: string; pct?: number; asset?: string; thesis?: string },
  riskParsed: { max_pct?: number; objection?: string; challenge?: string },
  execParsed: { action?: string; pct?: number; asset?: string },
): string {
  const alphaAct = String(alphaParsed.action ?? "HOLD").toUpperCase();
  const alphaAsset = alphaParsed.asset ? String(alphaParsed.asset).toUpperCase() : "";
  const alphaPct = Number(alphaParsed.pct ?? 0);
  const alphaThesis = alphaParsed.thesis ? ` (${wordTrim(String(alphaParsed.thesis), 35)})` : "";
  const alphaFrag = `alpha ${alphaAct}${alphaAsset ? " " + alphaAsset : ""} ${alphaPct}%${alphaThesis}`;

  const maxPct = Number(riskParsed.max_pct ?? 0);
  const riskObj = wordTrim(String(riskParsed.objection ?? riskParsed.challenge ?? ""), 35);
  const riskFrag = `risk max ${maxPct}%${riskObj ? " (" + riskObj + ")" : ""}`;

  const execAct = String(execParsed.action ?? "HOLD").toUpperCase();
  const execPct = Number(execParsed.pct ?? 0);
  const execAsset = execParsed.asset ? String(execParsed.asset).toUpperCase() : "";
  const execFrag =
    execAct === "HOLD"
      ? `exec HOLD`
      : `exec ${execAct}${execAsset ? " " + execAsset : ""} ${execPct}%`;

  return `${alphaFrag}; ${riskFrag}; ${execFrag}`;
}

// Lean HCS audit pointer (must fit under 1024 bytes). The full record — full
// reasoning, full attestations, full input/output per agent — lives on 0G
// Storage via the `sh` pointer that commitCycle injects after the 0G write.
//
// What the aggregate DOES include, so it tells the story at a glance without
// forcing readers to click through to 0G:
//   • 4-field specialist list (name, signal, confidence, attestation prefix)
//   • Per-agent verdicts (action, pct/max, attestation) in `adv`
//   • Per-agent reasoning previews (word-trimmed at sentence boundaries, not
//     char-chopped mid-word like the old format)
//   • A top-level `dlg` one-sentence dialogue narrative synthesized from the
//     three parsed verdicts, so Hashscan viewers see "alpha BUY 10%;
//     risk max 3% (smart money out); exec HOLD" immediately
function buildCompactRecord(
  cycleId: number,
  user: UserRecord,
  goal: string,
  specialists: SpecialistResult[],
  debate: DebateResult,
): CompactCycleRecord {
  const alphaParsed = debate.alpha.parsed as {
    action?: string;
    pct?: number;
    asset?: string;
    thesis?: string;
  };
  const riskParsed = debate.risk.parsed as {
    challenge?: string;
    objection?: string;
    max_pct?: number;
  };
  const execParsed = debate.executor.parsed as {
    action?: string;
    pct?: number;
    asset?: string;
    stop_loss?: string;
  };

  const stopLoss = parseFloat(
    String(execParsed.stop_loss ?? "-5").replace("%", "").replace("-", ""),
  );

  const record: CompactCycleRecord = {
    c: cycleId,
    u: user.id,
    t: new Date().toISOString(),
    rp: user.agent.riskProfile,
    g: wordTrim(goal, 120),
    dlg: buildDialogueNarrative(alphaParsed, riskParsed, execParsed),
    // Specialist att reduced from 16 → 12 chars — the full hash lives in the
    // per-event swarm-hire record and the 0G rich payload. 12 chars is still
    // unique within a cycle cluster and saves ~16 bytes per specialist.
    s: specialists.map((sp) => ({
      n: sp.name,
      sig: sp.signal,
      conf: sp.confidence,
      att: sp.attestationHash.slice(0, 12),
    })),
    // Adversarial block carries only action/pct/reasoning — `att` and `obj`
    // are redundant (att lives in per-event swarm-hire records + 0G rich
    // payload; obj was redundant with `r` reasoning and was the source of
    // the original mid-word-chop bug the user flagged).
    adv: {
      a: {
        act: String(alphaParsed.action ?? "HOLD"),
        pct: Number(alphaParsed.pct ?? 0),
        r: wordTrim(debate.alpha.reasoning, 80),
      },
      r: {
        max: Number(riskParsed.max_pct ?? 0),
        r: wordTrim(
          // Prefer the full reasoning narrative; fall back to `objection`
          // or `challenge` if the model didn't emit a reasoning field (Risk
          // historically only had `objection` — the Phase 3 prompt fix added
          // `reasoning` but older cycles may still only carry `objection`).
          debate.risk.reasoning ||
            String(riskParsed.challenge ?? riskParsed.objection ?? ""),
          80,
        ),
      },
      e: {
        act: String(execParsed.action ?? "HOLD"),
        pct: Number(execParsed.pct ?? 0),
        sl: stopLoss,
        r: wordTrim(debate.executor.reasoning, 80),
      },
    },
    d: {
      act: String(execParsed.action ?? "HOLD"),
      asset: "ETH",
      pct: Number(execParsed.pct ?? 0),
    },
    nav: user.fund.currentNav,
  };

  // Safety trim under the HCS 1024-byte limit. Budget is 944 (reserves ~80
  // bytes for the `sh` CID that commitCycle injects after the 0G write).
  //
  // Priority order — what we shed to stay under budget, lowest-value first:
  //   1. goal (`g`)     — already in 0G RichCycleRecord, just a hint field
  //   2. reasoning excerpts (`adv.*.r`) — the actual dialogue content
  //   3. dlg (`dlg`) — last resort since it's the at-a-glance narrative
  //
  // The old behaviour dropped ALL reasoning at the first sign of overflow,
  // which meant any 4-specialist cycle showed up on Hashscan as a bag of
  // verdicts with no explanation. New order preserves the signal: drop goal
  // first (it's in 0G), then reasoning only if still over budget, dlg last.
  const BUDGET = 944;
  const size = (): number => Buffer.byteLength(JSON.stringify(record), "utf8");

  if (size() > BUDGET) delete record.g;
  if (size() > BUDGET) {
    delete record.adv.a.r;
    delete record.adv.r.r;
    delete record.adv.e.r;
  }
  if (size() > BUDGET) delete record.dlg;

  return record;
}

// The full cycle record persisted to 0G Storage — source of truth for the UI
// payment graph and for anyone running an independent "verify on 0G" check.
// HCS keeps only the CID pointer; Prisma keeps a Json cache for fast reads.
function buildRichRecord(
  cycleId: number,
  user: UserRecord,
  goal: string,
  specialists: SpecialistResult[],
  debate: DebateResult,
  payments: PaymentRecord[],
  cycleLiquidity?: CycleLiquidity,
  swapResult?: ArcSwapResult,
): RichCycleRecord {
  const alphaParsed = debate.alpha.parsed as { action?: string; pct?: number };
  const riskParsed = debate.risk.parsed as { challenge?: string; objection?: string; max_pct?: number };
  const execParsed = debate.executor.parsed as { action?: string; pct?: number; stop_loss?: string };

  return {
    version: 1,
    cycleId,
    userId: user.id,
    timestamp: new Date().toISOString(),
    goal,
    riskProfile: user.agent.riskProfile,
    specialists: specialists.map((sp) => ({
      name: sp.name,
      signal: sp.signal,
      confidence: sp.confidence,
      reasoning: sp.reasoning ?? "",
      attestationHash: sp.attestationHash, // full, not truncated
      teeVerified: sp.teeVerified,
      hiredBy: sp.hiredBy ?? "main-agent",
      paymentTxHash: sp.paymentTxHash ?? "no-payment",
      priceUsd: sp.priceUsd ?? 0.001,
      reputation: sp.reputation ?? 500,
    })),
    debate: {
      alpha: {
        action: String(alphaParsed.action ?? "HOLD"),
        pct: Number(alphaParsed.pct ?? 0),
        reasoning: debate.alpha.reasoning ?? "",
        attestationHash: debate.alpha.attestationHash,
      },
      risk: {
        maxPct: Number(riskParsed.max_pct ?? 0),
        objection: String(riskParsed.challenge ?? riskParsed.objection ?? ""),
        reasoning: debate.risk.reasoning ?? "",
        attestationHash: debate.risk.attestationHash,
      },
      executor: {
        action: String(execParsed.action ?? "HOLD"),
        pct: Number(execParsed.pct ?? 0),
        stopLoss: String(execParsed.stop_loss ?? "-5%"),
        reasoning: debate.executor.reasoning ?? "",
        attestationHash: debate.executor.attestationHash,
      },
    },
    payments,
    decision: {
      action: String(execParsed.action ?? "HOLD"),
      asset: "ETH",
      pct: Number(execParsed.pct ?? 0),
    },
    swap: swapResult
      ? {
          success: swapResult.success,
          txHash: swapResult.txHash,
          explorerUrl: swapResult.explorerUrl,
          method: swapResult.method,
        }
      : undefined,
    cycleLiquidity,
    nav: user.fund.currentNav,
  };
}

// ── Phase 1: Analyze (hire specialists + adversarial debate) ─────────────────

export async function analyzeCycle(user: UserRecord, userGoal?: string): Promise<AnalysisResult> {
  const cycleId = user.agent.lastCycleId + 1;

  // Default goal when the caller (heartbeat / Telegram /run) doesn't supply one.
  // Dashboard callers send a real goal from the input box.
  const goal =
    userGoal && userGoal.trim().length > 0
      ? userGoal.trim()
      : `Grow portfolio, max ${user.agent.maxTradePercent}% per trade, ${user.agent.riskProfile} risk`;

  console.log(`[cycle] Analyzing for user ${user.id} (risk: ${user.agent.riskProfile}) goal: "${goal}"`);
  console.log(`[cycle] Proxy wallet: ${user.proxyWallet.address} (Circle: ${user.proxyWallet.walletId})`);

  // Emit the swarm-start event before any specialist is hired. This anchors
  // the cluster of per-event messages that follow (hires, debate turns, done)
  // so Hashscan viewers can group them by cycle `c`.
  emitSwarmEvent({
    ev: "start",
    c: cycleId,
    u: user.id,
    t: new Date().toISOString(),
    rp: user.agent.riskProfile,
    g: goal.slice(0, 120) || undefined,
  });

  // Probe OpenClaw gateway so we can honestly report its status in the CycleResult.
  // This call is cheap — the gateway auto-disables on ECONNREFUSED and subsequent
  // callers short-circuit. Status is display-only; it never gates specialist hiring.
  let openclawGatewayStatus: OpenClawGatewayStatus = "offline";
  try {
    const gatewayUp = await getGateway().ping();
    openclawGatewayStatus = gatewayUp ? "active" : "offline";
    console.log(`[cycle] OpenClaw gateway: ${openclawGatewayStatus}`);
  } catch {
    openclawGatewayStatus = "offline";
  }

  // Log cycle start (non-fatal — Supabase audit log, not a chain write)
  try {
    await logAction({
      userId: user.id,
      actionType: "CYCLE_STARTED",
      payload: { cycleNumber: cycleId, riskProfile: user.agent.riskProfile, openclawGatewayStatus },
    });
  } catch (err) {
    console.warn("[cycle] logAction CYCLE_STARTED failed (non-fatal):", err instanceof Error ? err.message : String(err));
  }

  // Fetch real-time USDC liquidity BEFORE any specialist or debate agent runs.
  // This is the honest budget the agents will reason against — the DB's
  // `user.fund.depositedUsdc` can drift from the actual Circle proxy balance
  // (external top-ups, failed transfers, manual tests), and if we let specialists
  // emit percentages against the stale value the swap pipeline will either fail
  // at prepareSwapFunds() or execute against a phantom budget. The snapshot
  // flows through DebateCallContext → fly-agent-server → specialist data
  // payloads → prompts → narrative → UI so every layer sees the same truth.
  // Non-fatal: on failure, returns zeros and the cycle proceeds (prompts will
  // see "$0 available" and HOLD naturally).
  const cycleLiquidity: CycleLiquidity = await fetchCycleLiquidity(user);
  console.log(
    `[cycle] Liquidity snapshot: available $${cycleLiquidity.availableUsd.toFixed(4)} (proxy $${cycleLiquidity.proxyUsd.toFixed(4)}, hot $${cycleLiquidity.hotUsd.toFixed(4)}, deposited-db $${cycleLiquidity.depositedUsd.toFixed(4)})`,
  );
  if (
    cycleLiquidity.depositedUsd > 0 &&
    Math.abs(cycleLiquidity.proxyUsd - cycleLiquidity.depositedUsd) > 0.01
  ) {
    console.warn(
      `[cycle] ⚠ DB/chain drift detected: DB $${cycleLiquidity.depositedUsd.toFixed(4)} vs chain $${cycleLiquidity.proxyUsd.toFixed(4)} — honoring $${cycleLiquidity.availableUsd.toFixed(4)}`,
    );
  }

  // ── Top up the x402 signer wallet before any specialist hire ──────────
  //
  // The x402 buyer is the BIP-44 hot wallet (see src/config/arc.ts
  // `getUserPaymentFetch`), NOT the Circle MPC proxy that holds user
  // deposits. On a fresh user — or whenever prior hires have drained it —
  // the hot wallet's Arc USDC balance is 0 and Circle Gateway rejects every
  // x402 payment with `{"error":"Payment settlement failed","reason":
  // "insufficient_balance"}`. ensureHotWalletFunded() bridges a small
  // buffer (default $0.20 = ~200 hires at $0.001 each) from the proxy only
  // when the hot wallet is below the floor, so we don't churn Circle
  // transfers on every cycle.
  //
  // Non-fatal: if Circle rejects or the proxy is itself dry, log-and-continue
  // — the cycle will still run, individual hires will 402 and cascade to a
  // degraded HOLD, but the whole pipeline doesn't abort.
  try {
    await ensureHotWalletFunded(user, 0.05, 0.20);
  } catch (err) {
    console.warn(
      `[cycle] hot wallet top-up failed (continuing — hires may 402):`,
      err instanceof Error ? err.message : String(err),
    );
  }

  // 1. Hire specialists + run debate
  //
  // HIERARCHICAL PATH (default): delegate to the three Fly.io debate agents
  // (vm-alpha, vm-risk, vm-executor). Each one autonomously hires its own
  // specialists via x402 before running 0G inference. This delivers the
  // "agent hiring economy" narrative — Alpha pays for bullish intel,
  // Risk pays for defensive intel, Executor optionally pays for a tiebreaker.
  //
  // FLAT PATH (fallback): main-agent hires all specialists up-front via
  // selectSpecialists()/hireSpecialists() and passes them to an in-process
  // runAdversarialDebate(). Used only if the hierarchical path fails entirely
  // or USE_HIERARCHICAL_HIRING=false.

  // Definite-assignment: both branches of the if/else below are guaranteed to
  // assign these variables. TS flow analysis can't prove it through the
  // `hierarchicalSucceeded` flag, so we use `!:` to tell it we know better.
  let specialists!: SpecialistResult[];
  let debate!: DebateResult;
  let specialistPath: SpecialistPath = "direct_x402";

  const debateCtx: DebateCallContext = {
    userGoal: goal,
    userWalletIndex: user.hotWalletIndex,
    riskProfile: user.agent.riskProfile as RiskProfile,
    marketVolatility: "medium",
    maxTradePercent: user.agent.maxTradePercent,
    cycleLiquidity,
  };

  let hierarchicalSucceeded = false;
  if (USE_HIERARCHICAL_HIRING) {
    try {
      console.log(`[cycle] Hierarchical hiring: delegating to debate tier`);

      // Alpha hires its own specialists and builds bull thesis
      const alphaResp = await callDebateAgent("alpha", debateCtx);
      console.log(`[cycle] Alpha hired ${alphaResp.specialists_hired.length} specialists (cost $${alphaResp.total_cost_usd.toFixed(4)})`);

      // Risk reads Alpha's thesis, hires its own defensive specialists, challenges
      const riskResp = await callDebateAgent("risk", {
        ...debateCtx,
        alphaThesis: alphaResp.reasoning,
        alphaParsed: alphaResp.parsed,
      });
      console.log(`[cycle] Risk hired ${riskResp.specialists_hired.length} specialists (cost $${riskResp.total_cost_usd.toFixed(4)})`);

      // Executor reads both, optionally hires a tiebreaker, makes final call
      const executorResp = await callDebateAgent("executor", {
        ...debateCtx,
        alphaThesis: alphaResp.reasoning,
        alphaParsed: alphaResp.parsed,
        riskChallenge: riskResp.reasoning,
        riskParsed: riskResp.parsed,
      });
      console.log(`[cycle] Executor hired ${executorResp.specialists_hired.length} specialists (cost $${executorResp.total_cost_usd.toFixed(4)})`);

      // Flatten all hired specialists into SpecialistResult[] for downstream code.
      // Each one gets hiredBy tag so we know which debate agent paid for it.
      // picks[] is preserved so the debate layer can see multi-token shortlists.
      // The 7B model frequently hallucinates off-universe tickers (ADA, SOL, BTC)
      // despite prompts explicitly forbidding it — filterTradeablePicks enforces
      // the EVM whitelist at code level and substitutes a WETH fallback when
      // every pick violates. See pick-filter.ts + Problem 1 in SYSTEM_STATE_AND_FIXES.
      const flatten = (resp: DebateAgentResponse): SpecialistResult[] =>
        resp.specialists_hired.map((s) => {
          const filtered = filterTradeablePicks(s.picks, s.signal, s.confidence);
          const base: SpecialistResult = {
            name: s.name,
            signal: s.signal,
            confidence: s.confidence,
            reasoning: s.reasoning ?? "",
            attestationHash: s.attestation,
            teeVerified: false,
            reputation: 500,
            hiredBy: resp.name,
            paymentTxHash: s.paymentTxHash,
            priceUsd: s.priceUsd,
            rawDataSnapshot: s.rawDataSnapshot,
            picks: filtered.picks,
          };
          if (filtered.substituted) {
            base.picks_substituted = true;
            base.picks_dropped = filtered.droppedAssets;
            console.warn(
              `[cycle] ${s.name} picks filtered: dropped [${filtered.droppedAssets.join(",")}] → fallback ${filtered.picks[0]?.asset ?? "WETH"}`,
            );
          }
          return base;
        });

      specialists = [
        ...flatten(alphaResp),
        ...flatten(riskResp),
        ...flatten(executorResp),
      ];

      // Log each SPECIALIST_HIRED action with hiredBy attribution (main-agent
      // owns DB writes; the Fly.io containers only return metadata).
      for (const spec of specialists) {
        await logAction({
          userId: user.id,
          actionType: "SPECIALIST_HIRED",
          agentName: spec.name,
          attestationHash: spec.attestationHash,
          teeVerified: spec.teeVerified,
          paymentAmount: "0.001",
          paymentNetwork: "arc",
          paymentTxHash: spec.paymentTxHash,
          payload: {
            signal: spec.signal,
            confidence: spec.confidence,
            hiredBy: spec.hiredBy,
            method: "hierarchical_x402",
          },
        }).catch(() => {});
      }

      // Emit swarm-hire events with FULL input/output persisted to 0G Storage.
      // Each hire event's `sh` field is the 0G rootHash of a RichHireData
      // payload containing the market data snapshot, full parsed JSON, full
      // cot, full attestation, payment proof, and reasoning. Done in parallel
      // via Promise.all so N specialists don't add N × (0G latency) to the
      // cycle — the batch completes in ~the slowest single upload.
      await Promise.all(
        specialists.map((spec) =>
          emitHireWithRichData(
            {
              ev: "hire",
              c: cycleId,
              by: spec.hiredBy ?? "main",
              to: spec.name,
              sig: spec.signal,
              conf: spec.confidence,
              cot: normalizeCot(
                (spec as unknown as { cot?: unknown }).cot,
                spec.reasoning,
              ),
              att: (spec.attestationHash ?? "").slice(0, 16),
            },
            buildRichHireData(spec, cycleId, user.id, `[hierarchical] ${spec.hiredBy ?? "main"} hired ${spec.name} for debate`),
          ),
        ),
      );

      // Emit synthesized debate-turn events for the hierarchical path, also
      // with full 0G-persisted rich payloads so the complete remote agent
      // response (content, parsed, reasoning, attestation) is verifiable.
      // The turns already ran on Fly.io — we reconstruct the input context
      // from the ctx we sent and capture the full response for 0G.
      const hTurn1 = 1;
      const hTurn2 = 2;
      const hTurn3 = 3;
      await Promise.all([
        emitTurnWithRichData(
          {
            ev: "turn",
            c: cycleId,
            t: hTurn1,
            ph: "opening",
            from: "alpha",
            cot: normalizeCot((alphaResp.parsed as { cot?: unknown }).cot, alphaResp.reasoning),
            verdict: compactVerdict(alphaResp.parsed),
            att: (alphaResp.attestationHash ?? "").slice(0, 16),
          },
          buildRichTurnFromHierarchical(alphaResp, hTurn1, "opening", "alpha", undefined, cycleId, user.id, debateCtx),
        ),
        emitTurnWithRichData(
          {
            ev: "turn",
            c: cycleId,
            t: hTurn2,
            ph: "opening",
            from: "risk",
            to: "alpha",
            cot: normalizeCot((riskResp.parsed as { cot?: unknown }).cot, riskResp.reasoning),
            verdict: compactVerdict(riskResp.parsed),
            att: (riskResp.attestationHash ?? "").slice(0, 16),
          },
          buildRichTurnFromHierarchical(
            riskResp,
            hTurn2,
            "opening",
            "risk",
            "alpha",
            cycleId,
            user.id,
            { ...debateCtx, alphaThesis: alphaResp.reasoning, alphaParsed: alphaResp.parsed },
          ),
        ),
        emitTurnWithRichData(
          {
            ev: "turn",
            c: cycleId,
            t: hTurn3,
            ph: "decision",
            from: "executor",
            cot: normalizeCot((executorResp.parsed as { cot?: unknown }).cot, executorResp.reasoning),
            verdict: compactVerdict(executorResp.parsed),
            att: (executorResp.attestationHash ?? "").slice(0, 16),
          },
          buildRichTurnFromHierarchical(
            executorResp,
            hTurn3,
            "decision",
            "executor",
            undefined,
            cycleId,
            user.id,
            {
              ...debateCtx,
              alphaThesis: alphaResp.reasoning,
              alphaParsed: alphaResp.parsed,
              riskChallenge: riskResp.reasoning,
              riskParsed: riskResp.parsed,
            },
          ),
        ),
      ]);

      debate = synthesizeDebateResult(alphaResp, riskResp, executorResp);
      hierarchicalSucceeded = true;
      specialistPath = "hierarchical_x402"; // debate agents autonomously hired their own specialists
      console.log(`[cycle] Hierarchical debate complete — executor: ${JSON.stringify(debate.executor.parsed)}`);
    } catch (err) {
      console.warn(`[cycle] Hierarchical hiring failed, falling back to flat path:`, err instanceof Error ? err.message : String(err));
    }
  }

  if (!hierarchicalSucceeded) {
    // LEGACY FLAT PATH (fallback / rollback insurance)
    const selectedIds = selectSpecialists({
      userRiskProfile: user.agent.riskProfile,
      marketVolatility: "medium",
      recentNewsCount: 0,
      portfolioExposure: 0,
    });
    console.log(`[cycle] Flat path: selected specialists ${selectedIds.join(", ")}`);

    // Direct x402 hiring — primary path when hierarchical is disabled or unreachable.
    // NO silent fallback to mock data: if both the primary and legacy marketplace
    // paths return zero specialists, we throw and the API route surfaces a 500
    // so the user/operator knows the swarm is down instead of seeing fake signals.
    specialists = await hireSpecialists(
      selectedIds,
      `Analyze current market conditions for ETH. Risk profile: ${user.agent.riskProfile}. Max allocation: ${user.agent.maxTradePercent}%.`,
      user.id,
      user.hotWalletIndex,
    );

    if (specialists.length === 0) {
      console.warn("[cycle] Primary hiring returned 0 results, trying legacy marketplace...");
      let payFetch: typeof fetch;
      try {
        payFetch = user.hotWalletIndex != null ? getUserPaymentFetch(user.hotWalletIndex) : fetch;
      } catch {
        payFetch = fetch;
      }
      specialists = await hireFromMarketplace(payFetch, user.id, {
        tags: ["sentiment", "whale", "momentum"],
        minReputation: 0,
        maxHires: 3,
      });
    }

    if (specialists.length === 0) {
      throw new Error(
        "SPECIALIST_HIRING_FAILED: hierarchical and direct x402 paths both returned zero specialists. " +
          "Verify the swarm (localhost:4001-4010 or Fly.io agents) is reachable and the x402 paywall is responding.",
      );
    }
    specialists.sort((a, b) => (b.reputation ?? 500) - (a.reputation ?? 500));

    // Apply the same EVM whitelist guard to the flat-path picks so the
    // debate layer only ever sees tradeable tickers regardless of which
    // hiring path fired. See pick-filter.ts.
    for (const spec of specialists) {
      const filtered = filterTradeablePicks(spec.picks, spec.signal, spec.confidence);
      spec.picks = filtered.picks;
      if (filtered.substituted) {
        spec.picks_substituted = true;
        spec.picks_dropped = filtered.droppedAssets;
        console.warn(
          `[cycle] ${spec.name} picks filtered (flat path): dropped [${filtered.droppedAssets.join(",")}] → fallback ${filtered.picks[0]?.asset ?? "WETH"}`,
        );
      }
    }

    // Emit one swarm-hire event per fulfilled specialist in the flat path,
    // each with a full RichHireData payload persisted to 0G Storage. The
    // hiring agent is "main" because this path hires up-front before any
    // debate agent has spoken. Done in parallel so N specialists add
    // ~1 × (0G latency) to the cycle, not N × it.
    const flatHireTask = `Analyze current market conditions for ETH. Risk profile: ${user.agent.riskProfile}. Max allocation: ${user.agent.maxTradePercent}%.`;
    await Promise.all(
      specialists.map((sp) =>
        emitHireWithRichData(
          {
            ev: "hire",
            c: cycleId,
            by: "main",
            to: sp.name,
            sig: sp.signal,
            conf: sp.confidence,
            cot: normalizeCot(
              (sp as unknown as { cot?: unknown }).cot,
              sp.reasoning,
            ),
            att: (sp.attestationHash ?? "").slice(0, 16),
          },
          buildRichHireData(sp, cycleId, user.id, flatHireTask),
        ),
      ),
    );

    debate = await runAdversarialDebate(specialists, user.agent.riskProfile, user.agent.maxTradePercent, cycleId, user.id);
    specialistPath = "direct_x402";
    console.log(`[cycle] Flat debate complete — executor: ${JSON.stringify(debate.executor.parsed)}`);
  }

  // Log debate stages (non-fatal)
  try {
    await logAction({ userId: user.id, actionType: "DEBATE_ALPHA", agentName: "alpha", attestationHash: debate.alpha.attestationHash, teeVerified: debate.alpha.teeVerified, payload: debate.alpha.parsed as Record<string, unknown> });
    await logAction({ userId: user.id, actionType: "DEBATE_RISK", agentName: "risk", attestationHash: debate.risk.attestationHash, teeVerified: debate.risk.teeVerified, payload: debate.risk.parsed as Record<string, unknown> });
    await logAction({ userId: user.id, actionType: "DEBATE_EXECUTOR", agentName: "executor", attestationHash: debate.executor.attestationHash, teeVerified: debate.executor.teeVerified, payload: debate.executor.parsed as Record<string, unknown> });
  } catch (err) {
    console.warn("[cycle] logAction debate failed (non-fatal):", err instanceof Error ? err.message : String(err));
  }

  // 3. Build compact + rich records (but do NOT commit to HCS/0G yet).
  // The rich record carries the cycleLiquidity snapshot so commitCycle can
  // cap the swap amount against real proxy balance even though it runs in a
  // separate function call (potentially after user approval delay).
  const payments = buildPaymentRecords(specialists);
  const compactRecord = buildCompactRecord(cycleId, user, goal, specialists, debate);
  const richRecord = buildRichRecord(cycleId, user, goal, specialists, debate, payments, cycleLiquidity);

  return {
    userId: user.id,
    cycleId,
    goal,
    specialists,
    debate,
    compactRecord,
    richRecord,
    specialistPath,
    openclawGatewayStatus,
  };
}

// ── Phase 2: Commit (log to HCS, 0G, Supabase — only after approval) ────────

export async function commitCycle(
  analysis: AnalysisResult,
  user: UserRecord,
  modifiedPct?: number,
): Promise<CycleResult> {
  const start = Date.now();
  const { cycleId, goal, specialists, debate } = analysis;
  const payments = [...analysis.richRecord.payments];
  const compactRecord = { ...analysis.compactRecord };
  const richRecord: RichCycleRecord = { ...analysis.richRecord };
  // Liquidity snapshot was captured in analyzeCycle and persisted on the rich
  // record; fall back to zeros if this is a legacy AnalysisResult without it.
  const cycleLiquidity: CycleLiquidity = analysis.richRecord.cycleLiquidity ?? {
    proxyUsd: 0,
    hotUsd: 0,
    availableUsd: 0,
    depositedUsd: user.fund.depositedUsdc,
    timestamp: new Date().toISOString(),
  };

  // Track every chain write so the UI can honestly render "degraded" when
  // something silently fails. Each flag flips to true only on confirmed success.
  const proofs: CycleProofs = { hcs: false, storage: false, inft: false, naryo: false };
  const degradedReasons: string[] = [];

  // Apply modified percentage if user changed it
  if (modifiedPct !== undefined) {
    compactRecord.d.pct = modifiedPct;
    compactRecord.adv.e.pct = modifiedPct;
    richRecord.decision.pct = modifiedPct;
    richRecord.debate.executor.pct = modifiedPct;
  }

  // Parse debate results early — needed for Naryo + swap + Prisma steps
  const alphaParsed = debate.alpha.parsed as { action?: string; pct?: number; asset?: string };
  const riskParsed = debate.risk.parsed as { challenge?: string; objection?: string; max_pct?: number; red_flags?: unknown };
  const execParsed = debate.executor.parsed as { action?: string; pct?: number; stop_loss?: string; asset?: string };

  // ── Deterministic executor override ─────────────────────────────────────
  // The executor prompt explicitly says: "If Risk.max_pct >= 3 AND Risk
  // listed no red_flags, your DEFAULT is to BUY at Risk.max_pct." The 7B
  // qwen model often ignores this and defaults to HOLD on "mixed signals",
  // wasting the upstream debate work. This override enforces the prompt's
  // own stated rule when the model fails to comply.
  //
  // Conditions for override (all must be true):
  //   · Executor picked HOLD
  //   · Alpha proposed BUY with pct > 0
  //   · Risk.max_pct >= 3
  //   · Risk.red_flags is empty / missing
  //   · Alpha proposed a valid asset ticker
  const alphaAction = String(alphaParsed.action ?? "HOLD").toUpperCase();
  const alphaPct = Number(alphaParsed.pct ?? 0);
  const alphaAsset = typeof alphaParsed.asset === "string" && alphaParsed.asset.trim().length > 0
    ? alphaParsed.asset.trim().toUpperCase()
    : null;
  const riskMaxPct = Number(riskParsed.max_pct ?? 0);
  const redFlags = Array.isArray(riskParsed.red_flags) ? (riskParsed.red_flags as unknown[]) : [];
  const executorSaidHold = String(execParsed.action ?? "HOLD").toUpperCase() === "HOLD";
  const debateOverride =
    executorSaidHold &&
    alphaAction === "BUY" &&
    alphaPct > 0 &&
    riskMaxPct >= 3 &&
    redFlags.length === 0 &&
    alphaAsset != null;

  if (debateOverride && alphaAsset) {
    const cappedPct = Math.min(alphaPct, riskMaxPct, user.agent.maxTradePercent);
    // Run the override asset through the EVM whitelist too — alpha's 7B can
    // still hallucinate off-chain tickers. validateTradeableAsset canonicalizes
    // ETH→WETH and falls back to the chain default if alpha picked nonsense.
    const overrideValidation = validateTradeableAsset(alphaAsset);
    console.log(
      `[cycle] Executor override: executor said HOLD but debate default says BUY → forcing BUY ${overrideValidation.asset} ${cappedPct}% (alpha=${alphaPct}%, risk.max=${riskMaxPct}%, user.max=${user.agent.maxTradePercent}%)`,
    );
    // Mutate the parsed result in place — downstream code reads execParsed.
    execParsed.action = "BUY";
    execParsed.pct = cappedPct;
    execParsed.asset = overrideValidation.asset;
    if (!execParsed.stop_loss) execParsed.stop_loss = "-5%";
    // Tag the override on the debate.executor.parsed so it lands in HCS + 0G
    // for full audit transparency — a reader can tell the executor's raw 7B
    // output was overridden and why.
    (debate.executor.parsed as Record<string, unknown>).override_applied = true;
    (debate.executor.parsed as Record<string, unknown>).override_reason =
      `Alpha BUY ${alphaAsset} ${alphaPct}%, Risk.max ${riskMaxPct}% with no red_flags — enforcing prompt default`;
    await logAction({
      userId: user.id,
      actionType: "CYCLE_COMPLETED",
      agentName: "executor-override",
      payload: {
        stage: "override_applied",
        alphaAsset,
        alphaPct,
        riskMaxPct,
        cappedPct,
      },
    }).catch(() => {});
  }

  // 1. Execute Arc swap FIRST if executor decided to trade — so the swap tx
  // hash lands in the rich record before we upload it to 0G. Non-fatal.
  //
  // The swap pipeline runs three sub-steps:
  //   1a. prepareSwapFunds() — bridge USDC from Circle proxy → hot wallet
  //   1b. executeArcSwap()   — sign Uniswap V3 exactInputSingle from hot wallet
  //   1c. computeHoldingsUpdate() + updateUser() — decrement deposited, bump holdings
  //
  // Each sub-step writes an agent_action row so the SSE stream can emit
  // funds_transferring / funds_ready / swap_executed / holdings_updated events.
  let swapResult: ArcSwapResult | undefined;
  let holdingsUpdate: ReturnType<typeof computeHoldingsUpdate> | undefined;
  const finalAction = String(execParsed.action ?? "HOLD");
  const finalPct = modifiedPct ?? Number(execParsed.pct ?? 0);

  // Gate the final asset through the EVM whitelist — the executor's 7B can
  // still hallucinate non-EVM tickers (SIREN, ADA, SOL) even after specialist
  // picks[] are filtered. This is the last line of defense before the asset
  // lands in narrative.headline, HCS d.asset, Prisma cycles.asset, and the UI.
  // If the executor picks junk, fall back to alpha's asset; if that's also
  // junk, fall back to the chain default (WETH on Arc).
  const rawFinalAsset = String((execParsed as { asset?: string }).asset ?? "ETH");
  const alphaAssetForValidation =
    typeof alphaParsed.asset === "string" && alphaParsed.asset.trim()
      ? alphaParsed.asset
      : null;
  const assetValidation = validateTradeableAsset(rawFinalAsset, alphaAssetForValidation);
  const finalAsset = assetValidation.asset;
  if (assetValidation.substituted) {
    console.warn(
      `[cycle] finalAsset filtered: ${assetValidation.original ?? "(empty)"} → ${finalAsset}`,
    );
    (execParsed as Record<string, unknown>).asset_substituted = true;
    (execParsed as Record<string, unknown>).original_asset = assetValidation.original;
    // Reflect the substitution in the executor's persisted output so downstream
    // narrative/HCS readers see the honest chain (was: X, now: Y).
    execParsed.asset = finalAsset;
    await logAction({
      userId: user.id,
      actionType: "CYCLE_COMPLETED",
      agentName: "asset-validator",
      payload: {
        stage: "asset_filtered",
        original: assetValidation.original,
        final: finalAsset,
      },
    }).catch(() => {});
  }

  if (finalAction !== "HOLD" && finalPct > 0 && user.fund.depositedUsdc > 0 && user.hotWalletIndex != null) {
    // Cap the allocation against real proxy-wallet liquidity, not the stale DB
    // `depositedUsdc` value. If the DB and chain have drifted, honoring the
    // smaller of the two is the honest budget — prepareSwapFunds() would
    // otherwise throw later when it couldn't cover the transfer.
    const honestBudget = Math.min(user.fund.depositedUsdc, cycleLiquidity.availableUsd);
    const swapAmount = calculateSwapAmount(honestBudget, finalPct);

    if (swapAmount > 0) {
      try {
        // 1a. Bridge funds from proxy wallet (where user deposits live) to
        //     the agent's hot wallet (which signs the Arc swap).
        await logAction({
          userId: user.id,
          actionType: "PAYMENT_SENT",
          agentName: "fund-swap",
          payload: { stage: "funds_transferring", fromProxy: user.proxyWallet.address, toHot: user.hotWalletAddress, amountUsd: swapAmount },
        }).catch(() => {});

        const prep = await prepareSwapFunds(user, swapAmount);
        console.log(`[cycle] Swap funds prepared: ${prep.skipped ? "already-funded" : `bridged $${prep.transferredUsd.toFixed(4)} via Circle tx ${prep.circleTxId?.slice(0, 10)}…`}`);

        await logAction({
          userId: user.id,
          actionType: "PAYMENT_SENT",
          agentName: "fund-swap",
          paymentNetwork: "arc",
          paymentAmount: prep.transferredUsd.toFixed(6),
          payload: {
            stage: "funds_ready",
            skipped: prep.skipped,
            circleTxId: prep.circleTxId,
            beforeUsd: prep.beforeUsd,
            afterUsd: prep.afterUsd,
          },
        }).catch(() => {});

        // 1b. Sign + send the actual Uniswap V3 exactInputSingle from hot wallet.
        const userKey = getUserPrivateKey(user.hotWalletIndex);
        swapResult = await executeArcSwap({
          userPrivateKey: userKey,
          amountUsd: swapAmount,
        });
        console.log(`[cycle] Arc swap: ${swapResult.success ? swapResult.txHash : swapResult.reason} (method: ${swapResult.method})`);

        await logAction({
          userId: user.id,
          actionType: swapResult.success ? "SWAP_EXECUTED" : "SWAP_FAILED",
          agentName: "arc-swap",
          paymentNetwork: "arc",
          paymentTxHash: swapResult.txHash,
          paymentAmount: swapAmount.toFixed(4),
          payload: {
            ...swapResult,
            asset: finalAsset,
            amountUsd: swapAmount,
          },
        }).catch(() => {});

        // 1c. On success, update the user's DB accounting: the deposited
        //     USDC drops by `swapAmount`, and the holdings map gets the
        //     real token amount derived from the current CoinGecko price.
        //     Falls back to swapAmount/100 only if the price lookup fails
        //     (e.g. the ticker isn't in COINGECKO_IDS).
        if (swapResult.success) {
          const tokenPriceUsd = await getTokenPrice(finalAsset).catch(() => null);
          const approximateTokenAmount =
            tokenPriceUsd && tokenPriceUsd > 0 ? swapAmount / tokenPriceUsd : swapAmount / 100;
          holdingsUpdate = computeHoldingsUpdate(user, finalAsset, swapAmount, approximateTokenAmount);
          try {
            await updateUser(user.id, {
              fund: {
                depositedUsdc: holdingsUpdate.newDepositedUsdc,
                // `holdings` is a typed sub-field under user.fund — Prisma
                // stores the whole fund JSON blob via JSONB merge (`||`), so
                // this upserts without clobbering depositedUsdc/currentNav.
                holdings: holdingsUpdate.newHoldings,
              },
            });
            await logAction({
              userId: user.id,
              actionType: "CYCLE_COMPLETED",
              agentName: "holdings-updater",
              payload: {
                stage: "holdings_updated",
                asset: finalAsset,
                usdcSpent: holdingsUpdate.usdcSpent,
                newDepositedUsdc: holdingsUpdate.newDepositedUsdc,
                newHoldings: holdingsUpdate.newHoldings,
              },
            }).catch(() => {});
            console.log(
              `[cycle] Holdings updated: -$${holdingsUpdate.usdcSpent.toFixed(4)} USDC, +${approximateTokenAmount.toFixed(6)} ${finalAsset}; deposited now $${holdingsUpdate.newDepositedUsdc.toFixed(4)}`,
            );
          } catch (err) {
            console.warn("[cycle] holdings update failed (non-fatal):", err instanceof Error ? err.message : String(err));
          }
        }
      } catch (err) {
        console.warn("[cycle] Arc swap pipeline failed (non-fatal):", err instanceof Error ? err.message : String(err));
        await logAction({
          userId: user.id,
          actionType: "SWAP_FAILED",
          agentName: "arc-swap",
          status: "failed",
          payload: { stage: "pipeline_error", message: err instanceof Error ? err.message : String(err) },
        }).catch(() => {});
      }
    }
  }

  // Fold the swap result into the rich record so 0G + Prisma both see it.
  if (swapResult) {
    richRecord.swap = {
      success: swapResult.success,
      txHash: swapResult.txHash,
      explorerUrl: swapResult.explorerUrl,
      method: swapResult.method,
    };
  }

  // ── Synthesize the augmented-layer narrative (pre-0G) ─────────────────
  // The narrative is the user-facing "what did the agents discuss" summary.
  // It's built BEFORE 0G storage so it can be injected into the rich record
  // and persisted permanently alongside the debate transcript. After storage,
  // the narrative is also:
  //   · emitted as a `cycle_narrative` SSE event by the streaming route
  //     (via the logAction audit row below)
  //   · returned in CycleResult.narrative (consumed by the API / UI)
  const narrative: CycleNarrative = synthesizeCycleNarrative({
    goal,
    specialists,
    debate,
    swap: swapResult,
    finalAsset,
    finalPct,
    newHoldings: holdingsUpdate?.newHoldings ?? {},
    newDepositedUsdc: holdingsUpdate?.newDepositedUsdc ?? user.fund.depositedUsdc,
    tokensAcquired: (holdingsUpdate?.newHoldings?.[finalAsset] ?? 0) -
      ((user.fund as unknown as { holdings?: Record<string, number> }).holdings?.[finalAsset] ?? 0),
    usdcSpent: holdingsUpdate?.usdcSpent ?? null,
    overrideApplied: (debate.executor.parsed as Record<string, unknown>).override_applied === true,
    overrideReason: ((debate.executor.parsed as Record<string, unknown>).override_reason as string) ?? null,
    cycleLiquidity,
    assetSubstituted: (execParsed as Record<string, unknown>).asset_substituted === true,
    originalAsset: (execParsed as Record<string, unknown>).original_asset as string | undefined,
  });
  richRecord.narrative = narrative;
  // Write the post-validation asset into the decision field so HCS + Prisma
  // + the dashboard headline all show the honest ticker instead of the
  // executor's raw (possibly hallucinated) output. buildRichRecord hardcodes
  // "ETH" at construction time; we overwrite it here after asset validation.
  richRecord.decision.asset = finalAsset;
  richRecord.decision.action = String(execParsed.action ?? "HOLD");
  richRecord.decision.pct = modifiedPct ?? finalPct;
  // Propagate asset substitution flags so downstream HCS / Prisma / UI
  // consumers can show "WETH (was: SIREN — filtered)".
  if ((execParsed as Record<string, unknown>).asset_substituted === true) {
    richRecord.decision.assetSubstituted = true;
    richRecord.decision.originalAsset = (execParsed as Record<string, unknown>).original_asset as string | undefined;
  }
  // Also sync the compact record — this is what gets logged to HCS with a
  // 1024-byte ceiling, so readers of the audit chain see the same ticker.
  compactRecord.d.asset = finalAsset;
  compactRecord.d.act = String(execParsed.action ?? "HOLD");
  compactRecord.d.pct = modifiedPct ?? finalPct;

  // Log the narrative as a dedicated audit row so the SSE stream can pick it
  // up and surface it to the client without having to re-synthesize.
  await logAction({
    userId: user.id,
    actionType: "CYCLE_COMPLETED",
    agentName: "narrative",
    payload: {
      stage: "narrative_ready",
      headline: narrative.headline,
      confluence: narrative.marketplaceContext.confluenceScore,
      overrideApplied: narrative.augmentedDebate.overrideApplied,
      finalReasoning: narrative.finalReasoning,
    },
  }).catch(() => {});

  // 2. Store the FULL rich record (now including the narrative) to 0G
  // decentralized storage — this is the source of truth for the UI payment
  // graph + "verify on 0G" independent check. HCS gets only the CID pointer.
  // Order matters: 0G first, HCS second — otherwise HCS can't carry the `sh`
  // field.
  let storageHash: string | undefined;
  try {
    storageHash = await storeMemory(user.id, richRecord);
    proofs.storage = true;
    compactRecord.sh = storageHash; // inject CID into the HCS audit pointer
    console.log(`[cycle] Stored rich record to 0G: ${storageHash}`);
    await logAction({ userId: user.id, actionType: "STORAGE_UPLOADED", payload: { storageHash } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[cycle] 0G storage failed:", msg);
    degradedReasons.push(`0G storage failed: ${msg.slice(0, 80)}`);
  }

  // 3. Log the compact record to Hedera HCS — the audit trail proof. If 0G
  // succeeded, the record now carries `sh` so anyone reading HCS can fetch
  // the full rich record from 0G. Failure here is non-fatal.
  let seqNum = 0;
  let hashscanUrl: string | undefined;
  try {
    const hcsResult = await logCycle(TOPIC_ID, compactRecord);
    seqNum = hcsResult.seqNum;
    hashscanUrl = hcsResult.hashscanUrl;
    proofs.hcs = true;
    console.log(`[cycle] Logged to HCS: seq=${seqNum} ${hashscanUrl}`);
    await logAction({ userId: user.id, actionType: "HCS_LOGGED", payload: { seqNum, hashscanUrl } }).catch(() => {});
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[cycle] HCS log failed:", msg);
    degradedReasons.push(`HCS log failed: ${msg.slice(0, 80)}`);
  }

  // Emit the capstone swarm-done event — closes the per-cycle message cluster
  // on Hashscan with the final decision + 0G CID pointer so verifiers can hop
  // straight from the done event to the rich record in 0G Storage.
  emitSwarmEvent({
    ev: "done",
    c: cycleId,
    d: {
      act: compactRecord.d.act,
      asset: compactRecord.d.asset,
      pct: compactRecord.d.pct,
    },
    sh: storageHash,
    nav: user.fund.currentNav,
  });

  // 3b. Emit CycleCompleted event on Hedera EVM for Naryo (non-fatal — gated
  // behind NARYO_AUDIT_CONTRACT_ADDRESS env var; absence counts as "disabled",
  // not "degraded".
  if (process.env.NARYO_AUDIT_CONTRACT_ADDRESS) {
    try {
      const { emitCycleEvent } = await import("../naryo/emit-event");
      await emitCycleEvent(
        user.walletAddress,
        cycleId,
        compactRecord.d.act ?? "HOLD",
        compactRecord.d.asset ?? "ETH",
        compactRecord.d.pct ?? 0,
      );
      proofs.naryo = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[cycle] Naryo event emit failed:", msg);
      degradedReasons.push(`Naryo event emit failed: ${msg.slice(0, 80)}`);
    }
  } else {
    // Naryo not configured — treated as a successful no-op so it doesn't mark
    // the cycle as degraded on users without the env var set.
    proofs.naryo = true;
  }

  // 4. Update iNFT metadata on 0G Chain — the intelligent NFT proof. Only runs
  // when the user has an iNFT AND storage succeeded (needs the storageHash).
  if (user.inftTokenId && storageHash) {
    try {
      await updateAgentMetadata(user.inftTokenId, storageHash);
      proofs.inft = true;
      await logAction({ userId: user.id, actionType: "INFT_UPDATED", payload: { inftTokenId: user.inftTokenId, storageHash } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[cycle] iNFT update failed:", msg);
      degradedReasons.push(`iNFT metadata update failed: ${msg.slice(0, 80)}`);
    }
  } else if (!user.inftTokenId) {
    // No iNFT minted for this user yet — treat as success so we don't flag
    // cycles as degraded just because the user onboarded before iNFT was live.
    proofs.inft = true;
  } else {
    // Has iNFT but storage failed → iNFT can't be updated → counts as degraded
    degradedReasons.push("iNFT metadata update skipped: 0G storage hash unavailable");
  }

  // 5. Save full cycle record to Supabase (non-fatal). We persist the `goal`
  // and the full `payments` graph so the dashboard can read them without a
  // mirror-node round-trip or a 0G indexer fetch on every page load.
  let cycleDbUuid: string | null = null;
  try {
    cycleDbUuid = await logCycleRecord(user.id, cycleId, {
      goal,
      // Prisma's Json input type rejects typed array literals directly — both
      // payments and specialists are cast to plain records to satisfy it.
      payments: JSON.parse(JSON.stringify(payments)),
      specialists: JSON.parse(JSON.stringify(specialists.map((s) => ({
        name: s.name,
        signal: s.signal,
        confidence: s.confidence,
        attestation: s.attestationHash,
        reasoning: s.reasoning ?? "",
        hiredBy: s.hiredBy ?? "main-agent",
        paymentTxHash: s.paymentTxHash ?? "",
        // Multi-token shortlist — present when the specialist emitted picks[]
        // (sentiment, momentum today; news-scanner etc. to follow). Preserving
        // this so the dashboard + enrichCycleRow can surface the full pick graph.
        picks: s.picks ?? null,
      })))),
      alpha: {
        action: String(alphaParsed.action ?? "HOLD"),
        pct: modifiedPct ?? Number(alphaParsed.pct ?? 0),
        attestation: debate.alpha.attestationHash,
        reasoning: debate.alpha.reasoning ?? "",
      },
      risk: {
        challenge: String(riskParsed.challenge ?? riskParsed.objection ?? "none"),
        maxPct: Number(riskParsed.max_pct ?? 0),
        attestation: debate.risk.attestationHash,
        reasoning: debate.risk.reasoning ?? "",
      },
      executor: {
        action: String(execParsed.action ?? "HOLD"),
        pct: modifiedPct ?? Number(execParsed.pct ?? 0),
        stopLoss: String(execParsed.stop_loss ?? "-5%"),
        attestation: debate.executor.attestationHash,
        reasoning: debate.executor.reasoning ?? "",
      },
      decision: String(execParsed.action ?? "HOLD"),
      // Use the executor's chosen asset (post-override), defaulting to ETH
      // only when the debate produced no valid ticker. finalAsset was set
      // during the swap pipeline step above.
      asset: finalAsset,
      decisionPct: modifiedPct ?? Number(execParsed.pct ?? 0),
      hcsSeqNum: seqNum,
      hashscanUrl,
      storageHash,
      swapTxHash: swapResult?.txHash,
      swapExplorerUrl: swapResult?.explorerUrl,
      totalCostUsd: 0.003,
      navAfter: user.fund.currentNav,
      // Cache the synthesized narrative on the Cycle row so enrichCycleRow
      // returns it directly without re-synthesizing or fetching from 0G.
      narrative: JSON.parse(JSON.stringify(narrative)),
    });
  } catch (err) {
    console.warn("[cycle] logCycleRecord failed (non-fatal):", err instanceof Error ? err.message : String(err));
  }

  // 5b. Record every specialist pick with an entry price snapshot. A later
  //     evaluator job (src/marketplace/pick-tracker.ts evaluatePickPerformance)
  //     scores these picks Δt later by comparing exit price vs entry price,
  //     then updates the specialist's marketplace reputation. This is the
  //     foundation of the hire/fire loop (see SYSTEM_STATE_AND_FIXES.md §2.5).
  if (cycleDbUuid) {
    await recordPickEntries({
      cycleId: cycleDbUuid,
      cycleNumber: cycleId,
      userId: user.id,
      specialists,
    }).catch((err) => {
      console.warn(
        "[cycle] recordPickEntries failed (non-fatal):",
        err instanceof Error ? err.message : String(err),
      );
    });
  }

  // 6. Persist debate transcripts (non-fatal — requires valid cycle UUID from step 5)
  if (debate.transcripts && debate.transcripts.length > 0 && cycleDbUuid) {
    try {
      const prisma = getPrisma();
      await Promise.all(
        debate.transcripts.map((t) =>
          prisma.debateTranscript.create({
            data: {
              cycleId: cycleDbUuid,
              userId: user.id,
              turnNumber: t.turnNumber,
              phase: t.phase,
              fromAgent: t.fromAgent,
              toAgent: t.toAgent ?? null,
              messageContent: t.messageContent,
              responseContent: t.responseContent ?? null,
              attestationHash: t.attestationHash ?? null,
              teeVerified: t.teeVerified ?? false,
              durationMs: t.durationMs,
            },
          }).catch((err: unknown) => {
            console.warn(`[cycle] Transcript turn ${t.turnNumber} save failed:`, err instanceof Error ? err.message : String(err));
          }),
        ),
      );
      console.log(`[cycle] Saved ${debate.transcripts.length} debate transcript turns`);
    } catch (err) {
      console.warn("[cycle] Debate transcript persistence failed (non-fatal):", err instanceof Error ? err.message : String(err));
    }
  }

  // 7. Update user
  await updateUser(user.id, {
    agent: {
      lastCycleId: cycleId,
      lastCycleAt: new Date().toISOString(),
    },
  });

  // 7. Update specialist reputations (non-fatal)
  try {
    const decision = String(execParsed.action ?? "HOLD");
    await evaluateCycleSignals(
      specialists.map((s) => ({ name: s.name, signal: s.signal })),
      decision === "BUY" ? 1.0 : decision === "SELL" ? -1.0 : 0.0,
    );
  } catch (err) {
    console.warn("[cycle] Reputation update failed (non-fatal):", err instanceof Error ? err.message : String(err));
  }

  // 8. Log completion (non-fatal)
  try {
    await logAction({
      userId: user.id,
      actionType: "CYCLE_COMPLETED",
      durationMs: Date.now() - start,
      payload: { decision: execParsed.action ?? "HOLD", seqNum, cycleNumber: cycleId },
    });
  } catch (err) {
    console.warn("[cycle] logAction CYCLE_COMPLETED failed (non-fatal):", err instanceof Error ? err.message : String(err));
  }

  // Compute final degraded state from tracked proofs + specialist TEE verification.
  // A cycle is "degraded" if ANY critical proof failed OR any specialist was not
  // TEE-verified (meaning its inference didn't come from a sealed 0G enclave).
  const anySpecialistUnverified = specialists.some((s) => !s.teeVerified);
  if (anySpecialistUnverified) {
    degradedReasons.push("One or more specialists returned without TEE attestation");
  }
  const degraded = !proofs.hcs || !proofs.storage || !proofs.inft || anySpecialistUnverified;

  return {
    userId: user.id,
    cycleId,
    goal,
    specialists,
    debate,
    decision: debate.executor.parsed,
    payments,
    seqNum,
    hashscanUrl,
    storageHash,
    inftTokenId: user.inftTokenId ?? undefined,
    swapResult,
    timestamp: new Date(),
    specialistPath: analysis.specialistPath ?? "direct_x402",
    openclawGatewayStatus: analysis.openclawGatewayStatus ?? "offline",
    proofs,
    degraded,
    degradedReasons,
    narrative,
  };
}

// ── Rejection path (no on-chain logging) ─────────────────────────────────────

export async function rejectCycle(
  analysis: AnalysisResult,
  user: UserRecord,
  reason: string,
): Promise<void> {
  console.log(`[cycle] Rejected cycle ${analysis.cycleId} for user ${user.id}: ${reason}`);

  try {
    await logAction({
      userId: user.id,
      actionType: "CYCLE_REJECTED",
      payload: { cycleNumber: analysis.cycleId, reason },
    });
  } catch (err) {
    console.warn("[cycle] logAction CYCLE_REJECTED failed (non-fatal):", err instanceof Error ? err.message : String(err));
  }

  // Keep cycle numbering consistent
  await updateUser(user.id, {
    agent: {
      lastCycleId: analysis.cycleId,
      lastCycleAt: new Date().toISOString(),
    },
  });
}

// ── Backward-compat wrapper (used by heartbeat auto-mode) ────────────────────

export async function runCycle(user: UserRecord, userGoal?: string): Promise<CycleResult> {
  const analysis = await analyzeCycle(user, userGoal);
  return commitCycle(analysis, user);
}
