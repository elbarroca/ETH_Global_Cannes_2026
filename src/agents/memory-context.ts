// RAG context formatter — turns prior RichCycleRecord blobs loaded from 0G
// Storage (via loadRecentCycles in src/og/storage.ts) into compact prompt
// blocks that get injected into specialist + debate prompts at cycle start.
//
// Budget is tight: 7B models lose coherence past ~200 tokens of extra context
// (see .claude/rules/openclaw.md). Each cycle summary is hard-capped at ~60
// tokens, reasoning strings are truncated at 120 chars, and we never format
// more than 3 cycles regardless of input length.
//
// Both functions return "" on empty input so callers can append unconditionally
// via `${priorContext}` without guarding on length.

import type { RichCycleRecord } from "../types/index";

const MAX_CYCLES = 3;
const MAX_REASON_CHARS = 120;

function truncate(raw: string | undefined, max: number = MAX_REASON_CHARS): string {
  if (!raw) return "";
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max - 1) + "…";
}

function daysAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "?";
  const deltaMs = Date.now() - then;
  const hours = Math.floor(deltaMs / (60 * 60 * 1000));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function cycleOutcomeHint(cycle: RichCycleRecord): string {
  // We don't track per-cycle P&L directly — the NAV field is point-in-time at
  // cycle end, and realized P&L lives on the user record. Surface the action
  // + NAV snapshot so the model can at least reason about trajectory if
  // multiple cycles are shown in order.
  const action = cycle.decision?.action ?? "HOLD";
  const asset = cycle.decision?.asset ?? "?";
  const pct = cycle.decision?.pct ?? 0;
  const navStr = typeof cycle.nav === "number" ? `NAV $${cycle.nav.toFixed(2)}` : "NAV n/a";
  if (action === "HOLD") return `HOLD → ${navStr}`;
  return `${action} ${pct}% ${asset} → ${navStr}`;
}

/**
 * Format a "PRIOR CYCLES" block for debate-agent prompts (Alpha / Risk /
 * Executor). Surfaces each prior cycle's final decision, Alpha's thesis,
 * Risk's objection, and the outcome NAV. Returns "" when cycles is empty.
 *
 * Appended AFTER the existing specialist signals block and BEFORE the
 * OUTPUT FORMAT instruction so the model treats it as additional context,
 * not as part of the response schema.
 */
export function formatPriorCyclesForPrompt(cycles: RichCycleRecord[]): string {
  if (!cycles || cycles.length === 0) return "";

  const selected = cycles.slice(0, MAX_CYCLES);
  const lines: string[] = ["PRIOR CYCLES (your own history — learn from it):"];

  selected.forEach((cycle, idx) => {
    const header = `${idx + 1}. Cycle #${cycle.cycleId} · ${daysAgo(cycle.timestamp)} · ${cycleOutcomeHint(cycle)}`;
    lines.push(header);

    const alphaR = truncate(cycle.debate?.alpha?.reasoning);
    if (alphaR) lines.push(`   Alpha thesis: ${alphaR}`);

    const riskR = truncate(cycle.debate?.risk?.objection ?? cycle.debate?.risk?.reasoning);
    if (riskR) lines.push(`   Risk flag: ${riskR}`);

    const execR = truncate(cycle.debate?.executor?.reasoning);
    if (execR) lines.push(`   Executor: ${execR}`);
  });

  lines.push("(Use this to stay consistent with past reasoning, avoid repeating mistakes, and build on winning theses. Do not simply copy prior decisions — evaluate fresh signals.)");
  return lines.join("\n");
}

/**
 * Format a specialist-scoped "YOUR LAST CALLS" scorecard. Surfaces a given
 * specialist's own prior picks across the recent cycle window so the 7B
 * model can reference its own history. Returns "" when the specialist has
 * no prior appearances.
 *
 * Intended for the specialist `task` string so it flows through the x402
 * hire body into the specialist server prompt builder.
 */
export function formatPriorPicksForSpecialist(
  cycles: RichCycleRecord[],
  specialistName: string,
): string {
  if (!cycles || cycles.length === 0) return "";

  const lines: string[] = [];
  for (const cycle of cycles.slice(0, MAX_CYCLES)) {
    const sp = cycle.specialists?.find((s) => s.name === specialistName);
    if (!sp) continue;
    const finalAction = cycle.decision?.action ?? "HOLD";
    const finalAsset = cycle.decision?.asset ?? "?";
    lines.push(
      `- #${cycle.cycleId} (${daysAgo(cycle.timestamp)}): you said ${sp.signal} conf ${sp.confidence}% → executor went ${finalAction} ${finalAsset}`,
    );
  }

  if (lines.length === 0) return "";
  return `YOUR LAST CALLS (specialist=${specialistName}):\n${lines.join("\n")}`;
}

/**
 * Extract the CIDs (storage hashes) of the prior cycles so the commit path
 * can persist them on the new RichCycleRecord as `priorCids`. The CIDs don't
 * live on the RichCycleRecord itself — they're the HCS `sh` pointers. This
 * helper takes the rich records AND the original HCS slice so we can zip them.
 *
 * For simplicity we accept a pre-built array of CIDs from the caller rather
 * than reaching back into HCS a second time.
 */
export function buildPriorCidsList(cids: string[]): string[] {
  return cids.filter((c) => typeof c === "string" && c.length > 0).slice(0, MAX_CYCLES);
}
