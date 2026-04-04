"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/contexts/user-context";
import { getCycleDetail, executeTrade } from "@/lib/api";
import type { ComputeDetailResponse } from "@/lib/types";
import { Card, CardBody } from "@/components/ui/card";
import { Badge, SealedBadge } from "@/components/ui/badge";
import { AgentGridCard } from "@/components/agent-grid-card";
import { ComputeLog } from "@/components/compute-log";
import { ExecuteTradeModal } from "@/components/execute-trade-modal";
import { DebateTheater } from "@/components/debate-theater";

const ACTION_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  BUY: { text: "text-green-400", bg: "bg-emerald-950/30", border: "border-emerald-700/40" },
  SELL: { text: "text-blood-400", bg: "bg-blood-950/30", border: "border-blood-700/40" },
  HOLD: { text: "text-gold-400", bg: "bg-gold-400/5", border: "border-gold-400/20" },
};

function truncHash(hash: string | null): string {
  if (!hash || hash.length < 14) return hash ?? "—";
  return `${hash.slice(0, 10)}...${hash.slice(-4)}`;
}

export default function ComputePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { userId, user } = useUser();
  const [data, setData] = useState<ComputeDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTradeModal, setShowTradeModal] = useState(false);

  useEffect(() => {
    if (!userId || !params.id) return;
    setLoading(true);
    getCycleDetail(userId, Number(params.id))
      .then(setData)
      .finally(() => setLoading(false));
  }, [userId, params.id]);

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-5 py-8">
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-void-400 text-sm">Loading hunt data...</span>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="max-w-7xl mx-auto px-5 py-8">
        <Card>
          <CardBody className="text-center py-12 space-y-3">
            <p className="text-void-400">Hunt not found.</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="text-sm text-blue-400 hover:underline"
            >
              Back to Dashboard
            </button>
          </CardBody>
        </Card>
      </main>
    );
  }

  const { cycle: c, actions } = data;
  const decision = c.decision ?? "HOLD";
  const asset = c.asset ?? "ETH";
  const pct = c.decisionPct ?? 0;
  const style = ACTION_COLORS[decision] ?? ACTION_COLORS.HOLD;
  const timestamp = new Date(c.createdAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Build specialist summaries for Lead Dawg card
  const specialists = (c.specialists ?? []) as Array<{
    name?: string;
    signal?: string;
    confidence?: number;
    attestationHash?: string;
  }>;
  const leadDawgMessage = specialists.length > 0
    ? specialists
        .map((s) => `${s.name}: ${s.signal} (${s.confidence}%)`)
        .join("\n")
    : "No specialist data available.";

  return (
    <main className="max-w-7xl mx-auto px-5 py-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-void-500 hover:text-void-300 text-sm transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-lg font-bold text-void-100">
            Hunt #{c.cycleNumber}
          </h1>
          <span className="text-sm text-void-600">{timestamp}</span>
        </div>
        {c.hcsSeqNum != null && c.hcsSeqNum > 0 && (
          <Badge variant="teal">HCS #{c.hcsSeqNum}</Badge>
        )}
      </div>

      {/* Mediator Banner */}
      <div className={`${style.bg} ${style.border} border rounded-2xl p-5 sealed-enter`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-void-500 uppercase tracking-wider mb-1">
              Mediator Decision
            </p>
            <p className={`text-2xl font-bold ${style.text}`}>
              {decision} {pct}% {asset}
            </p>
            {c.execStopLoss != null && (
              <p className="text-sm text-void-400 mt-1">
                Stop loss: {c.execStopLoss}%
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {c.storageHash && (
              <Badge variant="purple">0G Stored</Badge>
            )}
            <SealedBadge />
          </div>
        </div>
        {c.hashscanUrl && (
          <a
            href={c.hashscanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 text-xs text-teal-400 hover:underline"
          >
            Verify on Hashscan →
          </a>
        )}
      </div>

      {/* 2x2 Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Lead Dawg — orchestrator */}
        <AgentGridCard
          emoji="🐺"
          title="Lead Dawg"
          borderColor="border-l-gold-400"
          message={leadDawgMessage}
          recommendation={`Hired ${specialists.length} specialists · $${(specialists.length * 0.001).toFixed(3)} spent`}
          attestation=""
          sealed={false}
        />

        {/* Alpha — argues FOR */}
        <AgentGridCard
          emoji="🟢"
          title="Alpha Synthesizer"
          borderColor="border-l-green-500"
          message={c.alphaAction ? `${c.alphaAction} ${c.alphaPct ?? 0}% ${asset}` : "No alpha data"}
          recommendation={c.alphaAction ? `${c.alphaAction} ${c.alphaPct}%` : "—"}
          attestation={truncHash(c.alphaAttestation)}
          sealed={!!c.alphaAttestation}
        />

        {/* Risk — argues AGAINST */}
        <AgentGridCard
          emoji="🔴"
          title="Risk Challenger"
          borderColor="border-l-blood-500"
          message={c.riskChallenge ?? "No risk challenge data"}
          recommendation={c.riskMaxPct != null ? `Max ${c.riskMaxPct}%` : "—"}
          attestation={truncHash(c.riskAttestation)}
          sealed={!!c.riskAttestation}
        />

        {/* Executor — final decision */}
        <AgentGridCard
          emoji="🟡"
          title="Executor Judge"
          borderColor="border-l-gold-400"
          message={c.execAction ? `${c.execAction} ${c.execPct ?? 0}% ${asset}${c.execStopLoss ? `. Stop ${c.execStopLoss}%` : ""}` : "No executor data"}
          recommendation={c.execAction ? `${c.execAction} ${c.execPct}%` : "—"}
          attestation={truncHash(c.execAttestation)}
          sealed={!!c.execAttestation}
        />
      </div>

      {/* Debate Theater — turn-by-turn timeline from debate_transcripts */}
      {userId && c.id && (
        <DebateTheater
          cycleUuid={c.id}
          userId={userId}
          cycleNumber={c.cycleNumber}
          isActive={false}
        />
      )}

      {/* Logs Panel */}
      <ComputeLog actions={actions} />

      {/* Execute Trade Button */}
      {decision !== "HOLD" && userId && (
        <div className="flex justify-center">
          <button
            onClick={() => setShowTradeModal(true)}
            className={`flex items-center gap-2 px-8 py-3.5 text-white text-sm font-bold rounded-xl transition-colors hunting ${
              decision === "BUY"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-blood-600 hover:bg-blood-700"
            }`}
          >
            {decision === "BUY" ? "🟢" : "🔴"} Execute {decision} — ${((pct / 100) * (user?.fund.currentNav ?? 0)).toFixed(2)} USDC → {asset}
          </button>
        </div>
      )}

      {/* Trade Modal */}
      {showTradeModal && userId && (
        <ExecuteTradeModal
          action={decision as "BUY" | "SELL"}
          asset={asset}
          percentage={pct}
          navUsd={user?.fund.currentNav ?? 0}
          onConfirm={async () => {
            const res = await executeTrade(userId, decision, asset, pct);
            return { txId: res.txId, error: res.error };
          }}
          onClose={() => setShowTradeModal(false)}
        />
      )}

      {/* On-chain proof footer */}
      <div className="flex items-center gap-4 text-xs text-void-600 flex-wrap">
        {c.hcsSeqNum != null && c.hcsSeqNum > 0 && (
          <span>Hedera HCS: seq #{c.hcsSeqNum}</span>
        )}
        {c.storageHash && (
          <span>0G Storage: {truncHash(c.storageHash)}</span>
        )}
        {c.totalCostUsd != null && (
          <span>Total cost: ${c.totalCostUsd.toFixed(3)}</span>
        )}
        {c.navAfter != null && (
          <span>NAV after: ${c.navAfter.toFixed(2)}</span>
        )}
      </div>
    </main>
  );
}
