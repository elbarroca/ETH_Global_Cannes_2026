"use client";

import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import { Card, CardHeader, CardBody, CodeBlock } from "@/components/ui/card";
import { Badge, SealedBadge, LiveBadge, ZeroGBadge } from "@/components/ui/badge";
import { ComputeLog } from "@/components/compute-log";
import { DebateTheater } from "@/components/debate-theater";
import { ArcTxHashPanel, HuntIndexedPaymentRows } from "@/components/hunt/hunt-payment-rows";
import { mergeHuntPaymentRows } from "@/components/hunt/merge-hunt-payments";
import { HuntPipelineArrows } from "@/components/hunt/hunt-pipeline-arrows";
import { useUser } from "@/contexts/user-context";
import { getCycleDetail } from "@/lib/api";
import type { Cycle, AgentActionRecord } from "@/lib/types";
import {
  arcTxUrl,
  HCS_TOPIC_ID,
  INFT_CONTRACT_ADDRESS,
  hashscanMessageUrl,
  hashscanTopicUrl,
  ogChainAddressUrl,
  inftTokenUrl,
} from "@/lib/links";

// ── Helpers ──────────────────────────────────────────────────

function truncHash(hash: string | null | undefined): string {
  if (!hash || hash.length < 14) return hash ?? "—";
  return `${hash.slice(0, 10)}…${hash.slice(-4)}`;
}

const ACTION_STYLES: Record<string, { glow: string; badge: "green" | "red" | "amber"; ledColor: string }> = {
  BUY:  { glow: "glow-green",  badge: "green", ledColor: "text-[#39FF7A]" },
  SELL: { glow: "glow-red",    badge: "red",   ledColor: "text-[#FF5A5A]" },
  HOLD: { glow: "glow-dawg",   badge: "amber", ledColor: "text-[#FFCC00]" },
};

const HIRER_BADGE: Record<string, string> = {
  alpha: "bg-green-500/15 text-green-400 border-green-500/30",
  risk: "bg-blood-500/15 text-blood-300 border-blood-500/30",
  executor: "bg-gold-400/15 text-gold-400 border-gold-400/30",
  "main-agent": "bg-void-800 text-void-400 border-void-700",
};

const INFT_CONTRACT =
  process.env.NEXT_PUBLIC_INFT_CONTRACT ?? "0x73e3016D0D3Bf2985c55860cd2A51FF017c2c874";
const OG_EXPLORER_BASE = "https://chainscan-galileo.0g.ai";

// ── Compact card (collapsed state) ──────────────────────────

