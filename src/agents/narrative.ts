// Cycle narrative synthesis.
//
// The user wants to see WHAT the agents discussed — not just the final decision.
// Before this module, a cycle's outcome was "BUY 3% ETH stop -5%" and nothing
// else. The debate reasoning was stored in Prisma + HCS + 0G but never rendered
// into a single coherent paragraph the user could read.
//
// `synthesizeCycleNarrative` produces a structured summary covering:
//   · Which specialists were hired (and by whom)
//   · What each specialist picked, with reasoning
//   · Confluence scores (which tickers appeared in multiple specialist picks)
//   · Alpha's thesis, Risk's challenge, Executor's decision
//   · Whether the deterministic executor override fired and why
//   · Final execution (swap tx + holdings delta)
//   · Marketplace context (total cost, pack composition)
//
// The narrative is returned in `CycleResult.narrative`, emitted via SSE as
// `cycle_narrative`, and persisted in the 0G rich record so it's part of the
// permanent audit trail.

import type {
  SpecialistResult,
  DebateResult,
  ArcSwapResult,
  TokenPick,
  CycleLiquidity,
} from "../types/index";

export interface SpecialistDiscussionEntry {
  name: string;
  hiredBy: string;
  picks: TokenPick[];
  reasoning: string;
  costUsd: number;
  attestationHash: string;
  teeVerified: boolean;
}

export interface AugmentedDebateSummary {
  alpha: {
    action: string;
    asset: string;
    pct: number;
    thesis: string;
    attestationHash: string;
  };
  risk: {
    maxPct: number;
    redFlags: string[];
    risks: string[];
    objection: string;
    attestationHash: string;
  };
  executor: {
    action: string;
    asset: string;
    pct: number;
    stopLoss: string;
    reasoning: string;
    attestationHash: string;
  };
  overrideApplied: boolean;
  overrideReason: string | null;
}

export interface MarketplaceContextSummary {
  totalHires: number;
  totalCostUsd: number;
  /** ticker → number of specialists who picked it */
  confluenceScore: Record<string, number>;
  /** name → hirer (alpha/risk/executor) so the user sees the payment graph */
  hireGraph: Array<{ specialist: string; hiredBy: string; paymentTxHash: string }>;
}

export interface ExecutionSummary {
  asset: string;
  usdcSpent: number;
  tokensAcquired: number;
  swapTxHash: string | null;
  swapExplorerUrl: string | null;
  swapMethod: string;
  newHoldings: Record<string, number>;
  newDepositedUsdc: number;
}

/**
 * Per-role breakdown of how a percentage decision was reached, grounded in
 * real liquidity. Surfaced in the UI so the user sees
 * "Alpha chose 10% (= $0.045) because confluence=WETH 3× and risk capped at 10%".
 */
export interface AllocationRationale {
  role: "alpha" | "risk" | "executor";
  action: string;
  asset: string;
  pct: number;
  /** pct × cycleLiquidity.availableUsd / 100 — the concrete dollar amount. */
  usdAmount: number;
  /** Top 3 tickers from confluence so the user sees the voting picture. */
  topConfluence: Array<{ ticker: string; count: number }>;
  /** Short human-readable explanation built from the structured fields. */
  explanation: string;
}

export interface CycleNarrative {
  version: 1;
  goal: string;
  /** Single-line summary the user sees at the top. */
  headline: string;
  /** One paragraph explaining the decision in plain English. */
  finalReasoning: string;
  specialistDiscussion: SpecialistDiscussionEntry[];
  augmentedDebate: AugmentedDebateSummary;
  marketplaceContext: MarketplaceContextSummary;
  /** Real-time liquidity snapshot taken at cycle start — the budget the debate reasoned against. */
  cycleLiquidity?: CycleLiquidity;
  /** Per-role allocation breakdown: why this % and what it resolves to in USD. */
  allocationRationale?: AllocationRationale[];
  /** Populated only when the cycle actually executed a swap. */
  execution: ExecutionSummary | null;
  /** True when finalAsset was substituted from an off-chain ticker. */
  assetSubstituted?: boolean;
  /** Original executor-picked ticker before validation, if substituted. */
  originalAsset?: string;
  /** 0G Storage CIDs of the prior cycles loaded as RAG context at cycle start.
   *  Persisted into the narrative JSONB column on the Prisma cycle row so the
   *  dashboard can show "Memory Recall: N prior cycles loaded from 0G Storage"
   *  without having to re-fetch from 0G. See src/og/storage.ts:loadRecentCycles. */
  priorCids?: string[];
}

interface NarrativeInput {
  goal: string;
  specialists: SpecialistResult[];
  debate: DebateResult;
  swap?: ArcSwapResult;
  finalAsset: string;
  finalPct: number;
  newHoldings: Record<string, number>;
  newDepositedUsdc: number;
  tokensAcquired: number;
  usdcSpent: number | null;
  overrideApplied: boolean;
  overrideReason: string | null;
  /** Real-time liquidity snapshot — the budget debate agents reasoned against. */
  cycleLiquidity?: CycleLiquidity;
  /** True when finalAsset was substituted by the EVM-whitelist guard. */
  assetSubstituted?: boolean;
  /** The executor's original (rejected) ticker, if substitution fired. */
  originalAsset?: string;
}

