"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentActionRecord, Cycle } from "@/lib/types";
import { NAME_MAP } from "@/lib/cycle-mapper";
import {
  getOrderedPipelineActions,
  formatPipelineTime,
  NODE_META,
  pipelineNodeLabel,
} from "@/components/hunt/pipeline-shared";

/** Align action log `agentName` (slug or display) with `cycle.specialists[].name`. */
function canonicalSpecialistSlug(name: string): string {
  const slug = Object.entries(NAME_MAP).find(([, display]) => display === name)?.[0];
  if (slug) return slug;
  if (name in NAME_MAP) return name;
  return name.toLowerCase().replace(/\s+/g, "-");
}

function findCycleSpecialist(cycle: Cycle, agentName: string | null | undefined) {
  if (!agentName) return undefined;
  const target = canonicalSpecialistSlug(agentName);
  return cycle.specialists.find((s) => canonicalSpecialistSlug(s.name) === target);
}

/** Prefer HCS snapshot text; else one line from audit payload / specialist fields. */
function specialistNarrativeBody(
  spec: Cycle["specialists"][0] | undefined,
  payload: unknown,
): string | null {
  const primary = (spec?.analysis || spec?.reasoning || "").trim();
  if (primary) return primary;
  const p = payload as { signal?: string; confidence?: number } | null | undefined;
  const sig = (typeof p?.signal === "string" ? p.signal : undefined) ?? spec?.signal;
  const conf = p?.confidence ?? spec?.confidence;
  if (typeof sig === "string" && sig.trim()) {
    return conf != null ? `${sig.trim()} · ${conf}% confidence` : sig.trim();
  }
  return null;
}

const STORAGE_PREFIX = "alphadawg.huntNarrative.done.";

const PAUSE_AFTER_SPECIALIST_MS = 650;
const PAUSE_AFTER_DEBATE_REC_MS = 780;
const VERDICT_HOLD_MS = 2000;
const VERDICT_FINISH_MS = 1000;

/** Whitespace-preserving tokens so words are never split mid-token; pauses after . ! ? */
function tokenizeStream(text: string): string[] {
  if (!text) return [];
  return text.split(/(\s+)/).filter((t) => t.length > 0);
}

function delayForToken(token: string): number {
  const base = 52;
  const nonSpace = token.replace(/\s/g, "");
  const lenBonus = Math.min(nonSpace.length * 1.1, 40);
  const trimmed = token.trim();
  const endsSentence = trimmed.length > 0 && /[.!?](?:['")\]]?)$/.test(trimmed);
  const sentencePause = endsSentence ? 450 : 0;
  return base + lenBonus + sentencePause;
}

function useTokenStream(
  fullText: string,
  active: boolean,
  onDone: () => void,
): { text: string; done: boolean } {
  const tokens = useMemo(() => tokenizeStream(fullText), [fullText]);
  const [idx, setIdx] = useState(0);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    doneRef.current = false;
    setIdx(0);
  }, [fullText, active]);

  useEffect(() => {
    if (!active) return;
    if (tokens.length === 0) {
      if (!fullText) {
        if (!doneRef.current) {
          doneRef.current = true;
          onDoneRef.current();
        }
      }
      return;
    }
    if (idx >= tokens.length) {
      if (!doneRef.current) {
        doneRef.current = true;
        onDoneRef.current();
      }
      return;
    }
    const token = tokens[idx];
    const delay = delayForToken(token);
    const id = window.setTimeout(() => {
      setIdx((n) => n + 1);
    }, delay);
    return () => clearTimeout(id);
  }, [active, fullText, tokens, idx]);

  const text = tokens.length === 0 ? "" : tokens.slice(0, idx).join("");
  const done = tokens.length === 0 ? !fullText : idx >= tokens.length;
  return { text, done };
}

type DebateRole = "alpha" | "risk" | "executor";

type Phase =
  | {
      kind: "specialist";
      key: string;
      emoji: string;
      name: string;
      hiredBy: string;
      body: string;
      tail: string;
    }
  | {
      kind: "debate";
      key: string;
      role: DebateRole;
      emoji: string;
      label: string;
      roundLabel: string;
      body: string;
      rec: string;
      recClass: string;
      time: string;
    }
  | {
      kind: "infra";
      key: string;
      label: string;
      accent: string;
      body: string;
      time: string;
    }
  | { kind: "verdict"; key: string };

