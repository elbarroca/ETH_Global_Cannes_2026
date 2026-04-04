import { NextResponse } from "next/server";
import {
  recordRating,
  attachHcsSeqToRating,
  updateSpecialistReputation,
  type RatingKind,
} from "@/src/marketplace/reputation";
import { logSwarmEvent } from "@/src/hedera/hcs";
import { logAction } from "@/src/store/action-logger";

/**
 * POST /api/marketplace/rate
 *
 * Two accepted shapes:
 *
 *   Canonical (preferred):
 *     { userId, agentName, cycleId, kind: "like" | "dislike" | "verify" }
 *
 *     - Upserts a row into `agent_ratings` keyed on (userId, agentName, cycleId).
 *     - Updates `marketplace_agents.reputation` in lockstep via ELO math.
 *     - Logs an `AGENT_RATED` action so the swarm ticker lights up.
 *     - Awaits a `logSwarmEvent({ ev: "rating", ... })` so the response can
 *       include a Hashscan link to the on-chain proof. HCS failures are
 *       non-fatal — the rating still commits and the response returns with
 *       `hcsSeqNum: null` so the UX never blocks on Hedera outages.
 *
 *   Legacy (kept for backwards compatibility with older UI code):
 *     { agentName, positive: boolean }
 *
 *     - Mutates `marketplace_agents.reputation` directly without touching
 *       `agent_ratings`. No HCS write, no user history. Used by the fast
 *       demo mock path; new callers should use the canonical shape above.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      agentName?: string;
      cycleId?: number;
      kind?: RatingKind;
      positive?: boolean;
    };

    if (!body.agentName) {
      return NextResponse.json(
        { error: "agentName is required" },
        { status: 400 },
      );
    }

    // Canonical path — full history + HCS audit.
    if (body.userId && typeof body.cycleId === "number" && body.kind) {
      const kind = body.kind;
      if (kind !== "like" && kind !== "dislike" && kind !== "verify") {
        return NextResponse.json(
          { error: "kind must be one of: like, dislike, verify" },
          { status: 400 },
        );
      }

      const { ratingId, reputationBefore, reputationAfter } = await recordRating({
        userId: body.userId,
        agentName: body.agentName,
        cycleId: body.cycleId,
        kind,
      });

      // Log the rating in `agent_actions` so the swarm activity ticker picks
      // it up on its next poll. Non-fatal — the rating write has already
      // committed by the time we reach this line.
      await logAction({
        userId: body.userId,
        actionType: "AGENT_RATED",
        agentName: body.agentName,
        payload: {
          kind,
          cycleId: body.cycleId,
          reputationBefore,
          reputationAfter,
          ratingId,
        },
      }).catch((err) => {
        console.warn("[api/rate] action log failed:", err);
      });

      // Emit the on-chain proof. We AWAIT this (unlike the fire-and-forget
      // cycle-time hire/turn events) because the response carries the HCS seq
      // number back to the UI, which renders an "↗ HCS" verification link.
      // Typical Hedera testnet round-trip is ~1–2s. If it fails (network
      // flake, topic misconfigured) we still return 200 with hcsSeqNum=null
      // — the Supabase write is the source of truth for the displayed ELO.
      let hcsSeqNum: number | null = null;
      const topicId = process.env.HCS_AUDIT_TOPIC_ID ?? null;
      if (topicId) {
        try {
          const { seqNum } = await logSwarmEvent(topicId, {
            ev: "rating",
            c: body.cycleId,
            sn: body.agentName,
            uid: body.userId.slice(0, 8),
            k: kind,
            rb: reputationBefore,
            ra: reputationAfter,
            t: new Date().toISOString(),
          });
          hcsSeqNum = seqNum;
          await attachHcsSeqToRating(ratingId, seqNum, topicId).catch((err) => {
            console.warn("[api/rate] attach HCS seq failed:", err);
          });
        } catch (err) {
          console.warn(
            "[api/rate] logSwarmEvent failed (graceful degradation):",
            err,
          );
        }
      }

      return NextResponse.json({
        agentName: body.agentName,
        reputation: reputationAfter,
        reputationBefore,
        kind,
        ratingId,
        hcsSeqNum,
        hcsTopicId: topicId,
      });
    }

    // Legacy fast-path — no user history, no HCS write. Keeps old UI code
    // compiling until it migrates to the canonical shape.
    if (typeof body.positive === "boolean") {
      const newReputation = await updateSpecialistReputation(
        body.agentName,
        body.positive,
      );
      return NextResponse.json({
        agentName: body.agentName,
        reputation: newReputation,
      });
    }

    return NextResponse.json(
      {
        error:
          "Send either { userId, agentName, cycleId, kind } (canonical) or { agentName, positive } (legacy)",
      },
      { status: 400 },
    );
  } catch (err) {
    console.error("[api/marketplace/rate] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
