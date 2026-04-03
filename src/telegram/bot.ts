import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TelegramConfig {
  chatId: string;
  username?: string;
  verified: boolean;
  notifyPreference: "every_cycle" | "trades_only" | "daily_digest";
}

interface AgentConfig {
  active: boolean;
  riskProfile: "conservative" | "balanced" | "aggressive";
  maxPct: number;
  fundShares: number;
  nav: number;
  depositedUsdc: number;
  cyclesRun: number;
  lastCycleAt?: string;
}

interface UserRecord {
  id: string;
  walletAddress: string;
  telegram?: TelegramConfig;
  agent: AgentConfig;
  hcsTopicId?: string;
  linkCode?: string;
}

interface SpecialistResult {
  name: string;
  signal: string;
  confidence: number;
  attestationHash: string;
  teeVerified: boolean;
}

interface CycleResult {
  cycleId: number;
  hashscanUrl: string;
  specialists?: SpecialistResult[];
  debate?: {
    alpha?: { parsed?: { action: string; asset: string; pct: number; thesis?: string } };
    risk?: { parsed?: { maxSafePct: number; objection?: string } };
    executor?: { parsed?: { action: string; asset: string; pct: number; sl?: number; reasoning?: string } };
  };
}

// ─── STUBS — replace with Dev A's real modules ──────────────────────────────

const mockUsers = new Map<string, UserRecord>();

function getUserByChatId(chatId: string): UserRecord | null {
  // STUB: replace with import from "../store/user-store.js"
  return mockUsers.get(chatId) ?? null;
}

function updateUser(_id: string, _patch: Partial<UserRecord>): void {
  // STUB: replace with real updateUser
}

function redeemLinkCode(code: string): string | null {
  // STUB: any 6-char code returns a mock userId
  if (code.length === 6) {
    const userId = "mock-user-" + code;
    const mockUser: UserRecord = {
      id: userId,
      walletAddress: "0xMock" + code,
      agent: {
        active: true,
        riskProfile: "balanced",
        maxPct: 12,
        fundShares: 100,
        nav: 1050,
        depositedUsdc: 1000,
        cyclesRun: 0,
      },
    };
    mockUsers.set("pending-" + code, mockUser);
    return userId;
  }
  return null;
}

async function runCycle(_user: UserRecord): Promise<CycleResult> {
  // STUB: replace with import from "../agents/main-agent.js"
  return {
    cycleId: 1,
    hashscanUrl: "https://hashscan.io/testnet/topic/0.0.000/message/1",
    debate: {
      executor: { parsed: { action: "BUY", asset: "ETH", pct: 12 } },
    },
  };
}

