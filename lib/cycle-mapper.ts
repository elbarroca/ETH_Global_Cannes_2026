import type { Cycle } from "./types";
import type { CycleResult, CompactCycleRecord, EnrichedCycleResponse } from "./api";

export const EMOJI_MAP: Record<string, string> = {
  sentiment: "🧠",
  whale: "🐋",
  momentum: "📈",
  "memecoin-hunter": "🎰",
  "twitter-alpha": "🐦",
  "defi-yield": "🌾",
  "news-scanner": "📰",
  "onchain-forensics": "🔍",
  "options-flow": "📊",
  "macro-correlator": "🌍",
};

export const NAME_MAP: Record<string, string> = {
  sentiment: "SentimentBot",
  whale: "WhaleEye",
  momentum: "MomentumX",
  "memecoin-hunter": "Memecoin Hunter",
  "twitter-alpha": "Twitter Alpha",
  "defi-yield": "DeFi Yield",
  "news-scanner": "News Scanner",
  "onchain-forensics": "On-Chain Forensics",
  "options-flow": "Options Flow",
  "macro-correlator": "Macro Correlator",
};

function truncateHash(hash: string): string {
  if (!hash || hash.length < 12) return hash || "—";
  return `${hash.slice(0, 10)}...${hash.slice(-4)}`;
}

function parseStopLoss(sl: unknown): number | null {
  if (sl == null) return null;
  const str = String(sl).replace("%", "").replace("-", "");
  const n = parseFloat(str);
  return isNaN(n) ? null : -Math.abs(n);
}

