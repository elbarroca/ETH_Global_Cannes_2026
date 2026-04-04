// Next.js instrumentation — runs once on server startup
// Auto-starts specialist servers, marketplace registry, Telegram bot, and heartbeat loop

export async function register() {
  // Only run on the server (not during build or in the browser)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { loadRegistry } = await import("./src/marketplace/registry");
      await loadRegistry();
      console.log("[instrumentation] Marketplace registry loaded");
    } catch (err) {
      console.warn("[instrumentation] Registry load failed (non-fatal):", err instanceof Error ? err.message : String(err));
    }

    try {
      const { startSpecialists } = await import("./src/agents/specialist-server");
      await startSpecialists();
      console.log("[instrumentation] Specialist servers started");
    } catch (err) {
      console.warn("[instrumentation] Specialist startup failed (non-fatal):", err instanceof Error ? err.message : String(err));
    }

    // Start Telegram bot (polling mode — works inside Next.js process)
    if (process.env.TELEGRAM_BOT_TOKEN) {
      try {
        const { startBot } = await import("./src/telegram/bot");
        startBot();
        console.log("[instrumentation] Telegram bot started");
      } catch (err) {
        console.warn("[instrumentation] Telegram bot failed (non-fatal):", err instanceof Error ? err.message : String(err));
      }
    }

    // Start heartbeat loop — auto-hunts for active users on their configured schedule
    try {
      const { startHeartbeatLoop } = await import("./src/agents/heartbeat");
      startHeartbeatLoop();
      console.log("[instrumentation] Heartbeat loop started (hunts run on per-user schedule)");
    } catch (err) {
      console.warn("[instrumentation] Heartbeat startup failed (non-fatal):", err instanceof Error ? err.message : String(err));
    }
  }
}
