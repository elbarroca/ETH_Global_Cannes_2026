import type TelegramBot from "node-telegram-bot-api";
import type {
  AnalysisResult,
  CycleResult,
  CompactCycleRecord,
  PaymentRecord,
  SpecialistResult,
  UserRecord,
} from "../types/index";
import type { RoleSelection } from "../agents/role-manifests";

const HASHSCAN_BASE = "https://hashscan.io/testnet/topic";

function getTopicId(): string {
  return process.env.HCS_AUDIT_TOPIC_ID ?? "";
}

export function signalEmoji(signal: string): string {
  if (signal === "BUY") return "🟢";
  if (signal === "SELL") return "🔴";
  return "⚪";
}

// Escape the four characters Telegram legacy Markdown treats as formatting
// delimiters: `_`, `*`, `[`, `` ` ``. Apply to LLM-generated reasoning bodies
// before splicing into `*bold*`-wrapped templates — otherwise an unmatched
// `_` inside a 700-char paragraph makes Telegram 400 the whole send.
export function escapeMarkdown(text: string): string {
  return text.replace(/([_*[\]`])/g, "\\$1");
}

// Truncate at a word boundary so reasoning excerpts don't chop mid-syllable.
// Returns undefined only if the raw input is empty.
export function wordTrim(raw: string | undefined, maxChars: number): string {
  if (!raw) return "";
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (cleaned.length <= maxChars) return cleaned;
  const sliceLimit = maxChars - 3;
  const lastSpace = cleaned.lastIndexOf(" ", sliceLimit);
  const cut = lastSpace > 0 ? cleaned.slice(0, lastSpace) : cleaned.slice(0, sliceLimit);
  return `${cut}...`;
}

// Sum USDC-denominated nanopayment rows — mirrors the helper previously
// inlined in bot.ts so formatHuntComplete can compute total cost alongside
// the specialist count without importing from bot.ts.
function sumPaymentUsd(payments: PaymentRecord[] | undefined): number {
  if (!payments) return 0;
  let sum = 0;
  for (const p of payments) {
    const raw = String(p.amount ?? "").replace(/[$,]/g, "");
    const n = parseFloat(raw);
    if (!Number.isNaN(n)) sum += n;
  }
  return sum;
}

export function formatDebate(record: CompactCycleRecord): string {
  const topicId = getTopicId();
  const specs = (record.s ?? [])
    .map((s) => `  ${signalEmoji(s.sig)} ${s.n}: ${s.sig} (${s.conf}%)`)
    .join("\n");

  const alpha = record.adv?.a;
  const risk = record.adv?.r;
  const exec = record.adv?.e;

  return [
    `*Hunt #${record.c}*`,
    "",
    "📡 *Specialists:*",
    specs || "  No data",
    "",
    `🟢 *Alpha:* ${alpha?.act ?? "?"} ${alpha?.pct ?? 0}%${alpha?.r ? `\n  _"${alpha.r}"_` : ""}`,
    `🔴 *Risk:* max ${risk?.max ?? 0}%${risk?.r ? `\n  _"${risk.r}"_` : ""}`,
    `⚖️ *Executor:* ${exec?.act ?? "?"} ${exec?.pct ?? 0}% (SL ${exec?.sl ?? 0}%)${exec?.r ? `\n  _"${exec.r}"_` : ""}`,
    "",
    `📊 Decision: *${record.d?.act ?? "HOLD"}* ${record.d?.asset ?? ""} ${record.d?.pct ?? 0}%`,
    `💰 NAV: $${(record.nav ?? 0).toLocaleString()}`,
    "",
    `🔗 [Proof on Hashscan](${HASHSCAN_BASE}/${topicId})`,
  ].join("\n");
}

export function formatCycleSummary(record: CompactCycleRecord): string {
  const d = record.d;
  return `#${record.c} ${d?.act ?? "?"} ${d?.asset ?? ""} ${d?.pct ?? 0}% | NAV $${(record.nav ?? 0).toFixed(0)}`;
}

export function formatAnalysisPreview(analysis: AnalysisResult, user: UserRecord): string {
  const { specialists, debate, compactRecord } = analysis;
  const timeoutMin = user.agent.approvalTimeoutMin ?? 10;

  const specLines = specialists
    .map((s) => `  ${signalEmoji(s.signal)} ${s.name}: ${s.signal} (${s.confidence}%) [rep: ${s.reputation ?? "?"}]`)
    .join("\n");

  const alphaParsed = debate.alpha.parsed as { action?: string; pct?: number; argument?: string; thesis?: string };
  const riskParsed = debate.risk.parsed as { challenge?: string; objection?: string; max_pct?: number };
  const execParsed = debate.executor.parsed as { action?: string; pct?: number; stop_loss?: string; reasoning?: string };

  const exec = compactRecord.adv.e;

  const alphaReasoning = debate.alpha.reasoning ?? alphaParsed.argument ?? alphaParsed.thesis ?? "";
  const riskReasoning = debate.risk.reasoning ?? riskParsed.objection ?? riskParsed.challenge ?? "";
  const execReasoning = debate.executor.reasoning ?? execParsed.reasoning ?? "";

  return [
    `🧠 *Hunt #${analysis.cycleId} — Recommendation Ready*`,
    "",
    "📡 *Pack Signals:*",
    specLines || "  No data",
    "",
    "⚔️ *Adversarial Debate:*",
    `🟢 Alpha: ${alphaParsed.action ?? "?"} ${alphaParsed.pct ?? 0}% ETH — "${alphaReasoning.slice(0, 120)}${alphaReasoning.length > 120 ? "..." : ""}"`,
    `🔴 Risk: Max ${riskParsed.max_pct ?? 0}% — "${riskReasoning.slice(0, 120)}${riskReasoning.length > 120 ? "..." : ""}"`,
    `⚖️ Executor: ${exec.act} ${exec.pct}% ETH (SL ${exec.sl}%) — "${execReasoning.slice(0, 120)}${execReasoning.length > 120 ? "..." : ""}"`,
    "",
    `📊 Recommendation: *${exec.act}* ETH ${exec.pct}%`,
    `💰 NAV: $${user.fund.currentNav.toLocaleString()}`,
    "",
    `⏰ Auto-resolves in ${timeoutMin} minutes`,
    "",
    "_Tap below to approve or reject:_",
  ].join("\n");
}

export function formatApprovedResult(result: CycleResult, user: UserRecord): string {
  const action = (result.decision as { act?: string })?.act ?? "HOLD";
  const pct = (result.decision as { pct?: number })?.pct ?? 0;
  const teeCount = result.specialists.filter((s) => s.teeVerified).length;

  return [
    `✅ *Hunt #${result.cycleId} — Approved & Logged*`,
    "",
    `⚖️ Decision: *${action}* ETH ${pct}%`,
    `💰 NAV: $${user.fund.currentNav.toLocaleString()}`,
    `✅ TEE verified: ${teeCount}/${result.specialists.length}`,
    `📋 HCS: seq #${result.seqNum}`,
    "",
    `🔗 [Proof on Hashscan](${result.hashscanUrl})`,
  ].join("\n");
}

export function formatRejectedResult(analysis: AnalysisResult): string {
  const exec = analysis.compactRecord.adv.e;
  return [
    `❌ *Hunt #${analysis.cycleId} — Rejected*`,
    "",
    `Recommendation was: ${exec.act} ETH ${exec.pct}%`,
    "Decision was *not* logged to HCS.",
    "",
    "Use /run to trigger a new hunt.",
  ].join("\n");
}

export function formatTimedOutResult(
  analysis: AnalysisResult,
  autoAction: "approved" | "rejected",
): string {
  const exec = analysis.compactRecord.adv.e;
  if (autoAction === "approved") {
    return [
      `⏰ *Hunt #${analysis.cycleId} — Auto-Approved (timeout)*`,
      "",
      `⚖️ Decision: *${exec.act}* ETH ${exec.pct}%`,
      "Logged to HCS automatically.",
    ].join("\n");
  }
  return [
    `⏰ *Hunt #${analysis.cycleId} — Auto-Rejected (timeout)*`,
    "",
    `Recommendation was: ${exec.act} ETH ${exec.pct}%`,
    "Decision was *not* logged (conservative risk profile).",
  ].join("\n");
}

export function buildApprovalKeyboard(pendingId: string): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      { text: "✅ Approve", callback_data: `approve_${pendingId}` },
      { text: "❌ Reject", callback_data: `reject_${pendingId}` },
    ]],
  };
}

