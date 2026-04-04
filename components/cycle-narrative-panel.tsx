"use client";

import type { CycleNarrative } from "@/src/agents/narrative";
import { Card, CardBody } from "@/components/ui/card";
import { arcTxUrl } from "@/lib/links";

// User-facing cycle story — the "what did the agents discuss" panel.
// Reads the cached `CycleNarrative` written to Supabase at commit time
// (see src/agents/main-agent.ts commitCycle step 5 → logCycleRecord).
//
// Rendered below the ExpandableHuntCard on /dashboard so the user can see
// the full augmented-layer debate summary, confluence scores, and override
// reasoning for the current cycle. If the backend hasn't populated the
// narrative (legacy rows), this component renders nothing.

export function CycleNarrativePanel({ narrative }: { narrative: CycleNarrative }) {
  const {
    headline,
    finalReasoning,
    specialistDiscussion,
    augmentedDebate,
    marketplaceContext,
    execution,
    cycleLiquidity,
    allocationRationale,
    assetSubstituted,
    originalAsset,
  } = narrative;

  const confluenceEntries = Object.entries(marketplaceContext.confluenceScore).sort(
    (a, b) => b[1] - a[1],
  );

  // Pre-compute pct-to-usd lookup helper for rationale rendering
  const toUsd = (pct: number): string => {
    if (!cycleLiquidity) return "";
    const usd = (cycleLiquidity.availableUsd * pct) / 100;
    return `$${usd.toFixed(4)}`;
  };

  return (
    <Card>
      <CardBody className="space-y-4 py-5">
        {/* ── Headline ─────────────────────────────────────────── */}
        <div>
          <div className="text-[11px] uppercase tracking-wider text-void-600">
            Cycle summary
          </div>
          <h3 className="text-base font-bold text-void-100 mt-1">{headline}</h3>
          <p className="text-sm text-void-400 mt-2 leading-relaxed">{finalReasoning}</p>
          {assetSubstituted && originalAsset && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blood-900/30 border border-blood-700/40 text-[10px] font-mono uppercase tracking-wider text-blood-300">
              <span className="w-1.5 h-1.5 rounded-full bg-blood-500" />
              asset filtered: {originalAsset} → {augmentedDebate.executor.asset}
              <span className="text-blood-500/70">(non-EVM ticker, not swappable)</span>
            </div>
          )}
        </div>

        {/* ── Real-time liquidity snapshot ─────────────────────── */}
        {cycleLiquidity && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-void-600 mb-2">
              Available liquidity (real-time)
            </div>
            <div className="flex items-baseline gap-3 flex-wrap font-mono text-xs">
              <span className="text-base font-bold text-gold-400">
                ${cycleLiquidity.availableUsd.toFixed(4)}
              </span>
              <span className="text-void-500">USDC ready to deploy</span>
              <span className="text-void-700">·</span>
              <span className="text-void-500">
                proxy ${cycleLiquidity.proxyUsd.toFixed(4)}
              </span>
              <span className="text-void-700">·</span>
              <span className="text-void-500">
                hot ${cycleLiquidity.hotUsd.toFixed(4)}
              </span>
              {Math.abs(cycleLiquidity.proxyUsd - cycleLiquidity.depositedUsd) > 0.01 && (
                <span className="text-blood-400 text-[10px]">
                  ⚠ DB/chain drift
                </span>
              )}
            </div>
            <p className="text-[10px] text-void-600 mt-1">
              Every % chosen by the debate resolves against this balance — no phantom budget.
            </p>
          </div>
        )}

        {/* ── Confluence score ────────────────────────────────── */}
        {confluenceEntries.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-void-600 mb-2">
              Cross-specialist confluence
            </div>
            <div className="flex gap-2 flex-wrap">
              {confluenceEntries.map(([ticker, count]) => (
                <span
                  key={ticker}
                  className={`text-xs px-2 py-1 rounded-md border font-mono ${
                    count >= 2
                      ? "bg-dawg-500/20 text-dawg-400 border-dawg-500/40"
                      : "bg-void-800 text-void-400 border-void-700"
                  }`}
                >
                  {ticker} · {count}×
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Augmented debate rows ───────────────────────────── */}
        <div>
          <div className="text-[11px] uppercase tracking-wider text-void-600 mb-2">
            Augmented debate · allocation rationale
          </div>
          <div className="space-y-3 text-xs">
            {/* Alpha — thesis + concrete USD amount */}
            <div className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
              <div className="flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-green-400 font-semibold">Alpha</span>
                  <span className="text-void-500">
                    → {augmentedDebate.alpha.action} {augmentedDebate.alpha.pct}%{" "}
                    {augmentedDebate.alpha.asset}
                  </span>
                  {cycleLiquidity && augmentedDebate.alpha.pct > 0 && (
                    <span className="text-gold-400 font-mono">
                      = {toUsd(augmentedDebate.alpha.pct)}
                    </span>
                  )}
                </div>
                {augmentedDebate.alpha.thesis && (
                  <p className="text-void-400 italic mt-0.5">
                    &ldquo;{augmentedDebate.alpha.thesis.slice(0, 200)}&rdquo;
                  </p>
                )}
                {allocationRationale && allocationRationale[0]?.topConfluence.length > 0 && (
                  <p className="text-[10px] text-void-600 mt-1 font-mono">
                    confluence:{" "}
                    {allocationRationale[0].topConfluence
                      .map((c) => `${c.ticker} ${c.count}×`)
                      .join(", ")}
                  </p>
                )}
              </div>
            </div>

            {/* Risk — cap + concrete USD ceiling */}
            <div className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blood-500 mt-1.5 shrink-0" />
              <div className="flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-blood-300 font-semibold">Risk</span>
                  <span className="text-void-500">
                    → max {augmentedDebate.risk.maxPct}%
                  </span>
                  {cycleLiquidity && augmentedDebate.risk.maxPct > 0 && (
                    <span className="text-gold-400 font-mono">
                      = {toUsd(augmentedDebate.risk.maxPct)} ceiling
                    </span>
                  )}
                  {augmentedDebate.risk.redFlags.length > 0 && (
                    <span className="text-blood-400 text-[10px]">
                      red flags: {augmentedDebate.risk.redFlags.join(", ")}
                    </span>
                  )}
                </div>
                {augmentedDebate.risk.objection && (
                  <p className="text-void-400 italic mt-0.5">
                    &ldquo;{augmentedDebate.risk.objection.slice(0, 200)}&rdquo;
                  </p>
                )}
              </div>
            </div>

            {/* Executor — final decision + concrete USD amount */}
            <div className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gold-400 mt-1.5 shrink-0" />
              <div className="flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-gold-400 font-semibold">Executor</span>
                  <span className="text-void-500">
                    → {augmentedDebate.executor.action} {augmentedDebate.executor.pct}%{" "}
                    {augmentedDebate.executor.asset} · stop {augmentedDebate.executor.stopLoss}
                  </span>
                  {cycleLiquidity && augmentedDebate.executor.pct > 0 && (
                    <span className="text-gold-400 font-mono font-bold">
                      = {toUsd(augmentedDebate.executor.pct)}
                    </span>
                  )}
                </div>
                {augmentedDebate.overrideApplied && augmentedDebate.overrideReason && (
                  <p className="text-xs text-gold-400 mt-1 font-semibold">
                    ⚡ override fired: {augmentedDebate.overrideReason}
                  </p>
                )}
                {!augmentedDebate.overrideApplied && augmentedDebate.executor.reasoning && (
                  <p className="text-void-400 italic mt-0.5">
                    &ldquo;{augmentedDebate.executor.reasoning.slice(0, 200)}&rdquo;
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Specialist discussion (collapsible) ─────────────── */}
        {specialistDiscussion.length > 0 && (
          <details className="group">
            <summary className="text-[11px] uppercase tracking-wider text-void-600 cursor-pointer hover:text-void-400">
              Specialist discussion ({specialistDiscussion.length})
            </summary>
            <div className="mt-2 space-y-2">
              {specialistDiscussion.map((s, i) => (
                <div
                  key={`${s.name}-${i}`}
                  className="text-xs text-void-400 border-l-2 border-void-800 pl-3"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-void-300">{s.name}</span>
                    <span className="text-void-600">
                      hired by {s.hiredBy} · ${s.costUsd.toFixed(4)}
                    </span>
                    {s.teeVerified && (
                      <span className="text-[10px] text-emerald-500">TEE ✓</span>
                    )}
                  </div>
                  {s.picks.length > 0 && (
                    <div className="mt-1 font-mono text-[11px]">
                      picks:{" "}
                      {s.picks
                        .map((p) => `${p.asset}:${p.signal}(${p.confidence}%)`)
                        .join(", ")}
                    </div>
                  )}
                  {s.reasoning && (
                    <p className="italic mt-0.5">
                      &ldquo;{s.reasoning.slice(0, 160)}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}

        {/* ── Execution ───────────────────────────────────────── */}
        {execution && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-void-600 mb-2">
              Execution
            </div>
            <div className="text-xs text-void-400 space-y-0.5">
              <div>
                <span className="text-void-500">Spent:</span> $
                {execution.usdcSpent.toFixed(4)} USDC from proxy wallet
              </div>
              <div>
                <span className="text-void-500">Acquired:</span>{" "}
                {execution.tokensAcquired.toFixed(8)} {execution.asset}
              </div>
              {execution.swapTxHash && (
                <div>
                  <span className="text-void-500">Tx:</span>{" "}
                  <a
                    href={execution.swapExplorerUrl ?? arcTxUrl(execution.swapTxHash) ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-300 hover:text-teal-200 font-mono underline decoration-dotted"
                  >
                    {execution.swapTxHash.slice(0, 14)}… ↗
                  </a>{" "}
                  <span className="text-void-600">({execution.swapMethod})</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
