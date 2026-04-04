/**
 * Server-Sent Events stream for a live cycle run.
 *
 * Architecture
 * ────────────
 *   POST body:  { goal?: string }
 *   Response:   text/event-stream with these events, in order:
 *                 · suggest_bias       — synthesized from user goal + risk profile
 *                 · cycle_started      — cycleId + goal
 *                 · specialist_hired   — one per hire (name, hiredBy, paymentTxHash)
 *                 · debate_turn        — one per phase (alpha/risk/executor)
 *                 · swap_quote         — amount + token (if decision != HOLD)
 *                 · swap_executed      — txHash + explorerUrl
 *                 · cycle_committed    — final CycleResult summary
 *                 · done
 *
 * How it works
 * ────────────
 * This route fires `runCycle(user, goal)` in the background, then polls
 * `agent_actions` every 400ms for new rows tied to this cycle's window. Each
 * new row is translated into an SSE event. When the background promise
 * resolves, the final committed cycle is fetched from Prisma and emitted as
 * `cycle_committed`, then the stream closes with `done`.
 *
 * We chose polling over a direct EventEmitter in main-agent.ts to avoid a big
 * refactor — the audit log is already the source of truth for every step.
 */

import { NextRequest } from "next/server";
import { getUserById } from "@/src/store/user-store";
import { getPrisma } from "@/src/config/prisma";
import { runCycle } from "@/src/agents/main-agent";
import { enrichCycleRow } from "@/src/store/enrich-cycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Longer than the typical 90-120s cycle — Vercel/Railway may still cap this
// on certain plans, but the Next.js node runtime honors it locally.
export const maxDuration = 300;

interface StreamEvent {
  type:
    | "suggest_bias"
    | "cycle_started"
    | "specialist_hired"
    | "debate_turn"
    | "funds_transferring"
    | "funds_ready"
    | "swap_quote"
    | "swap_executed"
    | "swap_failed"
    | "holdings_updated"
    | "cycle_committed"
    | "error"
    | "done"
    | "heartbeat";
  data: Record<string, unknown>;
}

