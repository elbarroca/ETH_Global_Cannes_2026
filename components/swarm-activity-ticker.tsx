"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SwarmActivityResponse, SwarmActivityRow } from "@/lib/types";
import { agentEmoji, agentLabel } from "@/lib/swarm-endpoints";
import { arcTxUrl } from "@/lib/links";
import { useUser } from "@/contexts/user-context";

const POLL_MS = 3_000;
const LIMIT = 25;

/**
 * Action types whose appearance in the feed means the agent wallet balance
 * just moved on Arc. When the ticker's poll detects a new row with one of
 * these types, it asks `user-context` to re-fetch the balance immediately
 * so the nav pill and Nasdaq header update within one tick instead of
 * waiting for the next 3s balance poll to fire.
 */
const BALANCE_MOVING_ACTIONS = new Set([
  "SPECIALIST_HIRED",
  "TRADE_EXECUTED",
  "SWAP_EXECUTED",
  "PAYMENT_SENT",
  "AGENT_HIRED",
]);

/**
 * Visual treatment per action type. `tone` drives the LED glow colour
 * used on the big pixel-font label. `label` is the 3–6 char LED tag.
 */
interface ActionStyle {
  label: string;
  tone: "dawg" | "green" | "red" | "teal" | "purple" | "void";
}

const ACTION_STYLES: Record<string, ActionStyle> = {
  SPECIALIST_HIRED: { label: "HIRE",     tone: "dawg" },
  DEBATE_ALPHA:     { label: "ALPHA",    tone: "green" },
  DEBATE_RISK:      { label: "RISK",     tone: "red" },
  DEBATE_EXECUTOR:  { label: "VERDICT",  tone: "dawg" },
  HCS_LOGGED:       { label: "HCS",      tone: "teal" },
  STORAGE_UPLOADED: { label: "0G",       tone: "teal" },
  INFT_UPDATED:     { label: "iNFT",     tone: "purple" },
  TRADE_EXECUTED:   { label: "SWAP",     tone: "dawg" },
  SWAP_FAILED:      { label: "SWAP✗",    tone: "red" },
  CYCLE_STARTED:    { label: "START",    tone: "void" },
  CYCLE_COMPLETED:  { label: "SEALED",   tone: "dawg" },
  CYCLE_REJECTED:   { label: "REJ",      tone: "red" },
  AGENT_HIRED:      { label: "PACK+",    tone: "dawg" },
  AGENT_FIRED:      { label: "PACK−",    tone: "void" },
  AGENT_RATED:      { label: "RATE",     tone: "purple" },
};

const DEFAULT_STYLE: ActionStyle = { label: "EVENT", tone: "void" };

// Sentinel written by `callSpecialist()` in src/agents/hire-specialist.ts when
// a hire runs without an x402 payment (e.g. specialist served over plain HTTP,
// or the x402 middleware didn't fire). The field isn't null — it's this exact
// string — so we filter it out explicitly before treating `paymentTxHash` as
// a real on-chain receipt.
const NO_PAYMENT_SENTINEL = "no-payment";

/**
 * Parse a `payment_amount` column value into a USD number.
 *
 * Historical rows may contain a leading `$` (the column was briefly stored as
 * `"$0.001"` before we normalized it to bare numeric strings). Strip it before
 * calling `Number()` so those legacy rows don't render as `$NaN`.
 */
