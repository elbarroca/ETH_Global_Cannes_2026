import { updateUser } from "../store/user-store.js";
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
  console.log(`[cycle] Starting for user ${user.id} (risk: ${user.agent.riskProfile})`);
  console.log(`[cycle] Proxy wallet: ${user.proxyWallet.address} (Circle: ${user.proxyWallet.walletId})`);

  // 1. Hire specialists (with payment stub — Circle holds keys, no local wallet needed)
  const payFetch = createPaymentFetch(null);
  let specialists: SpecialistResult[];
  try {
    specialists = await Promise.all(
      SPECIALIST_URLS.map((url) => hire(payFetch, url)),
    );
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

  // 3. Log to Hedera HCS
  const cycleId = user.agent.lastCycleId + 1;
  const record = buildCompactRecord(cycleId, user, specialists, debate);
  const { seqNum, hashscanUrl } = await logCycle(TOPIC_ID, record);
  console.log(`[cycle] Logged to HCS: seq=${seqNum} ${hashscanUrl}`);

  // 3b. Store cycle result to 0G decentralized storage (non-fatal)
  let storageHash: string | undefined;
  try {
    storageHash = await storeMemory(user.id, record);
    console.log(`[cycle] Stored to 0G: ${storageHash}`);
  } catch (err) {
    console.warn("[cycle] 0G storage failed (non-fatal):", err instanceof Error ? err.message : String(err));
  }

  // 3c. Update iNFT metadata on 0G Chain (non-fatal)
  if (user.inftTokenId && storageHash) {
    try {
      await updateAgentMetadata(user.inftTokenId, storageHash);
    } catch (err) {
      console.warn("[cycle] iNFT update failed (non-fatal):", err instanceof Error ? err.message : String(err));
    }
  }

  // 4. Update user
  await updateUser(user.id, {
    agent: {
      lastCycleId: cycleId,
      lastCycleAt: new Date().toISOString(),
    },
  });

  // 5. Return result
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