function countPriorSameType(
  ordered: AgentActionRecord[],
  index: number,
  actionType: string,
): number {
  let n = 0;
  for (let i = 0; i < index; i++) {
    if (ordered[i].actionType === actionType) n += 1;
  }
  return n;
}

function extractDebateFromPayload(
  payload: unknown,
  fallback: { argument: string; recommendation: string },
): { argument: string; recommendation: string } {
  const p = payload as Record<string, unknown> | null;
  if (!p || typeof p !== "object") {
    return {
      argument: (fallback.argument || "—").trim(),
      recommendation: (fallback.recommendation || "—").trim(),
    };
  }
  const arg =
    (typeof p.argument === "string" && p.argument) ||
    (typeof p.reasoning === "string" && p.reasoning) ||
    (typeof p.thesis === "string" && p.thesis) ||
    (typeof p.challenge === "string" && p.challenge) ||
    (typeof p.objection === "string" && p.objection) ||
    fallback.argument;
  let rec = fallback.recommendation;
  if (typeof p.recommendation === "string" && p.recommendation) rec = p.recommendation;
  else if (typeof p.action === "string" && p.action) {
    const pct =
      typeof p.pct === "number"
        ? p.pct
        : typeof p.max_pct === "number"
          ? p.max_pct
          : "";
    rec = pct !== "" && pct !== undefined ? `${p.action} ${pct}%` : p.action;
  }
  return { argument: String(arg).trim() || "—", recommendation: String(rec).trim() || "—" };
}

function infraBody(a: AgentActionRecord): string {
  const p = (a.payload ?? null) as Record<string, unknown> | null;
  switch (a.actionType) {
    case "STORAGE_UPLOADED": {
      const h = typeof p?.storageHash === "string" ? p.storageHash : "";
      return h
        ? `0G Storage sealed · ${h.slice(0, 12)}…${h.slice(-6)}`
        : "0G Storage sealed · swarm memory persisted";
    }
    case "HCS_LOGGED": {
      const seq = typeof p?.seqNum === "number" ? p.seqNum : null;
      return seq != null ? `Hedera HCS audit logged · sequence #${seq}` : "Hedera HCS audit logged";
    }
    case "INFT_UPDATED": {
      const tid = typeof p?.inftTokenId === "number" ? p.inftTokenId : null;
      return tid != null ? `iNFT on 0G Chain updated · token #${tid}` : "iNFT metadata updated on 0G Chain";
    }
    case "SWAP_EXECUTED":
      return a.agentName
        ? `Arc swap settled · ${a.agentName}`
        : "Arc swap executed — allocation on-chain";
    case "SWAP_FAILED":
      return "Swap step failed — see hunt logs for details";
    default:
      return a.actionType;
  }
}

function debateMeta(role: DebateRole, cycle: Cycle) {
  const m = {
    alpha: {
      emoji: "🟢",
      label: "Alpha",
      recClass: "text-green-400",
      data: cycle.adversarial.alpha,
    },
    risk: {
      emoji: "🔴",
      label: "Risk",
      recClass: "text-blood-300",
      data: cycle.adversarial.risk,
    },
    executor: {
      emoji: "🟡",
      label: "Executor",
      recClass: "text-gold-400",
      data: cycle.adversarial.executor,
    },
  };
  return m[role];
}

