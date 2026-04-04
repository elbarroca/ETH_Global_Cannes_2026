import { sealedInference } from "../og/inference";
import { OG_PROVIDER } from "../config/og-compute";
import { getAgentUrl } from "../config/agent-registry";
import { PROMPTS, parseDualOutput, normalizeCot, compactVerdict } from "./prompts";
import { logSwarmEvent } from "../hedera/hcs";
import type { SpecialistResult, DebateResult, DebateTranscriptEntry, DebatePhase, SwarmEventRecord } from "../types/index";

const TOPIC_ID = process.env.HCS_AUDIT_TOPIC_ID!;

// Fire-and-forget swarm event emitter. Failures are logged but never thrown —
// a stumble in the audit trail must never fail a cycle.
//
// Traces each emit attempt with byte count + summary so we can diagnose
// cluster issues on Hashscan without trawling raw payloads. The debug line
// fires BEFORE logSwarmEvent so we see attempts even if HCS is slow/down.
function emitSwarmEvent(event: SwarmEventRecord): void {
  if (!TOPIC_ID) {
    console.warn(`[swarm] skip ev=${event.ev}: HCS_AUDIT_TOPIC_ID not set`);
    return;
  }

  const bytes = Buffer.byteLength(JSON.stringify(event), "utf8");
  let summary: string;
  switch (event.ev) {
    case "start":
      summary = `c=${event.c} u=${event.u.slice(0, 8)} rp=${event.rp}`;
      break;
    case "hire":
      summary = `c=${event.c} by=${event.by}→${event.to} ${event.sig}@${event.conf}% cot=${event.cot.length}steps`;
      break;
    case "turn":
      summary = `c=${event.c} t=${event.t} ${event.ph} ${event.from}${event.to ? "→" + event.to : ""} cot=${event.cot.length}steps`;
      break;
    case "done":
      summary = `c=${event.c} ${event.d.act} ${event.d.asset} ${event.d.pct}% sh=${event.sh?.slice(0, 12) ?? "none"}`;
      break;
  }
  console.log(`[swarm] → ev=${event.ev} bytes=${bytes} ${summary}`);

  logSwarmEvent(TOPIC_ID, event).catch((err) => {
    console.warn(
      `[swarm] ✗ ev=${event.ev} c=${(event as { c?: number }).c} failed:`,
      err instanceof Error ? err.message : String(err),
    );
  });
}

const DELAY_MS = 2000;
const DELIBERATION_PAUSE_MS = parseInt(process.env.DEBATE_DELIBERATION_PAUSE_MS ?? "10000", 10);

// If debate agents are deployed on Fly.io, call them via HTTP
// If not (localhost), fall back to direct 0G inference
const USE_REMOTE_DEBATE = process.env.USE_REMOTE_DEBATE !== "false";

const ALPHA_FALLBACK = { action: "HOLD", asset: "ETH", pct: 0, thesis: "Parse failed — defaulting to HOLD" };
const RISK_FALLBACK = { max_pct: 0, risks: ["parse failure"], objection: "Parse failed — blocking trade" };
const EXECUTOR_FALLBACK = { action: "HOLD", asset: "ETH", pct: 0, stop_loss: "-5%", reasoning: "Parse failed — defaulting to HOLD" };

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Tally how many specialists picked each ticker. Deterministic pre-computation
 * of the "confluence" signal the alpha prompt used to ask the 7B model to
 * count itself — 7B counting is unreliable, so we compute it in code and hand
 * the result to the model as a ready-made table.
 *
 * Result keys are uppercased tickers; values are pick counts.
 */
export function computeConfluence(specialists: SpecialistResult[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of specialists) {
    for (const p of s.picks ?? []) {
      const sym = (p.asset ?? "").toUpperCase();
      if (!sym) continue;
      counts[sym] = (counts[sym] ?? 0) + 1;
    }
  }
  return counts;
}

