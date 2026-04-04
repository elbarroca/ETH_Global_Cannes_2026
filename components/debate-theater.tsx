"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DebateTranscriptResponse, DebateTurn } from "@/lib/types";
import { agentEmoji, agentLabel, getSwarmAgent } from "@/lib/swarm-endpoints";

const POLL_ACTIVE_MS = 2_000;

interface DebateTheaterProps {
  /** UUID from the cycles table (not the display cycleNumber). */
  cycleUuid: string;
  /** Ownership check — the debate endpoint requires userId. */
  userId: string;
  /** Set true while a cycle is running so the component polls every 2s. */
  isActive?: boolean;
  /** Display-only cycle number shown in header. */
  cycleNumber?: number;
}

// Swim-lane metadata. Phase → lane config.
const LANES: Array<{
  key: DebateTurn["phase"];
  title: string;
  subtitle: string;
  accent: string;
  ring: string;
}> = [
  {
    key: "intelligence",
    title: "Intelligence",
    subtitle: "Specialists gathering real-time signals",
    accent: "text-teal-300",
    ring: "border-teal-500/30",
  },
  {
    key: "opening",
    title: "Opening Arguments",
    subtitle: "Alpha & Risk debate the thesis",
    accent: "text-dawg-300",
    ring: "border-dawg-500/30",
  },
  {
    key: "decision",
    title: "Decision",
    subtitle: "Executor delivers the final verdict",
    accent: "text-gold-400",
    ring: "border-gold-400/30",
  },
];

/**
 * Renders a cycle as a live, turn-by-turn debate timeline across 3 swim lanes:
 *
 *   Intelligence  → every specialist that was hired for this cycle (usually 5)
 *   Opening       → alpha + risk arguments (plus any rebuttals)
 *   Decision      → executor's final ruling
 *
 * Data source is /api/cycle/debate/[cycleId]?userId=X — the endpoint takes
 * the cycles.id (UUID), NOT the human-readable cycle number. If isActive is
 * true (an in-flight cycle), we poll every 2 seconds and new turns fade in
 * via the existing .payment-enter animation.
 */
export function DebateTheater({
  cycleUuid,
  userId,
  isActive = false,
  cycleNumber,
}: DebateTheaterProps) {
  const [turns, setTurns] = useState<DebateTurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTurns = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/cycle/debate/${cycleUuid}?userId=${encodeURIComponent(userId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        setError(`${res.status}`);
        return;
      }
      const data = (await res.json()) as DebateTranscriptResponse;
      setTurns(data.transcripts ?? []);
      setError(null);
    } catch (err) {
      setError(String((err as Error).message ?? err));
    } finally {
      setLoading(false);
    }
  }, [cycleUuid, userId]);

  useEffect(() => {
    if (!cycleUuid || !userId) return;
    void fetchTurns();
    if (!isActive) return;
    const id = setInterval(fetchTurns, POLL_ACTIVE_MS);
    return () => clearInterval(id);
  }, [fetchTurns, cycleUuid, userId, isActive]);

  // Group turns by phase for the lane renderer.
  const byPhase = useMemo(() => {
    const m = new Map<string, DebateTurn[]>();
    for (const t of turns) {
      const list = m.get(t.phase) ?? [];
      list.push(t);
      m.set(t.phase, list);
    }
    // Within each lane keep chronological order (ascending turn number).
    for (const list of m.values()) list.sort((a, b) => a.turnNumber - b.turnNumber);
    return m;
  }, [turns]);

  const allTee = turns.length > 0 && turns.every((t) => t.teeVerified);
  const totalDuration = turns.reduce((sum, t) => sum + (t.durationMs ?? 0), 0);

  return (
    <div className="bg-void-900 border border-void-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-void-800">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-void-400">
            Debate Theater
          </span>
          {cycleNumber != null && (
            <span className="text-void-600 font-mono text-xs">Hunt #{cycleNumber}</span>
          )}
          <span className="text-void-700">·</span>
          <span className="font-mono text-[10px] text-void-600">{turns.length} turns</span>
          {totalDuration > 0 && (
            <>
              <span className="text-void-700">·</span>
              <span className="font-mono text-[10px] text-void-600">
                {(totalDuration / 1000).toFixed(1)}s
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono bg-dawg-500/15 text-dawg-300 border border-dawg-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-dawg-400 animate-pulse" />
              live
            </span>
          )}
          {allTee && !isActive && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono bg-gold-400/10 text-gold-400 border border-gold-400/20">
              <span className="w-1.5 h-1.5 rounded-full bg-gold-400" />
              TEE sealed
            </span>
          )}
        </div>
      </div>

      {/* Lanes */}
      <div className="p-5 space-y-5">
        {loading && turns.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-dawg-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="text-xs text-blood-400 font-mono">
            Failed to load debate transcripts ({error})
          </div>
        )}
        {!loading && turns.length === 0 && !error && (
          <div className="text-center py-6 space-y-1">
            <p className="text-sm text-void-500">No debate transcripts yet</p>
            <p className="text-[10px] text-void-600">Turns appear here as the swarm runs</p>
          </div>
        )}
        {turns.length > 0 &&
          LANES.map((lane) => {
            const laneTurns = byPhase.get(lane.key) ?? [];
            if (laneTurns.length === 0) return null;
            return <Lane key={lane.key} lane={lane} turns={laneTurns} />;
          })}
      </div>
    </div>
  );
}

