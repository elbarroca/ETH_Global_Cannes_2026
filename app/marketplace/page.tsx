"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge, ZeroGBadge } from "@/components/ui/badge";
import { MOCK_AGENTS } from "@/lib/mock-data";
import { getLeaderboard, getMyAgents, hireAgent, fireAgent } from "@/lib/api";
import type { Agent } from "@/lib/types";
import type { HiredAgent } from "@/lib/api";
import { useUser } from "@/contexts/user-context";

const NAME_MAP: Record<string, string> = {
  sentiment: "SentimentBot",
  whale: "WhaleEye",
  momentum: "MomentumX",
};

const EMOJI_MAP: Record<string, string> = {
  sentiment: "\uD83E\uDDE0",
  whale: "\uD83D\uDC0B",
  momentum: "\uD83D\uDCC8",
};

export default function MarketplacePage() {
  const { userId } = useUser();
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [myAgents, setMyAgents] = useState<HiredAgent[]>([]);
  const [loadingPack, setLoadingPack] = useState(true);
  const [loadingMarketplace, setLoadingMarketplace] = useState(true);
  const [hiringName, setHiringName] = useState<string | null>(null);
  const [firingName, setFiringName] = useState<string | null>(null);

  const myAgentNames = new Set(myAgents.map((a) => a.name));

  const fetchMyAgents = useCallback(async () => {
    if (!userId) return;
    try {
      const agents = await getMyAgents(userId);
      setMyAgents(agents);
    } catch {
      setMyAgents([]);
    } finally {
      setLoadingPack(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchMyAgents();
  }, [fetchMyAgents]);

  useEffect(() => {
    getLeaderboard()
      .then((entries) => {
        const mapped: Agent[] = entries.map((e) => ({
          name: NAME_MAP[e.name] ?? e.name,
          emoji: EMOJI_MAP[e.name] ?? "\uD83E\uDD16",
          skill: e.tags.join(", ") || "Analysis",
          accuracy: e.accuracy,
          timesHired: e.totalHires,
          pricePerQuery: parseFloat(e.price.replace("$", "")) || 0.001,
          inftId: `#${String(e.totalHires).padStart(4, "0")}`,
          model: "glm-5-chat",
          provider: "0G Sealed TEE",
          creator: "AlphaDawg",
          isActive: e.active,
        }));
        setAllAgents(mapped);
      })
      .catch(() => {
        setAllAgents(MOCK_AGENTS);
      })
      .finally(() => setLoadingMarketplace(false));
  }, []);

  // Combine leaderboard + mock community agents for marketplace display
  const communityAgents = MOCK_AGENTS.filter((a) => !a.isActive);
  const marketplaceAgents = [
    ...allAgents.filter((a) => !myAgentNames.has(a.name) && !myAgentNames.has(NAME_MAP[a.name] ?? "")),
    ...communityAgents,
  ];

  // Build "Your Pack" from real hired agents, enriched with display data
  const packCards: Agent[] = myAgents.map((h) => {
    const displayName = NAME_MAP[h.name] ?? h.name;
    const mock = MOCK_AGENTS.find((m) => m.name === displayName);
    return {
      name: displayName,
      emoji: EMOJI_MAP[h.name] ?? mock?.emoji ?? "\uD83E\uDD16",
      skill: h.tags.join(", ") || mock?.skill || "Analysis",
      accuracy: h.correctCalls > 0 ? Math.round((h.correctCalls / h.totalHires) * 100) : mock?.accuracy ?? 75,
      timesHired: h.totalHires,
      pricePerQuery: parseFloat(h.price.replace("$", "")) || 0.001,
      inftId: mock?.inftId ?? `#${String(h.totalHires).padStart(4, "0")}`,
      model: "glm-5-chat",
      provider: "0G Sealed TEE",
      creator: "AlphaDawg",
      isActive: true,
    };
  });

  async function handleHire(agentDisplayName: string) {
    if (!userId) return;
    // Reverse-map display name to registry name
    const registryName = Object.entries(NAME_MAP).find(([, v]) => v === agentDisplayName)?.[0] ?? agentDisplayName;
    setHiringName(agentDisplayName);
    try {
      await hireAgent(userId, registryName);
      await fetchMyAgents();
    } catch (err) {
      console.error("[marketplace] Hire failed:", err);
    } finally {
      setHiringName(null);
    }
  }

  async function handleFire(agentDisplayName: string) {
    if (!userId) return;
    const registryName = Object.entries(NAME_MAP).find(([, v]) => v === agentDisplayName)?.[0] ?? agentDisplayName;
    setFiringName(agentDisplayName);
    try {
      await fireAgent(userId, registryName);
      await fetchMyAgents();
    } catch (err) {
      console.error("[marketplace] Fire failed:", err);
    } finally {
      setFiringName(null);
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-5 py-5 space-y-6">
      {/* Your pack */}
      <section className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-void-100">Your pack</h2>
            <p className="text-sm text-void-500 mt-0.5">
              Specialists your Lead Dawg currently hires
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-void-800/60 text-void-400 border border-void-700/40">
            Lead Dawg: iNFT #0846 on 0G Chain
          </span>
        </div>

        {loadingPack ? (
          <div className="text-sm text-void-500 py-8 text-center">Loading pack...</div>
        ) : packCards.length === 0 ? (
          <div className="text-sm text-void-500 py-8 text-center border border-dashed border-void-700 rounded-xl">
            No agents hired yet. Hire specialists from the marketplace below to start hunting.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {packCards.map((agent) => (
              <ActiveAgentCard
                key={agent.name}
                agent={agent}
                firing={firingName === agent.name}
                onFire={() => handleFire(agent.name)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Marketplace */}
      <section className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-void-100">Marketplace</h2>
            <p className="text-sm text-void-500 mt-0.5">
              Community-built specialists — minted as iNFTs on 0G
            </p>
          </div>
          <button className="px-4 py-2.5 bg-gold-400/10 hover:bg-gold-400/20 text-gold-400 border border-gold-400/20 text-sm font-medium rounded-xl transition-colors">
            Deploy your agent
          </button>
        </div>

        {loadingMarketplace ? (
          <div className="text-sm text-void-500 py-8 text-center">Loading marketplace...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {marketplaceAgents.map((agent) => (
              <CommunityAgentCard
                key={agent.name}
                agent={agent}
                hired={myAgentNames.has(agent.name) || myAgentNames.has(Object.entries(NAME_MAP).find(([, v]) => v === agent.name)?.[0] ?? "")}
                hiring={hiringName === agent.name}
                onHire={() => handleHire(agent.name)}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function ActiveAgentCard({
  agent,
  firing,
  onFire,
}: {
  agent: Agent;
  firing: boolean;
  onFire: () => void;
}) {
  return (
    <Card className="agent-card">
      <CardBody className="space-y-3">
        <div className="flex items-center justify-between">
          <ZeroGBadge />
          <Badge variant="green">active</Badge>
        </div>

        <div>
          <div className="text-2xl mb-1">{agent.emoji}</div>
          <div className="font-semibold text-sm text-void-200">{agent.name}</div>
          <div className="text-xs text-void-500 mt-0.5">{agent.skill}</div>
        </div>

        <div className="text-xs font-mono text-void-500">
          iNFT {agent.inftId} · 0G Chain
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-green-400 font-medium">{agent.accuracy}% accurate</span>
          <span className="text-void-500">{agent.timesHired} hires</span>
        </div>

        <div className="text-xs text-void-600">
          Model: <span className="text-void-400 font-mono">{agent.model}</span> via 0G Sealed
        </div>

        <hr className="border-void-800" />

        <div className="flex items-center justify-between text-xs">
          <span className="font-mono font-semibold text-void-200">
            ${agent.pricePerQuery.toFixed(3)}/query
          </span>
          <div className="flex items-center gap-2">
            <span className="text-blue-400">Paid via Arc USDC</span>
            <button
              onClick={onFire}
              disabled={firing}
              className="px-2 py-0.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800/30 text-xs rounded-md disabled:opacity-50 transition-colors"
            >
              {firing ? "Firing..." : "Fire"}
            </button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function CommunityAgentCard({
  agent,
  hired,
  hiring,
  onHire,
}: {
  agent: Agent;
  hired: boolean;
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
          <div className="font-semibold text-sm text-void-200">{agent.name}</div>
          <div className="text-xs text-void-500 mt-0.5">{agent.skill}</div>
        </div>

        <div className="text-xs font-mono text-void-500">iNFT {agent.inftId}</div>
        <div className="text-xs font-mono text-void-600">{agent.creator}</div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-green-400 font-medium">{agent.accuracy}% accurate</span>
          <span className="text-void-500">{agent.timesHired} hires</span>
        </div>

        <hr className="border-void-800" />

        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-semibold text-gold-400">
            ${agent.pricePerQuery.toFixed(3)}/query
          </span>
          {hired ? (
            <span className="px-3 py-1 bg-green-900/20 text-green-400 text-xs font-medium rounded-lg border border-green-800/30">
              Hired
            </span>
          ) : (
            <button
              onClick={onHire}
              disabled={hiring}
              className="px-3 py-1 bg-blood-600 hover:bg-blood-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {hiring ? "Hiring..." : "Hire"}
            </button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
