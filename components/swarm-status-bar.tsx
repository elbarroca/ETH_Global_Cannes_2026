"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SWARM_AGENTS } from "@/lib/swarm-endpoints";
import { LIVE_CONTRACTS } from "@/lib/links";
import type {
  SwarmHealthAgent,
  SwarmHealthResponse,
  SwarmHealthState,
  SwarmMetricsResponse,
} from "@/lib/types";

const POLL_MS = 15_000;

const DOT_CLASSES: Record<SwarmHealthState, string> = {
  online: "bg-emerald-400",
  waking: "bg-gold-400",
  offline: "bg-blood-500",
  timeout: "bg-blood-600",
};

const STATUS_LABEL: Record<SwarmHealthState, string> = {
  online: "Online response",
  waking: "Waking",
  offline: "Offline response",
  timeout: "Timed out",
};

/** Lower-priority platform telemetry. Health responses do not grant product authority. */
export function SwarmStatusBar() {
  const [health, setHealth] = useState<SwarmHealthResponse | null>(null);
  const [metrics, setMetrics] = useState<SwarmMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const fetchAll = useCallback(async (): Promise<void> => {
    try {
      const [healthResponse, metricsResponse] = await Promise.all([
        fetch("/api/swarm/health", { cache: "no-store" }),
        fetch("/api/swarm/metrics", { cache: "no-store" }),
      ]);
      if (!healthResponse.ok || !metricsResponse.ok) {
        setUnavailable(true);
        return;
      }
      setHealth(await healthResponse.json() as SwarmHealthResponse);
      setMetrics(await metricsResponse.json() as SwarmMetricsResponse);
      setUnavailable(false);
    } catch {
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
    const id = window.setInterval(fetchAll, POLL_MS);
    return () => window.clearInterval(id);
  }, [fetchAll]);

  const agentRows = useMemo(() => {
    const byName = new Map<string, SwarmHealthAgent>();
    for (const agent of health?.agents ?? []) byName.set(agent.name, agent);
    return SWARM_AGENTS.map((spec) => {
      const observed = byName.get(spec.name);
      return {
        spec,
        status: observed?.status ?? null,
        latencyMs: observed?.latencyMs ?? null,
        lastChecked: observed?.lastChecked ?? null,
      };
    });
  }, [health]);

  return (
    <section className="rounded-2xl border border-void-800 bg-void-950/45" aria-labelledby="network-telemetry-title">
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="network-telemetry-title" className="text-sm font-semibold text-void-200">Network telemetry</h2>
          <p className="mt-1 text-xs text-void-500">Platform-wide observations only. They are not personal job evidence or deployment authority.</p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
          <TelemetryValue label="Responding" value={health ? `${health.summary.online}/${health.summary.total}` : "—"} />
          <TelemetryValue label="Freshness" value="Unavailable" />
          <TelemetryValue label="Release SHA" value="Unavailable" />
        </div>
      </div>

      <div className="border-t border-void-800 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-void-400">
          <span className="font-semibold text-void-500">Network · 24h</span>
          <span>Cycles <strong className="font-mono text-void-200">{metrics ? metrics.last24h.cycles : "—"}</strong></span>
          <span>TEE attestations <strong className="font-mono text-void-200">{metrics ? metrics.last24h.teeAttestations : "—"}</strong></span>
          <span>x402 hires <strong className="font-mono text-void-200">{metrics ? metrics.last24h.hires : "—"}</strong></span>
          <span>USD paid <strong className="font-mono text-void-200">{metrics ? `$${metrics.last24h.paymentsUsd.toFixed(3)}` : "—"}</strong></span>
          {loading && <span role="status">Loading telemetry…</span>}
          {unavailable && <span className="text-blood-300">Latest telemetry request unavailable.</span>}
        </div>
      </div>

      <div className="grid gap-2 border-t border-void-800 px-4 py-3 sm:grid-cols-2">
        <details className="group rounded-xl border border-void-800 bg-black/30">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-xs font-semibold text-void-300 marker:content-none">
            Agent response details
            <span aria-hidden="true" className="text-gold-400 transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <ul className="grid gap-1 border-t border-void-800 p-2 sm:grid-cols-2">
            {agentRows.map(({ spec, status, latencyMs, lastChecked }) => (
              <li key={spec.name} className="min-w-0 rounded-lg px-2 py-2 text-xs text-void-400">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${status ? DOT_CLASSES[status] : "bg-void-600"}`} aria-hidden="true" />
                  <span className="truncate font-semibold text-void-200">{spec.label}</span>
                </div>
                <p className="mt-1 pl-4 text-[10px] text-void-600">
                  {status ? STATUS_LABEL[status] : "Status unavailable"}{latencyMs !== null ? ` · ${latencyMs}ms` : ""}{lastChecked ? ` · checked ${relativeTime(lastChecked)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </details>
        <ContractsDisclosure />
      </div>
    </section>
  );
}

function ContractsDisclosure() {
  return (
    <details className="group rounded-xl border border-void-800 bg-black/30">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-xs font-semibold text-void-300 marker:content-none">
        Configured explorer assets
        <span aria-hidden="true" className="text-gold-400 transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <ul className="space-y-1 border-t border-void-800 p-2">
        {LIVE_CONTRACTS.map((contract) => (
          <li key={contract.label}>
            <a href={contract.href} target="_blank" rel="noopener noreferrer" className="block rounded-lg px-2 py-2 hover:bg-void-900">
              <span className="flex items-center justify-between gap-3 text-xs text-void-200">
                <span>{contract.label}</span><span className="text-[10px] text-void-500">{contract.chain} ↗</span>
              </span>
              <span className="mt-1 block truncate font-mono text-[10px] text-void-600">{contract.identifier}</span>
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

function TelemetryValue({ label, value }: { label: string; value: string }) {
  return <span><span className="text-void-600">{label}</span> <strong className="font-mono font-medium text-void-300">{value}</strong></span>;
}

function relativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}
