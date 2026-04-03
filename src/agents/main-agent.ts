import { ethers } from "ethers";
import { loadProxyWallet } from "../store/proxy-wallet.js";
import { updateUser } from "../store/user-store.js";
import { runAdversarialDebate } from "./adversarial.js";
import { logCycle } from "../hedera/hcs.js";
import type {
  UserRecord,
  SpecialistResult,
  CycleResult,
  CompactCycleRecord,
  DebateResult,
} from "../types/index.js";

const TOPIC_ID = process.env.HCS_AUDIT_TOPIC_ID!;
const OG_RPC = process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai";

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
  const alphaParsed = debate.alpha.parsed as { action?: string; allocationPercent?: number };
  const riskParsed = debate.risk.parsed as { objection?: string; maxSafeAllocation?: number };
  const execParsed = debate.executor.parsed as { action?: string; allocationPercent?: number; stopLossPercent?: number };

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
        pct: Number(alphaParsed.allocationPercent ?? 0),
        att: debate.alpha.attestationHash.slice(0, 16),
      },
      r: {
        obj: String(riskParsed.objection ?? "none").slice(0, 40),
        max: Number(riskParsed.maxSafeAllocation ?? 0),
        att: debate.risk.attestationHash.slice(0, 16),
      },
      e: {
        act: String(execParsed.action ?? "HOLD"),
        pct: Number(execParsed.allocationPercent ?? 0),
        sl: Number(execParsed.stopLossPercent ?? 5),
        att: debate.executor.attestationHash.slice(0, 16),
      },
    },
    d: {
      act: String(execParsed.action ?? "HOLD"),
      asset: "ETH",
      pct: Number(execParsed.allocationPercent ?? 0),
    },
    nav: user.fund.currentNav,
  };
}

export async function runCycle(user: UserRecord): Promise<CycleResult> {
  console.log(`[cycle] Starting for user ${user.id} (risk: ${user.agent.riskProfile})`);

  // 1. Load proxy wallet
  const provider = new ethers.JsonRpcProvider(OG_RPC);
  const proxyWallet = loadProxyWallet(user.proxyWallet.encryptedKey, provider);
  console.log(`[cycle] Proxy wallet: ${proxyWallet.address}`);

  // 2. Hire specialists (with payment stub)
  const payFetch = createPaymentFetch(proxyWallet);
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

  // 3. Adversarial debate
  const debate = await runAdversarialDebate(
    specialists,
    user.agent.riskProfile,
    user.agent.maxTradePercent,
  );
  console.log(`[cycle] Debate complete — executor: ${JSON.stringify(debate.executor.parsed)}`);

  // 4. Log to Hedera HCS
  const cycleId = user.agent.lastCycleId + 1;
  const record = buildCompactRecord(cycleId, user, specialists, debate);
  const { seqNum, hashscanUrl } = await logCycle(TOPIC_ID, record);
  console.log(`[cycle] Logged to HCS: seq=${seqNum} ${hashscanUrl}`);

  // 5. Update user
  const execParsed = debate.executor.parsed as { allocationPercent?: number };
  const navDelta = (Number(execParsed.allocationPercent ?? 0) / 100) * user.fund.currentNav;
  updateUser(user.id, {
    agent: {
      ...user.agent,
      lastCycleId: cycleId,
      lastCycleAt: new Date().toISOString(),
    },
    fund: {
      ...user.fund,
      currentNav: user.fund.currentNav + navDelta,
    },
  });

  // 6. Return result
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
