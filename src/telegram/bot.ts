import TelegramBot from "node-telegram-bot-api";
import {
  getUserByChatId,
  updateUser,
} from "../store/user-store";
import { redeemLinkCode } from "../store/link-codes";
import { analyzeCycle, commitCycle, rejectCycle } from "../agents/main-agent";
import { createPendingCycle, getPendingCycle, getPendingForUser, resolvePendingCycle } from "../store/pending-cycles";
import { getPrisma } from "../config/prisma";
import type { UserRecord, CycleResult, CompactCycleRecord, AnalysisResult } from "../types/index";
import {
  formatDebate,
  formatCycleSummary,
  formatAnalysisPreview,
  formatApprovedResult,
  formatRejectedResult,
  formatHuntComplete,
  buildApprovalKeyboard,
} from "./formatter";

const MIRROR_BASE = "https://testnet.mirrornode.hedera.com/api/v1";

// Single shared bot instance. Initialized by one of three entry points:
//   1. startBot()          — local `npm run backend`, long-polling mode
//   2. initWebhookBot()    — Vercel webhook route, no polling, handlers registered
//   3. ensureBot()         — lazy send-only init from cron/dashboard routes
// Whichever runs first wins; the others become no-ops.
let bot: TelegramBot | null = null;
let handlersRegistered = false;

/**
 * Lazily creates a send-only bot (no polling, no handlers) if none exists.
 * Used by notifyUser/sendApprovalNotification/editTelegramMessage so they
 * work from Vercel cron/dashboard routes where startBot() was never called.
 */
function ensureBot(): TelegramBot | null {
  if (bot) return bot;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  bot = new TelegramBot(token, { polling: false });
  return bot;
}

/**
 * Initializes the bot for Vercel webhook mode:
 *   - No polling (webhook pushes updates to us)
 *   - Command + callback handlers registered (idempotent)
 * Called by app/api/telegram/webhook/route.ts on every invocation; the
 * lambda's warm period reuses the same memoized bot.
 */
export function initWebhookBot(): TelegramBot | null {
  const b = ensureBot();
  if (!b) return null;
  if (!handlersRegistered) {
    registerCommands(b);
    registerCallbacks(b);
    handlersRegistered = true;
  }
  return b;
}

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

// ── Exported notify function (used by heartbeat) ────────────────────────────
//
// Sends a rich hunt-complete notification matching the dashboard's debate
// depth (full Alpha/Risk/Executor reasoning + per-role hires with rotation
// rationale). The formatter lives in formatter.ts:formatHuntComplete so
// /why, /history, and this entry point all share the same escape + wordTrim
// helpers and there's one place to evolve the message shape.

export function notifyUser(user: UserRecord, result: CycleResult): void {
  const b = ensureBot();
  if (!b || !user.telegram.chatId) return;

  const pref = user.telegram.notifyPreference;
  const action = (result.decision as { act?: string })?.act ?? "HOLD";

  // Respect notification preference
  if (pref === "trades_only" && action === "HOLD") return;
  if (pref === "daily") return; // daily digest not yet implemented — suppress per-cycle

  const msg = formatHuntComplete(result, user);

  b.sendMessage(user.telegram.chatId, msg, { parse_mode: "Markdown" }).catch((err) => {
    console.warn(`[telegram] Failed to notify ${user.id}:`, err);
  });
}

// ── Exported: send approval notification (used by heartbeat for non-auto users)

export async function sendApprovalNotification(
  user: UserRecord,
  analysis: AnalysisResult,
  pendingId: string,
): Promise<number | null> {
  const b = ensureBot();
  if (!b || !user.telegram.chatId) return null;

  const preview = formatAnalysisPreview(analysis, user);
  const sent = await b.sendMessage(user.telegram.chatId, preview, {
    parse_mode: "Markdown",
    reply_markup: buildApprovalKeyboard(pendingId),
  });
  return sent.message_id;
}

// ── Exported: edit telegram message (used by timeout checker)

export async function editTelegramMessage(
  chatId: string,
  messageId: number,
  text: string,
): Promise<void> {
  const b = ensureBot();
  if (!b) return;
  await b.editMessageText(text, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: "Markdown",
  }).catch((err) => {
    console.warn("[telegram] editMessageText failed:", err);
  });
}

