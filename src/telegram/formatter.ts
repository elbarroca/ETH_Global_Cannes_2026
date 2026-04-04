import type TelegramBot from "node-telegram-bot-api";
import type {
  AnalysisResult,
  CycleResult,
  CompactCycleRecord,
  UserRecord,
} from "../types/index";

const HASHSCAN_BASE = "https://hashscan.io/testnet/topic";

function getTopicId(): string {
  return process.env.HCS_AUDIT_TOPIC_ID ?? "";
}

export function signalEmoji(signal: string): string {
  if (signal === "BUY") return "🟢";
  if (signal === "SELL") return "🔴";
  return "⚪";
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
    `🔴 *Risk:* ${risk?.obj ?? "?"} (max ${risk?.max ?? 0}%)${risk?.r ? `\n  _"${risk.r}"_` : ""}`,
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
