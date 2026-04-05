"use client";

import { useEffect, useState } from "react";
import { getInProgressCycle, type InProgressCycleResponse } from "@/lib/api";

const NAME_MAP: Record<string, string> = {
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

const EMOJI_MAP: Record<string, string> = {
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

const PHASE_LABELS: Record<InProgressCycleResponse["phase"], string> = {
  hiring: "Hiring specialists via x402",
  debating: "Adversarial debate · Alpha → Risk → Executor",
  sealing: "Sealing to 0G storage + Hedera HCS",
  committing: "Writing final cycle row",
  awaiting_approval: "Awaiting your approval to seal the hunt",
};

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

interface Props {
  userId: string | null;
  /** Poll interval in milliseconds. Default 2s — faster than the 6s hunt-feed poller. */
  pollMs?: number;
}

/**
 * Live "HUNT #N · in progress" banner. Polls `/api/cycle/in-progress/:userId`
 * every `pollMs` and renders a compact card showing the current phase,
 * elapsed time, and specialists hired so far. Renders nothing when no cycle
 * is in flight (so it silently disappears once commitCycle completes and
 * the hunt card for #N appears in the main feed).
 *
 * The card's elapsed counter ticks locally every second so the user sees
 * continuous feedback between polls.
 */
export function InProgressHuntBanner({ userId, pollMs = 2000 }: Props) {
  const [state, setState] = useState<InProgressCycleResponse | null>(null);
  const [localNow, setLocalNow] = useState(() => Date.now());

  // Poll server for state updates
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const poll = async () => {
      const next = await getInProgressCycle(userId);
      if (!cancelled) setState(next);
    };

    void poll();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, pollMs);
    const onVis = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [userId, pollMs]);

  // Tick local clock every second so the elapsed counter advances between polls
  useEffect(() => {
    if (!state) return;
    const id = setInterval(() => setLocalNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state]);

  if (!state) return null;

  const startedAtMs = new Date(state.startedAt).getTime();
  const elapsed = Math.max(0, localNow - startedAtMs);
  const phaseLabel = PHASE_LABELS[state.phase];
  const progressSteps: Array<{ key: string; label: string; done: boolean }> = [
    { key: "hiring", label: "Hire", done: state.specialists.length >= 3 },
    { key: "alpha", label: "Alpha", done: state.flags.hasAlpha },
    { key: "risk", label: "Risk", done: state.flags.hasRisk },
    { key: "executor", label: "Verdict", done: state.flags.hasExecutor },
    { key: "storage", label: "0G", done: state.flags.hasStorage },
    { key: "hcs", label: "HCS", done: state.flags.hasHcs },
  ];

  return (
    <div className="relative rounded-2xl border border-dawg-500/40 bg-dawg-500/5 overflow-hidden">
      {/* Animated top border pulse */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-dawg-400 to-transparent animate-pulse" />

      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <span className="relative flex items-center">
              <span className="absolute inline-flex h-2 w-2 rounded-full bg-dawg-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-dawg-400" />
            </span>
            <span className="font-pixel text-sm sm:text-base uppercase tracking-wider text-dawg-300">
              HUNT #{state.cycleNumber}
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-dawg-500/70 border border-dawg-500/30 bg-dawg-500/10 px-2 py-0.5 rounded-md">
              In progress
            </span>
            <span className="text-xs text-void-400 hidden sm:inline truncate">
              {phaseLabel}
            </span>
          </div>
          <span className="text-[10px] font-mono tabular-nums text-dawg-400">
            {formatElapsed(elapsed)}
          </span>
        </div>

        {/* Phase pipeline — each step glows gold when complete */}
        <div className="flex items-center gap-1 flex-wrap">
          {progressSteps.map((step, i) => (
            <div key={step.key} className="flex items-center gap-1">
              <span
                className={`text-[10px] font-mono uppercase tracking-wide px-2 py-1 rounded border ${
                  step.done
                    ? "border-dawg-500/60 bg-dawg-500/15 text-dawg-300"
                    : "border-void-700 bg-void-900 text-void-600"
                }`}
              >
                {step.label}
              </span>
              {i < progressSteps.length - 1 && (
                <span className="text-void-700 text-[10px]">→</span>
              )}
            </div>
          ))}
        </div>

        {/* Specialists hired so far */}
        {state.specialists.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {state.specialists.map((s) => (
              <div
                key={`${s.name}-${s.hiredAt}`}
                className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded border border-void-700 bg-void-900 text-void-300"
              >
                <span className="text-sm leading-none">{EMOJI_MAP[s.name] ?? "🤖"}</span>
                <span className="uppercase tracking-wide">{NAME_MAP[s.name] ?? s.name}</span>
                {s.signal && (
                  <span
                    className={
                      s.signal === "BUY"
                        ? "text-green-400"
                        : s.signal === "SELL"
                          ? "text-blood-400"
                          : "text-gold-400"
                    }
                  >
                    {s.signal}
                  </span>
                )}
                {s.confidence != null && <span className="text-void-500">{s.confidence}%</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