// Build rich context from specialist signals + raw data snapshots.
// Exported so fly-agent-server.ts (/hire-and-analyze endpoint) can reuse the
// same formatting when debate agents hire their own specialists.
//
// The output now contains a CROSS-SPECIALIST CONFLUENCE TABLE section computed
// deterministically from every specialist's picks[]. The alpha prompt
// references this table directly so the 7B model doesn't have to count —
// it just picks the top-confluence ticker.
export function buildSpecialistContext(specialists: SpecialistResult[]): string {
  const perSpec = specialists
    .map((s, idx) => {
      const repLabel = (s.reputation ?? 500) >= 700 ? "HIGH-REP" : (s.reputation ?? 500) >= 400 ? "MED-REP" : "LOW-REP";
      const lines = [`[#${idx + 1} ${repLabel}] ${s.name}: ${s.signal} (confidence: ${s.confidence}%, reputation: ${s.reputation ?? 500})`];

      if (s.reasoning) lines.push(`  reasoning: "${s.reasoning}"`);

      // Chain-of-thought steps — surfaces the specialist's observe/infer/decide
      // reasoning to the debate layer so Alpha, Risk and Executor can see HOW
      // the specialist arrived at its verdict, not just WHAT it said.
      const rawCot = (s as unknown as { cot?: unknown }).cot;
      const cotSteps = normalizeCot(rawCot, s.reasoning);
      if (cotSteps.length > 0 && Array.isArray(rawCot)) {
        // Only surface cot[] if the specialist actually emitted it as an array.
        // Falling back to the narrative-split would duplicate `reasoning` we
        // already printed on the line above.
        lines.push(`  cot: ${cotSteps.map((c) => `"${c}"`).join(" | ")}`);
      }

      // Multi-token picks — if the specialist emitted a shortlist, surface it
      // so the debate layer can see which tokens were actually suggested and
      // let the executor pick an asset beyond ETH.
      if (Array.isArray(s.picks) && s.picks.length > 0) {
        const pickStr = s.picks
          .map((p) => `${p.asset}:${p.signal}(${p.confidence}%)`)
          .join(", ");
        lines.push(`  picks: ${pickStr}`);
      }

      const snap = s.rawDataSnapshot as Record<string, unknown> | undefined;
      if (snap) {
        const h: string[] = [];
        if (snap.eth_price != null) h.push(`ETH=$${snap.eth_price}`);
        if (snap.fear_greed_value != null) h.push(`F&G=${snap.fear_greed_value}(${snap.fear_greed_label})`);
        if (snap.eth_24h_change != null) h.push(`24h=${Number(snap.eth_24h_change).toFixed(1)}%`);
        if (snap.rsi_14 != null) h.push(`RSI=${snap.rsi_14}`);
        if (snap.macd_crossover != null) h.push(`MACD=${snap.macd_crossover}`);
        if (snap.put_call_ratio != null) h.push(`P/C=${snap.put_call_ratio}`);
        if (snap.dxy_index != null) h.push(`DXY=${snap.dxy_index}`);
        if (snap.vix != null) h.push(`VIX=${snap.vix}`);
        if (snap.exchange_netflow != null) h.push(`netflow=${snap.exchange_netflow}`);
        if (snap.crypto_sentiment_score != null) h.push(`CT=${snap.crypto_sentiment_score}`);
        if (snap.top_gainer != null) h.push(`top=${snap.top_gainer}`);
        if (snap.avg_stable_apy != null) h.push(`apy=${snap.avg_stable_apy}%`);
        if (h.length > 0) lines.push(`  data: ${h.join(", ")}`);
      }
      return lines.join("\n");
    })
    .join("\n");

  // ── Confluence table (deterministic) ─────────────────────────────────
  // Rank tickers by number of specialists that picked them. This is the
  // single most important signal alpha uses — a ticker with 3 picks beats
  // a ticker with 1 pick, regardless of individual confidence scores.
  const confluence = computeConfluence(specialists);
  const ranked = Object.entries(confluence).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) {
    return `${perSpec}\n\nCROSS-SPECIALIST CONFLUENCE TABLE:\n  (no picks emitted — default to HOLD or pick the single-signal consensus)`;
  }
  const tableLines = ranked.map(
    ([ticker, count]) => `  ${ticker}: ${count}× ${count >= 2 ? "(CONFLUENCE — multiple specialists agree)" : "(single specialist)"}`,
  );
  return `${perSpec}\n\nCROSS-SPECIALIST CONFLUENCE TABLE (ticker × # specialists who picked it):\n${tableLines.join("\n")}\n\nThe top entry is the strongest multi-source signal. Prefer it unless Risk flags something specific.`;
}

