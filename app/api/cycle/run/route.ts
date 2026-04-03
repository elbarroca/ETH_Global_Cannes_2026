import { NextResponse } from "next/server";

export async function POST() {
  // This endpoint proxies to the backend process running on :3001
  // In development, the backend (npx tsx src/index.ts) handles cycle execution
  // The dashboard just triggers it via this proxy
  try {
    // For now, return a message directing to use Telegram /run or the backend directly
    // Full integration requires the Express API server (Sprint 3A Phase 3)
    return NextResponse.json({
      message: "Cycle trigger available via Telegram /run or backend API",
      status: "proxy_not_configured",
    }, { status: 501 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
