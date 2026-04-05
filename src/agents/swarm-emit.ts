// Centralized swarm audit emitter.
//
// Every swarm audit event (start, hire, turn, done) goes through one of the
// functions in this file. The emit flow is:
//
//   1. If rich data is provided (hire + turn events), persist it to 0G Storage
//      via storeMemory() and get back a rootHash (CID). On failure, continue
//      without the CID — the HCS audit pointer is still valuable on its own.
//
//   2. Attach the rootHash as `sh` on the HCS event.
//
//   3. Write a structured debug line BEFORE calling logSwarmEvent so we can
//      diagnose failures even when HCS is slow.
//
//   4. Fire logSwarmEvent — any failure is caught and logged but NEVER thrown.
//      A stumble in the audit trail must never fail a cycle.
//
// This module replaces duplicate `emitSwarmEvent` helpers that previously
// lived in main-agent.ts and adversarial.ts, and adds the rich-payload
// persistence layer so HCS events carry a full content-addressable pointer
// to the input/output data that the LLM saw and produced.

import { logSwarmEvent } from "../hedera/hcs";
import { storeMemory } from "../og/storage";
import { logAction } from "../store/action-logger";
import type {
  SwarmEventRecord,
  RichHireData,
  RichTurnData,
} from "../types/index";

const TOPIC_ID = process.env.HCS_AUDIT_TOPIC_ID;

// In-process mutex for 0G Storage uploads. The 0G ethers signer allocates
// sequential nonces, and when multiple uploads run in parallel (e.g. a
// `Promise.all(emitHireWithRichData(...))` batch of 4 hires) the signer
// races on the nonce counter and hits "replacement transaction underpriced"
// because two txs claim the same nonce. The fix is to serialize the uploads
// through a simple chain of promises — each caller waits for the previous
// upload to resolve before starting its own transaction.
//
// HCS writes (logSwarmEvent) stay fully parallel; only the 0G Storage leg
// is gated. Hedera's TopicMessageSubmit is idempotent across parallel
// submissions because each carries a different payload hash.
//
// This trades a few seconds of cycle latency (N×upload instead of max(N))
// for correctness: every hire/turn event gets a valid `sh` pointer instead
// of most of them landing without one.
let zeroGUploadChain: Promise<unknown> = Promise.resolve();

async function serialized0GUpload<T>(task: () => Promise<T>): Promise<T> {
  const previous = zeroGUploadChain;
  let resolveNext: () => void;
  const next = new Promise<void>((resolve) => {
    resolveNext = resolve;
  });
  zeroGUploadChain = next;
  try {
    await previous.catch(() => {});
    return await task();
  } finally {
    resolveNext!();
  }
}

// Persist a full hire/turn rich payload to 0G Storage and return its rootHash.
// This is the content-addressable pointer that turns the HCS audit trail
// from "summary only" into "fully verifiable with byte-for-byte reproducibility".
//
// Serialized via serialized0GUpload so that parallel Promise.all() batches of
// hires don't collide on nonce allocation in the shared ethers signer.
async function persistRichPayload(
  rich: RichHireData | RichTurnData,
): Promise<string | undefined> {
  try {
    const key = `swarm-${rich.eventKind}-c${rich.cycleId}-${rich.userId.slice(0, 8)}`;
    const rootHash = await serialized0GUpload(() => storeMemory(key, rich));
    return rootHash;
  } catch (err) {
    console.warn(
      `[swarm] 0G persist failed for ${rich.eventKind} c=${rich.cycleId}:`,
      err instanceof Error ? err.message : String(err),
    );
    return undefined;
  }
}

// Build the one-line structured debug trace for an HCS event.
function eventSummary(event: SwarmEventRecord): string {
  switch (event.ev) {
    case "start":
      return `c=${event.c} u=${event.u.slice(0, 8)} rp=${event.rp}`;
    case "hire":
      return `c=${event.c} by=${event.by}→${event.to} ${event.sig}@${event.conf}% cot=${event.cot.length}steps sh=${event.sh?.slice(0, 12) ?? "-"}`;
    case "turn":
      return `c=${event.c} t=${event.t} ${event.ph} ${event.from}${event.to ? "→" + event.to : ""} cot=${event.cot.length}steps sh=${event.sh?.slice(0, 12) ?? "-"}`;
    case "done":
      return `c=${event.c} ${event.d.act} ${event.d.asset} ${event.d.pct}% sh=${event.sh?.slice(0, 12) ?? "-"}`;
    case "rating":
      return `c=${event.c} ${event.sn} ${event.k} by=${event.uid} rep=${event.rb}→${event.ra}`;
  }
}

