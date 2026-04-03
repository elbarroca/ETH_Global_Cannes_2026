import TelegramBot from "node-telegram-bot-api";
import {
  getUserByChatId,
  updateUser,
} from "../store/user-store.js";
import { redeemLinkCode } from "../store/link-codes.js";
import { runCycle } from "../agents/main-agent.js";
import type { UserRecord, CycleResult, CompactCycleRecord } from "../types/index.js";

const MIRROR_BASE = "https://testnet.mirrornode.hedera.com/api/v1";
const HASHSCAN_BASE = "https://hashscan.io/testnet/topic";

let bot: TelegramBot | null = null;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTopicId(): string {
  return process.env.HCS_AUDIT_TOPIC_ID ?? "";
}

async function fetchHistory(limit: number): Promise<CompactCycleRecord[]> {
  const topicId = getTopicId();
  if (!topicId) return [];
  const url = `${MIRROR_BASE}/topics/${topicId}/messages?limit=${limit}&order=desc`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { messages: Array<{ message: string }> };
    return (data.messages ?? [])
      .map((msg) => {
        try {
          return JSON.parse(Buffer.from(msg.message, "base64").toString("utf-8")) as CompactCycleRecord;
        } catch {
          return null;
        }
      })
      .filter((r): r is CompactCycleRecord => r !== null);
  } catch {
    return [];
  }
}

function signalEmoji(signal: string): string {
  if (signal === "BUY") return "🟢";
  if (signal === "SELL") return "🔴";
  return "⚪";
}

function formatDebate(record: CompactCycleRecord): string {
  const topicId = getTopicId();
  const specs = (record.s ?? [])
    .map((s) => `  ${signalEmoji(s.sig)} ${s.n}: ${s.sig} (${s.conf}%)`)
    .join("\n");

  const alpha = record.adv?.a;
  const risk = record.adv?.r;
  const exec = record.adv?.e;

  return [
    `*Cycle #${record.c}*`,
    "",
    "📡 *Specialists:*",
    specs || "  No data",
    "",
    `🟢 *Alpha:* ${alpha?.act ?? "?"} ${alpha?.pct ?? 0}%`,
    `🔴 *Risk:* ${risk?.obj ?? "?"} (max ${risk?.max ?? 0}%)`,
    `⚖️ *Executor:* ${exec?.act ?? "?"} ${exec?.pct ?? 0}% (SL ${exec?.sl ?? 0}%)`,
    "",
    `📊 Decision: *${record.d?.act ?? "HOLD"}* ${record.d?.asset ?? ""} ${record.d?.pct ?? 0}%`,
    `💰 NAV: $${(record.nav ?? 0).toLocaleString()}`,
    "",
    `🔗 [Proof on Hashscan](${HASHSCAN_BASE}/${topicId})`,
  ].join("\n");
}

function formatCycleSummary(record: CompactCycleRecord): string {
  const d = record.d;
  return `#${record.c} ${d?.act ?? "?"} ${d?.asset ?? ""} ${d?.pct ?? 0}% | NAV $${(record.nav ?? 0).toFixed(0)}`;
}

// ── Exported notify function (used by heartbeat) ────────────────────────────

export function notifyUser(user: UserRecord, result: CycleResult): void {
  if (!bot || !user.telegram.chatId) return;

  const pref = user.telegram.notifyPreference;
  const action = (result.decision as { act?: string })?.act ?? "HOLD";

  // Respect notification preference
  if (pref === "trades_only" && action === "HOLD") return;
  if (pref === "daily") return; // daily digest not yet implemented — suppress per-cycle

  const msg = [
    `📊 *Cycle #${result.cycleId} Complete*`,
    `💰 Hired 3 specialists ($0.003)`,
    `⚖️ Decision: *${action}* ${(result.decision as { asset?: string })?.asset ?? ""} ${(result.decision as { pct?: number })?.pct ?? 0}%`,
    `✅ TEE verified: ${result.specialists.filter((s) => s.teeVerified).length}/${result.specialists.length}`,
    `🔗 [Proof](${result.hashscanUrl})`,
  ].join("\n");

  bot.sendMessage(user.telegram.chatId, msg, { parse_mode: "Markdown" }).catch((err) => {
    console.warn(`[telegram] Failed to notify ${user.id}:`, err);
  });
}

