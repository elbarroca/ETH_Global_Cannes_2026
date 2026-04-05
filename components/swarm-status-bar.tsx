"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SWARM_AGENTS } from "@/lib/swarm-endpoints";
import { LIVE_CONTRACTS } from "@/lib/links";
import type {
  SwarmHealthResponse,
  SwarmHealthAgent,
  SwarmHealthState,
  SwarmMetricsResponse,
} from "@/lib/types";

const POLL_MS = 15_000;

// Maps the 4 SwarmHealthState values to Tailwind color classes for the dot.
const DOT_CLASSES: Record<SwarmHealthState, string> = {
  online: "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.95)]",
  waking: "bg-gold-400 shadow-[0_0_10px_rgba(251,191,36,0.95)] animate-pulse",
  offline: "bg-blood-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]",
  timeout: "bg-blood-600",
};

const STATUS_LABEL: Record<SwarmHealthState, string> = {
  online: "Online",
  waking: "Waking (cold start)",
  offline: "Offline",
  timeout: "Timed out",
};

/** Compact horizontal strip with 13 agent health pills + 24h metric chips. */
export function SwarmStatusBar() {
  const [health, setHealth] = useState<SwarmHealthResponse | null>(null);
  const [metrics, setMetrics] = useState<SwarmMetricsResponse | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [h, m] = await Promise.all([
        fetch("/api/swarm/health", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
        fetch("/api/swarm/metrics", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      ]);
      if (h) setHealth(h as SwarmHealthResponse);
      if (m) setMetrics(m as SwarmMetricsResponse);
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
    const id = setInterval(fetchAll, POLL_MS);
    return () => clearInterval(id);
  }, [fetchAll]);

  // Merge SWARM_AGENTS (stable order) with server-returned health for render.
  const agentRows = useMemo(() => {
    const byName = new Map<string, SwarmHealthAgent>();
    for (const a of health?.agents ?? []) byName.set(a.name, a);
    return SWARM_AGENTS.map((spec) => {
      const h = byName.get(spec.name);
      return {
        spec,
        status: (h?.status ?? "offline") as SwarmHealthState,
        latencyMs: h?.latencyMs ?? null,
        lastChecked: h?.lastChecked ?? null,
      };
    });
  }, [health]);

  return (
    <div className="sticky top-0 z-40 bg-black/90 backdrop-blur-sm border-b border-dawg-500/20 px-4 py-3">
      <div className="max-w-screen-2xl mx-auto flex items-center gap-4 flex-wrap">
        {/* Left: 13 agent health pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-pixel glow-dawg-strong text-[18px] leading-none text-[#FFE066] uppercase tracking-[0.12em] mr-2">
            Swarm
          </span>
          {agentRows.map(({ spec, status, latencyMs, lastChecked }) => (
            <div
              key={spec.name}
              className="relative"
              onMouseEnter={() => setHovered(spec.name)}
              onMouseLeave={() => setHovered(null)}
            >
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border cursor-default transition-colors ${
                  spec.role === "adversarial"
                    ? "border-dawg-500/50 bg-dawg-500/[0.06]"
                    : "border-dawg-500/15 bg-black"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${DOT_CLASSES[status]}`} />
                <span className="font-pixel text-[14px] leading-none text-[#FFCC00]/90 uppercase tracking-wider">
                  {spec.name}
                </span>
              </div>
              {hovered === spec.name && (
                <div className="absolute top-full left-0 mt-1 z-50 w-52 bg-void-950 border border-void-800 rounded-lg shadow-xl p-2.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-void-200 font-semibold">{spec.label}</span>
                    <span className="text-[10px] text-void-500 uppercase">{spec.role}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${DOT_CLASSES[status]}`} />
                    <span className="text-void-400">{STATUS_LABEL[status]}</span>
                  </div>
                  {latencyMs != null && (
                    <div className="text-[10px] text-void-500 font-mono">
                      {latencyMs}ms
                    </div>
                  )}
                  {lastChecked && (
                    <div className="text-[10px] text-void-600 font-mono">
                      checked {relativeTime(lastChecked)}
                    </div>
                  )}
                  <a
                    href={spec.flyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-[10px] text-dawg-400 hover:underline font-mono truncate"
                  >
                    {spec.flyUrl.replace("https://", "")}
                  </a>
                </div>
              )}
            </div>
          ))}
          {loading && <span className="font-pixel text-[14px] text-void-500">PINGING…</span>}
          {health && (
            <span className="font-pixel glow-green text-[15px] leading-none text-[#39FF7A] ml-1">
              {health.summary.online}/{health.summary.total} ONLINE
            </span>
          )}
        </div>

        {/* Right: 24h metric chips + Live Contracts menu.
            These numbers are PLATFORM-WIDE (all users, last 24h), NOT personal
            activity. A fresh wallet will see non-zero values here even with
            zero personal hunts — the NETWORK label makes that explicit. */}
        <div className="flex items-center gap-2 ml-auto">
          <span
            className="font-pixel text-[12px] leading-none uppercase tracking-[0.14em] text-[#FFCC00]/50 pr-1 border-r border-dawg-500/20 mr-1"
            title="Platform-wide activity across all users in the last 24 hours"
          >
            Network · 24h
          </span>
          <MetricChip
            label="24h cycles"
            value={metrics ? metrics.last24h.cycles.toString() : "—"}
            accent="dawg"
          />
          <MetricChip
            label="TEE attestations"
            value={metrics ? metrics.last24h.teeAttestations.toString() : "—"}
            accent="gold"
          />
          <MetricChip
            label="x402 hires"
            value={metrics ? metrics.last24h.hires.toString() : "—"}
            accent="teal"
          />
          <MetricChip
            label="USD paid"
            value={
              metrics
                ? `$${metrics.last24h.paymentsUsd.toFixed(3)}`
                : "—"
            }
            accent="emerald"
          />
          <LiveContractsMenu />
        </div>
      </div>
    </div>
  );
}

