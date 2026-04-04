// Next.js instrumentation — runs once on server startup
// Auto-starts specialist servers + loads marketplace registry

export async function register() {
  // Only run on the server (not during build or in the browser)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      // Load marketplace registry from Prisma (auto-registers 3 built-in specialists)
      const { loadRegistry } = await import("./src/marketplace/registry");
      await loadRegistry();
      console.log("[instrumentation] Marketplace registry loaded");
    } catch (err) {
      console.warn("[instrumentation] Registry load failed (non-fatal):", err instanceof Error ? err.message : String(err));
    }

    try {
      // Start specialist Express servers on :4001-4003
      const { startSpecialists } = await import("./src/agents/specialist-server");
      await startSpecialists();
      console.log("[instrumentation] Specialist servers started");
    } catch (err) {
      console.warn("[instrumentation] Specialist startup failed (non-fatal):", err instanceof Error ? err.message : String(err));
    }
  }
}