function Lane({
  lane,
  turns,
}: {
  lane: (typeof LANES)[number];
  turns: DebateTurn[];
}) {
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-2.5">
        <h3 className={`text-[10px] font-bold uppercase tracking-[0.15em] ${lane.accent}`}>
          {lane.title}
        </h3>
        <span className="text-[10px] text-void-600">{lane.subtitle}</span>
        <span className="ml-auto text-[10px] font-mono text-void-700">{turns.length}</span>
      </div>
      <div className={`border-l-2 ${lane.ring} pl-4 space-y-2.5`}>
        {turns.map((turn) => (
          <TurnBubble key={turn.id} turn={turn} />
        ))}
      </div>
    </div>
  );
}

function TurnBubble({ turn }: { turn: DebateTurn }) {
  // Detect intelligence-phase error stubs — per the SWARM-STATUS §4 flat-hierarchy
  // bug, 336 of 530 intelligence rows are HTTP_ERROR placeholders. We still render
  // them but muted, so judges can see exactly which specialists were unreachable.
  const isOffline =
    turn.phase === "intelligence" &&
    (turn.attestationHash === "http-failed" ||
      (turn.responseContent?.startsWith("[HTTP_ERROR]") ?? false));

  const agent = turn.toAgent ?? turn.fromAgent;
  const spec = getSwarmAgent(agent);
  const emoji = agentEmoji(agent);
  const label = agentLabel(agent);

  const body = turn.responseContent ?? turn.messageContent ?? "";
  // Intelligence error rows have very long HTML stubs — take just the first line.
  const cleanBody = isOffline ? body.split("\n")[0]?.slice(0, 160) ?? "" : body;

  const durationSec =
    turn.durationMs != null && turn.durationMs > 0
      ? `${(turn.durationMs / 1000).toFixed(1)}s`
      : null;

  return (
    <div
      className={`payment-enter bg-void-950/60 border rounded-xl p-3 space-y-2 ${
        isOffline
          ? "border-void-800 opacity-60"
          : spec?.role === "adversarial"
            ? "border-dawg-500/20"
            : "border-void-800"
      }`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm">{emoji}</span>
        <span
          className={`text-xs font-semibold ${
            isOffline ? "text-void-500" : "text-void-200"
          }`}
        >
          {label}
        </span>
        <span className="text-[10px] text-void-700 font-mono">turn {turn.turnNumber}</span>
        {isOffline && (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono bg-void-800/60 text-void-500 border border-void-700"
            title="Specialist unreachable — orchestrator is still calling legacy localhost URL (SWARM-STATUS §4)"
          >
            [offline]
          </span>
        )}
        {turn.teeVerified && !isOffline && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-gold-400/10 text-gold-400 border border-gold-400/20">
            TEE ✓
          </span>
        )}
        {durationSec && (
          <span className="text-[9px] font-mono text-void-600">{durationSec}</span>
        )}
        {turn.attestationHash && !isOffline && (
          <span
            className="ml-auto text-[9px] font-mono text-void-600 truncate max-w-[180px]"
            title={turn.attestationHash}
          >
            {turn.attestationHash.slice(0, 20)}…
          </span>
        )}
      </div>
      {cleanBody && (
        <p
          className={`text-xs leading-relaxed ${
            isOffline ? "text-void-600 font-mono" : "text-void-300"
          }`}
        >
          {isOffline ? cleanBody : truncate(cleanBody, 600)}
        </p>
      )}
    </div>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max).trim()}…`;
}
