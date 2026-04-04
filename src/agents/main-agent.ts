import { updateUser } from "../store/user-store";
import { logAction, logCycleRecord } from "../store/action-logger";
import { runAdversarialDebate } from "./adversarial";
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
import { prepareSwapFunds, computeHoldingsUpdate } from "../payments/fund-swap";
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
} from "../types/index";
import type { RiskProfile, MarketVolatility, DebateRole } from "./role-manifests";

const TOPIC_ID = process.env.HCS_AUDIT_TOPIC_ID!;

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

// Lean HCS audit pointer (must fit under 1024 bytes). The full record — goal,
// payment graph, reasoning, full attestation hashes — lives in 0G Storage; the
// `sh` field (storageHash/CID) is injected by commitCycle after the 0G write
// so independent verifiers reading HCS can hop to the rich record.
function buildCompactRecord(
  cycleId: number,
  user: UserRecord,
  goal: string,
  specialists: SpecialistResult[],
  debate: DebateResult,
): CompactCycleRecord {
  const alphaParsed = debate.alpha.parsed as { action?: string; pct?: number };
  const riskParsed = debate.risk.parsed as { challenge?: string; objection?: string; max_pct?: number };
  const execParsed = debate.executor.parsed as { action?: string; pct?: number; stop_loss?: string };

  const stopLoss = parseFloat(String(execParsed.stop_loss ?? "-5").replace("%", "").replace("-", ""));

  const record: CompactCycleRecord = {
    c: cycleId,
    u: user.id,
    t: new Date().toISOString(),
    rp: user.agent.riskProfile,
    g: goal.slice(0, 120) || undefined,
    s: specialists.map((sp) => ({
      n: sp.name,
      sig: sp.signal,
      conf: sp.confidence,
      att: sp.attestationHash.slice(0, 16),
    })),
    adv: {
      a: {
        act: String(alphaParsed.action ?? "HOLD"),
        pct: Number(alphaParsed.pct ?? 0),
        att: debate.alpha.attestationHash.slice(0, 16),
        r: (debate.alpha.reasoning ?? "").slice(0, 60) || undefined,
      },
      r: {
        obj: String(riskParsed.challenge ?? riskParsed.objection ?? "none").slice(0, 40),
        max: Number(riskParsed.max_pct ?? 0),
        att: debate.risk.attestationHash.slice(0, 16),
        r: (debate.risk.reasoning ?? "").slice(0, 60) || undefined,
      },
      e: {
        act: String(execParsed.action ?? "HOLD"),
        pct: Number(execParsed.pct ?? 0),
        sl: stopLoss,
        att: debate.executor.attestationHash.slice(0, 16),
        r: (debate.executor.reasoning ?? "").slice(0, 60) || undefined,
      },
    },
    d: {
      act: String(execParsed.action ?? "HOLD"),
      asset: "ETH",
      pct: Number(execParsed.pct ?? 0),
    },
    nav: user.fund.currentNav,
  };

  // Safety check: drop reasoning excerpts if record exceeds HCS byte limit.
  // We reserved ~80 bytes for the `sh` field that commitCycle will inject
  // after the 0G storage upload, so the ceiling here is 870 instead of 950.
  if (Buffer.byteLength(JSON.stringify(record), "utf8") > 870) {
    delete record.adv.a.r;
    delete record.adv.r.r;
    delete record.adv.e.r;
  }
  // If still over, drop the goal excerpt (0G has it anyway).
  if (Buffer.byteLength(JSON.stringify(record), "utf8") > 870) {
    delete record.g;
  }

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
      const flatten = (resp: DebateAgentResponse): SpecialistResult[] =>
        resp.specialists_hired.map((s) => ({
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
        }));

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
          paymentAmount: "$0.001",
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

    debate = await runAdversarialDebate(specialists, user.agent.riskProfile, user.agent.maxTradePercent);
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

  // 3. Build compact + rich records (but do NOT commit to HCS/0G yet)
  const payments = buildPaymentRecords(specialists);
  const compactRecord = buildCompactRecord(cycleId, user, goal, specialists, debate);
  const richRecord = buildRichRecord(cycleId, user, goal, specialists, debate, payments);

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
  const alphaParsed = debate.alpha.parsed as { action?: string; pct?: number };
  const riskParsed = debate.risk.parsed as { challenge?: string; objection?: string; max_pct?: number };
  const execParsed = debate.executor.parsed as { action?: string; pct?: number; stop_loss?: string };

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
  const finalAsset = String((execParsed as { asset?: string }).asset ?? "ETH");

  if (finalAction !== "HOLD" && finalPct > 0 && user.fund.depositedUsdc > 0 && user.hotWalletIndex != null) {
    const swapAmount = calculateSwapAmount(user.fund.depositedUsdc, finalPct);

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
          paymentAmount: `$${prep.transferredUsd.toFixed(6)}`,
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
          paymentAmount: `$${swapAmount.toFixed(4)}`,
          payload: {
            ...swapResult,
            asset: finalAsset,
            amountUsd: swapAmount,
          },
        }).catch(() => {});

        // 1c. On success, update the user's DB accounting: the deposited
        //     USDC drops by `swapAmount`, and the holdings map gets the
        //     estimated token amount (USD / current price — we track USD
        //     equivalent since a proper quoter isn't wired for all tokens).
        if (swapResult.success) {
          const approximateTokenAmount = swapAmount / 100; // rough placeholder — proper quoter TODO
          holdingsUpdate = computeHoldingsUpdate(user, finalAsset, swapAmount, approximateTokenAmount);
          try {
            await updateUser(user.id, {
              fund: {
                depositedUsdc: holdingsUpdate.newDepositedUsdc,
                // `holdings` is a new sub-field under user.fund — Prisma stores
                // the whole fund JSON blob via JSONB merge, so this upserts.
                ...(({ holdings: holdingsUpdate.newHoldings } as unknown) as Record<string, never>),
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

  // 2. Store the FULL rich record to 0G decentralized storage — this is the
  // source of truth for the UI payment graph + "verify on 0G" independent
  // check. HCS gets only the CID pointer. Order matters: 0G first, HCS
  // second — otherwise HCS can't carry the `sh` field.
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
      asset: "ETH",
      decisionPct: modifiedPct ?? Number(execParsed.pct ?? 0),
      hcsSeqNum: seqNum,
      hashscanUrl,
      storageHash,
      swapTxHash: swapResult?.txHash,
      swapExplorerUrl: swapResult?.explorerUrl,
      totalCostUsd: 0.003,
      navAfter: user.fund.currentNav,
    });
  } catch (err) {
    console.warn("[cycle] logCycleRecord failed (non-fatal):", err instanceof Error ? err.message : String(err));
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
