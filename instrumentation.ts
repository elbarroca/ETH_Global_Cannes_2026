// Next.js can create one instrumentation instance per server process. Durable
// workers therefore never start here: the PostgreSQL-leased kernel worker has
// one canonical process entrypoint (`src/index.ts`). This hook is intentionally
// observability-only and imports no legacy or sponsor capability modules.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (
    process.env.ENABLE_KERNEL_WORKER === "true" ||
    process.env.ENABLE_BACKGROUND_WORKERS === "true"
  ) {
    console.warn(JSON.stringify({
      level: "warn",
      context: "instrumentation",
      code: "WORKER_FLAG_IGNORED_IN_WEB_PROCESS",
    }));
  }
}
