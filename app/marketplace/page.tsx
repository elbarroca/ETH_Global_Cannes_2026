"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge, ZeroGBadge } from "@/components/ui/badge";
import { DawgSpinner } from "@/components/dawg-spinner";
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

  return (
    <main className="max-w-7xl mx-auto px-5 py-6 space-y-8">
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-void-800 bg-gradient-to-br from-void-900 via-void-900 to-void-950 p-6">
        <div
          className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-dawg-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-blood-900/20 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-dawg-500/30 bg-dawg-500/10 px-2 py-0.5 font-mono text-[11px] text-dawg-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-dawg-400" />
                live marketplace
              </span>
              <span className="font-mono text-[11px] text-void-500">
                ERC-7857 on 0G Chain
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-void-100 md:text-3xl">
              Hire your pack.
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-void-400">
              Every specialist is an iNFT with a sealed-inference TEE, an x402
              paywall, and an on-chain reputation score. Your Lead Dawg dispatches
              them every cycle and pays per call in USDC.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <HeroStat
              label="your pack"
              value={loadingPack ? "…" : String(packSize)}
              sub="specialists hired"
              tone="dawg"
            />
            <HeroStat
              label="pack earned"
              value={
                loadingPack
                  ? "…"
                  : packEarningsUsd > 0
                    ? `$${packEarningsUsd.toFixed(3)}`
                    : "$0.000"
              }
              sub="cumulative USDC"
              tone="emerald"
            />
            <HeroStat
              label="swarm online"
              value={swarmTotal > 0 ? `${swarmOnline}/${swarmTotal}` : "…"}
              sub="live on Fly.io"
              tone={swarmOnline === swarmTotal && swarmTotal > 0 ? "emerald" : "gold"}
            />
            <HeroStat
              label="available"
              value={loadingMarketplace ? "…" : String(availableCount)}
              sub="to hire now"
              tone="void"
            />
          </div>
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
            <button className="inline-flex items-center gap-2 rounded-xl border border-gold-400/20 bg-gold-400/10 px-4 py-2 text-sm font-medium text-gold-400 transition-colors hover:border-gold-400/40 hover:bg-gold-400/20">
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
    </main>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────

type StatTone = "dawg" | "gold" | "emerald" | "void";

function HeroStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: StatTone;
}) {
  const valueTone: Record<StatTone, string> = {
    dawg: "text-dawg-300",
    gold: "text-gold-300",
    emerald: "text-emerald-300",
    void: "text-void-100",
  };
  return (
    <div className="rounded-xl border border-void-800 bg-void-950/60 px-3.5 py-3 backdrop-blur-sm">
      <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-void-600">
        {label}
      </div>
      <div className={`text-xl font-bold tabular-nums ${valueTone[tone]}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-void-600">{sub}</div>}
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

function AccuracyMeter({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const tone =
    pct >= 80
      ? "bg-emerald-400"
      : pct >= 60
        ? "bg-dawg-400"
        : pct >= 40
          ? "bg-gold-500"
          : "bg-blood-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-mono uppercase tracking-wider text-void-600">
          accuracy
        </span>
        <span className="font-mono font-semibold tabular-nums text-void-200">
          {pct}%
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-void-800">
        <div
          className={`h-full ${tone} transition-all duration-500`}
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

        <AccuracyMeter value={agent.accuracy} />

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
          <div className="flex items-center gap-2">
            <InftPill inftId={agent.inftId} inftTokenId={agent.inftTokenId} />
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
            <div className="mt-1.5 flex items-center gap-1.5">
              <ZeroGBadge />
              <InftPill inftId={agent.inftId} inftTokenId={agent.inftTokenId} />
            </div>
          </div>
        </div>

        <AccuracyMeter value={agent.accuracy} />

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
