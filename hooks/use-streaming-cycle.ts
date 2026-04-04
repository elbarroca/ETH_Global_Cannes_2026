"use client";

// Client hook for the POST /api/cycle/stream/[userId] Server-Sent Events route.
//
// Why `fetch` + manual parsing instead of `EventSource`?
//   EventSource doesn't support POST bodies, and we need to send `{ goal }`
//   in the request. The native Fetch API + ReadableStream reader gives us
//   the same SSE semantics with full control over headers/body.

import { useCallback, useRef, useState } from "react";

export type StreamEventType =
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

export interface StreamEvent {
  type: StreamEventType;
  data: Record<string, unknown>;
  at: number;
}

export interface BiasHint {
  bias: "BUY" | "SELL" | "HOLD";
  reasoning: string;
  riskProfile: string;
  maxTradePercent: number;
}

export interface HiredSpecialist {
  name: string;
  hiredBy: string;
  signal?: string;
  confidence?: number;
  paymentTxHash?: string | null;
  attestationHash?: string | null;
  at: number;
}

export interface DebateTurnEvent {
  tier: "alpha" | "risk" | "executor";
  attestationHash?: string | null;
  parsed: Record<string, unknown>;
  at: number;
}

export interface FundsBridgeState {
  transferring: boolean;
  skipped: boolean;
  amountUsd: number | null;
  fromProxy: string | null;
  toHot: string | null;
  circleTxId: string | null;
  beforeUsd: number | null;
  afterUsd: number | null;
}

export interface HoldingsState {
  asset: string;
  usdcSpent: number;
  newDepositedUsdc: number;
  newHoldings: Record<string, number>;
}

interface UseStreamingCycleResult {
  /** Start a streamed cycle — returns when the stream closes (or throws). */
  run: (goal: string) => Promise<void>;
  /** Cancel an in-flight stream. */
  cancel: () => void;

  running: boolean;
  events: StreamEvent[];

  /** Digested state for the UI — updated as events arrive. */
  bias: BiasHint | null;
  startedAt: number | null;
  cycleId: number | null;
  specialistsHired: HiredSpecialist[];
  debateTurns: DebateTurnEvent[];
  funds: FundsBridgeState;
  swapTxHash: string | null;
  swapExplorerUrl: string | null;
  holdings: HoldingsState | null;
  committed: Record<string, unknown> | null;
  error: string | null;
}

export function useStreamingCycle(userId: string | null): UseStreamingCycleResult {
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [bias, setBias] = useState<BiasHint | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [cycleId, setCycleId] = useState<number | null>(null);
  const [specialistsHired, setSpecialistsHired] = useState<HiredSpecialist[]>([]);
  const [debateTurns, setDebateTurns] = useState<DebateTurnEvent[]>([]);
  const [funds, setFunds] = useState<FundsBridgeState>({
    transferring: false,
    skipped: false,
    amountUsd: null,
    fromProxy: null,
    toHot: null,
    circleTxId: null,
    beforeUsd: null,
    afterUsd: null,
  });
  const [swapTxHash, setSwapTxHash] = useState<string | null>(null);
  const [swapExplorerUrl, setSwapExplorerUrl] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<HoldingsState | null>(null);
  const [committed, setCommitted] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const reset = () => {
    setEvents([]);
    setBias(null);
    setStartedAt(null);
    setCycleId(null);
    setSpecialistsHired([]);
    setDebateTurns([]);
    setFunds({
      transferring: false,
      skipped: false,
      amountUsd: null,
      fromProxy: null,
      toHot: null,
      circleTxId: null,
      beforeUsd: null,
      afterUsd: null,
    });
    setSwapTxHash(null);
    setSwapExplorerUrl(null);
    setHoldings(null);
    setCommitted(null);
    setError(null);
  };

  const handleEvent = (ev: StreamEvent) => {
    setEvents((prev) => [...prev, ev]);
    const { type, data } = ev;
    switch (type) {
      case "suggest_bias":
        setBias(data as unknown as BiasHint);
        break;
      case "cycle_started":
        setStartedAt(Date.now());
        setCycleId(Number(data.cycleId));
        break;
      case "specialist_hired":
        setSpecialistsHired((prev) => [...prev, { ...(data as unknown as HiredSpecialist), at: ev.at }]);
        break;
      case "debate_turn":
        setDebateTurns((prev) => [...prev, { ...(data as unknown as DebateTurnEvent), at: ev.at }]);
        break;
      case "funds_transferring":
        setFunds((f) => ({
          ...f,
          transferring: true,
          amountUsd: Number(data.amountUsd ?? null),
          fromProxy: String(data.fromProxy ?? "") || null,
          toHot: String(data.toHot ?? "") || null,
        }));
        break;
      case "funds_ready":
        setFunds((f) => ({
          ...f,
          transferring: false,
          skipped: Boolean(data.skipped),
          circleTxId: data.circleTxId ? String(data.circleTxId) : null,
          beforeUsd: Number(data.beforeUsd ?? f.beforeUsd ?? 0),
          afterUsd: Number(data.afterUsd ?? f.afterUsd ?? 0),
        }));
        break;
      case "swap_executed":
        setSwapTxHash(String(data.txHash ?? ""));
        setSwapExplorerUrl(String(data.explorerUrl ?? ""));
        break;
      case "swap_failed":
        setError(String(data.reason ?? data.message ?? "swap failed"));
        break;
      case "holdings_updated":
        setHoldings({
          asset: String(data.asset ?? "ETH"),
          usdcSpent: Number(data.usdcSpent ?? 0),
          newDepositedUsdc: Number(data.newDepositedUsdc ?? 0),
          newHoldings: (data.newHoldings as Record<string, number>) ?? {},
        });
        break;
      case "cycle_committed":
        setCommitted(data);
        break;
      case "error":
        setError(String(data.message ?? "Stream error"));
        break;
      default:
        break;
    }
  };

  const run = useCallback(
    async (goal: string) => {
      if (!userId) throw new Error("userId required");
      reset();
      setRunning(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`/api/cycle/stream/${userId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error(`stream failed: HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          // SSE frames are separated by \n\n
          let boundary;
          while ((boundary = buf.indexOf("\n\n")) >= 0) {
            const frame = buf.slice(0, boundary);
            buf = buf.slice(boundary + 2);
            if (!frame.trim()) continue;

            let eventType: StreamEventType = "heartbeat";
            let payloadStr = "";
            for (const line of frame.split("\n")) {
              if (line.startsWith("event: ")) {
                eventType = line.slice(7).trim() as StreamEventType;
              } else if (line.startsWith("data: ")) {
                payloadStr += line.slice(6);
              }
            }
            let parsed: Record<string, unknown> = {};
            try {
              parsed = payloadStr ? (JSON.parse(payloadStr) as Record<string, unknown>) : {};
            } catch {
              parsed = { raw: payloadStr };
            }
            handleEvent({ type: eventType, data: parsed, at: Date.now() });
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        setRunning(false);
        abortRef.current = null;
      }
    },
    [userId],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    run,
    cancel,
    running,
    events,
    bias,
    startedAt,
    cycleId,
    specialistsHired,
    debateTurns,
    funds,
    swapTxHash,
    swapExplorerUrl,
    holdings,
    committed,
    error,
  };
}