// ── Rich hunt-complete notification (matches dashboard depth) ───────────────
//
// Renders the full Alpha/Risk/Executor debate plus per-role specialist hires
// with rotation rationale ("Alpha picked X,Y from pool of 4"). Used by
// notifyUser() in bot.ts to replace the old 5-line summary so Telegram users
// see the same depth as the /dashboard UI.
//
// Target length: ~3500 chars (Telegram caps at 4096). LLM-generated reasoning
// is escaped via escapeMarkdown() and wordTrimmed to fit the budget.

function formatHireLine(
  roleEmoji: string,
  roleLabel: string,
  specialists: SpecialistResult[],
  rotation: RoleSelection | undefined,
): string {
  const hired = specialists.filter((s) => s.hiredBy === roleLabel.toLowerCase()).map((s) => s.name);
  if (rotation && rotation.pool.length > 0) {
    const pickedSet = new Set(rotation.picked);
    const poolNames = rotation.pool
      .map((n) => (pickedSet.has(n) ? `*${n}*` : n))
      .join(", ");
    const pickedCount = rotation.picked.length;
    const poolCount = rotation.pool.length;
    return `${roleEmoji} *${roleLabel}* → picked ${pickedCount}/${poolCount}: ${poolNames}`;
  }
  if (hired.length === 0) {
    return `${roleEmoji} *${roleLabel}* → (no specialists hired)`;
  }
  return `${roleEmoji} *${roleLabel}* → ${hired.join(", ")}`;
}

