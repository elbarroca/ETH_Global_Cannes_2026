import { updateUser } from "../store/user-store";
import { logAction, logCycleRecord } from "../store/action-logger";
import { runAdversarialDebate } from "./adversarial";
import { logCycle } from "../hedera/hcs";
import { storeMemory } from "../og/storage";
import { updateAgentMetadata } from "../og/inft";
import { getUserPaymentFetch } from "../config/arc";
import { hireFromMarketplace } from "../marketplace/registry";
import { evaluateCycleSignals } from "../marketplace/reputation";
import type {
  UserRecord,
  SpecialistResult,
  CycleResult,
  CompactCycleRecord,
  DebateResult,
} from "../types/index";

const TOPIC_ID = process.env.HCS_AUDIT_TOPIC_ID!;

function buildCompactRecord(
  cycleId: number,
  user: UserRecord,
  specialists: SpecialistResult[],
  debate: DebateResult,
): CompactCycleRecord {
  const alphaParsed = debate.alpha.parsed as { action?: string; pct?: number };
  const riskParsed = debate.risk.parsed as { challenge?: string; max_pct?: number };
  const execParsed = debate.executor.parsed as { action?: string; pct?: number; stop_loss?: string };

  const stopLoss = parseFloat(String(execParsed.stop_loss ?? "-5").replace("%", "").replace("-", ""));

  return {
    c: cycleId,
    u: user.id,
    t: new Date().toISOString(),
    rp: user.agent.riskProfile,
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
      },
      r: {
        obj: String(riskParsed.challenge ?? "none").slice(0, 40),
        max: Number(riskParsed.max_pct ?? 0),
        att: debate.risk.attestationHash.slice(0, 16),
      },
      e: {
        act: String(execParsed.action ?? "HOLD"),
        pct: Number(execParsed.pct ?? 0),
        sl: stopLoss,
        att: debate.executor.attestationHash.slice(0, 16),
      },
    },
    d: {
      act: String(execParsed.action ?? "HOLD"),
      asset: "ETH",
      pct: Number(execParsed.pct ?? 0),
    },
    nav: user.fund.currentNav,
  };
}

