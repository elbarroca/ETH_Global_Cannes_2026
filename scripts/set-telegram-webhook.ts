/**
 * Telegram webhook management CLI.
 *
 * Usage:
 *   npm run setup:webhook -- set       # Register webhook with Vercel URL
 *   npm run setup:webhook -- info      # Show current webhook status
 *   npm run setup:webhook -- delete    # Clear webhook (switch back to polling for local dev)
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN         — the bot's token (from @BotFather)
 *   APP_URL                    — base URL of your deployment (e.g. https://alphadawg.vercel.app)
 *   TELEGRAM_WEBHOOK_SECRET    — random secret Telegram echoes in the
 *                                X-Telegram-Bot-Api-Secret-Token header
 *                                on every webhook call. Match with the
 *                                value set in Vercel env vars.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * IMPORTANT: A bot token can EITHER have a webhook registered OR be used
 * in long-polling mode, never both. If you `setup:webhook set` pointing
 * at Vercel, your local `npm run backend` will no longer receive Telegram
 * updates (it'll log 409 Conflict and stop polling). To switch back for
 * local dev, run `setup:webhook delete`.
 *
 * For the hackathon, the cleanest setup is:
 *   - Production Vercel deploy → set webhook → everything serverless
 *   - Local dev without webhook → run `npm run backend` → polling mode
 * ─────────────────────────────────────────────────────────────────────────
 */

import dotenv from "dotenv";
dotenv.config();

const TELEGRAM_API = "https://api.telegram.org";

interface TelegramResponse<T = unknown> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

interface WebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  max_connections?: number;
  allowed_updates?: string[];
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`❌ ${key} is required in .env`);
    process.exit(1);
  }
  return value;
}

async function callTelegram<T = unknown>(
  token: string,
  method: string,
  params?: Record<string, unknown>,
): Promise<TelegramResponse<T>> {
  const url = `${TELEGRAM_API}/bot${token}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: params ? JSON.stringify(params) : undefined,
  });
  return (await res.json()) as TelegramResponse<T>;
}

async function setWebhook(): Promise<void> {
  const token = requireEnv("TELEGRAM_BOT_TOKEN");
  const appUrl = requireEnv("APP_URL");
  const secret = requireEnv("TELEGRAM_WEBHOOK_SECRET");

  const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/telegram/webhook`;

  console.log(`\n🔗 Registering webhook`);
  console.log(`   URL:    ${webhookUrl}`);
  console.log(`   Secret: ${secret.slice(0, 6)}...${secret.slice(-4)}`);

  const result = await callTelegram(token, "setWebhook", {
    url: webhookUrl,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });

  if (!result.ok) {
    console.error(`\n❌ Failed: ${result.description ?? "unknown error"} (code ${result.error_code})`);
    process.exit(1);
  }

  console.log(`\n✅ Webhook registered successfully`);
  console.log(`   Telegram will now POST updates to ${webhookUrl}`);
  console.log(`   Local polling (npm run backend) will conflict — stop it if it's running.\n`);
}

async function getWebhookInfo(): Promise<void> {
  const token = requireEnv("TELEGRAM_BOT_TOKEN");

  console.log(`\n🔍 Current webhook info...\n`);

  const result = await callTelegram<WebhookInfo>(token, "getWebhookInfo");

  if (!result.ok || !result.result) {
    console.error(`❌ Failed: ${result.description ?? "unknown error"}`);
    process.exit(1);
  }

  const info = result.result;
  console.log(`   URL:              ${info.url || "(none — polling mode)"}`);
  console.log(`   Pending updates:  ${info.pending_update_count}`);
  if (info.ip_address) {
    console.log(`   IP address:       ${info.ip_address}`);
  }
  if (info.max_connections) {
    console.log(`   Max connections:  ${info.max_connections}`);
  }
  if (info.allowed_updates?.length) {
    console.log(`   Allowed updates:  ${info.allowed_updates.join(", ")}`);
  }
  if (info.last_error_message) {
    const ago = info.last_error_date
      ? `${Math.round((Date.now() / 1000 - info.last_error_date) / 60)}m ago`
      : "unknown";
    console.log(`   ⚠️  Last error:    ${info.last_error_message} (${ago})`);
  } else {
    console.log(`   Status:           healthy ✓`);
  }
  console.log();
}

async function deleteWebhook(): Promise<void> {
  const token = requireEnv("TELEGRAM_BOT_TOKEN");

  console.log(`\n🗑  Deleting webhook...\n`);

  const result = await callTelegram(token, "deleteWebhook", {
    drop_pending_updates: false,
  });

  if (!result.ok) {
    console.error(`❌ Failed: ${result.description ?? "unknown error"}`);
    process.exit(1);
  }

  console.log(`✅ Webhook cleared. Bot is now in polling mode — \`npm run backend\` will receive updates again.\n`);
}

async function main(): Promise<void> {
  const cmd = process.argv[2];

  switch (cmd) {
    case "set":
      await setWebhook();
      break;
    case "info":
      await getWebhookInfo();
      break;
    case "delete":
    case "clear":
      await deleteWebhook();
      break;
    default:
      console.log(`\nUsage: npm run setup:webhook -- <command>\n`);
      console.log(`Commands:`);
      console.log(`  set       Register webhook with Vercel URL`);
      console.log(`  info      Show current webhook status`);
      console.log(`  delete    Clear webhook (switch back to polling)\n`);
      console.log(`Required env: TELEGRAM_BOT_TOKEN, APP_URL, TELEGRAM_WEBHOOK_SECRET\n`);
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error("Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