/**
 * One-click verification menu. Shows the 4 live smart contracts / chain-level
 * assets backing AlphaDawg with direct explorer links. This is the canonical
 * "everything is real and verifiable" surface for judges — no searching, no
 * copy-paste, just click and inspect on chain.
 */
function LiveContractsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const chainAccent: Record<(typeof LIVE_CONTRACTS)[number]["chain"], string> = {
    "0G Chain": "text-gold-400",
    Hedera: "text-teal-300",
    Arc: "text-dawg-300",
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border bg-black hover:bg-dawg-500/[0.06] transition-colors font-pixel text-[14px] leading-none uppercase tracking-wider ${
          open
            ? "text-[#FFE066] border-dawg-500/50 glow-dawg"
            : "text-[#FFCC00]/70 border-dawg-500/25"
        }`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
        Contracts
        <span className={`text-[10px] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-[340px] bg-void-950 border border-void-800 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-void-800 bg-void-900/60">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-void-300">
                Live on-chain assets
              </span>
            </div>
            <p className="text-[10px] text-void-600 mt-0.5">
              Every click opens the canonical block explorer
            </p>
          </div>
          <ul className="divide-y divide-void-800/60">
            {LIVE_CONTRACTS.map((contract) => (
              <li key={contract.label}>
                <a
                  href={contract.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-3 py-2.5 hover:bg-void-900 transition-colors group"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-void-200 group-hover:text-void-100">
                      {contract.label}
                    </span>
                    <span className={`text-[9px] font-mono uppercase tracking-wider ${chainAccent[contract.chain]}`}>
                      {contract.chain}
                    </span>
                  </div>
                  <p className="text-[10px] text-void-500 mt-0.5 leading-snug">
                    {contract.description}
                  </p>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="text-[9px] font-mono text-void-600 truncate">
                      {contract.identifier}
                    </span>
                    <span className="text-[9px] text-dawg-400 group-hover:text-dawg-300">
                      verify ↗
                    </span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MetricChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "dawg" | "gold" | "teal" | "emerald";
}) {
  const accentClasses: Record<typeof accent, string> = {
    dawg:    "text-[#FFE066] glow-dawg-strong",
    gold:    "text-[#FFCC00] glow-dawg",
    teal:    "text-[#5EEAD4] glow-teal",
    emerald: "text-[#39FF7A] glow-green",
  };
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-black border border-dawg-500/25">
      <span className="font-pixel text-[13px] leading-none uppercase tracking-wider text-[#FFCC00]/60">
        {label}
      </span>
      <span className={`font-pixel text-[18px] leading-none tabular-nums ${accentClasses[accent]}`}>
        {value}
      </span>
    </div>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}
