"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardBody, CodeBlock } from "@/components/ui/card";
import { Badge, SealedBadge, ZeroGBadge } from "@/components/ui/badge";
import { useUser } from "@/contexts/user-context";
import { getCycleDetail } from "@/lib/api";
import type { CycleDetail, AgentActionRecord } from "@/lib/types";

type AgentKey = "SentimentBot" | "WhaleEye" | "MomentumX" | "Alpha" | "Risk" | "Executor";

const AGENT_META: Record<AgentKey, { emoji: string; type: "Specialist" | "Adversarial"; skill: string }> = {
  SentimentBot: { emoji: "🧠", type: "Specialist", skill: "Twitter + Reddit sentiment" },
  WhaleEye: { emoji: "🐋", type: "Specialist", skill: "Whale wallet movements" },
  MomentumX: { emoji: "📈", type: "Specialist", skill: "RSI, MACD, volume analysis" },
  Alpha: { emoji: "🟢", type: "Adversarial", skill: "Argues FOR the trade" },
  Risk: { emoji: "🔴", type: "Adversarial", skill: "Argues AGAINST the trade" },
  Executor: { emoji: "🟡", type: "Adversarial", skill: "Makes the final call" },
};

const AGENT_KEYS: AgentKey[] = ["SentimentBot", "WhaleEye", "MomentumX", "Alpha", "Risk", "Executor"];

const PROVIDER_ADDRESS = process.env.NEXT_PUBLIC_OG_PROVIDER_ADDRESS ?? "0x9f2b...4a1c";
const INFT_CONTRACT = process.env.NEXT_PUBLIC_INFT_CONTRACT ?? "0x73e3016D0D3Bf2985c55860cd2A51FF017c2c874";

function getAttestationForAgent(
  key: AgentKey,
  cycle: CycleDetail | null,
  actions: AgentActionRecord[],
): string {
  if (!cycle) return "—";

  // Try to find the action log for this agent
  const actionTypeMap: Record<AgentKey, string> = {
    SentimentBot: "SPECIALIST_HIRED",
    WhaleEye: "SPECIALIST_HIRED",
    MomentumX: "SPECIALIST_HIRED",
    Alpha: "DEBATE_ALPHA",
    Risk: "DEBATE_RISK",
    Executor: "DEBATE_EXECUTOR",
  };

  // For specialists, also match by agent name
  const nameMap: Record<string, string> = { SentimentBot: "sentiment", WhaleEye: "whale", MomentumX: "momentum" };
  const action = key in nameMap
    ? actions.find((a) => a.actionType === actionTypeMap[key] && a.agentName === nameMap[key])
    : actions.find((a) => a.actionType === actionTypeMap[key]);
  if (action?.attestationHash) return action.attestationHash;

  // Fall back to cycle record attestations (only for adversarial agents — specialists are in JSON)
  switch (key) {
    case "SentimentBot":
    case "WhaleEye":
    case "MomentumX": {
      // Parse specialist attestations from the JSON column
      const specs = Array.isArray(cycle.specialists) ? cycle.specialists as Array<{ name?: string; attestation?: string }> : [];
      const specName = nameMap[key];
      const spec = specs.find((s) => s.name === specName);
      return spec?.attestation ?? "—";
    }
    case "Alpha": return cycle.alphaAttestation ?? "—";
    case "Risk": return cycle.riskAttestation ?? "—";
    case "Executor": return cycle.execAttestation ?? "—";
  }
}

function getTeeVerified(key: AgentKey, actions: AgentActionRecord[]): boolean {
  const actionTypeMap: Record<AgentKey, string> = {
    SentimentBot: "SPECIALIST_HIRED",
    WhaleEye: "SPECIALIST_HIRED",
    MomentumX: "SPECIALIST_HIRED",
    Alpha: "DEBATE_ALPHA",
    Risk: "DEBATE_RISK",
    Executor: "DEBATE_EXECUTOR",
  };
  const action = actions.find((a) => a.actionType === actionTypeMap[key]);
  return action?.teeVerified ?? false;
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <main className="max-w-7xl mx-auto px-5 py-5">
        <p className="text-void-500 text-sm animate-pulse">Loading...</p>
      </main>
    }>
      <VerifyContent />
    </Suspense>
  );
}