function buildPhasesFromTimeline(cycle: Cycle, actions: AgentActionRecord[]): Phase[] {
  const ordered = getOrderedPipelineActions(actions);
  const out: Phase[] = [];
  ordered.forEach((a, index) => {
    const time = formatPipelineTime(a.createdAt);
    switch (a.actionType) {
      case "SPECIALIST_HIRED": {
        const rawName = a.agentName ?? "Specialist";
        const spec = findCycleSpecialist(cycle, rawName);
        const body = specialistNarrativeBody(spec, a.payload);
        if (!body) return;
        const displayName = spec?.name ?? rawName;
        const hiredBy =
          (a.payload as { hiredBy?: string } | null)?.hiredBy ?? spec?.hiredBy ?? "main-agent";
        const sig = spec
          ? [spec.signal ?? "?", spec.confidence != null ? `${spec.confidence}%` : ""].filter(Boolean).join(" ")
          : "—";
        out.push({
          kind: "specialist",
          key: `sp-${a.id}-${index}`,
          emoji: spec?.emoji || "◆",
          name: displayName,
          hiredBy,
          body,
          tail: `Signal · ${sig} · ${time}`,
        });
        break;
      }
      case "DEBATE_ALPHA":
      case "DEBATE_RISK":
      case "DEBATE_EXECUTOR": {
        const role: DebateRole =
          a.actionType === "DEBATE_ALPHA" ? "alpha" : a.actionType === "DEBATE_RISK" ? "risk" : "executor";
        const meta = debateMeta(role, cycle);
        const round = countPriorSameType(ordered, index, a.actionType) + 1;
        const roundLabel = round > 1 ? ` · round ${round}` : "";
        const { argument, recommendation } = extractDebateFromPayload(a.payload, {
          argument: meta.data.argument,
          recommendation: meta.data.recommendation,
        });
        out.push({
          kind: "debate",
          key: `debate-${a.id}-${index}`,
          role,
          emoji: meta.emoji,
          label: meta.label,
          roundLabel,
          body: argument,
          rec: recommendation,
          recClass: meta.recClass,
          time,
        });
        break;
      }
      case "STORAGE_UPLOADED":
      case "HCS_LOGGED":
      case "INFT_UPDATED":
      case "SWAP_EXECUTED":
      case "SWAP_FAILED":
        out.push({
          kind: "infra",
          key: `infra-${a.id}-${index}`,
          label: pipelineNodeLabel(a),
          accent: NODE_META[a.actionType]?.accent ?? "border-void-700 bg-void-900/40 text-void-300",
          body: infraBody(a),
          time,
        });
        break;
      default:
        break;
    }
  });
  out.push({ kind: "verdict", key: "verdict" });
  return out;
}

function buildPhasesFallback(cycle: Cycle): Phase[] {
  const out: Phase[] = [];
  cycle.specialists.forEach((s, i) => {
    const body = specialistNarrativeBody(s, null);
    if (!body) return;
    const sig = [s.signal ?? "?", s.confidence != null ? `${s.confidence}%` : ""].filter(Boolean).join(" ");
    out.push({
      kind: "specialist",
      key: `sp-${i}-${s.name}`,
      emoji: s.emoji || "◆",
      name: s.name,
      hiredBy: s.hiredBy ?? "main-agent",
      body,
      tail: `Signal · ${sig}`,
    });
  });
  const debate: Array<{
    role: DebateRole;
    emoji: string;
    label: string;
    data: Cycle["adversarial"]["alpha"];
    recClass: string;
  }> = [
    { role: "alpha", emoji: "🟢", label: "Alpha", data: cycle.adversarial.alpha, recClass: "text-green-400" },
    { role: "risk", emoji: "🔴", label: "Risk", data: cycle.adversarial.risk, recClass: "text-blood-300" },
    { role: "executor", emoji: "🟡", label: "Executor", data: cycle.adversarial.executor, recClass: "text-gold-400" },
  ];
  for (const d of debate) {
    const body = (d.data.argument || "").trim() || "—";
    const rec = (d.data.recommendation || "").trim() || "—";
    out.push({
      kind: "debate",
      key: `debate-${d.role}`,
      role: d.role,
      emoji: d.emoji,
      label: d.label,
      roundLabel: "",
      body,
      rec,
      recClass: d.recClass,
      time: "",
    });
  }
  out.push({ kind: "verdict", key: "verdict" });
  return out;
}

export interface HuntNarrativeFlowProps {
  cycle: Cycle;
  actions: AgentActionRecord[];
  loadingActions: boolean;
  onComplete: () => void;
}

/**
 * Staged “live stream” aligned with the chronological action log when available;
 * otherwise falls back to specialists → adversarial → verdict.
 */