export async function runCycle(user: UserRecord): Promise<CycleResult> {
  const start = Date.now();
  const cycleId = user.agent.lastCycleId + 1;

  console.log(`[cycle] Starting for user ${user.id} (risk: ${user.agent.riskProfile})`);
  console.log(`[cycle] Proxy wallet: ${user.proxyWallet.address} (Circle: ${user.proxyWallet.walletId})`);

  // Log cycle start (non-fatal — Prisma may not be configured)
  try {
    await logAction({
      userId: user.id,
      actionType: "CYCLE_STARTED",
      payload: { cycleNumber: cycleId, riskProfile: user.agent.riskProfile },
    });
  } catch (err) {
    console.warn("[cycle] logAction CYCLE_STARTED failed (non-fatal):", err instanceof Error ? err.message : String(err));
  }

  // 1. Hire specialists via x402 nanopayments on Arc (per-user HD wallet)
  let payFetch: typeof fetch;
  try {
    if (user.hotWalletIndex != null) {
      payFetch = getUserPaymentFetch(user.hotWalletIndex);
    } else {
      console.warn("[cycle] No hot wallet for user, using bare fetch");
      payFetch = fetch;
    }
  } catch (err) {
    console.warn("[cycle] x402 setup failed, using bare fetch:", err instanceof Error ? err.message : String(err));
    payFetch = fetch;
  }
  let specialists: SpecialistResult[];
  try {
    specialists = await hireFromMarketplace(payFetch, user.id, {
      tags: ["sentiment", "whale", "momentum"],
      minReputation: 300,
      maxHires: 3,
    });
    if (specialists.length === 0) throw new Error("No specialists returned");
  } catch (err) {
    console.warn("[cycle] Marketplace hiring failed, using mock data:", err);
    specialists = [
      { name: "sentiment", signal: "BUY", confidence: 65, attestationHash: "mock-s", teeVerified: false },
      { name: "whale", signal: "HOLD", confidence: 50, attestationHash: "mock-w", teeVerified: false },
      { name: "momentum", signal: "BUY", confidence: 70, attestationHash: "mock-m", teeVerified: false },
    ];
  }
  console.log(`[cycle] Specialists: ${specialists.map((s) => `${s.name}=${s.signal}`).join(", ")}`);

  // 2. Adversarial debate
  const debate = await runAdversarialDebate(
    specialists,
    user.agent.riskProfile,
    user.agent.maxTradePercent,
  );
  console.log(`[cycle] Debate complete — executor: ${JSON.stringify(debate.executor.parsed)}`);

  // Log debate stages (non-fatal)
  try {
    await logAction({ userId: user.id, actionType: "DEBATE_ALPHA", agentName: "alpha", attestationHash: debate.alpha.attestationHash, teeVerified: debate.alpha.teeVerified, payload: debate.alpha.parsed as Record<string, unknown> });
    await logAction({ userId: user.id, actionType: "DEBATE_RISK", agentName: "risk", attestationHash: debate.risk.attestationHash, teeVerified: debate.risk.teeVerified, payload: debate.risk.parsed as Record<string, unknown> });
    await logAction({ userId: user.id, actionType: "DEBATE_EXECUTOR", agentName: "executor", attestationHash: debate.executor.attestationHash, teeVerified: debate.executor.teeVerified, payload: debate.executor.parsed as Record<string, unknown> });
  } catch (err) {
    console.warn("[cycle] logAction debate failed (non-fatal):", err instanceof Error ? err.message : String(err));
  }

  // 3. Log to Hedera HCS (non-fatal — stub seqNum/hashscanUrl if not configured)
  const record = buildCompactRecord(cycleId, user, specialists, debate);
  let seqNum = 0;
  let hashscanUrl = "";
  try {
    ({ seqNum, hashscanUrl } = await logCycle(TOPIC_ID, record));
    console.log(`[cycle] Logged to HCS: seq=${seqNum} ${hashscanUrl}`);
    await logAction({ userId: user.id, actionType: "HCS_LOGGED", payload: { seqNum, hashscanUrl } }).catch(() => {});
  } catch (err) {
    console.warn("[cycle] HCS log failed (non-fatal):", err instanceof Error ? err.message : String(err));
    hashscanUrl = `https://hashscan.io/testnet/topic/${TOPIC_ID || "unconfigured"}`;
  }

  // 3b. Store cycle result to 0G decentralized storage (non-fatal)
  let storageHash: string | undefined;
  try {
    storageHash = await storeMemory(user.id, record);
    console.log(`[cycle] Stored to 0G: ${storageHash}`);
    await logAction({
      userId: user.id,
      actionType: "STORAGE_UPLOADED",
      payload: { storageHash },
    });
  } catch (err) {
    console.warn("[cycle] 0G storage failed (non-fatal):", err instanceof Error ? err.message : String(err));
  }

  // 3c. Update iNFT metadata on 0G Chain (non-fatal)
  if (user.inftTokenId && storageHash) {
    try {
      await updateAgentMetadata(user.inftTokenId, storageHash);
      await logAction({
        userId: user.id,
        actionType: "INFT_UPDATED",
        payload: { inftTokenId: user.inftTokenId, storageHash },
      });
    } catch (err) {
      console.warn("[cycle] iNFT update failed (non-fatal):", err instanceof Error ? err.message : String(err));
    }
  }

  // 4. Parse debate results for cycle record
  const alphaParsed = debate.alpha.parsed as { action?: string; pct?: number };
  const riskParsed = debate.risk.parsed as { challenge?: string; max_pct?: number };
  const execParsed = debate.executor.parsed as { action?: string; pct?: number; stop_loss?: string };

  // 5. Save full cycle record to Supabase (non-fatal)
  try { await logCycleRecord(user.id, cycleId, {
    specialists: specialists.map((s) => ({
      name: s.name,
      signal: s.signal,
      confidence: s.confidence,
      attestation: s.attestationHash,
    })),
    alpha: {
      action: String(alphaParsed.action ?? "HOLD"),
      pct: Number(alphaParsed.pct ?? 0),
      attestation: debate.alpha.attestationHash,
    },
    risk: {
      challenge: String(riskParsed.challenge ?? "none"),
      maxPct: Number(riskParsed.max_pct ?? 0),
      attestation: debate.risk.attestationHash,
    },
    executor: {
      action: String(execParsed.action ?? "HOLD"),
      pct: Number(execParsed.pct ?? 0),
      stopLoss: String(execParsed.stop_loss ?? "-5%"),
      attestation: debate.executor.attestationHash,
    },
    decision: String(execParsed.action ?? "HOLD"),
    asset: "ETH",
    decisionPct: Number(execParsed.pct ?? 0),
    hcsSeqNum: seqNum,
    hashscanUrl,
    storageHash,
    totalCostUsd: 0.003,
    navAfter: user.fund.currentNav,
  }); } catch (err) {
    console.warn("[cycle] logCycleRecord failed (non-fatal):", err instanceof Error ? err.message : String(err));
  }

  // 6. Update user
  await updateUser(user.id, {
    agent: {
      lastCycleId: cycleId,
      lastCycleAt: new Date().toISOString(),
    },
  });

  // 7. Update specialist reputations (non-fatal)
  // NOTE: Uses executor decision as proxy for correctness. True accuracy requires
  // comparing against actual price movement in subsequent cycles.
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

  // 9. Return result
  return {
    userId: user.id,
    cycleId,
    specialists,
    debate,
    decision: debate.executor.parsed,
    seqNum,
    hashscanUrl,
    timestamp: new Date(),
  };
}