function CompactView({
  cycle,
  expanded,
  onClick,
  computing,
  computingLabel,
}: {
  cycle: Cycle;
  expanded: boolean;
  onClick: () => void;
  computing?: boolean;
  computingLabel?: string;
}) {
  const style = ACTION_STYLES[cycle.trade.action] ?? ACTION_STYLES.HOLD;
  const time = new Date(cycle.timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const specCount = cycle.specialists.length;
  const cost = (specCount * 0.001).toFixed(3);
  const hcsHref =
    cycle.hcs.sequenceNumber > 0
      ? hashscanMessageUrl(HCS_TOPIC_ID, cycle.hcs.sequenceNumber)
      : null;
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <button onClick={onClick} className="w-full text-left group">
      {/* Top strip — hunt number + time + action badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-pixel glow-dawg text-[18px] leading-none text-[#FFCC00] uppercase tracking-wider">
            HUNT #{cycle.id}
          </span>
          <span className="font-pixel text-[13px] leading-none text-void-500">{time}</span>
        </div>
        <div className="flex items-center gap-2">
          {computing && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-dawg-500/40 bg-dawg-500/10 text-[10px] font-semibold uppercase tracking-wider text-dawg-300">
              <span className="w-2.5 h-2.5 border-2 border-dawg-400 border-t-transparent rounded-full animate-spin" />
              {computingLabel ?? "Computing"}…
            </span>
          )}
          {cycle.proofs?.hcs && <span className="text-[9px] text-teal-400 font-mono">HCS ✓</span>}
          {cycle.proofs?.storage && <span className="text-[9px] text-purple-400 font-mono">0G ✓</span>}
          {cycle.proofs?.inft && <span className="text-[9px] text-gold-400 font-mono">iNFT ✓</span>}
          <Badge variant={style.badge}>{cycle.trade.action}</Badge>
        </div>
      </div>

      {/* Big trade line */}
      <div className={`font-pixel text-[28px] leading-none uppercase tracking-wider tabular-nums ${style.ledColor} ${style.glow}`}>
        {cycle.trade.action} {cycle.trade.percentage}% {cycle.trade.asset}
      </div>

      {/* Filtered-asset chip — appears when the executor's raw ticker was
          rewritten by the EVM whitelist gate (e.g. SIREN → WETH). Clicking
          the hunt surfaces the full before/after in the narrative panel. */}
      {cycle.trade.assetSubstituted && cycle.trade.originalAsset && (
        <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-blood-700/40 bg-blood-900/20 text-[10px] font-mono uppercase tracking-wider text-blood-300">
          <span className="w-1 h-1 rounded-full bg-blood-500" />
          filtered: {cycle.trade.originalAsset} → {cycle.trade.asset}
        </div>
      )}

      {/* Specialist signals strip — each chip shows payment status:
          · 0x... hash  → "tx ↗" link to Arc explorer (direct settlement)
          · UUID (abc1-234…) → "batched 🔒" chip (Circle Gateway deferred settlement)
          · "paid"/"no-payment" → no chip (legacy/failed rows)

          Circle Gateway uses batched settlement: individual $0.001 hires are
          authorized and Gateway-debited immediately (real payment), but the
          on-chain Arc transaction lands later as one batch. The UUID is the
          settlement receipt that can be resolved to the eventual tx. */}
      {cycle.specialists.length > 0 && (
        <div className="flex items-center gap-2 mt-2.5 overflow-x-auto pb-1">
          {cycle.specialists.map((s, i) => {
            const sigColor =
              (s.signal ?? "HOLD") === "BUY" ? "text-[#39FF7A]" : (s.signal ?? "HOLD") === "SELL" ? "text-[#FF5A5A]" : "text-[#FFCC00]";
            const txHash = s.paymentTxHash ?? "";
            const isDirect = txHash.startsWith("0x");
            const isBatched =
              !isDirect &&
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(txHash);
            const txUrl = isDirect ? arcTxUrl(txHash) : null;
            return (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-void-800/60 border border-void-700/40 shrink-0"
              >
                <span className="text-[10px] text-void-500 font-mono">{s.name}</span>
                <span className={`text-[10px] font-bold font-mono ${sigColor}`}>
                  {s.signal ?? "?"} {s.confidence ?? 0}%
                </span>
                {s.attestation && s.attestation !== "mock-s" && (
                  <span className="w-1 h-1 rounded-full bg-gold-400" title="TEE attested" />
                )}
                {txUrl && (
                  <a
                    href={txUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={stop}
                    title={`Arc x402 settlement: ${txHash}`}
                    className="text-[9px] font-mono text-teal-400 hover:text-teal-300 underline decoration-dotted"
                  >
                    tx ↗
                  </a>
                )}
                {isBatched && (
                  <span
                    title={`Circle Gateway settlement receipt: ${txHash}`}
                    className="text-[9px] font-mono text-teal-400/80 cursor-help"
                  >
                    batched
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom metadata */}
      <div className="flex items-center gap-3 mt-2 text-xs text-void-600 flex-wrap">
        <span>{specCount} specialists</span>
        <span className="w-1 h-1 rounded-full bg-void-700" />
        <span>{specCount * 2} sealed inferences</span>
        <span className="w-1 h-1 rounded-full bg-void-700" />
        <span>${cost} spent</span>
        {hcsHref && (
          <>
            <span className="w-1 h-1 rounded-full bg-void-700" />
            <a
              href={hcsHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={stop}
              className="text-teal-400 hover:text-teal-300 underline decoration-dotted"
            >
              HCS #{cycle.hcs.sequenceNumber} ↗
            </a>
          </>
        )}
        {cycle.swap?.txHash && (
          <>
            <span className="w-1 h-1 rounded-full bg-void-700" />
            <a
              href={cycle.swap.explorerUrl ?? arcTxUrl(cycle.swap.txHash) ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={stop}
              className="text-indigo-300 hover:text-indigo-200 font-mono underline decoration-dotted"
            >
              Swap {cycle.swap.txHash.slice(0, 6)}… ↗
            </a>
          </>
        )}
        <span className="ml-auto text-void-500 group-hover:text-dawg-500 transition-colors text-[10px] font-semibold uppercase tracking-wider">
          {expanded ? "Click to collapse ‹" : "Click to expand ›"}
        </span>
      </div>
    </button>
  );
}

// ── Rating buttons ──────────────────────────────────────────
//
// Explicit LIKE / DISLIKE pills for each specialist inside an expanded hunt
// card. Votes POST to /api/marketplace/rate which runs an ELO update via
// `recordRating()` (src/marketplace/reputation.ts). The API also:
//
//   - Upserts an `agent_ratings` row keyed on (userId, agentName, cycleId)
//     — the canonical per-user history.
//   - Awaits a `logSwarmEvent({ ev: "rating", ... })` write, so the response
//     carries a Hashscan seq number which we render as an "↗ HCS" link.
//
// Persisted per-browser via localStorage as a UX speed optimization; the
// server's unique constraint is the authoritative dedupe.

interface RateResponse {
  agentName: string;
  reputation: number;
  reputationBefore?: number;
  kind?: "like" | "dislike" | "verify";
  ratingId?: string;
  hcsSeqNum?: number | null;
  hcsTopicId?: string | null;
}

function RatingButtons({ agentName, cycleId }: { agentName: string; cycleId: number }) {
  const { userId } = useUser();
  const storageKey = `alphadawg.vote.${cycleId}.${agentName}`;
  const [voted, setVoted] = useState<"up" | "down" | null>(null);
  const [loading, setLoading] = useState(false);
  const [newReputation, setNewReputation] = useState<number | null>(null);
  const [hcsLink, setHcsLink] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);

  // Hydrate previous vote from localStorage (per cycle × agent).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === "up" || saved === "down") setVoted(saved);
    } catch { /* private-mode browsers */ }
  }, [storageKey]);

  const vote = useCallback(async (positive: boolean) => {
    if (loading) return;
    const next = positive ? "up" : "down";
    if (voted === next) return; // No toggle-off — we want a committed rating.
    setLoading(true);
    try {
      // Canonical payload when we have the user id — gets history + HCS.
      // Falls back to the legacy `positive` shape otherwise so anonymous
      // dashboard viewers still see something happen (the legacy path just
      // skips the audit write).
      const body = userId
        ? {
            userId,
            agentName,
            cycleId,
            kind: positive ? "like" : "dislike",
          }
        : { agentName, positive };
      const res = await fetch("/api/marketplace/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = (await res.json()) as RateResponse;
        setNewReputation(data.reputation);
        setVoted(next);
        setPulse(true);
        setTimeout(() => setPulse(false), 800);
        if (data.hcsSeqNum != null && data.hcsTopicId) {
          setHcsLink(
            `https://hashscan.io/testnet/topic/${data.hcsTopicId}?s=${data.hcsSeqNum}`,
          );
        } else {
          setHcsLink(null);
        }
        try { window.localStorage.setItem(storageKey, next); } catch { /* ignore */ }
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [agentName, cycleId, userId, voted, loading, storageKey]);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); vote(true); }}
        disabled={loading}
        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold font-mono uppercase tracking-wider transition-all ${
          voted === "up"
            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_12px_rgba(52,211,153,0.35)]"
            : "bg-void-900/50 text-void-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-void-700/60 hover:border-emerald-500/40"
        } ${pulse && voted === "up" ? "animate-pulse" : ""}`}
        title="Good call — promote this specialist"
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.228.22.442.393.626a2.491 2.491 0 001.903.874h.014a2.486 2.486 0 001.9-.874 2.49 2.49 0 00.392-.626M5.904 18.75c-.082-.228-.22-.442-.393-.626a2.485 2.485 0 00-1.9-.874A2.49 2.49 0 001.5 18.75" />
        </svg>
        LIKE
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); vote(false); }}
        disabled={loading}
        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold font-mono uppercase tracking-wider transition-all ${
          voted === "down"
            ? "bg-blood-500/20 text-blood-300 border border-blood-500/50 shadow-[0_0_12px_rgba(239,68,68,0.35)]"
            : "bg-void-900/50 text-void-400 hover:text-blood-300 hover:bg-blood-500/10 border border-void-700/60 hover:border-blood-500/40"
        } ${pulse && voted === "down" ? "animate-pulse" : ""}`}
        title="Bad call — demote this specialist"
      >
        <svg className="w-3 h-3 rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.228.22.442.393.626a2.491 2.491 0 001.903.874h.014a2.486 2.486 0 001.9-.874 2.49 2.49 0 00.392-.626M5.904 18.75c-.082-.228-.22-.442-.393-.626a2.485 2.485 0 00-1.9-.874A2.49 2.49 0 001.5 18.75" />
        </svg>
        DISLIKE
      </button>
      {newReputation != null && (
        <span
          className="font-pixel text-[13px] tabular-nums text-gold-400 glow-dawg"
          title="New ELO reputation score after your vote — visible on the marketplace"
        >
          ELO {newReputation}
        </span>
      )}
      {hcsLink && (
        <a
          href={hcsLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-[10px] text-teal-300 hover:text-teal-200 underline decoration-dotted"
          title="Verify this rating on Hashscan — the before/after ELO is logged to HCS as proof"
        >
          HCS ↗
        </a>
      )}
    </div>
  );
}

// ── Inline expanded detail ──────────────────────────────────

function AgentFlowStrip({ cycle }: { cycle: Cycle }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-mono rounded-lg border border-void-800 bg-void-950/60 px-3 py-2.5 mb-3">
      <span className="text-teal-400">{cycle.specialists.length} specialists</span>
      <span className="text-void-700">→</span>
      <span className="text-green-400">Alpha</span>
      <span className="text-void-700">→</span>
      <span className="text-blood-300">Risk</span>
      <span className="text-void-700">→</span>
      <span className="text-gold-400">Executor</span>
      <span className="text-void-700">→</span>
      <span className="text-void-100 font-semibold">
        {cycle.trade.action} {cycle.trade.percentage}% {cycle.trade.asset}
      </span>
    </div>
  );
}

const accordionSummaryClass =
  "flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-semibold text-sm text-void-200 " +
  "marker:content-none [&::-webkit-details-marker]:hidden border-b border-void-800/80 bg-void-950/60 " +
  "hover:bg-void-900/80 transition-colors";

function InlineDetail({
  cycle,
  actions,
  loadingActions,
  userId,
  userInftTokenId,
}: {
  cycle: Cycle;
  actions: AgentActionRecord[];
  loadingActions: boolean;
  userId: string;
  userInftTokenId?: number | null;
}) {
  const style = ACTION_STYLES[cycle.trade.action] ?? ACTION_STYLES.HOLD;
  const mergedPayments = mergeHuntPaymentRows(cycle, actions);
  const totalCost = mergedPayments.reduce((s, p) => s + p.amount, 0);
  const effectiveInftTokenId = cycle.inftTokenId ?? userInftTokenId ?? null;
  const swap = cycle.swap;

  const hiresFor = (role: "alpha" | "risk" | "executor"): string[] =>
    cycle.specialists.filter((s) => s.hiredBy === role).map((s) => s.name);

  const debateAgents = [
    { emoji: "🟢", name: "Alpha", role: "alpha" as const, data: cycle.adversarial.alpha, recColor: "text-green-400" },
    { emoji: "🔴", name: "Risk", role: "risk" as const, data: cycle.adversarial.risk, recColor: "text-blood-300" },
    { emoji: "🟡", name: "Executor", role: "executor" as const, data: cycle.adversarial.executor, recColor: "text-gold-400" },
  ];

  return (
    <div className="space-y-4 hunt-fade-in">
      {/* Decision banner */}
      <div className="nasdaq-led nasdaq-scanlines nasdaq-dot-matrix rounded-2xl px-6 py-5 border border-dawg-500/20 glow-card">
        <p className="text-[11px] text-void-600 uppercase tracking-widest mb-1">Mediator Decision</p>
        <p className={`font-pixel text-[36px] leading-none uppercase tracking-wider ${style.ledColor} ${style.glow}`}>
          {cycle.trade.action} {cycle.trade.percentage}% {cycle.trade.asset}
        </p>
        {cycle.trade.stopLoss != null && (
          <p className="text-sm text-void-500 mt-1 font-pixel">Stop: {cycle.trade.stopLoss}%</p>
        )}
        {cycle.goal && (
          <p className="text-xs text-void-500 mt-2 italic">&ldquo;{cycle.goal}&rdquo;</p>
        )}
      </div>

      {/* Per-hunt accordions: payments, agent flow, proofs */}
      <div className="space-y-3">
        <details className="rounded-xl border border-void-800 bg-void-950/40 open:border-dawg-500/25" open>
          <summary className={accordionSummaryClass}>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Nanopayments &amp; Arc execution
            </span>
            <Badge variant="blue">USDC</Badge>
          </summary>
          <div className="p-4 space-y-4 border-t border-void-800/60">
            {loadingActions && (
              <p className="text-[10px] text-void-600 font-mono">Loading action log — fund-swap &amp; Arc rows merge when ready…</p>
            )}
            <HuntIndexedPaymentRows payments={mergedPayments} />
            <div className="flex items-center justify-between text-sm pt-1 border-t border-void-800/60">
              <span className="font-medium text-void-200">Hunt cost (Arc)</span>
              <span className="font-mono font-bold text-void-100">${totalCost.toFixed(3)}</span>
            </div>
            <p className="text-xs text-blue-400">Circle nanopayments · Gas-free</p>
            <div
              className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3 space-y-2 hunt-detail-card-enter hunt-card-surface"
              style={
                {
                  "--hunt-stagger": `${Math.min(mergedPayments.length * 42, 320)}ms`,
                } as CSSProperties
              }
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-void-200">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                Arc execution
                <Badge variant="indigo">Testnet</Badge>
              </div>
              {swap ? (
                swap.success && swap.txHash ? (
                  <>
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-void-600 mb-1">Method</div>
                      <span className="font-mono text-xs text-void-300">{swap.method}</span>
                    </div>
                    {swap.amountIn && (
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-void-600 mb-1">Amount</div>
                        <span className="font-mono text-xs text-void-200">${swap.amountIn} USDC</span>
                      </div>
                    )}
                    <ArcTxHashPanel
                      hash={swap.txHash}
                      explorerHref={swap.explorerUrl ?? arcTxUrl(swap.txHash) ?? "#"}
                    />
                  </>
                ) : (
                  <div className="text-xs text-void-500">
                    {swap.method === "skipped"
                      ? `Skipped: ${swap.reason ?? "no allocation required"}`
                      : `Failed: ${swap.reason ?? "unknown error"}`}
                  </div>
                )
              ) : (
                <p className="text-xs text-void-600">No on-chain execution (HOLD or zero allocation).</p>
              )}
            </div>
          </div>
        </details>

        <details className="rounded-xl border border-void-800 bg-void-950/40 open:border-dawg-500/25" open>
          <summary className={accordionSummaryClass}>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-dawg-500" />
              Agent information flow
            </span>
            <Badge variant="amber">debate</Badge>
          </summary>
          <div className="p-4 border-t border-void-800/60 space-y-3">
            <div
              className="hunt-detail-card-enter hunt-card-surface rounded-xl border border-void-800/50 bg-void-950/25 p-2"
              style={{ "--hunt-stagger": "0ms" } as CSSProperties}
            >
              <HuntPipelineArrows actions={actions} />
            </div>
            <p className="text-[11px] text-void-600 uppercase tracking-wider">Conclusion path</p>
            <div className="hunt-detail-card-enter" style={{ "--hunt-stagger": "48ms" } as CSSProperties}>
              <AgentFlowStrip cycle={cycle} />
            </div>
            {cycle.dbId ? (
              <div
                className="hunt-detail-card-enter hunt-card-surface rounded-xl border border-void-800/50 bg-void-950/20 p-1"
                style={{ "--hunt-stagger": "96ms" } as CSSProperties}
              >
                <DebateTheater
                  cycleUuid={cycle.dbId}
                  userId={userId}
                  cycleNumber={cycle.id}
                />
              </div>
            ) : (
              <p className="text-xs text-void-600 py-2">
                Full transcript requires a cycle UUID (fresh hunts from this dashboard). Older rows may omit it.
              </p>
            )}
          </div>
        </details>

        <details className="rounded-xl border border-void-800 bg-void-950/40">
          <summary className={accordionSummaryClass}>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-500" />
              Hedera &amp; 0G proofs
            </span>
            <ZeroGBadge label="audit" />
          </summary>
          <div className="p-4 border-t border-void-800/60 space-y-4">
            <div className="hunt-detail-card-enter rounded-2xl" style={{ "--hunt-stagger": "0ms" } as CSSProperties}>
              <Card className="border-void-800/60 hunt-card-surface">
                <CardHeader>
                  <div className="flex items-center gap-2 text-sm font-semibold text-void-200">
                    <span className="w-2 h-2 rounded-full bg-teal-500" />
                    Hedera audit
                  </div>
                </CardHeader>
                <CardBody>
                  <CodeBlock>
                    <div className="space-y-1 text-void-500">
                      <div>Topic: <span className="text-void-200">{cycle.hcs.topicId}</span></div>
                      <div>Seq: <span className="text-void-200">#{cycle.hcs.sequenceNumber}</span> · Time: {cycle.hcs.timestamp}</div>
                      <div className="text-void-600">6 attestations · 3 payments · 1 decision</div>
                    </div>
                  </CodeBlock>
                  <a
                    href={`https://hashscan.io/testnet/topic/${cycle.hcs.topicId}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs text-teal-400 hover:underline transition-colors"
                  >
                    Verify on Hashscan →
                  </a>
                </CardBody>
              </Card>
            </div>
            <div className="hunt-detail-card-enter rounded-2xl" style={{ "--hunt-stagger": "56ms" } as CSSProperties}>
              <Card className="border-void-800/60 hunt-card-surface">
                <CardHeader>
                  <div className="flex items-center gap-2 text-sm font-semibold text-void-200">
                    <span className="w-2 h-2 rounded-full bg-gold-400" />
                    0G proof
                  </div>
                  <ZeroGBadge label="0G Storage + Chain" />
                </CardHeader>
                <CardBody className="space-y-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-void-600 mb-1">0G Storage root</div>
                    {cycle.storageHash ? (
                      <span className="font-mono text-sm text-gold-400 break-all">{cycle.storageHash}</span>
                    ) : (
                      <span className="text-xs text-void-600">Pending commit</span>
                    )}
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-void-600 mb-1">iNFT (ERC-7857)</div>
                    {effectiveInftTokenId != null ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-gold-400">Token #{effectiveInftTokenId}</span>
                          <Badge variant="green">0G Chain</Badge>
                        </div>
                        <a href={`${OG_EXPLORER_BASE}/address/${INFT_CONTRACT}`}
                          target="_blank" rel="noopener noreferrer"
                          className="inline-block text-xs text-gold-400 hover:underline">
                          View on 0G Explorer →
                        </a>
                      </div>
                    ) : (
                      <span className="text-xs text-void-600">No iNFT minted</span>
                    )}
                  </div>
                  {cycle.memory.length > 0 && (
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-void-600 mb-1">Pack memory</div>
                      {cycle.memory.map((m) => (
                        <div key={m.cycleRef} className="flex gap-2">
                          <span className="font-mono text-xs text-gold-400 shrink-0 pt-0.5">#{m.cycleRef}</span>
                          <p className="text-xs text-void-500 leading-relaxed">{m.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          </div>
        </details>
      </div>

      {/* 2-column layout: ETH pack | The challenge */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Column 1: ETH pack */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm font-semibold text-void-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              ETH pack
            </div>
            <Badge variant="amber">{cycle.specialists.length} hired</Badge>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="rounded-md border border-dawg-500/20 bg-dawg-500/5 px-2.5 py-1.5 text-[10px] text-dawg-300 font-mono uppercase tracking-wider">
              Rate each specialist — your vote moves their ELO score on the marketplace.
            </div>
            {cycle.specialists.map((s, i) => {
              const hiredBy = s.hiredBy ?? "main-agent";
              const paymentUrl = s.paymentTxHash && s.paymentTxHash.startsWith("0x")
                ? arcTxUrl(s.paymentTxHash) : null;
              return (
                <div
                  key={`${s.name}-${i}`}
                  className="space-y-2 rounded-xl border border-void-800/70 bg-void-950/30 p-3 hunt-panel-card-enter hunt-card-surface"
                  style={{ "--hunt-stagger": `${i * 52}ms` } as CSSProperties}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span>{s.emoji}</span>
                      <span className="text-xs font-semibold text-void-200">{s.name}</span>
                      <ZeroGBadge />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-wider ${HIRER_BADGE[hiredBy] ?? HIRER_BADGE["main-agent"]}`}>
                        hired by {hiredBy}
                      </span>
                      {paymentUrl ? (
                        <a href={paymentUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs font-mono text-teal-300 hover:text-teal-200 underline decoration-dotted"
                          title={s.paymentTxHash}>
                          ${s.price.toFixed(3)} ↗
                        </a>
                      ) : (
                        <span className="text-xs font-mono text-void-500">${s.price.toFixed(3)}</span>
                      )}
                    </div>
                  </div>
                  <CodeBlock>{s.analysis}</CodeBlock>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <SealedBadge />
                      <span className="text-xs font-mono text-void-600">{s.attestation}</span>
                    </div>
                    <RatingButtons agentName={s.name} cycleId={cycle.id} />
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>

        {/* Column 2: The challenge */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm font-semibold text-void-200">
              <span className="w-2 h-2 rounded-full bg-blood-500 animate-pulse" />
              The challenge
              {cycle.rebuttalTriggered && <Badge variant="amber">2 rounds</Badge>}
            </div>
            <LiveBadge />
          </CardHeader>
          <CardBody className="space-y-4">
            {debateAgents.map(({ emoji, name, role, data, recColor }, idx) => {
              const hires = hiresFor(role);
              return (
                <div
                  key={name}
                  className="space-y-2 rounded-xl border border-void-800/70 bg-void-950/30 p-3 hunt-panel-card-enter hunt-card-surface"
                  style={{ "--hunt-stagger": `${idx * 52}ms` } as CSSProperties}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span>{emoji}</span>
                      <span className="text-sm font-semibold text-void-200">{name}</span>
                    </div>
                    <SealedBadge />
                  </div>
                  <CodeBlock>
                    {data.argument}
                    <br />
                    <span className={`font-semibold ${recColor}`}>{data.recommendation}</span>
                  </CodeBlock>
                  <div className="text-[10px] text-void-600 font-mono">
                    {hires.length > 0 ? (
                      <>hires: <span className={recColor}>{hires.join(", ")}</span></>
                    ) : (
                      <span className="italic">no specialists hired</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-void-500">0G: glm-5-chat</span>
                    <span className="text-xs font-mono text-void-600">{data.attestation}</span>
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>
      </div>

      {/* Action Logs */}
      {loadingActions ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-dawg-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-2 text-xs text-void-500">Loading hunt logs…</span>
        </div>
      ) : (
        <ComputeLog actions={actions} />
      )}

      {/* On-chain proof footer */}
      <div className="flex items-center gap-4 text-xs text-void-600 flex-wrap border-t border-void-800 pt-3">
        {cycle.hcs.sequenceNumber > 0 && (
          <a href={hashscanMessageUrl(HCS_TOPIC_ID, cycle.hcs.sequenceNumber)}
            target="_blank" rel="noopener noreferrer"
            className="text-teal-400 hover:text-teal-300 underline decoration-dotted">
            Hedera HCS: seq #{cycle.hcs.sequenceNumber} ↗
          </a>
        )}
        <a href={hashscanTopicUrl(HCS_TOPIC_ID)} target="_blank" rel="noopener noreferrer"
          className="text-void-500 hover:text-teal-300 font-mono">
          topic {HCS_TOPIC_ID}
        </a>
        {cycle.storageHash && (
          <button type="button"
            onClick={() => navigator.clipboard.writeText(cycle.storageHash ?? "").catch(() => {})}
            className="text-gold-400 hover:text-gold-300 font-mono">
            0G: {truncHash(cycle.storageHash)} 📋
          </button>
        )}
        <a href={ogChainAddressUrl(INFT_CONTRACT_ADDRESS)} target="_blank" rel="noopener noreferrer"
          className="text-gold-400 hover:text-gold-300 underline decoration-dotted">
          iNFT contract ↗
        </a>
        {cycle.inftTokenId != null && (
          <a href={inftTokenUrl(cycle.inftTokenId)} target="_blank" rel="noopener noreferrer"
            className="text-gold-400 hover:text-gold-300 underline decoration-dotted">
            iNFT #{cycle.inftTokenId} ↗
          </a>
        )}
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────

export function ExpandableHuntCard({
  cycle,
  userId,
  defaultExpanded = false,
  userInftTokenId,
  computing = false,
  computingLabel,
  computingStage,
}: {
  cycle: Cycle;
  userId: string;
  defaultExpanded?: boolean;
  userInftTokenId?: number | null;
  /** When true, renders a spinner badge in the card corner and surfaces the
      current stage message in the expanded body. Used by the dashboard while
      an analyze/approve flow is in flight. */
  computing?: boolean;
  computingLabel?: string;
  computingStage?: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [actions, setActions] = useState<AgentActionRecord[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);
  const wasComputingRef = useRef(!!computing);

  // Fetch actions when expanded
  useEffect(() => {
    if (!expanded || !userId) return;
    setLoadingActions(true);
    getCycleDetail(userId, cycle.id)
      .then((data) => {
        if (data) setActions(data.actions);
      })
      .finally(() => setLoadingActions(false));
  }, [expanded, userId, cycle.id]);

  // While a cycle is computing (analyze/commit), poll agent_actions so payment
  // hashes and fund-swap Circle ids appear without closing the accordion.
  useEffect(() => {
    if (!expanded || !userId || !computing) return;
    const id = window.setInterval(() => {
      getCycleDetail(userId, cycle.id).then((data) => {
        if (data) setActions(data.actions);
      });
    }, 2500);
    return () => clearInterval(id);
  }, [expanded, userId, cycle.id, computing]);

  // When computing finishes, refresh once so the final committed rows replace
  // any stale partial list from the poll.
  useEffect(() => {
    if (wasComputingRef.current && !computing && expanded && userId) {
      getCycleDetail(userId, cycle.id).then((data) => {
        if (data) setActions(data.actions);
      });
    }
    wasComputingRef.current = !!computing;
  }, [computing, expanded, userId, cycle.id]);

  return (
    <div className={`bg-void-900 border rounded-2xl px-4 py-3 agent-card cursor-pointer transition-all ${expanded ? "border-dawg-500/30 glow-card col-span-full" : "border-void-800 hover:glow-card"} ${computing ? "border-dawg-500/40" : ""}`}>
      <CompactView
        cycle={cycle}
        expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        computing={computing}
        computingLabel={computingLabel}
      />

      {/* Inline expand area using CSS grid animation */}
      <div className="hunt-expand-grid" data-open={expanded ? "true" : "false"}>
        <div className="hunt-expand-inner">
          {expanded && (
            <div
              className="pt-4 border-t border-void-800 mt-3"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              role="presentation"
            >
              {computing && (
                <div className="mb-4 flex items-center gap-3 rounded-xl border border-dawg-500/30 bg-dawg-500/5 px-4 py-3">
                  <span className="w-4 h-4 border-2 border-dawg-400 border-t-transparent rounded-full animate-spin shrink-0" />
                  <div className="flex-1">
                    <div className="text-[11px] uppercase tracking-wider text-dawg-300 font-semibold">
                      {computingLabel ?? "Computing"} new hunt
                    </div>
                    {computingStage && (
                      <div className="text-xs text-void-400 mt-0.5">{computingStage}</div>
                    )}
                    <div className="text-[10px] text-void-600 mt-1">
                      Showing last committed hunt until the new one finishes. Live logs will appear below.
                    </div>
                  </div>
                </div>
              )}
              <InlineDetail
                cycle={cycle}
                actions={actions}
                loadingActions={loadingActions}
                userId={userId}
                userInftTokenId={userInftTokenId}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
