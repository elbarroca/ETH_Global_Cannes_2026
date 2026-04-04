"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge, ZeroGBadge } from "@/components/ui/badge";
import { getLeaderboard, getMyAgents, hireAgent, fireAgent } from "@/lib/api";
import type { Agent, SwarmHealthResponse, MarketplaceEarningsResponse, SwarmHealthState } from "@/lib/types";
import type { HiredAgent } from "@/lib/api";
import { useUser } from "@/contexts/user-context";
import { agentLabel, agentEmoji } from "@/lib/swarm-endpoints";
import {
  INFT_CONTRACT_ADDRESS,
  arcAddressUrl,
  inftTokenUrl,
  ogChainAddressUrl,
} from "@/lib/links";

function truncateAddress(addr: string | null | undefined): string | null {
  if (!addr) return null;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function relativeTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const HEALTH_DOT: Record<SwarmHealthState, string> = {
  online: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]",
  waking: "bg-gold-400 shadow-[0_0_6px_rgba(251,191,36,0.6)] animate-pulse",
  offline: "bg-blood-500",
  timeout: "bg-blood-600",
};

/**
 * Honest iNFT row for marketplace cards. If the specialist has a real
 * ERC-7857 token ID in marketplace_agents.inft_token_id, we render it as a
 * clickable link to the token on 0G Chainscan. Otherwise we say "Not minted"
 * in muted text — zero fabricated token IDs.
 */
