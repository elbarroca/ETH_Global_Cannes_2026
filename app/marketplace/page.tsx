"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge, ZeroGBadge } from "@/components/ui/badge";
import { DawgSpinner } from "@/components/dawg-spinner";
import { CreateAgentModal } from "@/components/create-agent-modal";
import { getLeaderboard, getMyAgents, hireAgent, fireAgent } from "@/lib/api";
import type {
  Agent,
  SwarmHealthResponse,
  MarketplaceEarningsResponse,
  SwarmHealthState,
} from "@/lib/types";
import type { HiredAgent } from "@/lib/api";
import { useUser } from "@/contexts/user-context";
import { agentLabel, agentEmoji } from "@/lib/swarm-endpoints";
import { arcAddressUrl, inftTokenUrl } from "@/lib/links";

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
  online: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]",
  waking: "bg-gold-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] animate-pulse",
  offline: "bg-blood-500",
  timeout: "bg-blood-600",
};

const HEALTH_LABEL: Record<SwarmHealthState, string> = {
  online: "online",
  waking: "waking",
  offline: "offline",
  timeout: "timeout",
};

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
  const [showCreateAgent, setShowCreateAgent] = useState(false);

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

  const myAgentNames = useMemo(
    () => new Set(myAgents.map((a) => a.name)),
    [myAgents],
  );

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

  const fetchLeaderboard = useCallback(async () => {
    try {
      const entries = await getLeaderboard();
      const mapped: Agent[] = entries.map((e) => ({
        name: agentLabel(e.name),
        registryName: e.name,
        emoji: agentEmoji(e.name),
        skill: e.tags.join(", ") || "Analysis",
        accuracy: e.accuracy,
        timesHired: e.totalHires,
        reputation: e.reputation,
        pricePerQuery: parseFloat(e.price.replace("$", "")) || 0.001,
        // Canonical: either a real ERC-7857 token ID from marketplace_agents
        // or `null`. Callers render "Not minted" for null. We DO NOT
        // fabricate an ID from totalHires anymore — that was misleading.
        inftId: e.inftTokenId != null ? `#${e.inftTokenId}` : "",
        inftTokenId: e.inftTokenId ?? null,
        storageRootHash: e.storageRootHash ?? null,
        storageUri: e.storageUri ?? null,
        model: "glm-5-chat",
        provider: "0G Sealed TEE",
        creator: "AlphaDawg",
        isActive: e.active,
        walletAddress: e.walletAddress ?? undefined,
        lastHireAt: e.lastHireAt,
      }));
      setAllAgents(mapped);
      setLeaderboardFailed(false);
    } catch {
      // Surface the failure honestly instead of silently substituting mock data.
      setAllAgents([]);
      setLeaderboardFailed(true);
    } finally {
      setLoadingMarketplace(false);
    }
  }, []);

  useEffect(() => {
    void fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Marketplace shows ONLY real agents from the leaderboard.
  // Previously this was silently padded with MOCK_AGENTS community entries,
  // which made it impossible for judges to tell real agents from fixtures.
  const marketplaceAgents = allAgents.filter(
    (a) => !myAgentNames.has(a.registryName ?? a.name),
  );

  // Build "Your Pack" from real hired agents. No mock enrichment — the display
  // name/emoji lookups above already cover every known specialist.
  const packCards: Agent[] = myAgents.map((h) => ({
    name: agentLabel(h.name),
    registryName: h.name,
    emoji: agentEmoji(h.name),
    skill: h.tags.join(", ") || "Analysis",
    accuracy: h.correctCalls > 0 ? Math.round((h.correctCalls / h.totalHires) * 100) : 75,
    timesHired: h.totalHires,
    reputation: h.reputation ?? 500,
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

  // ── Hero stats (derived from live data) ───────────────────────────────
  const packSize = packCards.length;
  const packEarningsUsd = packCards.reduce((sum, a) => {
    const amount = getEarnings(a.registryName)?.totalUsd ?? 0;
    return sum + amount;
  }, 0);
  const swarmOnline = health?.summary.online ?? 0;
  const swarmTotal = health?.summary.total ?? 0;
  const availableCount = marketplaceAgents.length;

  // Top-5 ELO standings — drawn from the same leaderboard fetch so the strip
  // at the top of the marketplace is always coherent with the cards below.
  const leaderboardStandings = [...allAgents]
    .sort((a, b) => b.reputation - a.reputation)
    .slice(0, 5);

  return (
    <main className="max-w-7xl mx-auto px-5 py-6 space-y-6">
      {/* ── HERO — Nasdaq LED marketplace board ─────────────────────── */}
      <section
        className="nasdaq-led nasdaq-scanlines relative overflow-hidden rounded-2xl border-2 border-dawg-500/60 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_10px_50px_-10px_rgba(255,199,0,0.35)]"
        aria-label="AlphaDawg specialist marketplace board"
      >
        <div className="h-[3px] w-full bg-gradient-to-r from-transparent via-dawg-500 to-transparent" />
        <div className="nasdaq-dot-matrix pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />

        <div className="relative">
          {/* Row 1: exchange strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dawg-500/20 px-5 py-2 text-xs uppercase">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#39FF7A] opacity-60" />
                  <span className="nasdaq-led-green relative inline-flex h-2.5 w-2.5 rounded-full bg-[#39FF7A]" />
                </span>
                <span className="nasdaq-led-green text-[18px] leading-none">LIVE</span>
              </span>
              <span className="nasdaq-led-dim text-[18px] leading-none">||</span>
              <span className="text-[18px] leading-none">
                PACK
                <span className="nasdaq-led-dim mx-2">·</span>
                <span className="nasdaq-led-bright">SPECIALIST MARKETPLACE</span>
              </span>
              <span className="nasdaq-led-dim text-[18px] leading-none">||</span>
              <span className="nasdaq-led-dim hidden text-[16px] leading-none md:inline">
                ERC-7857 · 0G CHAIN · X402 PAYWALLS
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="nasdaq-led-dim text-[16px] leading-none tabular-nums">
                {user?.inftTokenId != null ? `LEAD DAWG #${user.inftTokenId}` : "LEAD DAWG · UNMINTED"}
              </span>
            </div>
          </div>

          {/* Row 2: headline + metric tiles */}
          <div className="grid grid-cols-1 gap-6 px-5 py-6 md:grid-cols-[auto_1fr] md:items-end md:gap-10">
            <div>
              <div className="nasdaq-led-dim text-[18px] uppercase leading-none tracking-[0.22em]">
                HIRE YOUR PACK
              </div>
              <div className="mt-2">
                <span className="nasdaq-led-bright text-[56px] leading-[0.85] md:text-[80px]">
                  PACK
                </span>
              </div>
              <p className="mt-3 max-w-md text-[13px] leading-relaxed text-void-400">
                Every specialist is an iNFT with a TEE-sealed inference
                endpoint, an x402 paywall, and an on-chain ELO score. Vote on
                each hunt to move the standings.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <LedMarketTile
                label="YOUR PACK"
                value={loadingPack ? "—" : String(packSize)}
                sub="SPECIALISTS HIRED"
                tone="bright"
              />
              <LedMarketTile
                label="PACK EARNED"
                value={
                  loadingPack
                    ? "—"
                    : packEarningsUsd > 0
                      ? `$${packEarningsUsd.toFixed(3)}`
                      : "$0.000"
                }
                sub="CUMULATIVE USDC"
                tone="green"
              />
              <LedMarketTile
                label="SWARM ONLINE"
                value={swarmTotal > 0 ? `${swarmOnline}/${swarmTotal}` : "—"}
                sub="LIVE ON FLY.IO"
                tone={swarmOnline === swarmTotal && swarmTotal > 0 ? "green" : "bright"}
              />
              <LedMarketTile
                label="AVAILABLE"
                value={loadingMarketplace ? "—" : String(availableCount)}
                sub="TO HIRE NOW"
                tone="bright"
              />
            </div>
          </div>

          {/* Row 3: Top-5 ELO standings (pixel leaderboard) */}
          {leaderboardStandings.length > 0 && (
            <div className="border-t border-dawg-500/20 bg-black/40 px-5 py-3">
              <div className="mb-2 flex items-center gap-2 text-[12px] uppercase tracking-[0.2em]">
                <span className="nasdaq-led-dim">TOP ELO STANDINGS</span>
                <span className="nasdaq-led-dim">·</span>
                <span className="nasdaq-led-bright">LEAGUE LEADERS</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
                {leaderboardStandings.map((agent, idx) => {
                  const rankTone =
                    idx === 0
                      ? "nasdaq-led-bright"
                      : idx === 1
                        ? "nasdaq-led-green"
                        : "nasdaq-led-dim";
                  return (
                    <div
                      key={agent.registryName ?? agent.name}
                      className="flex items-center gap-2 rounded-md border border-dawg-500/20 bg-black/60 px-2.5 py-1.5"
                    >
                      <span className={`font-pixel text-[18px] leading-none ${rankTone}`}>
                        #{idx + 1}
                      </span>
                      <span className="text-base">{agent.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-semibold text-void-200">
                          {agent.name}
                        </div>
                        <div className="font-pixel text-[14px] leading-none tabular-nums nasdaq-led-bright">
                          {agent.reputation}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── YOUR PACK ────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          title="Your pack"
          subtitle="Specialists your Lead Dawg currently hires"
          count={loadingPack ? null : packSize}
          right={
            <span className="inline-flex items-center gap-1.5 rounded-md border border-void-700/50 bg-void-800/60 px-2.5 py-1 font-mono text-[11px] text-void-400">
              <span className="h-1.5 w-1.5 rounded-full bg-dawg-400" />
              {user?.inftTokenId != null
                ? `Lead Dawg · iNFT #${user.inftTokenId}`
                : "Lead Dawg · not minted"}
            </span>
          }
        />

        {loadingPack ? (
          <EmptyState>
            <DawgSpinner size={56} label="Loading your pack…" />
          </EmptyState>
        ) : packCards.length === 0 ? (
          <EmptyState>
            <div className="text-sm text-void-400">
              No agents hired yet.
              <br />
              <span className="text-void-600">
                Pick one from the marketplace below to start hunting.
              </span>
            </div>
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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

      {/* ── MARKETPLACE ──────────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          title="Marketplace"
          subtitle="Community-built specialists — minted as iNFTs on 0G"
          count={loadingMarketplace ? null : availableCount}
          right={
            <button
              onClick={() => setShowCreateAgent(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-gold-400/20 bg-gold-400/10 px-4 py-2 text-sm font-medium text-gold-400 transition-colors hover:border-gold-400/40 hover:bg-gold-400/20"
            >
              <span className="text-base leading-none">+</span>
              <span>Deploy your agent</span>
            </button>
          }
        />

        {loadingMarketplace ? (
          <EmptyState>
            <DawgSpinner size={56} label="Scanning marketplace…" />
          </EmptyState>
        ) : leaderboardFailed ? (
          <EmptyState>
            <div className="text-sm text-void-400">
              Leaderboard API unavailable.
              <br />
              <span className="text-void-600">
                Cannot load community specialists right now.
              </span>
            </div>
          </EmptyState>
        ) : marketplaceAgents.length === 0 ? (
          <EmptyState>
            <div className="text-sm text-void-400">
              All available specialists are hired.
              <br />
              <span className="text-void-600">Check back after the next deploy.</span>
            </div>
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

      {showCreateAgent && (
        <CreateAgentModal
          createdBy={user?.proxyWallet?.address ?? userId ?? null}
          onClose={() => setShowCreateAgent(false)}
          onCreated={() => {
            // Refetch the leaderboard so the newly deployed agent shows up
            // in the Marketplace grid. The modal closes itself on "Close".
            void fetchLeaderboard();
          }}
        />
      )}
    </main>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────

type LedTone = "bright" | "green" | "dim";

/**
 * LED tile that matches the dashboard Nasdaq hero — same pixelated
 * font, same glow colors, same black panel. Used in the marketplace hero
 * metric grid so both surfaces share one visual language.
 */
function LedMarketTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: LedTone;
}) {
  const valueClass: Record<LedTone, string> = {
    bright: "nasdaq-led-bright",
    green: "nasdaq-led-green",
    dim: "nasdaq-led-dim",
  };
  return (
    <div className="rounded-lg border border-dawg-500/30 bg-black px-4 py-3 shadow-[inset_0_0_20px_rgba(255,199,0,0.04)]">
      <div className="nasdaq-led-dim text-[14px] uppercase leading-none tracking-[0.18em]">
        {label}
      </div>
      <div className={`mt-2 text-[34px] leading-[0.9] tabular-nums ${valueClass[tone]}`}>
        {value}
      </div>
      {sub && (
        <div className="nasdaq-led-dim mt-2 text-[13px] uppercase leading-none tracking-wider">
          {sub}
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  count,
  right,
}: {
  title: string;
  subtitle: string;
  count: number | null;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-void-100">{title}</h2>
          {count !== null && (
            <span className="rounded-md bg-void-800/60 px-2 py-0.5 font-mono text-[11px] text-void-400">
              {count}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-void-500">{subtitle}</p>
      </div>
      {right}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-void-800 bg-void-900/40">
      <div className="text-center">{children}</div>
    </div>
  );
}

function AgentAvatar({
  emoji,
  healthStatus,
  size = "md",
}: {
  emoji: string;
  healthStatus?: SwarmHealthState;
  size?: "md" | "lg";
}) {
  const box = size === "lg" ? "h-16 w-16 text-3xl" : "h-14 w-14 text-2xl";
  return (
    <div className="relative shrink-0">
      <div
        className={`${box} flex items-center justify-center rounded-2xl border border-dawg-500/20 bg-gradient-to-br from-dawg-500/15 via-void-900 to-void-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`}
      >
        <span className="drop-shadow-[0_2px_6px_rgba(255,199,0,0.25)]">
          {emoji}
        </span>
      </div>
      {healthStatus && (
        <span
          className={`absolute -right-1 -top-1 h-3 w-3 rounded-full ring-2 ring-void-900 ${HEALTH_DOT[healthStatus]}`}
          title={`Fly.io: ${HEALTH_LABEL[healthStatus]}`}
        />
      )}
    </div>
  );
}

/**
 * Headline ELO reputation tile + accuracy progress bar. The big pixel number
 * is the same metric the TOP ELO STANDINGS strip at the top of the page
 * shows — user thumbs up/down in hunt cards moves it in real time via
 * /api/marketplace/rate. Accuracy sits underneath as a supporting stat.
 */
function EloHeadline({
  reputation,
  accuracy,
}: {
  reputation: number;
  accuracy: number;
}) {
  const elo = Math.max(0, Math.min(1000, Math.round(reputation)));
  const eloTone =
    elo >= 700
      ? "nasdaq-led-bright"
      : elo >= 500
        ? "nasdaq-led-green"
        : "nasdaq-led-red";
  const pct = Math.max(0, Math.min(100, accuracy));
  const barTone =
    pct >= 80
      ? "bg-emerald-400"
      : pct >= 60
        ? "bg-dawg-400"
        : pct >= 40
          ? "bg-gold-500"
          : "bg-blood-500";
  return (
    <div className="rounded-xl border border-dawg-500/20 bg-black/60 p-3 shadow-[inset_0_0_20px_rgba(255,199,0,0.04)]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="nasdaq-led-dim text-[11px] uppercase tracking-[0.2em]">
          ELO
        </span>
        <span className={`font-pixel text-[32px] leading-none tabular-nums ${eloTone}`}>
          {elo}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px]">
        <span className="font-mono uppercase tracking-wider text-void-600">
          accuracy
        </span>
        <span className="font-mono font-semibold tabular-nums text-void-200">
          {pct}%
        </span>
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-void-800">
        <div
          className={`h-full ${barTone} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function InftPill({
  inftId,
  inftTokenId,
}: {
  inftId: string;
  inftTokenId: number | null | undefined;
}) {
  if (inftTokenId != null && inftId) {
    return (
      <a
        href={inftTokenUrl(inftTokenId)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center rounded-md border border-void-700/40 bg-void-800/60 px-2 py-0.5 font-mono text-[10px] text-void-400 transition-colors hover:border-dawg-500/30 hover:text-dawg-300"
        title="View iNFT on 0G Chain explorer"
      >
        iNFT {inftId}
      </a>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md border border-void-800 bg-void-900/60 px-2 py-0.5 font-mono text-[10px] text-void-600">
      iNFT · not minted
    </span>
  );
}

/**
 * 0G Storage pill — shows the Merkle root hash that the specialist's iNFT
 * points at on-chain (VaultMindAgent.encryptedURIs[tokenId] = "0g-storage://{rootHash}").
 *
 * Click to copy the full rootHash. There is no public browser explorer for
 * 0G Storage roots — the blob is retrievable programmatically via the 0G
 * indexer API. The tooltip explains this so judges know the path.
 */
function StoragePill({ rootHash }: { rootHash: string | null | undefined }) {
  if (!rootHash) {
    return (
      <span className="inline-flex items-center rounded-md border border-void-800 bg-void-900/60 px-2 py-0.5 font-mono text-[10px] text-void-600">
        0G Storage · pending
      </span>
    );
  }
  const short = `${rootHash.slice(0, 6)}…${rootHash.slice(-4)}`;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(rootHash).catch(() => {});
      }}
      className="inline-flex items-center gap-1 rounded-md border border-teal-800/40 bg-teal-950/30 px-2 py-0.5 font-mono text-[10px] text-teal-300 transition-colors hover:border-teal-500/40 hover:bg-teal-900/40"
      title={`0G Storage root: ${rootHash}\n\nClick to copy.\n\nThis hash is bound on-chain in VaultMindAgent.encryptedURIs[tokenId]. Retrievable via the 0G indexer API.`}
    >
      0G Storage {short} <span className="text-teal-500">📋</span>
    </button>
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
    <Card className="agent-card group relative overflow-hidden transition-all hover:border-dawg-500/30 hover:shadow-[0_8px_30px_-12px_rgba(255,199,0,0.25)]">
      <div
        className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-dawg-500/40 to-transparent"
        aria-hidden="true"
      />
      <CardBody className="space-y-4">
        <div className="flex items-start gap-3">
          <AgentAvatar emoji={agent.emoji} healthStatus={healthStatus} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-void-100">
                  {agent.name}
                </div>
                <div className="mt-0.5 truncate text-xs text-void-500">
                  {agent.skill}
                </div>
              </div>
              <Badge variant="green">active</Badge>
            </div>
          </div>
        </div>

        <EloHeadline reputation={agent.reputation} accuracy={agent.accuracy} />

        <div className="grid grid-cols-2 gap-2 rounded-xl border border-void-800/80 bg-void-950/40 p-2.5">
          <Stat label="hires" value={String(agent.timesHired)} />
          <Stat
            label="earned"
            value={earningsUsd != null ? `$${earningsUsd.toFixed(3)}` : "—"}
            tone="emerald"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase tracking-wider text-void-600">
              price / query
            </span>
            <span className="font-mono text-base font-semibold text-void-100 tabular-nums">
              ${agent.pricePerQuery.toFixed(3)}
            </span>
          </div>
          {firing ? (
            <div className="flex min-w-[88px] justify-center">
              <DawgSpinner size={28} label="Firing…" labelClassName="text-blood-300" />
            </div>
          ) : (
            <button
              onClick={onFire}
              className="inline-flex min-w-[88px] items-center justify-center rounded-lg border border-blood-800/40 bg-blood-900/30 px-3 py-2 text-xs font-semibold text-blood-300 transition-colors hover:bg-blood-900/50"
            >
              Fire
            </button>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-void-800/80 pt-3 text-[11px] font-mono text-void-600">
          <div className="flex flex-wrap items-center gap-1.5">
            <InftPill inftId={agent.inftId} inftTokenId={agent.inftTokenId} />
            <StoragePill rootHash={agent.storageRootHash} />
            {hireCount != null && hireCount > 0 && (
              <span>· {hireCount} calls</span>
            )}
          </div>
          {lastHire && <span className="text-void-500">{lastHire}</span>}
        </div>

        {walletShort && agent.walletAddress && (
          <div className="truncate text-[11px] font-mono text-void-600">
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
    <Card className="agent-card group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:border-dawg-500/30 hover:shadow-[0_12px_32px_-16px_rgba(255,199,0,0.35)]">
      <div
        className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-void-700 to-transparent transition-all group-hover:via-dawg-500/60"
        aria-hidden="true"
      />
      <CardBody className="space-y-4">
        <div className="flex items-start gap-3">
          <AgentAvatar emoji={agent.emoji} healthStatus={healthStatus} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-void-100">
              {agent.name}
            </div>
            <div className="mt-0.5 truncate text-xs text-void-500">
              {agent.skill}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <ZeroGBadge />
              <InftPill inftId={agent.inftId} inftTokenId={agent.inftTokenId} />
              <StoragePill rootHash={agent.storageRootHash} />
            </div>
          </div>
        </div>

        <EloHeadline reputation={agent.reputation} accuracy={agent.accuracy} />

        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 font-mono text-void-500">
            <span className="tabular-nums text-void-300">{agent.timesHired}</span>
            <span className="text-void-600">hires</span>
          </div>
          {earningsUsd != null && earningsUsd > 0 ? (
            <div className="flex items-center gap-1.5 font-mono">
              <span className="tabular-nums text-emerald-300">
                ${earningsUsd.toFixed(3)}
              </span>
              <span className="text-void-600">earned</span>
            </div>
          ) : (
            <span className="font-mono text-void-600">no fills yet</span>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-void-800/80 pt-3">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase tracking-wider text-void-600">
              price / query
            </span>
            <span className="font-mono text-base font-semibold text-gold-400 tabular-nums">
              ${agent.pricePerQuery.toFixed(3)}
            </span>
          </div>
          {hired ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-800/40 bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Hired
            </span>
          ) : hiring ? (
            <div className="flex min-w-[96px] justify-center">
              <DawgSpinner size={28} label="Hiring…" labelClassName="text-dawg-300" />
            </div>
          ) : (
            <button
              onClick={onHire}
              className="inline-flex min-w-[96px] items-center justify-center rounded-lg bg-dawg-500 px-3 py-2 text-xs font-bold text-void-950 shadow-[0_0_0_1px_rgba(255,199,0,0.3),0_8px_20px_-8px_rgba(255,199,0,0.5)] transition-all hover:bg-dawg-400 hover:shadow-[0_0_0_1px_rgba(255,199,0,0.4),0_10px_24px_-8px_rgba(255,199,0,0.6)]"
            >
              Hire
            </button>
          )}
        </div>

        {(walletShort || hireCount != null || lastHire) && (
          <div className="flex items-center justify-between text-[11px] font-mono text-void-600">
            {walletShort && agent.walletAddress ? (
              <a
                href={arcAddressUrl(agent.walletAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-dawg-400 hover:underline"
                title={agent.walletAddress}
              >
                {walletShort}
              </a>
            ) : (
              <span className="text-void-700">—</span>
            )}
            {lastHire && <span>{lastHire}</span>}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "emerald";
}) {
  const valueTone =
    tone === "emerald" ? "text-emerald-300" : "text-void-100";
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-void-600">
        {label}
      </div>
      <div className={`mt-0.5 font-mono text-sm font-semibold tabular-nums ${valueTone}`}>
        {value}
      </div>
    </div>
  );
}
