"use client";

import { useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
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
    <main className="max-w-7xl mx-auto px-5 py-5 space-y-6">
      {/* Your pack */}
      <section className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-void-100">
              Your pack
            </h2>
            <p className="text-sm text-void-500 mt-0.5">
              Specialists your Lead Dawg currently hires
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-void-800/60 text-void-400 border border-void-700/40">
            Lead Dawg: iNFT #0846 on 0G Chain
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {active.map((agent) => (
            <ActiveAgentCard key={agent.name} agent={agent} />
          ))}
        </div>
      </section>

      {/* Marketplace */}
      <section className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-void-100">
              Marketplace
            </h2>
            <p className="text-sm text-void-500 mt-0.5">
              Community-built specialists — minted as iNFTs on 0G
            </p>
          </div>
          <button className="px-4 py-2.5 bg-gold-400/10 hover:bg-gold-400/20 text-gold-400 border border-gold-400/20 text-sm font-medium rounded-xl transition-colors">
            Deploy your agent
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
    <Card className="agent-card">
      <CardBody className="space-y-3">
        <div className="flex items-center justify-between">
          <ZeroGBadge />
          <Badge variant="green">active</Badge>
        </div>

        <div>
          <div className="text-2xl mb-1">{agent.emoji}</div>
          <div className="font-semibold text-sm text-void-200">
            {agent.name}
          </div>
          <div className="text-xs text-void-500 mt-0.5">{agent.skill}</div>
        </div>

        <div className="text-xs font-mono text-void-500">
          iNFT {agent.inftId} · 0G Chain
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-green-400 font-medium">
            {agent.accuracy}% accurate
          </span>
          <span className="text-void-500">{agent.timesHired} hires</span>
        </div>

        <div className="text-xs text-void-600">
          Model:{" "}
          <span className="text-void-400 font-mono">
            {agent.model}
          </span>{" "}
          via 0G Sealed
        </div>

        <hr className="border-void-800" />

        <div className="flex items-center justify-between text-xs">
          <span className="font-mono font-semibold text-void-200">
            ${agent.pricePerQuery.toFixed(3)}/query
          </span>
          <span className="text-blue-400">Paid via Arc USDC</span>
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
    <Card className="agent-card hover:border-blood-800/50">
      <CardBody className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-2xl">{agent.emoji}</span>
          <ZeroGBadge />
        </div>

        <div>
          <div className="font-semibold text-sm text-void-200">
            {agent.name}
          </div>
          <div className="text-xs text-void-500 mt-0.5">{agent.skill}</div>
        </div>

        <div className="text-xs font-mono text-void-500">
          iNFT {agent.inftId}
        </div>

        <div className="text-xs font-mono text-void-600">{agent.creator}</div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-green-400 font-medium">
            {agent.accuracy}% accurate
          </span>
          <span className="text-void-500">{agent.timesHired} hires</span>
        </div>

        <hr className="border-void-800" />

        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-semibold text-gold-400">
            ${agent.pricePerQuery.toFixed(3)}/query
          </span>
          <button
            onClick={onHire}
            disabled={hiring}
            className="px-3 py-1 bg-blood-600 hover:bg-blood-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors"
          >
            {hiring ? "Hiring…" : "Hire"}
          </button>
        </div>
      </CardBody>
    </Card>
  );
}
