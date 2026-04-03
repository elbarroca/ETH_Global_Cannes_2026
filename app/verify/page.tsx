"use client";

import { useState } from "react";
import { Card, CardBody, CodeBlock } from "@/components/ui/card";
import { Badge, SealedBadge, ZeroGBadge } from "@/components/ui/badge";
import { MOCK_CYCLE } from "@/lib/mock-data";

type AgentKey = "SentimentBot" | "WhaleEye" | "MomentumX" | "Alpha" | "Risk" | "Executor";

const AGENTS: {
  key: AgentKey;
  emoji: string;
  type: "Specialist" | "Adversarial";
  skill: string;
  inftId: string;
  model: string;
  provider: string;
  attestation: string;
}[] = [
  {
    key: "SentimentBot",
    emoji: "🧠",
    type: "Specialist",
    skill: "Twitter + Reddit sentiment",
    inftId: "#0847",
    model: "glm-5-chat",
    provider: "0x9f2b...4a1c",
    attestation: "0xa7c3e91f8b2d34e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d42b",
  },
  {
    key: "WhaleEye",
    emoji: "🐋",
    type: "Specialist",
    skill: "Whale wallet movements",
    inftId: "#0848",
    model: "glm-5-chat",
    provider: "0x9f2b...4a1c",
    attestation: "0xb8d4f02a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9c1e3f73c",
  },
  {
    key: "MomentumX",
    emoji: "📈",
    type: "Specialist",
    skill: "RSI, MACD, volume analysis",
    inftId: "#0849",
    model: "glm-5-chat",
    provider: "0x9f2b...4a1c",
    attestation: "0xc9e5a13b2d4f6b8d0e2c4a6f8b0d2f4a6c8e0b2d4f6a8c0e2b4d6f8a0c2e4f84d",
  },
  {
    key: "Alpha",
    emoji: "🟢",
    type: "Adversarial",
    skill: "BUY 20% ETH",
    inftId: "Platform infra",
    model: "glm-5-chat",
    provider: "0x9f2b...4a1c",
    attestation: "0xd0f6b24c3e5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a5c95e",
  },
  {
    key: "Risk",
    emoji: "🔴",
    type: "Adversarial",
    skill: "HOLD. Max 10%",
    inftId: "Platform infra",
    model: "glm-5-chat",
    provider: "0x9f2b...4a1c",
    attestation: "0xe1a7c35d4f6b8d0e2c4a6f8b0d2f4a6c8e0b2d4f6a8c0e2b4d6f8a0c2e4f6a06f",
  },
  {
    key: "Executor",
    emoji: "🟡",
    type: "Adversarial",
    skill: "BUY 12% ETH. Stop -4%",
    inftId: "Platform infra",
    model: "glm-5-chat",
    provider: "0x9f2b...4a1c",
    attestation: "0xf2b8d46e5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a5c7e17a",
  },
];

export default function VerifyPage() {
  const [selected, setSelected] = useState<AgentKey>("SentimentBot");
  const agent = AGENTS.find((a) => a.key === selected)!;
  const cycle = MOCK_CYCLE;

  return (
    <main className="max-w-6xl mx-auto px-4 py-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            0G verification — cycle #{cycle.id}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Every inference runs inside a TEE hardware enclave on 0G Compute
          </p>
        </div>
        <ZeroGBadge label="6 sealed inference calls" />
      </div>

      {/* Agent selector */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {AGENTS.map((a) => (
          <button
            key={a.key}
            onClick={() => setSelected(a.key)}
            className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-center transition-all ${
              selected === a.key
                ? "bg-purple-50 border-purple-500 text-purple-700"
                : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            <span className="text-xl">{a.emoji}</span>
            <span className="text-xs font-medium leading-tight">{a.key}</span>
            <span className="text-xs text-gray-400">{a.type}</span>
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
                  <span className="font-semibold text-gray-900">
                    {agent.key}
                  </span>
                  <Badge variant="gray">{agent.type}</Badge>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{agent.skill}</p>
              </div>
            </div>
            <SealedBadge />
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Agent details */}
            <div className="space-y-3">
              <DetailBlock label="0G Compute Provider">
                <span className="font-mono text-sm text-gray-700">
                  {agent.provider}
                </span>
              </DetailBlock>
              <DetailBlock label="Model">
                <span className="font-mono text-sm text-gray-700">
                  {agent.model}
                </span>
              </DetailBlock>
              <DetailBlock label="iNFT Identity">
                {agent.inftId === "Platform infra" ? (
                  <span className="text-sm text-gray-500">Platform infra</span>
                ) : (
                  <span className="font-mono text-sm text-purple-600">
                    {agent.inftId} on 0G Chain
                  </span>
                )}
              </DetailBlock>
              <DetailBlock label="Execution Environment">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">
                    Intel TDX + NVIDIA H100 TEE
                  </span>
                  <Badge variant="green">Hardware isolated</Badge>
                </div>
              </DetailBlock>
            </div>

            {/* Right: TEE Attestation */}
            <div>
              <CodeBlock className="space-y-2">
                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">
                    Attestation hash
                  </div>
                  <div className="text-purple-600 break-all">
                    {agent.attestation}
                  </div>
                </div>
                <hr className="border-gray-200" />
                <div className="space-y-1 text-gray-500">
                  <div>Signature: Ed25519</div>
                  <div>Key generated inside TEE</div>
                  <div>Private key never leaves enclave</div>
                  <div>
                    Timestamp:{" "}
                    <span className="text-gray-700">
                      {cycle.timestamp}
                    </span>
                  </div>
                </div>
                <hr className="border-gray-200" />
                <a
                  href="#"
                  className="text-purple-600 hover:text-purple-700 transition-colors"
                >
                  Verify on 0G Explorer →
                </a>
              </CodeBlock>
            </div>
          </div>

          {/* Explanation block */}
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
            <p className="text-xs text-gray-600 leading-relaxed">
              This attestation cryptographically proves that{" "}
              <strong className="text-gray-800">{agent.key}</strong>
              's analysis was executed inside a hardware-isolated TEE on 0G Compute. The
              model (
              <span className="font-mono text-purple-600">
                {agent.model}
              </span>
              ) ran on input data that nobody — not the server operator, not VaultMind,
              not anyone — could see or modify during processing. The output was signed by
              a key generated inside the enclave. If anyone had tampered with the input,
              the model, or the output, the attestation hash would not match. You can
              verify this independently on the 0G Explorer.
            </p>
          </div>
        </CardBody>
      </Card>

      {/* Memory card */}
      <Card>
        <CardBody className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">
            0G storage — agent memory used this cycle
          </h3>
          <div className="space-y-2.5">
            {cycle.memory.map((m) => (
              <div key={m.cycleRef} className="flex gap-2">
                <span className="font-mono text-xs text-purple-600 shrink-0 pt-0.5">
                  #{m.cycleRef}
                </span>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {m.text}
                </p>
              </div>
            ))}
          </div>
          <a
            href="#"
            className="text-xs text-purple-600 hover:text-purple-700 transition-colors"
          >
            View full memory on 0G Storage →
          </a>
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
      <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">{label}</div>
      <div>{children}</div>
    </div>
  );
}