export function formatHuntComplete(result: CycleResult, user: UserRecord): string {
  const decision = result.decision as { act?: string; asset?: string; pct?: number };
  const action = decision.act ?? "HOLD";
  const asset = decision.asset ?? "";
  const pct = decision.pct ?? 0;

  const alphaParsed = result.debate.alpha.parsed as { action?: string; pct?: number; argument?: string; thesis?: string };
  const riskParsed = result.debate.risk.parsed as { max_pct?: number; objection?: string; challenge?: string };
  const execParsed = result.debate.executor.parsed as { action?: string; pct?: number; stop_loss?: number | string; reasoning?: string };

  const alphaReasoning = escapeMarkdown(
    wordTrim(result.debate.alpha.reasoning ?? alphaParsed.argument ?? alphaParsed.thesis ?? "", 700),
  );
  const riskReasoning = escapeMarkdown(
    wordTrim(result.debate.risk.reasoning ?? riskParsed.objection ?? riskParsed.challenge ?? "", 700),
  );
  const execReasoning = escapeMarkdown(
    wordTrim(result.debate.executor.reasoning ?? execParsed.reasoning ?? "", 500),
  );

  const alphaAct = alphaParsed.action ?? "HOLD";
  const alphaPct = alphaParsed.pct ?? 0;
  const riskMax = riskParsed.max_pct ?? 0;
  const execAct = execParsed.action ?? "HOLD";
  const execPct = execParsed.pct ?? 0;
  const execSl = execParsed.stop_loss ?? 0;

  const payTotal = sumPaymentUsd(result.payments);
  const payCount = (result.payments ?? []).length;
  const specCount = result.specialists.length;
  const costLine = payCount > 0
    ? `💰 ${payCount} nanopayment${payCount === 1 ? "" : "s"} — $${payTotal.toFixed(4)} USDC`
    : `💰 ${specCount} specialist${specCount === 1 ? "" : "s"} hired`;

  const teeCount = result.specialists.filter((s) => s.teeVerified).length;
  const seqLine = result.seqNum ? `📋 HCS seq #${result.seqNum}` : "";

  const alphaRot = result.debate.alpha.rotation;
  const riskRot = result.debate.risk.rotation;
  const execRot = result.debate.executor.rotation;

  const lines: string[] = [
    `📊 *Hunt #${result.cycleId} Complete* — *${action}* ${asset} ${pct}%`,
    `💹 NAV: $${user.fund.currentNav.toLocaleString()} · ${costLine}`,
    "",
    "⚔️ *Debate*",
    "",
    `🟢 *Alpha* — ${alphaAct} ${alphaPct}%`,
    `_${alphaReasoning || "(no reasoning captured)"}_`,
    "",
    `🔴 *Risk* — max ${riskMax}%`,
    `_${riskReasoning || "(no reasoning captured)"}_`,
    "",
    `⚖️ *Executor* — ${execAct} ${execPct}% (SL ${execSl}%)`,
    `_${execReasoning || "(no reasoning captured)"}_`,
    "",
    "📡 *Hires this hunt*",
    formatHireLine("🟢", "Alpha", result.specialists, alphaRot),
    formatHireLine("🔴", "Risk", result.specialists, riskRot),
  ];

  // Only show executor hire line if it actually picked someone — otherwise
  // clutter. Executor's pool is single-element and usually skipped.
  if (execRot && execRot.picked.length > 0) {
    lines.push(formatHireLine("⚖️", "Executor", result.specialists, execRot));
  }

  lines.push(
    "",
    `✅ TEE verified: ${teeCount}/${specCount}${seqLine ? ` · ${seqLine}` : ""}`,
    `🔗 [Proof on Hashscan](${result.hashscanUrl ?? HASHSCAN_BASE + "/" + getTopicId()})`,
  );

  return lines.join("\n");
}