function parsePaymentAmount(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/^\$/, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Human-friendly one-sentence description of what actually happened.
 *
 * Judges read this across the room — so we spell out the story in plain
 * English, substituting the agent name + payment amount where available,
 * rather than relying on cryptic codes like `DEBATE_ALPHA`.
 */
function describe(row: SwarmActivityRow): string {
  const agent = row.agentName ? agentLabel(row.agentName) : null;
  const amount = parsePaymentAmount(row.paymentAmount);
  const price = amount != null ? `$${amount.toFixed(3)}` : null;
  const p = (row.payload ?? {}) as Record<string, unknown>;

  // Pull commonly-referenced payload fields once so the switch cases below
  // can cheaply decide whether to surface richer context. All narrowings are
  // defensive — a missing or mistyped field falls back to the generic string.
  const decision = typeof p.decision === "string" ? p.decision : null;
  const asset =
    typeof p.asset === "string"
      ? p.asset
      : typeof p.swapAssetOut === "string"
        ? p.swapAssetOut
        : null;
  const pct = typeof p.pct === "number" ? p.pct : typeof p.decisionPct === "number" ? p.decisionPct : null;
  const cycleNum =
    typeof p.cycleNumber === "number"
      ? p.cycleNumber
      : typeof p.cycleId === "number"
        ? p.cycleId
        : null;
  const txHash =
    typeof p.txHash === "string"
      ? p.txHash
      : typeof p.swapTxHash === "string"
        ? p.swapTxHash
        : null;
  const tokenId = typeof p.tokenId === "number" ? p.tokenId : null;
  const storageHash = typeof p.storageHash === "string" ? p.storageHash : null;

  // Narrow payload for rating rows — action-type-dependent shape (see
  // app/api/marketplace/rate/route.ts). Degrades gracefully if payload is
  // missing or a field has the wrong type.
  if (row.actionType === "AGENT_RATED") {
    const kind = typeof p.kind === "string" ? p.kind : null;
    const rb = typeof p.reputationBefore === "number" ? p.reputationBefore : null;
    const ra = typeof p.reputationAfter === "number" ? p.reputationAfter : null;
    const verb = kind === "verify" ? "verified" : kind === "dislike" ? "disliked" : "liked";
    const who = agent ?? "a specialist";
    if (rb != null && ra != null) {
      return `User ${verb} ${who} · ELO ${rb} → ${ra}`;
    }
    return `User ${verb} ${who}`;
  }

  switch (row.actionType) {
    case "SPECIALIST_HIRED": {
      const signal = typeof p.signal === "string" ? p.signal : null;
      const confidence = typeof p.confidence === "number" ? p.confidence : null;
      const hiredBy = typeof p.hiredBy === "string" ? p.hiredBy : null;
      const signalSuffix =
        signal && confidence != null ? ` — returned ${signal} ${confidence}%` : "";
      const byPrefix = hiredBy && hiredBy !== "main-agent" ? `${hiredBy} hired ` : "Hired ";
      if (agent && price) {
        return `${byPrefix}${agent} · paid ${price} via x402${signalSuffix}`;
      }
      if (agent) {
        return `${byPrefix}${agent} from the marketplace${signalSuffix}`;
      }
      return "Hired a specialist via x402";
    }
    case "DEBATE_ALPHA": {
      const rec =
        typeof p.recommendation === "string"
          ? p.recommendation
          : typeof p.signal === "string"
            ? p.signal
            : null;
      return rec
        ? `Alpha argued the bull case · recommended ${rec}`
        : "Alpha agent argued the bull case";
    }
    case "DEBATE_RISK": {
      const cap = typeof p.maxPct === "number" ? p.maxPct : null;
      return cap != null
        ? `Risk challenged the trade · capped at ${cap}%`
        : "Risk agent challenged with the bear view";
    }
    case "DEBATE_EXECUTOR": {
      if (decision && asset && pct != null) {
        return `Executor verdict: ${decision} ${pct}% ${asset}`;
      }
      return "Executor issued the final verdict";
    }
    case "HCS_LOGGED": {
      const seq = typeof p.seqNum === "number" ? p.seqNum : null;
      if (seq != null && decision && asset) {
        return `Sealed ${decision}${pct != null ? ` ${pct}%` : ""} ${asset} to Hedera HCS seq #${seq}`;
      }
      if (seq != null) return `Decision sealed to Hedera HCS seq #${seq}`;
      return "Decision sealed to Hedera HCS topic";
    }
    case "STORAGE_UPLOADED": {
      const rh = storageHash ?? (typeof p.rootHash === "string" ? p.rootHash : null);
      if (rh && cycleNum != null) {
        return `Uploaded hunt #${cycleNum} reasoning to 0G Storage · ${rh.slice(0, 10)}…`;
      }
      if (cycleNum != null) return `Uploaded hunt #${cycleNum} reasoning to 0G Storage`;
      return "Memory uploaded to 0G decentralized storage";
    }
    case "INFT_UPDATED": {
      if (tokenId != null) return `Refreshed iNFT #${tokenId} metadata on 0G Chain`;
      return "Agent iNFT metadata refreshed on 0G Chain";
    }
    case "TRADE_EXECUTED":
    case "SWAP_EXECUTED": {
      if (decision && asset && pct != null) {
        return `Swapped ${decision} ${pct}% ${asset} on Arc${txHash ? ` · ${txHash.slice(0, 10)}…` : ""}`;
      }
      if (asset) return `Arc USDC swap executed — out ${asset}`;
      return "Arc USDC swap executed on-chain";
    }
    case "SWAP_FAILED": {
      const reason = typeof p.reason === "string" ? p.reason : null;
      return reason ? `Swap failed — ${reason} · funds safe` : "Swap failed — funds remain safe";
    }
    case "CYCLE_STARTED": {
      if (cycleNum != null) return `Started hunt #${cycleNum}`;
      return "New hunt cycle initiated by the main agent";
    }
    case "CYCLE_COMPLETED": {
      if (decision && asset && pct != null && cycleNum != null) {
        return `Hunt #${cycleNum} committed: ${decision} ${pct}% ${asset}`;
      }
      if (decision && asset) return `Cycle committed: ${decision} ${asset}`;
      return "Hunt cycle committed to the audit trail";
    }
    case "CYCLE_REJECTED": {
      if (cycleNum != null) return `Hunt #${cycleNum} rejected by the user`;
      return "Pending cycle rejected by the user";
    }
    case "AGENT_HIRED":
      return agent
        ? `${agent} joined the pack`
        : "New specialist joined the pack";
    case "AGENT_FIRED":
      return agent
        ? `${agent} removed from the pack`
        : "Specialist removed from the pack";
    default:
      return agent ? `${agent} event` : "Swarm event";
  }
}

const TONE_TEXT: Record<ActionStyle["tone"], string> = {
  dawg:   "text-[#FFE066] glow-dawg-strong",
  green:  "text-[#39FF7A] glow-green",
  red:    "text-[#FF5A5A] glow-red",
  teal:   "text-[#5EEAD4] glow-teal",
  purple: "text-[#C497FF] glow-purple",
  void:   "text-void-200 glow-void",
};

const TONE_DOT: Record<ActionStyle["tone"], string> = {
  dawg:   "bg-dawg-400 shadow-[0_0_10px_rgba(255,199,0,0.9)]",
  green:  "bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.9)]",
  red:    "bg-blood-500 shadow-[0_0_10px_rgba(239,68,68,0.9)]",
  teal:   "bg-teal-400 shadow-[0_0_10px_rgba(20,184,166,0.9)]",
  purple: "bg-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.9)]",
  void:   "bg-void-400",
};

const TONE_BORDER: Record<ActionStyle["tone"], string> = {
  dawg:   "border-l-dawg-500/80",
  green:  "border-l-emerald-500/80",
  red:    "border-l-blood-500/80",
  teal:   "border-l-teal-500/80",
  purple: "border-l-purple-500/80",
  void:   "border-l-void-600",
};

/**
 * Live feed of recent agent_actions rows, styled as a Marketsite-esque
 * pixel LED board. Each row is a 3-line "event card":
 *
 *   Line 1 — big pixel label (HIRE / ALPHA / SWAP…) with glow + relative time
 *   Line 2 — plain-English sentence describing what the swarm just did
 *   Line 3 — meta: price, tx hash link, TEE ✓, duration
 *
 * Sized for TV viewing: labels are 22px, descriptions 14px, meta 12px.
 */
export function SwarmActivityTicker() {
  const { refreshAgentBalance } = useUser();
  const [rows, setRows] = useState<SwarmActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  // Currently-expanded row id. Only one row open at a time — clicking another
  // row closes the previous one. Avoids a modal: the detail renders inline
  // inside the same <li> so judges keep their place in the feed.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  // Remember the newest row id we've already shown so we can detect
  // genuinely-new rows on each poll. Lives in a ref so updating it doesn't
  // trigger a re-render loop.
  const lastSeenIdRef = useRef<string | null>(null);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const fetchRows = useCallback(async () => {
    try {
      const res = await fetch(`/api/swarm/activity?limit=${LIMIT}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as SwarmActivityResponse;
      const nextRows = data.rows ?? [];
      setRows(nextRows);

      // Detect new balance-moving rows since the last poll. `nextRows` is
      // newest-first, so walk from the top until we hit the previous top id.
      // Any row above that cutoff is new. If any new row is a balance-moving
      // action (hire, swap, transfer) trigger an out-of-band balance refresh
      // so the nav pill updates within ~200ms instead of waiting up to 3s
      // for the user-context's own poll to tick.
      const previousTopId = lastSeenIdRef.current;
      let sawBalanceMovingNewRow = false;
      for (const row of nextRows) {
        if (row.id === previousTopId) break;
        if (BALANCE_MOVING_ACTIONS.has(row.actionType)) {
          sawBalanceMovingNewRow = true;
          break;
        }
      }
      if (nextRows.length > 0) {
        lastSeenIdRef.current = nextRows[0].id;
      }
      // Skip the very first poll (previousTopId === null) so we don't
      // pointlessly refetch balance on page load — user-context's own
      // initial tick handles that.
      if (sawBalanceMovingNewRow && previousTopId !== null) {
        void refreshAgentBalance();
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [refreshAgentBalance]);

  useEffect(() => {
    void fetchRows();
    const id = setInterval(fetchRows, POLL_MS);
    return () => clearInterval(id);
  }, [fetchRows]);

  useEffect(() => {
    if (!userScrolledRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [rows]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    userScrolledRef.current = e.currentTarget.scrollTop > 40;
  };

  return (
    <div className="bg-black border-2 border-dawg-500/40 rounded-2xl overflow-hidden flex flex-col h-[620px] glow-card nasdaq-scanlines">
      {/* Header strip — pixel LED title bar */}
      <div className="relative flex items-center justify-between px-4 py-3 border-b border-dawg-500/30 bg-black">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-dawg-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-dawg-400 shadow-[0_0_10px_rgba(255,199,0,0.9)]" />
          </span>
          <span className="font-pixel glow-dawg-strong text-[22px] leading-none text-[#FFE066] uppercase tracking-[0.1em]">
            Swarm Activity
          </span>
        </div>
        <span className="font-pixel glow-dawg text-[16px] leading-none text-[#FFCC00]">
          {rows.length} EVENTS
        </span>
      </div>

      {/* Scrollable feed */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-dawg-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="font-pixel glow-dawg text-center py-8 text-[18px] text-[#FFCC00]/60">
            Waiting for swarm events…
          </div>
        ) : (
          <ul className="divide-y divide-dawg-500/10">
            {rows.map((row) => (
              <TickerRow
                key={row.id}
                row={row}
                expanded={expandedId === row.id}
                onToggle={() => toggleExpand(row.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TickerRow({
  row,
  expanded,
  onToggle,
}: {
  row: SwarmActivityRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const style = ACTION_STYLES[row.actionType] ?? DEFAULT_STYLE;
  const emoji = row.agentName ? agentEmoji(row.agentName) : null;
  const teeOk = row.teeVerified === true;
  const amount = parsePaymentAmount(row.paymentAmount);
  const hasRealTx =
    !!row.paymentTxHash && row.paymentTxHash !== NO_PAYMENT_SENTINEL;
  const hasPayment = amount != null && hasRealTx;
  const duration = row.durationMs != null && row.durationMs > 0
    ? `${(row.durationMs / 1000).toFixed(1)}s`
    : null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLLIElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    } else if (e.key === "Escape" && expanded) {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <li
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      className={`payment-enter px-4 py-3.5 border-l-[3px] ${TONE_BORDER[style.tone]} cursor-pointer transition-colors ${
        expanded ? "bg-dawg-500/[0.08]" : "hover:bg-dawg-500/[0.04]"
      } focus:outline-none focus:bg-dawg-500/[0.08]`}
    >
      {/* ── Line 1 — pixel LED action label + timestamp ─────────────── */}
      <div className="flex items-center gap-2.5">
        <span className={`w-2 h-2 rounded-full shrink-0 ${TONE_DOT[style.tone]}`} />
        <span
          className={`font-pixel text-[22px] leading-none tracking-wider shrink-0 ${TONE_TEXT[style.tone]}`}
        >
          {style.label}
        </span>
        {emoji && <span className="text-[18px] leading-none shrink-0">{emoji}</span>}
        <span className="font-pixel glow-dawg ml-auto text-[16px] leading-none text-[#FFCC00]/70 shrink-0">
          {relativeTime(row.createdAt)}
        </span>
      </div>

      {/* ── Line 2 — descriptive sentence ───────────────────────────── */}
      <p className="mt-2 text-sm leading-snug text-void-200">
        {describe(row)}
      </p>

      {/* ── Line 3 — meta strip (price, tx hash, TEE, duration) ─────── */}
      {(hasPayment || teeOk || hasRealTx || duration) && (
        <div className="mt-2 flex items-center gap-2.5 flex-wrap text-xs">
          {hasPayment && amount != null && (
            <span className="font-pixel glow-green text-[15px] leading-none text-[#39FF7A]">
              ${amount.toFixed(3)}
            </span>
          )}
          {hasRealTx && row.paymentTxHash && row.paymentTxHash.startsWith("0x") ? (
            <a
              href={arcTxUrl(row.paymentTxHash) ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="font-mono text-[11px] text-teal-300 hover:text-teal-200 underline decoration-dotted"
              title={`View x402 payment on ArcScan: ${row.paymentTxHash}`}
            >
              {row.paymentTxHash.slice(0, 10)}… ↗
            </a>
          ) : row.paymentTxHash ? (
            <span className="font-mono text-[11px] text-void-500">
              {row.paymentTxHash.slice(0, 10)}…
            </span>
          ) : null}
          {teeOk && (
            <span className="font-pixel glow-dawg text-[14px] leading-none text-[#FFCC00]">
              TEE ✓
            </span>
          )}
          {duration && (
            <span className="font-pixel text-[14px] leading-none text-void-400">
              {duration}
            </span>
          )}
        </div>
      )}

      {/* ── Expanded detail panel ──────────────────────────────────────
          Rendered inline beneath the summary row when the user clicks or
          presses Enter/Space. Surfaces the full attestation hash, the
          non-truncated tx hash, the payload JSON, and a per-action-type
          contextual link (e.g. "View hunt cycle" for rows that carry a
          cycleId). Kept in-flow instead of a modal so the scroll position
          stays stable and keyboard focus never leaves the ticker. */}
      {expanded && <TickerRowDetail row={row} />}
    </li>
  );
}

function TickerRowDetail({ row }: { row: SwarmActivityRow }) {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  const cycleNum =
    typeof payload.cycleNumber === "number"
      ? payload.cycleNumber
      : typeof payload.cycleId === "number"
        ? payload.cycleId
        : null;

  return (
    <div
      className="mt-3 rounded-lg border border-dawg-500/20 bg-black/60 px-3 py-2.5 space-y-2 text-[11px] font-mono text-void-300"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="grid grid-cols-[110px,1fr] gap-x-2 gap-y-1">
        <span className="text-void-600 uppercase tracking-wider">Action</span>
        <span className="text-void-200 break-all">{row.actionType}</span>

        {row.agentName && (
          <>
            <span className="text-void-600 uppercase tracking-wider">Agent</span>
            <span className="text-void-200 break-all">{row.agentName}</span>
          </>
        )}

        <span className="text-void-600 uppercase tracking-wider">Status</span>
        <span
          className={
            row.status === "success"
              ? "text-emerald-300"
              : row.status === "failed"
                ? "text-blood-300"
                : "text-void-200"
          }
        >
          {row.status}
        </span>

        <span className="text-void-600 uppercase tracking-wider">Timestamp</span>
        <span className="text-void-200">{new Date(row.createdAt).toLocaleString()}</span>

        {row.attestationHash && (
          <>
            <span className="text-void-600 uppercase tracking-wider">Attestation</span>
            <span className="text-void-200 break-all">{row.attestationHash}</span>
          </>
        )}

        {row.paymentTxHash && row.paymentTxHash !== NO_PAYMENT_SENTINEL && (
          <>
            <span className="text-void-600 uppercase tracking-wider">Tx hash</span>
            {row.paymentTxHash.startsWith("0x") ? (
              <a
                href={arcTxUrl(row.paymentTxHash) ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-300 hover:text-teal-200 underline decoration-dotted break-all"
              >
                {row.paymentTxHash} ↗
              </a>
            ) : (
              <span className="text-void-200 break-all">{row.paymentTxHash}</span>
            )}
          </>
        )}

        {row.paymentNetwork && (
          <>
            <span className="text-void-600 uppercase tracking-wider">Network</span>
            <span className="text-void-200">{row.paymentNetwork}</span>
          </>
        )}

        {row.durationMs != null && row.durationMs > 0 && (
          <>
            <span className="text-void-600 uppercase tracking-wider">Duration</span>
            <span className="text-void-200">{(row.durationMs / 1000).toFixed(2)}s</span>
          </>
        )}
      </div>

      {Object.keys(payload).length > 0 && (
        <div className="pt-2 border-t border-dawg-500/10">
          <div className="text-void-600 uppercase tracking-wider text-[10px] mb-1">
            Payload
          </div>
          <pre className="text-void-300 whitespace-pre-wrap break-all text-[10px] leading-relaxed max-h-[180px] overflow-y-auto">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </div>
      )}

      {cycleNum != null && (
        <div className="pt-1">
          <a
            href={`/verify?cycle=${cycleNum}`}
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] text-teal-300 hover:text-teal-200 underline decoration-dotted"
          >
            View hunt #{cycleNum} attestations ↗
          </a>
        </div>
      )}
    </div>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 10_000) return "NOW";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}S`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}M`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}H`;
  return `${Math.floor(diff / 86_400_000)}D`;
}