function isEmptyParse(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length === 0;
}

// ── Inference: try remote HTTP agent first, fallback to direct 0G ─────────────

async function inferWithRetry(
  agentName: string,
  systemPrompt: string,
  userMessage: string,
  fallback: Record<string, unknown>,
): Promise<{ content: string; parsed: Record<string, unknown>; reasoning: string; attestationHash: string; teeVerified: boolean }> {

  // Try calling the remote debate agent (Fly.io) via HTTP
  if (USE_REMOTE_DEBATE) {
    try {
      const agentUrl = getAgentUrl(agentName);
      const res = await fetch(`${agentUrl}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt, userMessage }),
        signal: AbortSignal.timeout(30_000),
      });

      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        if (data.content || data.signal) {
          const content = String(data.content ?? JSON.stringify(data));
          const { reasoning, parsed } = parseDualOutput<Record<string, unknown>>(content, fallback);
          if (!isEmptyParse(parsed)) {
            return {
              content,
              parsed,
              reasoning: String(data.reasoning ?? reasoning),
              attestationHash: String(data.attestationHash ?? `remote-${Date.now().toString(36)}`),
              teeVerified: Boolean(data.teeVerified),
            };
          }
        }
      }
    } catch (err) {
      console.warn(`[debate] Remote ${agentName} call failed, falling back to direct 0G:`, err instanceof Error ? err.message : String(err));
    }
  }

  // Direct 0G sealed inference (works when agents are local or remote is down)
  const result = await sealedInference(OG_PROVIDER, systemPrompt, userMessage);
  const EMPTY: Record<string, unknown> = {};
  const { reasoning, parsed } = parseDualOutput<Record<string, unknown>>(result.content, EMPTY);

  // Retry once with emphasis if 7B model returned unparseable JSON
  if (isEmptyParse(parsed)) {
    await delay(DELAY_MS);
    const emphasisMsg = `${userMessage}\n\nIMPORTANT: Write 2-3 sentences of reasoning, then output valid JSON with your decision.`;
    const retry = await sealedInference(OG_PROVIDER, systemPrompt, emphasisMsg);
    const retryResult = parseDualOutput<Record<string, unknown>>(retry.content, fallback);
    return {
      content: retry.content,
      parsed: retryResult.parsed,
      reasoning: retryResult.reasoning,
      attestationHash: retry.attestationHash,
      teeVerified: retry.teeVerified,
    };
  }

  return { content: result.content, parsed, reasoning, attestationHash: result.attestationHash, teeVerified: result.teeVerified };
}

// ── Transcript helper ─────────────────────────────────────────────────────────

function recordTranscript(
  transcripts: DebateTranscriptEntry[],
  phase: DebatePhase,
  fromAgent: string,
  toAgent: string,
  message: string,
  response: string,
  attestationHash: string,
  teeVerified: boolean,
  durationMs: number,
): void {
  transcripts.push({
    turnNumber: transcripts.length + 1,
    phase, fromAgent, toAgent,
    messageContent: message.slice(0, 2000),
    responseContent: response.slice(0, 2000),
    attestationHash, teeVerified, durationMs,
  });
}

// ── Main debate pipeline ──────────────────────────────────────────────────────

export async function runAdversarialDebate(
  specialistResults: SpecialistResult[],
  riskProfile: string,
  maxTradePercent: number,
  cycleId?: number,
): Promise<DebateResult> {
  const debateStart = Date.now();
  const transcripts: DebateTranscriptEntry[] = [];
  const specContext = buildSpecialistContext(specialistResults);
  let turnCounter = 0;

  // Log specialist intelligence phase
  for (const spec of specialistResults) {
    recordTranscript(transcripts, "intelligence", "main-orchestrator", spec.name,
      `Fetch ${spec.name} analysis`, `${spec.signal} (${spec.confidence}%): ${spec.reasoning ?? ""}`,
      spec.attestationHash, spec.teeVerified, 0);
  }

  // ── Round 1: Standard debate ──────────────────────────────────

  const alphaMsg = `Specialist signals:\n${specContext}\n\nRisk profile: ${riskProfile}. Max allocation: ${maxTradePercent}%.`;
  let t0 = Date.now();
  let alpha = await inferWithRetry("alpha", PROMPTS.alpha.content, alphaMsg, ALPHA_FALLBACK);
  recordTranscript(transcripts, "opening", "main-orchestrator", "alpha", alphaMsg, alpha.content, alpha.attestationHash, alpha.teeVerified, Date.now() - t0);
  if (cycleId != null) {
    emitSwarmEvent({
      ev: "turn",
      c: cycleId,
      t: ++turnCounter,
      ph: "opening",
      from: "alpha",
      cot: normalizeCot((alpha.parsed as { cot?: unknown }).cot, alpha.reasoning),
      verdict: compactVerdict(alpha.parsed),
      att: (alpha.attestationHash ?? "").slice(0, 16),
    });
  }

  await delay(DELAY_MS);

  const alphaCotLines = normalizeCot((alpha.parsed as { cot?: unknown }).cot, alpha.reasoning);
  const alphaCotBlock = alphaCotLines.length > 0 ? `\nAlpha's chain of thought:\n${alphaCotLines.map((c) => `  - ${c}`).join("\n")}` : "";
  const riskMsg = `Specialist signals:\n${specContext}\n\nAlpha argues: "${alpha.reasoning}"${alphaCotBlock}\nAlpha proposes: ${JSON.stringify(alpha.parsed)}\n\nMax allowed: ${maxTradePercent}%. Challenge this.`;
  t0 = Date.now();
  let risk = await inferWithRetry("risk", PROMPTS.risk.content, riskMsg, RISK_FALLBACK);
  recordTranscript(transcripts, "opening", "main-orchestrator", "risk", riskMsg, risk.content, risk.attestationHash, risk.teeVerified, Date.now() - t0);
  if (cycleId != null) {
    emitSwarmEvent({
      ev: "turn",
      c: cycleId,
      t: ++turnCounter,
      ph: "opening",
      from: "risk",
      to: "alpha",
      cot: normalizeCot((risk.parsed as { cot?: unknown }).cot, risk.reasoning),
      verdict: compactVerdict(risk.parsed),
      att: (risk.attestationHash ?? "").slice(0, 16),
    });
  }

  await delay(DELAY_MS);

  const riskCotLines = normalizeCot((risk.parsed as { cot?: unknown }).cot, risk.reasoning);
  const riskCotBlock = riskCotLines.length > 0 ? `\nRisk's chain of thought:\n${riskCotLines.map((c) => `  - ${c}`).join("\n")}` : "";
  const executorMsg = `Specialist signals:\n${specContext}\n\nAlpha argues: "${alpha.reasoning}"${alphaCotBlock}\nAlpha: ${JSON.stringify(alpha.parsed)}\n\nRisk challenges: "${risk.reasoning}"${riskCotBlock}\nRisk: ${JSON.stringify(risk.parsed)}\n\nRisk profile: ${riskProfile}. Max allocation: ${maxTradePercent}%. Make the final call.`;
  t0 = Date.now();
  let executor = await inferWithRetry("executor", PROMPTS.executor.content, executorMsg, EXECUTOR_FALLBACK);
  recordTranscript(transcripts, "decision", "main-orchestrator", "executor", executorMsg, executor.content, executor.attestationHash, executor.teeVerified, Date.now() - t0);
  if (cycleId != null) {
    emitSwarmEvent({
      ev: "turn",
      c: cycleId,
      t: ++turnCounter,
      ph: "decision",
      from: "executor",
      cot: normalizeCot((executor.parsed as { cot?: unknown }).cot, executor.reasoning),
      verdict: compactVerdict(executor.parsed),
      att: (executor.attestationHash ?? "").slice(0, 16),
    });
  }

  // ── Round 2: Rebuttal if confidence is low ────────────────────
  const rawConf = (executor.parsed as { confidence?: unknown }).confidence;
  const execConfidence = rawConf != null ? parseFloat(String(rawConf).replace("%", "")) : 100;
  const execPct = Number((executor.parsed as { pct?: number }).pct ?? 0);
  const shouldRebuttal = !isNaN(execConfidence) && (execConfidence < 60 || (execPct > 0 && execConfidence < 70));

  if (shouldRebuttal) {
    console.log(`[debate] Low confidence (${execConfidence}%) — triggering rebuttal round`);
    await delay(DELAY_MS);

    const alphaRebuttalMsg = `REBUTTAL ROUND. Executor initially decided: ${JSON.stringify(executor.parsed)}\nRisk argued: "${risk.reasoning}"\n\nSpecialist signals:\n${specContext}\n\nDefend or revise your position. Risk profile: ${riskProfile}. Max allocation: ${maxTradePercent}%.`;
    t0 = Date.now();
    alpha = await inferWithRetry("alpha", PROMPTS.alpha.content, alphaRebuttalMsg, ALPHA_FALLBACK);
    recordTranscript(transcripts, "rebuttal", "main-orchestrator", "alpha", alphaRebuttalMsg, alpha.content, alpha.attestationHash, alpha.teeVerified, Date.now() - t0);
    if (cycleId != null) {
      emitSwarmEvent({
        ev: "turn",
        c: cycleId,
        t: ++turnCounter,
        ph: "rebuttal",
        from: "alpha",
        to: "risk",
        cot: normalizeCot((alpha.parsed as { cot?: unknown }).cot, alpha.reasoning),
        verdict: compactVerdict(alpha.parsed),
        att: (alpha.attestationHash ?? "").slice(0, 16),
      });
    }

    await delay(DELAY_MS);

    const riskRebuttalMsg = `REBUTTAL ROUND. Executor initially decided: ${JSON.stringify(executor.parsed)}\nAlpha now argues: "${alpha.reasoning}"\nAlpha revised: ${JSON.stringify(alpha.parsed)}\n\nSpecialist signals:\n${specContext}\n\nMax allowed: ${maxTradePercent}%. Revise your challenge.`;
    t0 = Date.now();
    risk = await inferWithRetry("risk", PROMPTS.risk.content, riskRebuttalMsg, RISK_FALLBACK);
    recordTranscript(transcripts, "rebuttal", "main-orchestrator", "risk", riskRebuttalMsg, risk.content, risk.attestationHash, risk.teeVerified, Date.now() - t0);
    if (cycleId != null) {
      emitSwarmEvent({
        ev: "turn",
        c: cycleId,
        t: ++turnCounter,
        ph: "rebuttal",
        from: "risk",
        to: "alpha",
        cot: normalizeCot((risk.parsed as { cot?: unknown }).cot, risk.reasoning),
        verdict: compactVerdict(risk.parsed),
        att: (risk.attestationHash ?? "").slice(0, 16),
      });
    }

    await delay(DELAY_MS);

    const executorFinalMsg = `FINAL DECISION after rebuttal.\n\nSpecialist signals:\n${specContext}\n\nAlpha (rebuttal): "${alpha.reasoning}"\nAlpha: ${JSON.stringify(alpha.parsed)}\n\nRisk (rebuttal): "${risk.reasoning}"\nRisk: ${JSON.stringify(risk.parsed)}\n\nRisk profile: ${riskProfile}. Max allocation: ${maxTradePercent}%. Make your FINAL call.`;
    t0 = Date.now();
    executor = await inferWithRetry("executor", PROMPTS.executor.content, executorFinalMsg, EXECUTOR_FALLBACK);
    recordTranscript(transcripts, "decision", "main-orchestrator", "executor", executorFinalMsg, executor.content, executor.attestationHash, executor.teeVerified, Date.now() - t0);
    if (cycleId != null) {
      emitSwarmEvent({
        ev: "turn",
        c: cycleId,
        t: ++turnCounter,
        ph: "decision",
        from: "executor",
        cot: normalizeCot((executor.parsed as { cot?: unknown }).cot, executor.reasoning),
        verdict: compactVerdict(executor.parsed),
        att: (executor.attestationHash ?? "").slice(0, 16),
      });
    }
  }

  // Deliberation pause
  console.log(`[debate] Deliberating for ${DELIBERATION_PAUSE_MS / 1000}s...`);
  await delay(DELIBERATION_PAUSE_MS);

  const totalDurationMs = Date.now() - debateStart;
  console.log(`[debate] Done: ${(totalDurationMs / 1000).toFixed(1)}s, ${transcripts.length} turns`);

  return { alpha, risk, executor, rebuttalTriggered: shouldRebuttal, transcripts, totalDurationMs, totalTurns: transcripts.length };
}