// ── Command handlers ────────────────────────────────────────────────────────

function registerCommands(telegramBot: TelegramBot): void {
  // /start — Welcome + link instructions
  telegramBot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id.toString();
    const linkCode = match?.[1]?.trim();

    // Try to link via code
    if (linkCode) {
      const userId = redeemLinkCode(linkCode);
      if (userId) {
        try {
          await updateUser(userId, {
            telegram: {
              chatId,
              username: msg.from?.username ?? null,
              verified: true,
            },
          });
          await telegramBot.sendMessage(msg.chat.id,
            "✅ *Wallet linked!* Your VaultMind agent is now connected.\n\nUse /status to check your agent.",
            { parse_mode: "Markdown" },
          );
        } catch {
          await telegramBot.sendMessage(msg.chat.id, "❌ Link code expired or user not found. Try again.");
        }
        return;
      }
    }

    // Check if already linked
    const user = await getUserByChatId(chatId);
    if (user) {
      await telegramBot.sendMessage(msg.chat.id,
        `✅ Welcome back! Agent is *${user.agent.active ? "running" : "paused"}*.\n\nUse /status for details.`,
        { parse_mode: "Markdown" },
      );
      return;
    }

    await telegramBot.sendMessage(msg.chat.id, [
      "🧠 *VaultMind*",
      "",
      "Your AI agent hires specialists, debates adversarially, and proves every decision on-chain.",
      "",
      "*Commands:*",
      "/status — Current NAV + agent state",
      "/why — Last cycle's full debate",
      "/history — Last 10 cycles",
      "/run — Trigger cycle now",
      "/stop — Pause agent",
      "/resume — Resume agent",
      "",
      "To link your wallet, use the link code from the dashboard:",
      "`/start YOUR_CODE`",
    ].join("\n"), { parse_mode: "Markdown" });
  });

  // /status — NAV, positions, agent state
  telegramBot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id.toString();
    const user = await getUserByChatId(chatId);
    if (!user) {
      await telegramBot.sendMessage(msg.chat.id, "❌ No linked wallet. Use `/start CODE` to link.", { parse_mode: "Markdown" });
      return;
    }

    const lastCycleAgo = user.agent.lastCycleAt
      ? `${Math.round((Date.now() - new Date(user.agent.lastCycleAt).getTime()) / 60000)} min ago`
      : "never";

    await telegramBot.sendMessage(msg.chat.id, [
      "📊 *VaultMind Status*",
      "",
      `NAV: *$${user.fund.currentNav.toLocaleString()}*`,
      `Deposited: $${user.fund.depositedUsdc}`,
      `HTS Shares: ${user.fund.htsShareBalance}`,
      `Agent: ${user.agent.active ? "● Running" : "○ Paused"}`,
      `Risk: ${user.agent.riskProfile} (max ${user.agent.maxTradePercent}%)`,
      `Last cycle: ${lastCycleAgo}`,
      `Total cycles: ${user.agent.lastCycleId}`,
    ].join("\n"), { parse_mode: "Markdown" });
  });

  // /why — Full debate from last cycle
  telegramBot.onText(/\/why/, async (msg) => {
    const chatId = msg.chat.id.toString();
    const user = await getUserByChatId(chatId);
    if (!user) {
      await telegramBot.sendMessage(msg.chat.id, "❌ No linked wallet.");
      return;
    }

    await telegramBot.sendMessage(msg.chat.id, "⏳ Fetching last cycle...");
    const history = await fetchHistory(30);
    const userCycles = history.filter((r) => r.u === user.id);

    if (userCycles.length === 0) {
      await telegramBot.sendMessage(msg.chat.id, "No cycles found yet. Use /run to trigger one.");
      return;
    }

    await telegramBot.sendMessage(msg.chat.id, formatDebate(userCycles[0]), { parse_mode: "Markdown" });
  });

  // /history — Last 10 cycles
  telegramBot.onText(/\/history/, async (msg) => {
    const chatId = msg.chat.id.toString();
    const user = await getUserByChatId(chatId);
    if (!user) {
      await telegramBot.sendMessage(msg.chat.id, "❌ No linked wallet.");
      return;
    }

    await telegramBot.sendMessage(msg.chat.id, "⏳ Fetching history...");
    const history = await fetchHistory(30);
    const userCycles = history.filter((r) => r.u === user.id).slice(0, 10);

    if (userCycles.length === 0) {
      await telegramBot.sendMessage(msg.chat.id, "No cycles found. Use /run to trigger one.");
      return;
    }

    const lines = userCycles.map(formatCycleSummary);
    await telegramBot.sendMessage(msg.chat.id, [
      `📜 *Last ${userCycles.length} Cycles*`,
      "",
      ...lines,
    ].join("\n"), { parse_mode: "Markdown" });
  });

  // /run — Trigger manual cycle
  telegramBot.onText(/\/run/, async (msg) => {
    const chatId = msg.chat.id.toString();
    const user = await getUserByChatId(chatId);
    if (!user) {
      await telegramBot.sendMessage(msg.chat.id, "❌ No linked wallet.");
      return;
    }

    await telegramBot.sendMessage(msg.chat.id, "⚡ Running cycle...");

    try {
      const result = await runCycle(user);
      const debate = formatDebate({
        c: result.cycleId,
        u: result.userId,
        t: result.timestamp.toISOString(),
        rp: user.agent.riskProfile,
        s: result.specialists.map((sp) => ({
          n: sp.name,
          sig: sp.signal,
          conf: sp.confidence,
          att: sp.attestationHash,
        })),
        adv: {
          a: {
            act: (result.debate.alpha.parsed as { action?: string }).action ?? "?",
            pct: (result.debate.alpha.parsed as { allocation_pct?: number }).allocation_pct ?? 0,
            att: result.debate.alpha.attestationHash,
          },
          r: {
            obj: (result.debate.risk.parsed as { objection?: string }).objection ?? "?",
            max: (result.debate.risk.parsed as { max_safe_pct?: number }).max_safe_pct ?? 0,
            att: result.debate.risk.attestationHash,
          },
          e: {
            act: (result.debate.executor.parsed as { action?: string }).action ?? "?",
            pct: (result.debate.executor.parsed as { pct?: number }).pct ?? 0,
            sl: (result.debate.executor.parsed as { stop_loss_pct?: number }).stop_loss_pct ?? 0,
            att: result.debate.executor.attestationHash,
          },
        },
        d: result.decision as { act: string; asset: string; pct: number },
        nav: user.fund.currentNav,
      });
      await telegramBot.sendMessage(msg.chat.id, debate, { parse_mode: "Markdown" });
    } catch (err) {
      await telegramBot.sendMessage(msg.chat.id,
        `❌ Cycle failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  // /stop — Pause agent
  telegramBot.onText(/\/stop/, async (msg) => {
    const chatId = msg.chat.id.toString();
    const user = await getUserByChatId(chatId);
    if (!user) {
      await telegramBot.sendMessage(msg.chat.id, "❌ No linked wallet.");
      return;
    }

    await updateUser(user.id, { agent: { active: false } });
    await telegramBot.sendMessage(msg.chat.id, "⏸️ Agent *paused*. No more cycles until /resume.", { parse_mode: "Markdown" });
  });

  // /resume — Resume agent
  telegramBot.onText(/\/resume/, async (msg) => {
    const chatId = msg.chat.id.toString();
    const user = await getUserByChatId(chatId);
    if (!user) {
      await telegramBot.sendMessage(msg.chat.id, "❌ No linked wallet.");
      return;
    }

    await updateUser(user.id, { agent: { active: true } });
    await telegramBot.sendMessage(msg.chat.id, "▶️ Agent *resumed*. Cycles will run every 5 minutes.", { parse_mode: "Markdown" });
  });
}

// ── Start bot ───────────────────────────────────────────────────────────────

export function startBot(): void {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN not set — bot disabled");
    return;
  }

  bot = new TelegramBot(token, { polling: true });
  registerCommands(bot);
  console.log("[telegram] Bot started (polling mode)");
}