// Build a cycle-level narrative for the user. Pure function — no side effects.
export function synthesizeCycleNarrative(input: NarrativeInput): CycleNarrative {
  const {
    goal,
    specialists,
    debate,
    swap,
    finalAsset,
    finalPct,
    newHoldings,
    newDepositedUsdc,
    tokensAcquired,
    usdcSpent,
    overrideApplied,
    overrideReason,
    cycleLiquidity,
    assetSubstituted,
    originalAsset,
  } = input;

  // ── Confluence scoring ────────────────────────────────────────────────
  // For every specialist that emitted picks, tally how many specialists
  // picked each ticker. The winning ticker is usually the one with the
  // highest confluence score — that's the multi-source signal.
  const confluence: Record<string, number> = {};
  for (const s of specialists) {
    for (const p of s.picks ?? []) {
      const key = p.asset.toUpperCase();
      confluence[key] = (confluence[key] ?? 0) + 1;
    }
  }

  // ── Specialist discussion rows ────────────────────────────────────────
  const specialistDiscussion: SpecialistDiscussionEntry[] = specialists.map((s) => ({
    name: s.name,
    hiredBy: s.hiredBy ?? "main-agent",
    picks: s.picks ?? [],
    reasoning: (s.reasoning ?? "").trim(),
    costUsd: s.priceUsd ?? 0.001,
    attestationHash: s.attestationHash,
    teeVerified: s.teeVerified,
  }));

  // ── Augmented debate summary ──────────────────────────────────────────
  const alphaParsed = (debate.alpha.parsed ?? {}) as {
    action?: string;
    asset?: string;
    pct?: number;
    thesis?: string;
  };
  const riskParsed = (debate.risk.parsed ?? {}) as {
    max_pct?: number;
    red_flags?: unknown;
    risks?: unknown;
    objection?: string;
  };
  const execParsed = (debate.executor.parsed ?? {}) as {
    action?: string;
    asset?: string;
    pct?: number;
    stop_loss?: string;
    reasoning?: string;
  };

  const augmentedDebate: AugmentedDebateSummary = {
    alpha: {
      action: String(alphaParsed.action ?? "HOLD").toUpperCase(),
      asset: String(alphaParsed.asset ?? finalAsset).toUpperCase(),
      pct: Number(alphaParsed.pct ?? 0),
      thesis: String(alphaParsed.thesis ?? debate.alpha.reasoning ?? "").trim(),
      attestationHash: debate.alpha.attestationHash,
    },
    risk: {
      maxPct: Number(riskParsed.max_pct ?? 0),
      redFlags: Array.isArray(riskParsed.red_flags)
        ? (riskParsed.red_flags as unknown[]).map(String)
        : [],
      risks: Array.isArray(riskParsed.risks)
        ? (riskParsed.risks as unknown[]).map(String)
        : [],
      objection: String(riskParsed.objection ?? debate.risk.reasoning ?? "").trim(),
      attestationHash: debate.risk.attestationHash,
    },
    executor: {
      action: String(execParsed.action ?? "HOLD").toUpperCase(),
      asset: finalAsset,
      pct: finalPct,
      stopLoss: String(execParsed.stop_loss ?? "-5%"),
      reasoning: String(execParsed.reasoning ?? debate.executor.reasoning ?? "").trim(),
      attestationHash: debate.executor.attestationHash,
    },
    overrideApplied,
    overrideReason,
  };

  // ── Allocation rationale per role ─────────────────────────────────────
  // For each debate role, compute the concrete USD amount its percentage
  // resolves to against the real liquidity snapshot. This is what the UI
  // renders next to each debate turn: "chose 10% → $0.045 of $0.45 available".
  const availableUsd = cycleLiquidity?.availableUsd ?? 0;
  const topConfluence = Object.entries(confluence)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([ticker, count]) => ({ ticker, count }));
  const topConfluenceStr = topConfluence.length > 0
    ? topConfluence.map((c) => `${c.ticker} ${c.count}×`).join(", ")
    : "(no confluence)";
  const computeUsd = (pct: number) => Math.round(availableUsd * pct) / 100;
  const allocationRationale: AllocationRationale[] = [
    {
      role: "alpha",
      action: augmentedDebate.alpha.action,
      asset: augmentedDebate.alpha.asset,
      pct: augmentedDebate.alpha.pct,
      usdAmount: computeUsd(augmentedDebate.alpha.pct),
      topConfluence,
      explanation: `Chose ${augmentedDebate.alpha.action} ${augmentedDebate.alpha.pct}% ${augmentedDebate.alpha.asset} — confluence: ${topConfluenceStr}. At $${availableUsd.toFixed(4)} available, this resolves to $${computeUsd(augmentedDebate.alpha.pct).toFixed(4)}.`,
    },
    {
      role: "risk",
      action: "CAP",
      asset: augmentedDebate.alpha.asset,
      pct: augmentedDebate.risk.maxPct,
      usdAmount: computeUsd(augmentedDebate.risk.maxPct),
      topConfluence,
      explanation: `Capped at ${augmentedDebate.risk.maxPct}%${augmentedDebate.risk.redFlags.length > 0 ? ` (red flags: ${augmentedDebate.risk.redFlags.join(", ")})` : " (no red flags)"} — max $${computeUsd(augmentedDebate.risk.maxPct).toFixed(4)} of $${availableUsd.toFixed(4)} available.`,
    },
    {
      role: "executor",
      action: augmentedDebate.executor.action,
      asset: augmentedDebate.executor.asset,
      pct: augmentedDebate.executor.pct,
      usdAmount: computeUsd(augmentedDebate.executor.pct),
      topConfluence,
      explanation: `Final call: ${augmentedDebate.executor.action} ${augmentedDebate.executor.pct}% ${augmentedDebate.executor.asset} → $${computeUsd(augmentedDebate.executor.pct).toFixed(4)} USDC${overrideApplied ? " (deterministic override fired)" : ""}.`,
    },
  ];

  // ── Marketplace context ───────────────────────────────────────────────
  const marketplaceContext: MarketplaceContextSummary = {
    totalHires: specialists.length,
    totalCostUsd: Number(
      specialists.reduce((sum, s) => sum + (s.priceUsd ?? 0.001), 0).toFixed(6),
    ),
    confluenceScore: confluence,
    hireGraph: specialists.map((s) => ({
      specialist: s.name,
      hiredBy: s.hiredBy ?? "main-agent",
      paymentTxHash: s.paymentTxHash ?? "pending",
    })),
  };

  // ── Execution summary (only if a swap actually fired) ─────────────────
  const execution: ExecutionSummary | null = swap
    ? {
        asset: finalAsset,
        usdcSpent: usdcSpent ?? 0,
        tokensAcquired,
        swapTxHash: swap.txHash ?? null,
        swapExplorerUrl: swap.explorerUrl ?? null,
        swapMethod: swap.method ?? "unknown",
        newHoldings,
        newDepositedUsdc,
      }
    : null;

  // ── Headline + user-facing reasoning ──────────────────────────────────
  const topPicks = Object.entries(confluence)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([ticker, count]) => `${ticker} (${count}×)`)
    .join(", ");

  const headline = execution?.swapTxHash
    ? `BUY ${finalPct}% ${finalAsset} — $${(usdcSpent ?? 0).toFixed(4)} USDC from proxy, swap landed on Arc`
    : augmentedDebate.executor.action === "HOLD"
      ? `HOLD — ${specialists.length} specialists hired, debate settled on no-trade`
      : `Debate concluded ${augmentedDebate.executor.action} ${finalPct}% ${finalAsset} (not yet executed)`;

  const finalReasoningParts: string[] = [];
  finalReasoningParts.push(`The user asked: "${goal}".`);
  finalReasoningParts.push(
    `${specialists.length} specialists were hired${marketplaceContext.totalCostUsd > 0 ? ` for $${marketplaceContext.totalCostUsd.toFixed(4)} total` : ""}.`,
  );
  if (topPicks) {
    finalReasoningParts.push(`Cross-specialist confluence: ${topPicks}.`);
  }
  finalReasoningParts.push(
    `Alpha proposed ${augmentedDebate.alpha.action} ${augmentedDebate.alpha.pct}% ${augmentedDebate.alpha.asset}${augmentedDebate.alpha.thesis ? `: "${augmentedDebate.alpha.thesis.slice(0, 140)}"` : ""}.`,
  );
  finalReasoningParts.push(
    `Risk capped at ${augmentedDebate.risk.maxPct}%${augmentedDebate.risk.redFlags.length > 0 ? ` (red flags: ${augmentedDebate.risk.redFlags.join(", ")})` : " with no red flags"}.`,
  );
  if (overrideApplied) {
    finalReasoningParts.push(
      `Executor initially HOLD; the deterministic override fired because ${overrideReason ?? "Alpha+Risk agreed on a BUY with no red flags"}.`,
    );
  } else {
    finalReasoningParts.push(
      `Executor: ${augmentedDebate.executor.action} ${augmentedDebate.executor.pct}% ${augmentedDebate.executor.asset}${augmentedDebate.executor.reasoning ? ` — "${augmentedDebate.executor.reasoning.slice(0, 140)}"` : ""}.`,
    );
  }
  if (execution?.swapTxHash) {
    finalReasoningParts.push(
      `Swap executed on Arc: ${execution.swapTxHash.slice(0, 14)}…, ${execution.tokensAcquired.toFixed(8)} ${execution.asset} acquired, holdings now ${JSON.stringify(execution.newHoldings)}.`,
    );
  }

  return {
    version: 1,
    goal,
    headline,
    finalReasoning: finalReasoningParts.join(" "),
    specialistDiscussion,
    augmentedDebate,
    marketplaceContext,
    cycleLiquidity,
    allocationRationale,
    execution,
    assetSubstituted,
    originalAsset,
  };
}
