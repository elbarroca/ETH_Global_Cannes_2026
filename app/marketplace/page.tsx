"use client";

import { useState } from "react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge, ZeroGBadge } from "@/components/ui/badge";
import { MOCK_AGENTS } from "@/lib/mock-data";
import type { Agent } from "@/lib/types";

export default function MarketplacePage() {
  const [agents, setAgents] = useState<Agent[]>(MOCK_AGENTS);
  const [hiring, setHiring] = useState<string | null>(null);

  const active = agents.filter((a) => a.isActive);
  const community = agents.filter((a) => !a.isActive);

  async function handleHire(name: string) {
    setHiring(name);
    await new Promise((r) => setTimeout(r, 1000));
    setAgents((prev) =>
      prev.map((a) => (a.name === name ? { ...a, isActive: true } : a))
    );
    setHiring(null);
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-5 space-y-6">
      {/* Your swarm */}
      <section className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Your swarm
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Agents your Main Agent currently hires
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-purple-50 text-purple-700">
            Your Main Agent: iNFT #0846 on 0G Chain
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {active.map((agent) => (
            <ActiveAgentCard key={agent.name} agent={agent} />
          ))}
        </div>
      </section>

      {/* Marketplace */}
      <section className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Marketplace
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Community-built specialists — each minted as iNFT on 0G Chain
            </p>
          </div>
          <button className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-colors">
            Deploy your own agent
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {community.map((agent) => (
            <CommunityAgentCard
              key={agent.name}
              agent={agent}
              hiring={hiring === agent.name}
              onHire={() => handleHire(agent.name)}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function ActiveAgentCard({ agent }: { agent: Agent }) {
  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-center justify-between">
          <ZeroGBadge />
          <Badge variant="green">active</Badge>
        </div>

        <div>
          <div className="text-2xl mb-1">{agent.emoji}</div>
          <div className="font-semibold text-gray-900">
            {agent.name}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">{agent.skill}</div>
        </div>

        <div className="text-xs font-mono text-purple-600">
          iNFT {agent.inftId} · 0G Chain
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-emerald-600 font-medium">
            {agent.accuracy}% accurate
          </span>
          <span className="text-gray-400">{agent.timesHired} hires</span>
        </div>

        <div className="text-xs text-gray-400">
          Inference:{" "}
          <span className="text-purple-600 font-mono">
            {agent.model}
          </span>{" "}
          via 0G Sealed
        </div>

        <hr className="border-gray-100" />

        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-gray-700">
            ${agent.pricePerQuery.toFixed(3)}/query
          </span>
          <span className="text-gray-400">Paid via Arc USDC</span>
        </div>
      </CardBody>
    </Card>
  );
}

function CommunityAgentCard({
  agent,
  hiring,
  onHire,
}: {
  agent: Agent;
  hiring: boolean;
  onHire: () => void;
}) {
  return (
    <Card>
      <CardBody className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-2xl">{agent.emoji}</span>
          <ZeroGBadge />
        </div>

        <div>
          <div className="font-semibold text-gray-900">
            {agent.name}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">{agent.skill}</div>
        </div>

        <div className="text-xs font-mono text-purple-600">
          iNFT {agent.inftId}
        </div>

        <div className="text-xs font-mono text-gray-400">{agent.creator}</div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-emerald-600 font-medium">
            {agent.accuracy}% accurate
          </span>
          <span className="text-gray-400">{agent.timesHired} hires</span>
        </div>

        <hr className="border-gray-100" />

        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-gray-700">
            ${agent.pricePerQuery.toFixed(3)}/query
          </span>
          <button
            onClick={onHire}
            disabled={hiring}
            className="px-3 py-1 bg-gray-900 text-white text-xs font-medium rounded-lg hover:opacity-80 disabled:opacity-50 transition-opacity"
          >
            {hiring ? "Hiring…" : "Hire"}
          </button>
        </div>
      </CardBody>
    </Card>
  );
}