// ── Command handlers ────────────────────────────────────────────────────────

export function registerCommands(telegramBot: TelegramBot): void {
  // /start — Welcome + link instructions
  telegramBot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id.toString();
    const linkCode = match?.[1]?.trim();

    // Try to link via code
    if (linkCode) {
      const userId = await redeemLinkCode(linkCode);
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
            "✅ *Wallet linked!* Your AlphaDawg agent is now connected.\n\nUse /status to check your agent.",
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
      "🧠 *AlphaDawg*",
      "",
      "Your AI agent hires specialists, debates adversarially, and proves every decision on-chain.",
      "",
      "*Commands:*",
      "/status — Current NAV + agent state",
      "/why — Last hunt's full debate",
      "/history — Last 10 hunts",
      "/run — Trigger hunt now",
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
      "📊 *AlphaDawg Status*",
      "",
      `NAV: *$${user.fund.currentNav.toLocaleString()}*`,
      `Deposited: $${user.fund.depositedUsdc}`,
      `HTS Shares: ${user.fund.htsShareBalance}`,
      `Agent: ${user.agent.active ? "● Running" : "○ Paused"}`,
      `Risk: ${user.agent.riskProfile} (max ${user.agent.maxTradePercent}%)`,
      `Approval: ${user.agent.approvalMode ?? "always"}`,
      `Last hunt: ${lastCycleAgo}`,
      `Total hunts: ${user.agent.lastCycleId}`,
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

    await telegramBot.sendMessage(msg.chat.id, "⏳ Fetching last hunt...");
    const history = await fetchHistory(30);
    const userCycles = history.filter((r) => r.u === user.id);

    if (userCycles.length === 0) {
      await telegramBot.sendMessage(msg.chat.id, "No hunts found yet. Use /run to trigger one.");
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
      await telegramBot.sendMessage(msg.chat.id, "No hunts found. Use /run to trigger one.");
      return;
    }

    const lines = userCycles.map(formatCycleSummary);
    await telegramBot.sendMessage(msg.chat.id, [
      `📜 *Last ${userCycles.length} Hunts*`,
      "",
      ...lines,
    ].join("\n"), { parse_mode: "Markdown" });
  });

  // /run — Show hire preview with inline buttons
  telegramBot.onText(/\/run/, async (msg) => {
    const chatId = msg.chat.id.toString();
    const user = await getUserByChatId(chatId);
    if (!user) {
      await telegramBot.sendMessage(msg.chat.id, "❌ No linked wallet.");
      return;
    }

    if (!user.agent.active) {
      await telegramBot.sendMessage(msg.chat.id, "⏸️ Agent is paused. Use /resume first.");
      return;
    }

    const preview = [
      "🧠 *AlphaDawg — Hire Specialists?*",
      "",
      `Risk: *${user.agent.riskProfile}* (max ${user.agent.maxTradePercent}%)`,
      `NAV: *$${user.fund.currentNav.toLocaleString()}*`,
      "",
      "📡 *Pack Preview:*",
      "  1. SentimentBot — social/fear-greed analysis",
      "  2. WhaleEye — large wallet flow tracking",
      "  3. MomentumX — RSI/MACD/support-resistance",
      "",
      "💰 Cost: *$0.003* (3 x $0.001 via Arc x402)",
      "⚡ Pipeline: Hire → Debate → *You Approve* → Log",
      "",
      "_Tap below to confirm or skip:_",
    ].join("\n");

    await telegramBot.sendMessage(msg.chat.id, preview, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[
          { text: "✅ Hire & Analyze ($0.003)", callback_data: `hire_confirm_${user.id}` },
          { text: "❌ Skip", callback_data: "hire_skip" },
        ]],
      },
    });
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
    await telegramBot.sendMessage(msg.chat.id, "⏸️ Agent *paused*. No more hunts until /resume.", { parse_mode: "Markdown" });
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
    await telegramBot.sendMessage(msg.chat.id, "▶️ Agent *resumed*. Hunts will run every 5 minutes.", { parse_mode: "Markdown" });
  });
}

