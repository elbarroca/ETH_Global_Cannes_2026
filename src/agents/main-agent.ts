import { updateUser } from "../store/user-store.js";
import { logAction, logCycleRecord } from "../store/action-logger.js";
import { runAdversarialDebate } from "./adversarial.js";
import { logCycle } from "../hedera/hcs.js";
import { storeMemory } from "../og/storage.js";
import { updateAgentMetadata } from "../og/inft.js";
import type {
  UserRecord,
  SpecialistResult,
  CycleResult,
  CompactCycleRecord,
  DebateResult,
} from "../types/index.js";

const TOPIC_ID = process.env.HCS_AUDIT_TOPIC_ID!;

const SPECIALIST_URLS = [
  "http://localhost:4001/analyze",
  "http://localhost:4002/analyze",
  "http://localhost:4003/analyze",
];

// STUB — replace when Dev B delivers x402-client.ts
function createPaymentFetch(_account: unknown): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    return fetch(input, init);
  };
}

async function hire(fetchFn: typeof fetch, url: string): Promise<SpecialistResult> {
  const res = await fetchFn(url);
  if (!res.ok) {
    throw new Error(`Specialist ${url} returned ${res.status}`);
  }
  return (await res.json()) as SpecialistResult;
}

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

  // Log cycle start
  await logAction({
    userId: user.id,
    actionType: "CYCLE_STARTED",
    payload: { cycleNumber: cycleId, riskProfile: user.agent.riskProfile },
  });

  // 1. Hire specialists (with payment stub — Circle holds keys, no local wallet needed)
  const payFetch = createPaymentFetch(null);
  let specialists: SpecialistResult[];
  try {
    const results: SpecialistResult[] = [];
    for (const [i, url] of SPECIALIST_URLS.entries()) {
      const t0 = Date.now();
      try {
        const sp = await hire(payFetch, url);
        results.push(sp);
        await logAction({
          userId: user.id,
          actionType: "SPECIALIST_HIRED",
          agentName: sp.name,
          attestationHash: sp.attestationHash,
          teeVerified: sp.teeVerified,
          paymentAmount: "$0.001",
          paymentNetwork: "arc",
          durationMs: Date.now() - t0,
          payload: { signal: sp.signal, confidence: sp.confidence },
        });
      } catch (err) {
        await logAction({
          userId: user.id,
          actionType: "SPECIALIST_HIRED",
          agentName: `specialist-${i}`,
          status: "failed",
          payload: { error: String(err) },
          durationMs: Date.now() - t0,
        });
        throw err;
      }
    }
    specialists = results;
  } catch (err) {
    console.warn("[cycle] Specialist hiring failed, using mock data:", err);
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

  // Log debate stages
  await logAction({
    userId: user.id,
    actionType: "DEBATE_ALPHA",
    agentName: "alpha",
    attestationHash: debate.alpha.attestationHash,
    teeVerified: debate.alpha.teeVerified,
    payload: debate.alpha.parsed as Record<string, unknown>,
  });
  await logAction({
    userId: user.id,
    actionType: "DEBATE_RISK",
    agentName: "risk",
    attestationHash: debate.risk.attestationHash,
    teeVerified: debate.risk.teeVerified,
    payload: debate.risk.parsed as Record<string, unknown>,
  });
  await logAction({
    userId: user.id,
    actionType: "DEBATE_EXECUTOR",
    agentName: "executor",
    attestationHash: debate.executor.attestationHash,
    teeVerified: debate.executor.teeVerified,
    payload: debate.executor.parsed as Record<string, unknown>,
  });

  // 3. Log to Hedera HCS
  const record = buildCompactRecord(cycleId, user, specialists, debate);
  const { seqNum, hashscanUrl } = await logCycle(TOPIC_ID, record);
  console.log(`[cycle] Logged to HCS: seq=${seqNum} ${hashscanUrl}`);

  await logAction({
    userId: user.id,
    actionType: "HCS_LOGGED",
    payload: { seqNum, hashscanUrl },
  });

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

  // 5. Save full cycle record to Supabase
  await logCycleRecord(user.id, cycleId, {
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
  });

  // 6. Update user
  await updateUser(user.id, {
    agent: {
      lastCycleId: cycleId,
      lastCycleAt: new Date().toISOString(),
    },
  });

  // 7. Log completion
  await logAction({
    userId: user.id,
    actionType: "CYCLE_COMPLETED",
    durationMs: Date.now() - start,
    payload: { decision: execParsed.action ?? "HOLD", seqNum, cycleNumber: cycleId },
  });

  // 8. Return result
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