function encode(event: StreamEvent): Uint8Array {
  const payload = JSON.stringify(event.data);
  return new TextEncoder().encode(`event: ${event.type}\ndata: ${payload}\n\n`);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const user = await getUserById(userId);
  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const goal: string =
    typeof (body as { goal?: unknown }).goal === "string" && (body as { goal: string }).goal.trim().length > 0
      ? (body as { goal: string }).goal.trim()
      : `Grow portfolio, max ${user.agent.maxTradePercent}% per trade, ${user.agent.riskProfile} risk`;

  const nextCycleId = user.agent.lastCycleId + 1;
  const prisma = getPrisma();
  const startTime = new Date();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: StreamEvent) => {
        try {
          controller.enqueue(encode(ev));
        } catch {
          // Client disconnected — stop writing.
        }
      };

      // 1. Immediate bias suggestion derived from the goal + user profile.
      //    This is a cheap, deterministic heuristic so the UI has something to
      //    show within 100ms of pressing Hunt. The LLM-backed debate runs
      //    afterward and may revise/override.
      const lower = goal.toLowerCase();
      let bias: "BUY" | "SELL" | "HOLD" = "HOLD";
      let biasReason = "Balanced default — letting the debate decide.";
      if (/\b(buy|entry|dip|accumul|long)\b/.test(lower)) {
        bias = "BUY";
        biasReason = `Goal mentions entry/accumulation — suggesting bullish bias (up to ${user.agent.maxTradePercent}%).`;
      } else if (/\b(sell|exit|short|reduce|take profit)\b/.test(lower)) {
        bias = "SELL";
        biasReason = `Goal mentions exit/reduction — suggesting bearish bias.`;
      } else if (/\b(safe|defensive|hold|wait)\b/.test(lower)) {
        biasReason = `Goal mentions safety/waiting — defaulting to HOLD unless debate says otherwise.`;
      }
      send({
        type: "suggest_bias",
        data: {
          bias,
          reasoning: biasReason,
          riskProfile: user.agent.riskProfile,
          maxTradePercent: user.agent.maxTradePercent,
        },
      });

      send({
        type: "cycle_started",
        data: { cycleId: nextCycleId, goal, userId: user.id },
      });

      // 2. Fire runCycle in the background — don't await it here. The poller
      //    below walks agent_actions every 400ms until the promise resolves.
      const state: { error: Error | null; done: boolean } = { error: null, done: false };
      const cyclePromise = runCycle(user, goal).catch((err: unknown) => {
        state.error = err instanceof Error ? err : new Error(String(err));
        return null;
      }).finally(() => {
        state.done = true;
      });

      // Track which agent_action IDs we've already emitted.
      const seen = new Set<string>();
      let tick = 0;

      // 3. Poll loop — translate audit rows into SSE events
      while (!state.done) {
        await new Promise((r) => setTimeout(r, 400));
        tick++;

        const actions = await prisma.agentAction.findMany({
          where: {
            userId: user.id,
            createdAt: { gte: startTime },
            actionType: {
              in: [
                "SPECIALIST_HIRED",
                "DEBATE_ALPHA",
                "DEBATE_RISK",
                "DEBATE_EXECUTOR",
                "PAYMENT_SENT",
                "SWAP_EXECUTED",
                "SWAP_FAILED",
                "CYCLE_COMPLETED",
              ],
            },
          },
          orderBy: { createdAt: "asc" },
        }).catch(() => []);

        for (const a of actions) {
          if (seen.has(a.id)) continue;
          seen.add(a.id);

          const payload = (a.payload ?? {}) as Record<string, unknown>;

          if (a.actionType === "SPECIALIST_HIRED") {
            send({
              type: "specialist_hired",
              data: {
                name: a.agentName,
                hiredBy: payload.hiredBy ?? "main-agent",
                signal: payload.signal,
                confidence: payload.confidence,
                paymentTxHash: a.paymentTxHash,
                attestationHash: a.attestationHash,
              },
            });
          } else if (a.actionType.startsWith("DEBATE_")) {
            const tier = a.actionType.replace("DEBATE_", "").toLowerCase();
            send({
              type: "debate_turn",
              data: {
                tier,
                attestationHash: a.attestationHash,
                parsed: payload,
              },
            });
          } else if (a.actionType === "SWAP_EXECUTED") {
            send({
              type: "swap_executed",
              data: {
                txHash: (payload as { txHash?: string }).txHash,
                explorerUrl: (payload as { explorerUrl?: string }).explorerUrl,
                method: (payload as { method?: string }).method,
                asset: (payload as { asset?: string }).asset,
                amountUsd: (payload as { amountUsd?: number }).amountUsd,
              },
            });
          } else if (a.actionType === "SWAP_FAILED") {
            send({
              type: "swap_failed",
              data: {
                reason: (payload as { reason?: string }).reason ?? "unknown",
                stage: (payload as { stage?: string }).stage,
                message: (payload as { message?: string }).message,
              },
            });
          } else if (a.actionType === "PAYMENT_SENT" && a.agentName === "fund-swap") {
            // Proxy → hot wallet bridging events. The stage field on the
            // payload tells us whether this is the "sending" or "landed"
            // half of the transfer.
            const stage = (payload as { stage?: string }).stage;
            if (stage === "funds_transferring") {
              send({
                type: "funds_transferring",
                data: {
                  fromProxy: (payload as { fromProxy?: string }).fromProxy,
                  toHot: (payload as { toHot?: string }).toHot,
                  amountUsd: (payload as { amountUsd?: number }).amountUsd,
                },
              });
            } else if (stage === "funds_ready") {
              send({
                type: "funds_ready",
                data: {
                  skipped: (payload as { skipped?: boolean }).skipped,
                  circleTxId: (payload as { circleTxId?: string }).circleTxId,
                  beforeUsd: (payload as { beforeUsd?: number }).beforeUsd,
                  afterUsd: (payload as { afterUsd?: number }).afterUsd,
                },
              });
            }
          } else if (a.actionType === "CYCLE_COMPLETED" && a.agentName === "holdings-updater") {
            send({
              type: "holdings_updated",
              data: {
                asset: (payload as { asset?: string }).asset,
                usdcSpent: (payload as { usdcSpent?: number }).usdcSpent,
                newDepositedUsdc: (payload as { newDepositedUsdc?: number }).newDepositedUsdc,
                newHoldings: (payload as { newHoldings?: Record<string, number> }).newHoldings,
              },
            });
          }
        }

        // Heartbeat every ~6s (15 ticks × 400ms) so proxies don't idle-kill us
        if (tick % 15 === 0) {
          send({ type: "heartbeat", data: { at: Date.now(), emitted: seen.size } });
        }
      }

      // 4. Cycle finished — emit final committed record or error
      const result = await cyclePromise;
      if (state.error || !result) {
        send({
          type: "error",
          data: { message: state.error?.message ?? "Cycle failed" },
        });
      } else {
        const row = await prisma.cycle.findFirst({
          where: { userId: user.id, cycleNumber: result.cycleId },
        });
        if (row) {
          const enriched = await enrichCycleRow(row);
          send({ type: "cycle_committed", data: enriched as unknown as Record<string, unknown> });
        } else {
          send({
            type: "cycle_committed",
            data: {
              cycleId: result.cycleId,
              decision: result.decision,
              goal: result.goal,
              storageHash: result.storageHash,
              seqNum: result.seqNum,
              payments: result.payments,
            },
          });
        }
      }

      send({ type: "done", data: { cycleId: nextCycleId } });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