export function HuntNarrativeFlow({
  cycle,
  actions,
  loadingActions,
  onComplete,
}: HuntNarrativeFlowProps) {
  const phases = useMemo(() => {
    const fromLog = buildPhasesFromTimeline(cycle, actions);
    if (fromLog.length > 1) return fromLog;
    return buildPhasesFallback(cycle);
  }, [cycle, actions]);

  const [idx, setIdx] = useState(0);
  const [debateSub, setDebateSub] = useState<0 | 1>(0);
  const [verdictDone, setVerdictDone] = useState(false);

  useEffect(() => {
    setIdx(0);
    setDebateSub(0);
    setVerdictDone(false);
  }, [cycle.id, phases]);

  const phase = phases[idx];
  const streamActive = !(loadingActions && actions.length === 0);
  const storageKey = `${STORAGE_PREFIX}${cycle.id}`;

  const finish = useCallback(() => {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    onComplete();
  }, [onComplete, storageKey]);

  const skip = useCallback(() => {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    onComplete();
  }, [onComplete, storageKey]);

  const advance = useCallback(() => {
    setIdx((i) => i + 1);
    setDebateSub(0);
    setVerdictDone(false);
  }, []);

  const phaseKey = phase?.kind === "debate" ? `${phase.key}-${debateSub}` : phase?.key ?? "";

  const onArgDone = useCallback(() => {
    if (phase?.kind !== "debate") return;
    if (debateSub === 0) setDebateSub(1);
  }, [phase, debateSub]);

  const specialistBody = phase?.kind === "specialist" ? phase.body : "";
  const debateBody = phase?.kind === "debate" && debateSub === 0 ? phase.body : "";
  const debateRec = phase?.kind === "debate" && debateSub === 1 ? phase.rec : "";
  const infraBodyText = phase?.kind === "infra" ? phase.body : "";

  const twSpec = useTokenStream(specialistBody, phase?.kind === "specialist" && streamActive, () => {
    window.setTimeout(advance, PAUSE_AFTER_SPECIALIST_MS);
  });

  const twDebArg = useTokenStream(
    debateBody,
    phase?.kind === "debate" && debateSub === 0 && streamActive,
    onArgDone,
  );

  const twDebRec = useTokenStream(debateRec, phase?.kind === "debate" && debateSub === 1 && streamActive, () => {
    window.setTimeout(advance, PAUSE_AFTER_DEBATE_REC_MS);
  });

  const twInfra = useTokenStream(infraBodyText, phase?.kind === "infra" && streamActive, () => {
    window.setTimeout(advance, PAUSE_AFTER_SPECIALIST_MS);
  });

  useEffect(() => {
    if (!streamActive || phase?.kind !== "verdict") return;
    let t2: number | undefined;
    const t = window.setTimeout(() => {
      setVerdictDone(true);
      t2 = window.setTimeout(finish, VERDICT_FINISH_MS);
    }, VERDICT_HOLD_MS);
    return () => {
      clearTimeout(t);
      if (t2 !== undefined) clearTimeout(t2);
    };
  }, [phase, finish, streamActive]);

  if (loadingActions && actions.length === 0) {
    return (
      <div className="rounded-2xl border border-dawg-500/25 bg-void-950/80 overflow-hidden hunt-fade-in">
        <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 min-h-[220px]">
          <div className="w-10 h-10 border-[3px] border-dawg-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-base sm:text-lg text-void-300 text-center font-medium">
            Syncing hunt timeline…
          </p>
          <p className="text-sm text-void-500 text-center max-w-sm">
            Loading chronological pipeline so the replay matches your real agent log.
          </p>
        </div>
      </div>
    );
  }

  if (!phase || phases.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-dawg-500/25 bg-void-950/80 overflow-hidden hunt-fade-in">
      <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-void-800/80 bg-void-950/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs sm:text-sm font-bold uppercase tracking-[0.15em] text-dawg-400 shrink-0">
            Live stream
          </span>
          <span className="text-xs sm:text-sm text-void-500 font-mono truncate">
            #{cycle.id} · {Math.min(idx + 1, phases.length)}/{phases.length}
          </span>
        </div>
        <button
          type="button"
          onClick={skip}
          className="text-xs sm:text-sm font-mono uppercase tracking-wider text-void-500 hover:text-dawg-300 px-3 py-1.5 rounded-lg border border-void-700/80 hover:border-dawg-500/40 transition-colors shrink-0"
        >
          Skip
        </button>
      </div>

      <div className="p-5 sm:p-6 space-y-4 min-h-[240px]">
        {phase.kind === "specialist" && (
          <div className="payment-enter space-y-3" key={phaseKey}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-2xl">{phase.emoji}</span>
              <span className="text-lg sm:text-xl font-semibold text-void-100">{phase.name}</span>
              <span className="text-xs sm:text-sm px-2 py-1 rounded-lg border border-teal-500/35 text-teal-300/95 font-mono uppercase">
                specialist
              </span>
              <span className="text-xs sm:text-sm px-2 py-1 rounded-lg border border-void-600/60 text-void-400 font-mono">
                hired by {phase.hiredBy}
              </span>
            </div>
            <p className="text-base sm:text-lg leading-relaxed text-void-200 whitespace-pre-wrap">
              {twSpec.text}
              {!twSpec.done && (
                <span className="inline-block w-0.5 h-5 ml-0.5 align-middle bg-dawg-500/90 animate-pulse" />
              )}
            </p>
            {twSpec.done && (
              <p className="text-sm font-mono text-void-500 border-t border-void-800/60 pt-3">{phase.tail}</p>
            )}
          </div>
        )}

        {phase.kind === "debate" && (
          <div className="payment-enter space-y-3" key={phaseKey}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-2xl">{phase.emoji}</span>
              <span className="text-lg sm:text-xl font-semibold text-void-100">
                {phase.label}
                {phase.roundLabel && (
                  <span className="text-void-500 font-normal text-base">{phase.roundLabel}</span>
                )}
              </span>
              <span className="text-xs sm:text-sm px-2 py-1 rounded-lg border border-dawg-500/30 text-dawg-300/95 font-mono uppercase">
                {phase.role}
              </span>
              {phase.time && (
                <span className="text-sm font-mono text-void-500 ml-auto">{phase.time}</span>
              )}
            </div>
            {debateSub === 0 && (
              <p className="text-base sm:text-lg leading-relaxed text-void-200 whitespace-pre-wrap">
                {twDebArg.text}
                {!twDebArg.done && (
                  <span className="inline-block w-0.5 h-5 ml-0.5 align-middle bg-dawg-500/90 animate-pulse" />
                )}
              </p>
            )}
            {debateSub === 1 && (
              <p className={`text-base sm:text-lg font-semibold leading-relaxed ${phase.recClass}`}>
                {twDebRec.text}
                {!twDebRec.done && (
                  <span className="inline-block w-0.5 h-5 ml-0.5 align-middle bg-dawg-500/90 animate-pulse" />
                )}
              </p>
            )}
          </div>
        )}

        {phase.kind === "infra" && (
          <div className="payment-enter space-y-3" key={phase.key}>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`text-sm font-bold font-mono uppercase px-3 py-1.5 rounded-xl border ${phase.accent}`}
              >
                {phase.label}
              </span>
              <span className="text-sm font-mono text-void-500">{phase.time}</span>
            </div>
            <p className="text-base sm:text-lg leading-relaxed text-void-200 whitespace-pre-wrap">
              {twInfra.text}
              {!twInfra.done && (
                <span className="inline-block w-0.5 h-5 ml-0.5 align-middle bg-dawg-500/90 animate-pulse" />
              )}
            </p>
          </div>
        )}

        {phase.kind === "verdict" && (
          <div
            className={`flex flex-col items-center justify-center py-12 px-4 rounded-2xl border transition-all duration-700 ${
              verdictDone ? "border-gold-400/50 bg-gold-500/10 scale-[1.01]" : "border-void-700 bg-void-900/40"
            }`}
          >
            <div className="text-xs sm:text-sm font-bold uppercase tracking-[0.25em] text-gold-400/90 mb-3">
              Mediator
            </div>
            <p className="text-xl sm:text-2xl font-pixel text-void-100 uppercase tracking-wider text-center">
              Decision synthesized
            </p>
            <p className="text-sm sm:text-base text-void-500 mt-3 text-center max-w-md leading-relaxed">
              Adversarial debate closed — revealing trade line below
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function huntNarrativeAlreadySeen(cycleId: number): boolean {
  try {
    return window.localStorage.getItem(`${STORAGE_PREFIX}${cycleId}`) === "1";
  } catch {
    return false;
  }
}

export function clearHuntNarrativeFlag(cycleId: number): void {
  try {
    window.localStorage.removeItem(`${STORAGE_PREFIX}${cycleId}`);
  } catch {
    /* ignore */
  }
}