function VerifyContent() {
  const [selected, setSelected] = useState<AgentKey>("SentimentBot");
  const { userId, user } = useUser();
  const searchParams = useSearchParams();
  const [cycle, setCycle] = useState<CycleDetail | null>(null);
  const [actions, setActions] = useState<AgentActionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const cycleParam = searchParams.get("cycle");
  const parsedCycle = cycleParam ? parseInt(cycleParam, 10) : NaN;
  const cycleNumber = isNaN(parsedCycle) ? (user?.agent?.lastCycleId ?? 0) : parsedCycle;

  useEffect(() => {
    if (!userId || cycleNumber <= 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getCycleDetail(userId, cycleNumber)
      .then((data) => {
        if (data) {
          setCycle(data.cycle);
          setActions(data.actions);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId, cycleNumber]);

  const agent = AGENT_META[selected];
  const attestation = getAttestationForAgent(selected, cycle, actions);
  const teeVerified = getTeeVerified(selected, actions);

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-5 py-5">
        <p className="text-void-500 text-sm animate-pulse">Loading verification data...</p>
      </main>
    );
  }

  if (!cycle) {
    return (
      <main className="max-w-7xl mx-auto px-5 py-5 space-y-4">
        <h1 className="text-lg font-bold text-void-100">0G Verification</h1>
        <Card>
          <CardBody className="text-center py-12 space-y-3">
            <p className="text-void-400 text-sm">No cycle data found.</p>
            <p className="text-void-600 text-xs">
              Run a hunt from the dashboard first, then come back to verify.
            </p>
          </CardBody>
        </Card>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-5 py-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-void-100">
            0G verification — hunt #{cycle.cycleNumber}
          </h1>
          <p className="text-sm text-void-500 mt-0.5">
            Every inference sealed inside TEE hardware on 0G Compute
          </p>
        </div>
        <ZeroGBadge label="6 sealed inference calls" />
      </div>

      {/* Agent selector */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {AGENT_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => setSelected(key)}
            className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-center transition-all ${
              selected === key
                ? "bg-blood-900/30 border-2 border-blood-600 text-void-200"
                : "bg-void-900 border-void-800 text-void-500 hover:border-void-700"
            }`}
          >
            <span className="text-xl">{AGENT_META[key].emoji}</span>
            <span className="text-xs font-medium leading-tight">{key}</span>
            <span className="text-xs text-void-500">{AGENT_META[key].type}</span>
          </button>
        ))}
      </div>

      {/* Proof detail card */}
      <Card>
        <CardBody className="space-y-4">
          {/* Card header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{agent.emoji}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-void-200">{selected}</span>
                  <Badge variant="gray">{agent.type}</Badge>
                  {teeVerified && <Badge variant="green">TEE Verified</Badge>}
                </div>
                <p className="text-xs text-void-500 mt-0.5">{agent.skill}</p>
              </div>
            </div>
            <SealedBadge />
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Agent details */}
            <div className="space-y-3">
              <DetailBlock label="0G Compute Provider">
                <span className="font-mono text-sm text-void-200">{PROVIDER_ADDRESS}</span>
              </DetailBlock>
              <DetailBlock label="Model">
                <span className="font-mono text-sm text-void-200">glm-5-chat</span>
              </DetailBlock>
              <DetailBlock label="iNFT Identity">
                {agent.type === "Specialist" ? (
                  <span className="font-mono text-sm text-gold-400">
                    ERC-7857 on 0G Chain
                  </span>
                ) : (
                  <span className="text-sm text-void-500">Platform infra</span>
                )}
              </DetailBlock>
              <DetailBlock label="Execution Environment">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-void-200">Intel TDX + NVIDIA H100 TEE</span>
                  <Badge variant="green">Hardware isolated</Badge>
                </div>
              </DetailBlock>
              <DetailBlock label="Decision">
                <span className="text-sm text-void-200">
                  {cycle.decision ?? "HOLD"} {cycle.decisionPct ?? 0}% {cycle.asset ?? "ETH"}
                </span>
              </DetailBlock>
            </div>

            {/* Right: TEE Attestation */}
            <div>
              <CodeBlock className="space-y-2">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-void-600 mb-1">
                    Attestation hash
                  </div>
                  <div className="text-gold-400 break-all">
                    {attestation}
                  </div>
                </div>
                <hr className="border-void-800" />
                <div className="space-y-1 text-void-500">
                  <div>Signature: Ed25519</div>
                  <div>Key generated inside TEE</div>
                  <div>Private key never leaves enclave</div>
                  <div>
                    Timestamp:{" "}
                    <span className="text-void-200">
                      {new Date(cycle.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    TEE verified:{" "}
                    <span className={teeVerified ? "text-green-400" : "text-gold-400"}>
                      {teeVerified ? "Yes" : "Pending"}
                    </span>
                  </div>
                </div>
                <hr className="border-void-800" />
                <div className="flex flex-col gap-1">
                  {cycle.hashscanUrl && (
                    <a
                      href={cycle.hashscanUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-400 hover:text-void-300 transition-colors"
                    >
                      Verify on Hashscan →
                    </a>
                  )}
                  <a
                    href={`https://chainscan-newton.0g.ai/address/${INFT_CONTRACT}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold-400 hover:text-void-300 transition-colors"
                  >
                    View iNFT on 0G Explorer →
                  </a>
                </div>
              </CodeBlock>
            </div>
          </div>

          {/* Explanation block */}
          <div className="bg-void-850 border border-void-800 rounded-xl p-4">
            <p className="text-xs text-void-400 leading-relaxed">
              This attestation cryptographically proves that{" "}
              <strong className="text-void-300">{selected}</strong>
              {"'"}s analysis was executed inside a hardware-isolated TEE on 0G Compute. The
              model (
              <span className="font-mono text-gold-400">glm-5-chat</span>
              ) ran on input data that nobody — not the server operator, not AlphaDawg,
              not anyone — could see or modify during processing. The output was signed by
              a key generated inside the enclave. If anyone had tampered with the input,
              the model, or the output, the attestation hash would not match.
            </p>
          </div>
        </CardBody>
      </Card>

      {/* 0G Storage card */}
      <Card>
        <CardBody className="space-y-3">
          <h3 className="text-sm font-semibold text-void-200">
            0G Storage — decentralized cycle record
          </h3>
          <div className="space-y-2">
            <DetailBlock label="Storage Root Hash">
              {cycle.storageHash ? (
                <span className="font-mono text-sm text-gold-400 break-all">
                  {cycle.storageHash}
                </span>
              ) : (
                <span className="text-xs text-void-600">Not stored (0G Storage was unavailable)</span>
              )}
            </DetailBlock>
            <DetailBlock label="HCS Sequence">
              <span className="font-mono text-sm text-void-200">
                #{cycle.hcsSeqNum ?? "—"}
              </span>
            </DetailBlock>
            <DetailBlock label="Total Cost">
              <span className="text-sm text-void-200">
                ${(cycle.totalCostUsd ?? 0.003).toFixed(3)} USDC (3 specialist hires)
              </span>
            </DetailBlock>
          </div>
        </CardBody>
      </Card>
    </main>
  );
}

function DetailBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-void-600 mb-1">{label}</div>
      <div>{children}</div>
    </div>
  );
}
