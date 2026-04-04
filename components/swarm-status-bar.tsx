"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SWARM_AGENTS } from "@/lib/swarm-endpoints";
import type {
  SwarmHealthResponse,
  SwarmHealthAgent,
  SwarmHealthState,
  SwarmMetricsResponse,
} from "@/lib/types";

const POLL_MS = 15_000;

// Maps the 4 SwarmHealthState values to Tailwind color classes for the dot.
const DOT_CLASSES: Record<SwarmHealthState, string> = {
  online: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]",
  waking: "bg-gold-400 shadow-[0_0_8px_rgba(251,191,36,0.6)] animate-pulse",
  offline: "bg-blood-500",
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
    <div className="bg-void-900/80 backdrop-blur-sm border-b border-void-800 px-4 py-2.5 text-xs">
      <div className="max-w-screen-2xl mx-auto flex items-center gap-4 flex-wrap">
        {/* Left: 13 agent health pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-void-500 mr-1">
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
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md border cursor-default ${
                  spec.role === "adversarial"
                    ? "border-dawg-500/30 bg-dawg-500/5"
                    : "border-void-800 bg-void-950/50"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${DOT_CLASSES[status]}`} />
                <span className="font-mono text-[10px] text-void-300">{spec.name}</span>
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
          {loading && <span className="text-void-600">pinging…</span>}
          {health && (
            <span className="text-[10px] text-void-500 font-mono ml-1">
              {health.summary.online}/{health.summary.total} online
            </span>
          )}
        </div>

        {/* Right: 24h metric chips */}
        <div className="flex items-center gap-2 ml-auto">
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
        </div>
      </div>
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
    dawg: "text-dawg-300",
    gold: "text-gold-400",
    teal: "text-teal-300",
    emerald: "text-emerald-300",
  };
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-void-950/60 border border-void-800">
      <span className="text-[9px] uppercase tracking-wider text-void-500">{label}</span>
      <span className={`font-mono font-bold text-xs ${accentClasses[accent]}`}>{value}</span>
    </div>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}