export function mapCycleResultToCycle(result: CycleResult): Cycle {
  const alphaParsed = result.debate?.alpha?.parsed ?? {};
  const riskParsed = result.debate?.risk?.parsed ?? {};
  const execParsed = result.debate?.executor?.parsed ?? {};

  const topicId = result.hashscanUrl
    ? result.hashscanUrl.match(/topic\/([\d.]+)/)?.[1] ?? "0.0.unknown"
    : "0.0.unknown";

  return {
    id: result.cycleId,
    timestamp: result.timestamp ?? new Date().toISOString(),
    goal: result.goal,
    specialists: (result.specialists ?? []).map((s) => ({
      name: NAME_MAP[s.name] ?? s.name,
      emoji: EMOJI_MAP[s.name] ?? "🤖",
      analysis: s.reasoning
        ? `${s.reasoning}\n${s.signal} (confidence: ${s.confidence}%)${s.reputation ? ` [rep: ${s.reputation}]` : ""}`
        : `${s.signal} (confidence: ${s.confidence}%)${s.reputation ? ` [rep: ${s.reputation}]` : ""}`,
      reasoning: s.reasoning,
      signal: s.signal,
      confidence: s.confidence,
      price: 0.001,
      attestation: truncateHash(s.attestationHash),
      model: "glm-5-chat",
      provider: "0G Sealed TEE",
      inftId: "",
      hiredBy: s.hiredBy,
      paymentTxHash: s.paymentTxHash,
    })),
    adversarial: {
      alpha: {
        argument: result.debate?.alpha?.reasoning
          || String(alphaParsed.thesis ?? alphaParsed.argument ?? "Analyzing opportunity..."),
        recommendation: `${alphaParsed.action ?? "HOLD"} ${alphaParsed.pct ?? 0}% ${alphaParsed.asset ?? "ETH"}`,
        attestation: truncateHash(result.debate?.alpha?.attestationHash ?? ""),
      },
      risk: {
        argument: result.debate?.risk?.reasoning
          || String(riskParsed.objection ?? riskParsed.challenge ?? "Evaluating risks..."),
        recommendation: `Max ${riskParsed.max_pct ?? riskParsed.maxSafePct ?? 0}%. Risks: ${Array.isArray(riskParsed.risks) ? (riskParsed.risks as string[]).join(", ") : "none flagged"}`,
        attestation: truncateHash(result.debate?.risk?.attestationHash ?? ""),
      },
      executor: {
        argument: result.debate?.executor?.reasoning
          || String(execParsed.reasoning ?? "Making final decision..."),
        recommendation: `${execParsed.action ?? "HOLD"} ${execParsed.pct ?? 0}% ${execParsed.asset ?? "ETH"}${execParsed.stop_loss ? `. Stop ${execParsed.stop_loss}` : ""}`,
        attestation: truncateHash(result.debate?.executor?.attestationHash ?? ""),
      },
    },
    // Prefer the real payment graph when the backend supplied it; fall back
    // to deriving rows from specialists only if it's missing entirely.
    payments: (result.payments && result.payments.length > 0
      ? result.payments.map((p) => ({
          from: p.from,
          to: NAME_MAP[p.to] ?? p.to,
          amount: 0.001,
          txHash: p.txHash,
          hiredBy: p.hiredBy,
          chain: p.chain,
        }))
      : (result.specialists ?? []).map((s) => ({
          from: s.hiredBy ?? "main-agent",
          to: NAME_MAP[s.name] ?? s.name,
          amount: 0.001,
          txHash: s.paymentTxHash ?? "pending",
          hiredBy: s.hiredBy ?? "main-agent",
          chain: "arc" as const,
        }))),
    hcs: {
      topicId,
      sequenceNumber: result.seqNum ?? 0,
      timestamp: result.timestamp
        ? new Date(result.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : "",
    },
    trade: {
      action: (String(execParsed.action ?? "HOLD") as "BUY" | "SELL" | "HOLD"),
      asset: String(execParsed.asset ?? "ETH"),
      percentage: Number(execParsed.pct ?? 0),
      stopLoss: parseStopLoss(execParsed.stop_loss),
    },
    memory: [],
    storageHash: result.storageHash,
    inftTokenId: result.inftTokenId,
    swap: result.swapResult
      ? {
          success: result.swapResult.success,
          txHash: result.swapResult.txHash,
          explorerUrl: result.swapResult.explorerUrl,
          method: result.swapResult.method,
          reason: result.swapResult.reason,
          amountIn: result.swapResult.amountIn,
          tokenIn: result.swapResult.tokenIn,
          tokenOut: result.swapResult.tokenOut,
        }
      : undefined,
    specialistPath: result.specialistPath,
    openclawGatewayStatus: result.openclawGatewayStatus,
    proofs: result.proofs,
    degraded: result.degraded,
    degradedReasons: result.degradedReasons,
  };
}

// Legacy compact-record mapper — still used by the two-phase approval flow
// where the pending API returns a CompactCycleRecord snapshot. Dashboard lists
// should use mapEnrichedResponseToCycle instead.
export function mapCompactRecordToCycle(record: CompactCycleRecord): Cycle {
  return {
    id: record.c,
    timestamp: record.t,
    goal: record.g,
    specialists: record.s.map((s) => ({
      name: NAME_MAP[s.n] ?? s.n,
      emoji: EMOJI_MAP[s.n] ?? "🤖",
      analysis: `${s.sig} (confidence: ${s.conf}%)`,
      signal: s.sig,
      confidence: s.conf,
      price: 0.001,
      attestation: s.att,
      model: "glm-5-chat",
      provider: "0G Sealed TEE",
      inftId: "",
    })),
    adversarial: {
      alpha: {
        argument: record.adv.a.r || `${record.adv.a.act} ${record.adv.a.pct}% ETH`,
        recommendation: `${record.adv.a.act} ${record.adv.a.pct}% ETH`,
        attestation: record.adv.a.att,
      },
      risk: {
        argument: record.adv.r.r || record.adv.r.obj,
        recommendation: `Max ${record.adv.r.max}%`,
        attestation: record.adv.r.att,
      },
      executor: {
        argument: record.adv.e.r || `${record.adv.e.act} ${record.adv.e.pct}% ETH. Stop -${record.adv.e.sl}%`,
        recommendation: `${record.adv.e.act} ${record.adv.e.pct}% ETH`,
        attestation: record.adv.e.att,
      },
    },
    payments: [], // compact HCS records no longer carry the payment graph — 0G does
    hcs: {
      topicId: process.env.NEXT_PUBLIC_HCS_TOPIC_ID ?? "0.0.unknown",
      sequenceNumber: record.c,
      timestamp: new Date(record.t).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    },
    trade: {
      action: record.d.act as "BUY" | "SELL" | "HOLD",
      asset: record.d.asset,
      percentage: record.d.pct,
      stopLoss: record.adv.e.sl ? -record.adv.e.sl : null,
    },
    memory: [],
    storageHash: record.sh,
  };
}

// Primary mapper used by /dashboard — handles the Prisma-enriched response
// returned by /api/cycle/latest + /history. Preserves `goal`, `hiredBy`
// attribution per specialist, and the full `payments[]` graph.
export function mapEnrichedResponseToCycle(r: EnrichedCycleResponse): Cycle {
  return {
    id: r.cycleId,
    dbId: r.cycleUuid,
    timestamp: r.timestamp,
    goal: r.goal || undefined,
    specialists: r.specialists.map((s) => ({
      name: NAME_MAP[s.name] ?? s.name,
      emoji: EMOJI_MAP[s.name] ?? "🤖",
      analysis: s.reasoning
        ? `${s.reasoning}\n${s.signal} (confidence: ${s.confidence}%)${s.reputation ? ` [rep: ${s.reputation}]` : ""}`
        : `${s.signal} (confidence: ${s.confidence}%)${s.reputation ? ` [rep: ${s.reputation}]` : ""}`,
      reasoning: s.reasoning,
      signal: s.signal,
      confidence: s.confidence,
      price: 0.001,
      attestation: truncateHash(s.attestationHash),
      model: "glm-5-chat",
      provider: "0G Sealed TEE",
      inftId: "",
      hiredBy: s.hiredBy,
      paymentTxHash: s.paymentTxHash,
    })),
    adversarial: {
      alpha: {
        argument: r.debate.alpha.reasoning || `${r.debate.alpha.action} ${r.debate.alpha.pct}% ETH`,
        recommendation: `${r.debate.alpha.action} ${r.debate.alpha.pct}% ETH`,
        attestation: truncateHash(r.debate.alpha.attestationHash),
      },
      risk: {
        argument: r.debate.risk.reasoning || r.debate.risk.objection || "",
        recommendation: `Max ${r.debate.risk.maxPct}%`,
        attestation: truncateHash(r.debate.risk.attestationHash),
      },
      executor: {
        argument: r.debate.executor.reasoning || `${r.debate.executor.action} ${r.debate.executor.pct}% ETH. Stop ${r.debate.executor.stopLoss}`,
        recommendation: `${r.debate.executor.action} ${r.debate.executor.pct}% ETH`,
        attestation: truncateHash(r.debate.executor.attestationHash),
      },
    },
    payments: r.payments.map((p) => ({
      from: p.from,
      to: NAME_MAP[p.to] ?? p.to,
      amount: 0.001,
      txHash: p.txHash,
      hiredBy: p.hiredBy,
      chain: p.chain,
    })),
    hcs: {
      topicId: (r.hashscanUrl ? r.hashscanUrl.match(/topic\/([\d.]+)/)?.[1] : null) ?? "0.0.unknown",
      sequenceNumber: r.seqNum,
      timestamp: new Date(r.timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    },
    trade: {
      action: r.decision.action as "BUY" | "SELL" | "HOLD",
      asset: r.decision.asset,
      percentage: r.decision.pct,
      stopLoss: parseStopLoss(r.debate.executor.stopLoss),
    },
    memory: [],
    storageHash: r.storageHash ?? undefined,
    inftTokenId: r.inftTokenId ?? undefined,
    swap: r.swap
      ? {
          success: r.swap.success,
          txHash: r.swap.txHash,
          explorerUrl: r.swap.explorerUrl,
          method: (r.swap.method as Cycle["swap"] extends undefined ? never : NonNullable<Cycle["swap"]>["method"]) ?? "mock_swap",
        }
      : undefined,
  };
}
