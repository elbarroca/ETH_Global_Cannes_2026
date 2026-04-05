/**
 * Telegram webhook endpoint.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Replaces the long-polling mode used by `npm run backend` (src/index.ts
 * → startBot). Telegram pushes updates here via HTTPS POST instead of us
 * holding a connection open to api.telegram.org.
 *
 * One-time setup (run once after deploy):
 *   npm run setup:webhook -- set
 * Which calls Telegram's setWebhook API to point at
 *   https://<vercel-url>/api/telegram/webhook
 * with `secret_token=$TELEGRAM_WEBHOOK_SECRET`. Telegram then sends that
 * secret in the X-Telegram-Bot-Api-Secret-Token header on every request,
 * which we verify below to reject forgeries.
 *
 * The existing command + callback handlers in src/telegram/bot.ts are
 * reused as-is via initWebhookBot() — they're already parameterized on
 * the bot instance, so zero handler refactoring was needed.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { initWebhookBot } from "@/src/telegram/bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Updates are lightweight — most handlers finish in <5s. The heaviest path
// (callback_query → hire_confirm → analyzeCycle → createPendingCycle) can
// touch 30-60s. Set to Hobby ceiling.
export const maxDuration = 60;

const SECRET_HEADER = "x-telegram-bot-api-secret-token";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Verify the shared secret Telegram includes in every webhook call.
  //    Without this, anyone on the internet could POST fake updates.
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const receivedSecret = request.headers.get(SECRET_HEADER);
    if (receivedSecret !== expectedSecret) {
      console.warn("[telegram-webhook] Invalid secret token — rejecting");
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else {
    console.warn("[telegram-webhook] TELEGRAM_WEBHOOK_SECRET not set — accepting all updates (dev only)");
  }

  // 2. Parse the Telegram Update payload.
  let update: unknown;
  try {
    update = await request.json();
  } catch (err) {
    console.error("[telegram-webhook] Invalid JSON:", err);
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // 3. Lazily initialize the bot with handlers registered (idempotent across
  //    warm invocations). Returns null if TELEGRAM_BOT_TOKEN is not set.
  const bot = initWebhookBot();
  if (!bot) {
    console.error("[telegram-webhook] initWebhookBot returned null — TELEGRAM_BOT_TOKEN missing?");
    return NextResponse.json({ error: "bot_not_configured" }, { status: 500 });
  }

  // 4. Let node-telegram-bot-api's EventEmitter fire the registered handlers.
  //    processUpdate is synchronous but handlers are async — we don't await
  //    them because Telegram only cares that we return 200 quickly (it
  //    retries on 5xx or timeout).
  try {
    bot.processUpdate(update as Parameters<typeof bot.processUpdate>[0]);
  } catch (err) {
    // Never throw back to Telegram — log and 200 so they don't retry forever.
    console.error("[telegram-webhook] processUpdate error:", err);
  }

  return NextResponse.json({ ok: true });
}

// Health check — `curl https://<url>/api/telegram/webhook`
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    route: "/api/telegram/webhook",
    mode: "webhook",
    botTokenSet: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    secretConfigured: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
  });
}