async function getHistoryForUser(
  _topicId: string,
  _userId: string,
  _limit: number
): Promise<CycleResult[]> {
  // STUB: replace with import from "../hedera/hcs.js"
  return [];
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function timeSince(isoString: string): string {
  const ms = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  return "yesterday";
}

function formatCycleSummary(result: CycleResult): string {
  const exec = result.debate?.executor?.parsed;
  const action = exec?.action ?? "HOLD";
  const asset = exec?.asset ?? "N/A";
  const pct = exec?.pct ?? 0;
  const sl = exec?.sl ?? 0;
  const specialists = result.specialists ?? [];
  const verified = specialists.filter((s) => s.teeVerified).length;

  return (
    `📊 *Cycle #${result.cycleId} Complete*\n` +
    `💰 Hired 3 specialists ($0.003)\n` +
    `⚖️ Decision: ${action} ${asset} ${pct}% (SL ${sl}%)\n` +
    `✅ ${verified}/3 TEE verified\n` +
    `🔗 [View on Hashscan](${result.hashscanUrl})`
  );
}

function formatDebateMessage(result: CycleResult): string {
  const specialists = result.specialists ?? [];
  const alpha = result.debate?.alpha?.parsed;
  const risk = result.debate?.risk?.parsed;
  const exec = result.debate?.executor?.parsed;

  const specsText = specialists.length
    ? specialists
        .map((s) => `${capitalize(s.name)}: ${s.signal} (${s.confidence}%)`)
        .join("\n")
    : "No specialist data";

  return (
    `🧠 *Cycle #${result.cycleId} — Full Debate*\n\n` +
    `📡 *Specialists:*\n${specsText}\n\n` +
    `🟢 *Alpha:* ${alpha?.action ?? "?"} ${alpha?.pct ?? 0}% ${alpha?.asset ?? ""}\n` +
    `'${alpha?.thesis ?? "N/A"}'\n\n` +
    `🔴 *Risk:* MAX ${risk?.maxSafePct ?? 0}%\n` +
    `'${risk?.objection ?? "N/A"}'\n\n` +
    `⚖️ *Executor:* ${exec?.action ?? "?"} ${exec?.pct ?? 0}% ${exec?.asset ?? ""}, SL ${exec?.sl ?? 0}%\n` +
    `'${exec?.reasoning ?? "N/A"}'\n\n` +
    `🔗 [Proof on Hashscan](${result.hashscanUrl})`
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Bot ─────────────────────────────────────────────────────────────────────

let bot: TelegramBot;

function unlinkedMessage(chatId: number): void {
  bot.sendMessage(
    chatId,
    "⚠️ Your Telegram is not linked.\n\nGo to *vaultmind.xyz*, connect your wallet, then send:\n`/link YOUR_CODE`",
    { parse_mode: "Markdown" }
  );
}

export function startTelegramBot(): void {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set in .env");

  bot = new TelegramBot(token, { polling: true });
  console.log("Telegram bot started, polling...");

  // /start
  bot.onText(/^\/start$/, (msg) => {
    const chatId = msg.chat.id;
    const user = getUserByChatId(chatId.toString());
    if (user?.telegram?.verified) {
      const state = user.agent.active ? "running" : "paused";
      bot.sendMessage(chatId, `👋 Welcome back! Your agent is *${state}*.`, {
        parse_mode: "Markdown",
      });
    } else {
      bot.sendMessage(
        chatId,
        "👋 Welcome to *VaultMind*!\n\nGo to *vaultmind.xyz*, connect your wallet, then send:\n`/link YOUR_CODE`",
        { parse_mode: "Markdown" }
      );
    }
  });

  // /link CODE
  bot.onText(/^\/link\s+(\S+)$/, (msg, match) => {
    const chatId = msg.chat.id;
    const code = (match?.[1] ?? "").toUpperCase();

    const userId = redeemLinkCode(code);
    if (!userId) {
      bot.sendMessage(chatId, "❌ Invalid or expired code. Please check your dashboard.");
      return;
    }

    updateUser(userId, {
      telegram: {
        chatId: chatId.toString(),
        username: msg.from?.username,
        verified: true,
        notifyPreference: "trades_only",
      },
    });

    // Cache the linked user
    const pendingUser = mockUsers.get("pending-" + code);
    if (pendingUser) {
      pendingUser.telegram = {
        chatId: chatId.toString(),
        username: msg.from?.username,
        verified: true,
        notifyPreference: "trades_only",
      };
      mockUsers.set(chatId.toString(), pendingUser);
      mockUsers.delete("pending-" + code);
    }

    bot.sendMessage(
      chatId,
      "✅ *Telegram linked!*\n\nYour agent is now connected. Use /status to check your portfolio.",
      { parse_mode: "Markdown" }
    );
  });

  // /status
  bot.onText(/^\/status$/, (msg) => {
    const chatId = msg.chat.id;
    const user = getUserByChatId(chatId.toString());
    if (!user) { unlinkedMessage(chatId); return; }

    const { agent } = user;
    const lastCycle = agent.lastCycleAt ? timeSince(agent.lastCycleAt) : "never";
    const text =
      `📊 *Your VaultMind Status*\n\n` +
      `💰 NAV: $${agent.nav.toFixed(2)}\n` +
      `💵 Deposited: $${agent.depositedUsdc}\n` +
      `🎯 Risk Profile: ${capitalize(agent.riskProfile)}\n` +
      `📈 Max Per Trade: ${agent.maxPct}%\n` +
      `🤖 Agent: ${agent.active ? "✅ Running" : "⏸ Paused"}\n` +
      `🔄 Cycles: ${agent.cyclesRun}\n` +
      `⏱ Last Cycle: ${lastCycle}`;

    bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
  });

  // /why
  bot.onText(/^\/why$/, async (msg) => {
    const chatId = msg.chat.id;
    const user = getUserByChatId(chatId.toString());
    if (!user) { unlinkedMessage(chatId); return; }

    try {
      const history = await getHistoryForUser(user.hcsTopicId ?? "", user.id, 1);
      if (!history.length) {
        bot.sendMessage(chatId, "No cycles run yet. Use /run to start.");
        return;
      }
      bot.sendMessage(chatId, formatDebateMessage(history[0]!), {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      });
    } catch (err) {
      bot.sendMessage(chatId, `Error fetching history: ${(err as Error).message}`);
    }
  });

  // /history
  bot.onText(/^\/history$/, async (msg) => {
    const chatId = msg.chat.id;
    const user = getUserByChatId(chatId.toString());
    if (!user) { unlinkedMessage(chatId); return; }

    try {
      const history = await getHistoryForUser(user.hcsTopicId ?? "", user.id, 10);
      if (!history.length) {
        bot.sendMessage(chatId, "No cycles run yet. Use /run to start.");
        return;
      }

      const lines = history.map((h) => {
        const exec = h.debate?.executor?.parsed;
        return `• Cycle #${h.cycleId}: ${exec?.action ?? "?"} ${exec?.asset ?? ""} ${exec?.pct ?? 0}%`;
      });

      bot.sendMessage(
        chatId,
        `📋 *Last ${history.length} Cycles*\n\n${lines.join("\n")}`,
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      bot.sendMessage(chatId, `Error fetching history: ${(err as Error).message}`);
    }
  });

  // /run
  bot.onText(/^\/run$/, async (msg) => {
    const chatId = msg.chat.id;
    const user = getUserByChatId(chatId.toString());
    if (!user) { unlinkedMessage(chatId); return; }

    bot.sendMessage(chatId, "🔄 Running cycle... this takes ~30 seconds.");

    try {
      const result = await runCycle(user);
      bot.sendMessage(chatId, formatCycleSummary(result), {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      });
    } catch (err) {
      bot.sendMessage(chatId, `❌ Cycle failed: ${(err as Error).message}`);
    }
  });

  // /stop
  bot.onText(/^\/stop$/, (msg) => {
    const chatId = msg.chat.id;
    const user = getUserByChatId(chatId.toString());
    if (!user) { unlinkedMessage(chatId); return; }

    updateUser(user.id, { agent: { ...user.agent, active: false } });
    bot.sendMessage(chatId, "⏸ Agent paused. Use /resume to restart.");
  });

  // /resume
  bot.onText(/^\/resume$/, (msg) => {
    const chatId = msg.chat.id;
    const user = getUserByChatId(chatId.toString());
    if (!user) { unlinkedMessage(chatId); return; }

    if (user.agent.fundShares <= 0) {
      bot.sendMessage(chatId, "⚠️ No funds deposited. Please deposit first at vaultmind.xyz");
      return;
    }

    updateUser(user.id, { agent: { ...user.agent, active: true } });
    bot.sendMessage(chatId, "▶️ Agent resumed! It will run on the next scheduled cycle.");
  });

  bot.on("polling_error", (err) => {
    console.error("Telegram polling error:", err.message);
  });
}

export function notifyUser(user: UserRecord, result: CycleResult): void {
  if (!user.telegram?.chatId || !user.telegram.verified) return;

  const pref = user.telegram.notifyPreference;
  const action = result.debate?.executor?.parsed?.action ?? "HOLD";

  if (pref === "trades_only" && action === "HOLD") return;
  if (pref === "daily_digest") return;

  const chatId = parseInt(user.telegram.chatId, 10);
  bot?.sendMessage(chatId, formatCycleSummary(result), {
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  });
}

// ─── Run directly ────────────────────────────────────────────────────────────

startTelegramBot();
