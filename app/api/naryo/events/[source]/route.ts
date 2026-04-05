import { NextRequest, NextResponse } from "next/server";
import { processNaryoEvent } from "@/src/naryo/event-handler";
import type { NaryoEventPayload } from "@/src/naryo/event-handler";

const VALID_SOURCES = new Set([
  "hcs",
  "hts",
  "cycle",
  "deposit",
  "og-mint",
  "og-metadata",
  // Exhaustive Naryo coverage — three new Hedera EVM event broadcasts.
  // specialist: SpecialistHired per x402 hire
  // heartbeat: HeartbeatEmitted on the throttled heartbeat cadence
  // cross-chain: CrossChainCorrelation proof for Arc swaps + other DLT events
  "specialist",
  "heartbeat",
  "cross-chain",
  // Arc testnet — direct listening to AlphaDawgSwap AMM trades.
  // arc-swap: Swap(address recipient, bool usdcToDweth, uint256 amountIn, uint256 amountOut)
  "arc-swap",
]);

/**
 * POST /api/naryo/events/[source]
 * Receives event broadcasts from the Naryo multichain listener.
 * Each source maps to a specific Naryo filter (HCS, HTS, EVM cycle, etc).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ source: string }> },
) {
  const { source } = await params;

  if (!VALID_SOURCES.has(source)) {
    return NextResponse.json({ error: `Invalid source: ${source}` }, { status: 400 });
  }

  try {
    const payload = (await req.json()) as NaryoEventPayload;
    const eventId = await processNaryoEvent(payload, source);
    return NextResponse.json({ ok: true, eventId });
  } catch (err) {
    console.error(`[naryo] Failed to process ${source} event:`, err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