// ── Callback handler for inline buttons ────────────────────────────────────

export function registerCallbacks(telegramBot: TelegramBot): void {
  telegramBot.on("callback_query", async (query) => {
    const data = query.data;
    const chatId = query.message?.chat.id;
    if (!data || !chatId) return;

    // ── Hire & Analyze confirm ──────────────────────────────────────────
    if (data.startsWith("hire_confirm_")) {
      const userId = data.replace("hire_confirm_", "");
      await telegramBot.answerCallbackQuery(query.id, { text: "Starting analysis..." });

      if (query.message) {
        await telegramBot.editMessageText("⚡ *Analyzing...*\n\nHiring 3 pack members via x402 nanopayments...", {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: "Markdown",
        }).catch(() => {});
      }

      try {
        const user = await getUserByChatId(chatId.toString());
        if (!user || user.id !== userId) {
          await telegramBot.sendMessage(chatId, "❌ User mismatch. Try /run again.");
          return;
        }

        // Guard: check for existing pending cycle
        const existing = await getPendingForUser(user.id);
        if (existing) {
          await telegramBot.sendMessage(chatId, "⚠️ You already have a pending hunt. Approve or reject it first.");
          return;
        }

        // Phase 1: Analyze only (no on-chain commit yet)
        const analysis = await analyzeCycle(user);

        // Create pending cycle for approval
        const timeoutMin = user.agent.approvalTimeoutMin ?? 10;
        const pending = await createPendingCycle(analysis, "telegram", timeoutMin);

        // Send recommendation with approval buttons
        const preview = formatAnalysisPreview(analysis, user);
        const sent = await telegramBot.sendMessage(chatId, preview, {
          parse_mode: "Markdown",
          reply_markup: buildApprovalKeyboard(pending.id),
        });

        // Store telegram message ID for later editing (timeout checker needs it)
        await getPrisma().pendingCycle.update({
          where: { id: pending.id },
          data: { telegramMsgId: sent.message_id },
        }).catch((e) => console.warn("[telegram] telegramMsgId update failed:", e));

      } catch (err) {
        console.error("[telegram] Analysis failed:", err);
        await telegramBot.sendMessage(chatId, "❌ Analysis failed. Check server logs for details.");
      }
      return;
    }

    // ── Approve pending cycle ───────────────────────────────────────────
    if (data.startsWith("approve_")) {
      const pendingId = data.replace("approve_", "");
      await telegramBot.answerCallbackQuery(query.id, { text: "Approving..." });

      try {
        const pending = await getPendingCycle(pendingId);
        if (!pending || pending.status !== "PENDING_APPROVAL") {
          await telegramBot.answerCallbackQuery(query.id, { text: "Already resolved" });
          return;
        }

        // Verify ownership
        const user = await getUserByChatId(chatId.toString());
        if (!user || user.id !== pending.userId) {
          await telegramBot.sendMessage(chatId, "❌ User mismatch.");
          return;
        }

        // Edit message to show progress
        if (query.message) {
          await telegramBot.editMessageText("⚡ *Approving — logging to HCS & 0G...*", {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: "Markdown",
          }).catch(() => {});
        }

        // Atomically resolve FIRST to prevent double-commit race condition
        const resolved = await resolvePendingCycle(pendingId, {
          status: "APPROVED",
          resolvedBy: "user",
        });
        if (!resolved) {
          await telegramBot.sendMessage(chatId, "⚠️ Already resolved by another session.");
          return;
        }

        // Phase 2: Commit to HCS, 0G, Supabase (safe — only one caller reaches here)
        const analysis: AnalysisResult = {
          userId: pending.userId,
          cycleId: pending.cycleNumber,
          goal: pending.goal,
          specialists: pending.specialists,
          debate: pending.debate,
          compactRecord: pending.compactRecord,
          richRecord: pending.richRecord,
        };

        try {
          const result = await commitCycle(analysis, user);

          // Show approved result
          const approvedMsg = formatApprovedResult(result, user);
          if (query.message) {
            await telegramBot.editMessageText(approvedMsg, {
              chat_id: chatId,
              message_id: query.message.message_id,
              parse_mode: "Markdown",
            }).catch(() => {});
          } else {
            await telegramBot.sendMessage(chatId, approvedMsg, { parse_mode: "Markdown" });
          }
        } catch (commitErr) {
          // commitCycle failed AFTER resolve succeeded — advance lastCycleId to prevent reuse
          console.error("[telegram] commitCycle failed after resolve, cleaning up:", commitErr);
          await rejectCycle(analysis, user, "commit_failed").catch(() => {});
          await telegramBot.sendMessage(chatId, "❌ Commit failed after approval. Cycle logged as failed.");
        }
      } catch (err) {
        console.error("[telegram] Approval failed:", err);
        await telegramBot.sendMessage(chatId, "❌ Approval failed. Check server logs.");
      }
      return;
    }

    // ── Reject pending cycle ────────────────────────────────────────────
    if (data.startsWith("reject_")) {
      const pendingId = data.replace("reject_", "");
      await telegramBot.answerCallbackQuery(query.id, { text: "Rejecting..." });

      try {
        const pending = await getPendingCycle(pendingId);
        if (!pending || pending.status !== "PENDING_APPROVAL") {
          await telegramBot.answerCallbackQuery(query.id, { text: "Already resolved" });
          return;
        }

        const user = await getUserByChatId(chatId.toString());
        if (!user || user.id !== pending.userId) {
          await telegramBot.sendMessage(chatId, "❌ User mismatch.");
          return;
        }

        // Atomically resolve FIRST
        const resolved = await resolvePendingCycle(pendingId, {
          status: "REJECTED",
          resolvedBy: "user",
          rejectReason: "user_rejected",
        });
        if (!resolved) {
          await telegramBot.sendMessage(chatId, "⚠️ Already resolved by another session.");
          return;
        }

        const analysis: AnalysisResult = {
          userId: pending.userId,
          cycleId: pending.cycleNumber,
          goal: pending.goal,
          specialists: pending.specialists,
          debate: pending.debate,
          compactRecord: pending.compactRecord,
          richRecord: pending.richRecord,
        };

        await rejectCycle(analysis, user, "user_rejected");

        const rejectedMsg = formatRejectedResult(analysis);
        if (query.message) {
          await telegramBot.editMessageText(rejectedMsg, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: "Markdown",
          }).catch(() => {});
        } else {
          await telegramBot.sendMessage(chatId, rejectedMsg, { parse_mode: "Markdown" });
        }
      } catch (err) {
        console.error("[telegram] Rejection failed:", err);
        await telegramBot.sendMessage(chatId, "❌ Rejection failed. Check server logs.");
      }
      return;
    }

    // ── Hire skip ───────────────────────────────────────────────────────
    if (data === "hire_skip") {
      await telegramBot.answerCallbackQuery(query.id, { text: "Skipped" });
      if (query.message) {
        await telegramBot.editMessageText("⏭️ Hunt skipped. Use /run when ready.", {
          chat_id: chatId,
          message_id: query.message.message_id,
        }).catch(() => {});
      }
    }
  });
}

// ── Start bot ───────────────────────────────────────────────────────────────

export function startBot(): void {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN not set — bot disabled");
    return;
  }

  if (bot) {
    console.warn("[telegram] Bot already initialized — skipping duplicate start");
    return;
  }

  bot = new TelegramBot(token, { polling: true });

  // Handle 409 conflict (another instance polling) — stop gracefully.
  // Common cause: webhook is registered (Vercel prod) AND local polling is running.
  // Fix: run `npm run setup:webhook -- delete` to clear the webhook, or stop polling.
  bot.on("polling_error", (err) => {
    const msg = (err as Error).message ?? "";
    if (msg.includes("409 Conflict")) {
      console.error("[telegram] Another bot instance or webhook is active — stopping local polling to avoid conflict");
      bot?.stopPolling();
      bot = null;
      handlersRegistered = false;
    } else {
      console.error("[telegram] Polling error:", msg);
    }
  });

  registerCommands(bot);
  registerCallbacks(bot);
  handlersRegistered = true;
  console.log("[telegram] Bot started (polling mode)");
}