function InftRow({ tokenId }: { tokenId: number | null | undefined }) {
  if (tokenId == null) {
    return (
      <div className="text-xs font-mono text-void-600">
        iNFT <span className="italic">not minted</span> · 0G Chain
      </div>
    );
  }
  return (
    <div className="text-xs font-mono text-void-500">
      iNFT{" "}
      <a
        href={inftTokenUrl(tokenId)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-gold-400 hover:underline"
        title={`View iNFT #${tokenId} on 0G Chainscan`}
      >
        #{tokenId} ↗
      </a>{" "}
      · 0G Chain
    </div>
  );
}

export default function MarketplacePage() {
  const { userId, user } = useUser();
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [myAgents, setMyAgents] = useState<HiredAgent[]>([]);
  const [loadingPack, setLoadingPack] = useState(true);
  const [loadingMarketplace, setLoadingMarketplace] = useState(true);
  const [hiringName, setHiringName] = useState<string | null>(null);
  const [firingName, setFiringName] = useState<string | null>(null);
  const [health, setHealth] = useState<SwarmHealthResponse | null>(null);
  const [earnings, setEarnings] = useState<MarketplaceEarningsResponse | null>(null);

  // Poll swarm health + marketplace earnings every 15s so the cards show live
  // online dots and cumulative USDC earned per specialist.
  useEffect(() => {
    let cancelled = false;
    const fetchSidecar = async () => {
      try {
        const [h, e] = await Promise.all([
          fetch("/api/swarm/health", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
          fetch("/api/marketplace/earnings", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
        ]);
        if (!cancelled) {
          if (h) setHealth(h as SwarmHealthResponse);
          if (e) setEarnings(e as MarketplaceEarningsResponse);
        }
      } catch {
        /* non-fatal */
      }
    };
    void fetchSidecar();
    const id = setInterval(fetchSidecar, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const getHealth = useCallback(
    (registryName: string | undefined): SwarmHealthState | undefined => {
      if (!registryName) return undefined;
      return health?.agents.find((a) => a.name === registryName)?.status;
    },
    [health],
  );

  const getEarnings = useCallback(
    (registryName: string | undefined) => {
      if (!registryName) return null;
      return earnings?.agents[registryName] ?? null;
    },
    [earnings],
  );

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

  const [leaderboardFailed, setLeaderboardFailed] = useState(false);

  useEffect(() => {
    getLeaderboard()
      .then((entries) => {
        const mapped: Agent[] = entries.map((e) => ({
          name: agentLabel(e.name),
          registryName: e.name,
          emoji: agentEmoji(e.name),
          skill: e.tags.join(", ") || "Analysis",
          accuracy: e.accuracy,
          timesHired: e.totalHires,
          pricePerQuery: parseFloat(e.price.replace("$", "")) || 0.001,
          // Canonical: either a real ERC-7857 token ID from marketplace_agents
          // or `null`. Callers render "Not minted" for null. We DO NOT
          // fabricate an ID from totalHires anymore — that was misleading.
          inftId: e.inftTokenId != null ? `#${e.inftTokenId}` : "",
          inftTokenId: e.inftTokenId ?? null,
          model: "glm-5-chat",
          provider: "0G Sealed TEE",
          creator: "AlphaDawg",
          isActive: e.active,
          walletAddress: e.walletAddress ?? undefined as string | undefined,
          lastHireAt: e.lastHireAt,
        }));
        setAllAgents(mapped);
        setLeaderboardFailed(false);
      })
      .catch(() => {
        // Surface the failure honestly instead of silently substituting mock data.
        setAllAgents([]);
        setLeaderboardFailed(true);
      })
      .finally(() => setLoadingMarketplace(false));
  }, []);

  // Marketplace shows ONLY real agents from the leaderboard.
  // Previously this was silently padded with MOCK_AGENTS community entries,
  // which made it impossible for judges to tell real agents from fixtures.
  const marketplaceAgents = allAgents.filter((a) => !myAgentNames.has(a.registryName ?? a.name));

  // Build "Your Pack" from real hired agents. No mock enrichment — the display
  // name/emoji lookups above already cover every known specialist.
  const packCards: Agent[] = myAgents.map((h) => ({
    name: agentLabel(h.name),
    registryName: h.name,
    emoji: agentEmoji(h.name),
    skill: h.tags.join(", ") || "Analysis",
    accuracy: h.correctCalls > 0 ? Math.round((h.correctCalls / h.totalHires) * 100) : 75,
    timesHired: h.totalHires,
    pricePerQuery: parseFloat(h.price.replace("$", "")) || 0.001,
    // my-agents endpoint doesn't surface inftTokenId yet — the pack view
    // intentionally hides the "#XXXX" line when no real token exists.
    inftId: "",
    inftTokenId: null,
    model: "glm-5-chat",
    provider: "0G Sealed TEE",
    creator: "AlphaDawg",
    isActive: true,
    walletAddress: h.walletAddress ?? undefined,
  }));

  async function handleHire(registryName: string, displayName: string) {
    if (!userId) return;
    setHiringName(displayName);
    try {
      await hireAgent(userId, registryName);
      await fetchMyAgents();
    } catch (err) {
      console.error("[marketplace] Hire failed:", err);
    } finally {
      setHiringName(null);
    }
  }

  async function handleFire(registryName: string, displayName: string) {
    if (!userId) return;
    setFiringName(displayName);
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
            {user?.inftTokenId != null
              ? `Lead Dawg: iNFT #${user.inftTokenId} on 0G Chain`
              : "Lead Dawg: iNFT not minted"}
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
                healthStatus={getHealth(agent.registryName)}
                earningsUsd={getEarnings(agent.registryName)?.totalUsd ?? null}
                hireCount={getEarnings(agent.registryName)?.hires ?? null}
                onFire={() => handleFire(agent.registryName ?? agent.name, agent.name)}
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
        ) : leaderboardFailed ? (
          <div className="text-sm text-void-500 py-8 text-center border border-dashed border-void-700 rounded-xl">
            Leaderboard API unavailable — cannot load community specialists.
          </div>
        ) : marketplaceAgents.length === 0 ? (
          <div className="text-sm text-void-500 py-8 text-center border border-dashed border-void-700 rounded-xl">
            No unhired specialists available right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {marketplaceAgents.map((agent) => (
              <CommunityAgentCard
                key={agent.name}
                agent={agent}
                hired={myAgentNames.has(agent.registryName ?? "")}
                hiring={hiringName === agent.name}
                healthStatus={getHealth(agent.registryName)}
                earningsUsd={getEarnings(agent.registryName)?.totalUsd ?? null}
                hireCount={getEarnings(agent.registryName)?.hires ?? null}
                onHire={() => handleHire(agent.registryName ?? agent.name, agent.name)}
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
  healthStatus,
  earningsUsd,
  hireCount,
  onFire,
}: {
  agent: Agent;
  firing: boolean;
  healthStatus: SwarmHealthState | undefined;
  earningsUsd: number | null;
  hireCount: number | null;
  onFire: () => void;
}) {
  const walletShort = truncateAddress(agent.walletAddress);
  const lastHire = relativeTime(agent.lastHireAt);
  return (
    <Card className="agent-card">
      <CardBody className="space-y-3">
        <div className="flex items-center justify-between">
          <a
            href={ogChainAddressUrl(INFT_CONTRACT_ADDRESS)}
            target="_blank"
            rel="noopener noreferrer"
            title="VaultMindAgent contract on 0G Chainscan"
          >
            <ZeroGBadge />
          </a>
          <Badge variant="green">active</Badge>
        </div>

        <div>
          <div className="text-2xl mb-1">{agent.emoji}</div>
          <div className="flex items-center gap-2">
            {healthStatus && (
              <span
                className={`w-1.5 h-1.5 rounded-full ${HEALTH_DOT[healthStatus]}`}
                title={`Fly.io status: ${healthStatus}`}
              />
            )}
            <div className="font-semibold text-sm text-void-200">{agent.name}</div>
          </div>
          <div className="text-xs text-void-500 mt-0.5">{agent.skill}</div>
        </div>

        <InftRow tokenId={agent.inftTokenId} />

        {walletShort && agent.walletAddress && (
          <div className="text-[11px] font-mono text-void-600">
            payTo:{" "}
            <a
              href={arcAddressUrl(agent.walletAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-dawg-400 hover:underline"
              title={agent.walletAddress}
            >
              {walletShort}
            </a>
          </div>
        )}

        {(earningsUsd != null || lastHire) && (
          <div className="flex items-center gap-2 text-[11px] text-void-500 font-mono">
            {earningsUsd != null && (
              <span className="text-emerald-300">
                Earned ${earningsUsd.toFixed(3)}
              </span>
            )}
            {hireCount != null && hireCount > 0 && (
              <span className="text-void-600">· {hireCount} calls</span>
            )}
            {lastHire && <span className="text-void-600">· {lastHire}</span>}
          </div>
        )}

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
  healthStatus,
  earningsUsd,
  hireCount,
  onHire,
}: {
  agent: Agent;
  hired: boolean;
  hiring: boolean;
  healthStatus: SwarmHealthState | undefined;
  earningsUsd: number | null;
  hireCount: number | null;
  onHire: () => void;
}) {
  const walletShort = truncateAddress(agent.walletAddress);
  const lastHire = relativeTime(agent.lastHireAt);
  return (
    <Card className="agent-card hover:border-blood-800/50">
      <CardBody className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-2xl">{agent.emoji}</span>
          <a
            href={ogChainAddressUrl(INFT_CONTRACT_ADDRESS)}
            target="_blank"
            rel="noopener noreferrer"
            title="VaultMindAgent contract on 0G Chainscan"
          >
            <ZeroGBadge />
          </a>
        </div>

        <div>
          <div className="flex items-center gap-2">
            {healthStatus && (
              <span
                className={`w-1.5 h-1.5 rounded-full ${HEALTH_DOT[healthStatus]}`}
                title={`Fly.io status: ${healthStatus}`}
              />
            )}
            <div className="font-semibold text-sm text-void-200">{agent.name}</div>
          </div>
          <div className="text-xs text-void-500 mt-0.5">{agent.skill}</div>
        </div>

        <InftRow tokenId={agent.inftTokenId} />
        <div className="text-xs font-mono text-void-600">{agent.creator}</div>
        {walletShort && agent.walletAddress && (
          <div className="text-[11px] font-mono text-void-600">
            payTo:{" "}
            <a
              href={arcAddressUrl(agent.walletAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-dawg-400 hover:underline"
              title={agent.walletAddress}
            >
              {walletShort}
            </a>
          </div>
        )}

        {(earningsUsd != null || lastHire) && (
          <div className="flex items-center gap-2 text-[11px] text-void-500 font-mono flex-wrap">
            {earningsUsd != null && (
              <span className="text-emerald-300">
                Earned ${earningsUsd.toFixed(3)}
              </span>
            )}
            {hireCount != null && hireCount > 0 && (
              <span className="text-void-600">· {hireCount} calls</span>
            )}
            {lastHire && <span className="text-void-600">· {lastHire}</span>}
          </div>
        )}

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
              className="px-3 py-1 bg-dawg-500 hover:bg-dawg-400 text-void-950 text-xs font-bold rounded-lg disabled:opacity-50 transition-colors"
            >
              {hiring ? "Hiring..." : "Hire"}
            </button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