// Fire an HCS swarm event without rich data (used for `start` and `done`).
// The caller retains ownership of the event object.
export function emitSwarmEvent(event: SwarmEventRecord): void {
  if (!TOPIC_ID) {
    console.warn(`[swarm] skip ev=${event.ev}: HCS_AUDIT_TOPIC_ID not set`);
    return;
  }

  const bytes = Buffer.byteLength(JSON.stringify(event), "utf8");
  console.log(`[swarm] → ev=${event.ev} bytes=${bytes} ${eventSummary(event)}`);

  logSwarmEvent(TOPIC_ID, event).catch((err) => {
    console.warn(
      `[swarm] ✗ ev=${event.ev} c=${(event as { c?: number }).c} failed:`,
      err instanceof Error ? err.message : String(err),
    );
  });
}

// Persist a RichHireData payload to 0G Storage, attach the rootHash to the
// HCS hire event, and fire it. Returns a promise so the caller can batch
// multiple hire emits in parallel via Promise.all — essential in the
// hierarchical path where we emit one hire event per specialist.
//
// On 0G failure, the HCS event is still emitted without `sh` so the audit
// trail keeps its summary layer. This is intentional: HCS is the primary
// audit log, 0G is the verifiable back-reference.
export async function emitHireWithRichData(
  baseEvent: Extract<SwarmEventRecord, { ev: "hire" }>,
  rich: RichHireData,
): Promise<void> {
  if (!TOPIC_ID) {
    console.warn(`[swarm] skip ev=hire: HCS_AUDIT_TOPIC_ID not set`);
    return;
  }

  const sh = await persistRichPayload(rich);
  if (sh) {
    void logAction({
      userId: rich.userId,
      actionType: "OG_HIRE_STORED",
      payload: {
        cycleId: rich.cycleId,
        storageHash: sh,
        specialist: rich.specialist,
        hiredBy: rich.hiredBy,
      },
    }).catch(() => {});
  }
  const event: SwarmEventRecord = sh ? { ...baseEvent, sh } : baseEvent;
  const bytes = Buffer.byteLength(JSON.stringify(event), "utf8");
  console.log(`[swarm] → ev=hire bytes=${bytes} ${eventSummary(event)}`);

  try {
    await logSwarmEvent(TOPIC_ID, event);
  } catch (err) {
    console.warn(
      `[swarm] ✗ ev=hire c=${event.c} failed:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

// Same as emitHireWithRichData but for debate turn events.
export async function emitTurnWithRichData(
  baseEvent: Extract<SwarmEventRecord, { ev: "turn" }>,
  rich: RichTurnData,
): Promise<void> {
  if (!TOPIC_ID) {
    console.warn(`[swarm] skip ev=turn: HCS_AUDIT_TOPIC_ID not set`);
    return;
  }

  const sh = await persistRichPayload(rich);
  if (sh) {
    void logAction({
      userId: rich.userId,
      actionType: "OG_TURN_STORED",
      payload: {
        cycleId: rich.cycleId,
        storageHash: sh,
        turnNumber: rich.turnNumber,
        phase: rich.phase,
        from: rich.from,
      },
    }).catch(() => {});
  }
  const event: SwarmEventRecord = sh ? { ...baseEvent, sh } : baseEvent;
  const bytes = Buffer.byteLength(JSON.stringify(event), "utf8");
  console.log(`[swarm] → ev=turn bytes=${bytes} ${eventSummary(event)}`);

  try {
    await logSwarmEvent(TOPIC_ID, event);
  } catch (err) {
    console.warn(
      `[swarm] ✗ ev=turn c=${event.c} failed:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}
