"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { PlusIcon, ShieldCheckIcon } from "@phosphor-icons/react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyableIdentifier, EvidenceStatus } from "@/components/ui/evidence";
import { DawgSpinner } from "@/components/dawg-spinner";
import { CreateAgentModal } from "@/components/create-agent-modal";
import { KernelJobDialog } from "@/components/kernel-job-dialog";
import {
  ApiError,
  fireAgent,
  getAgentLifecycle,
  getAgentRecommendations,
  getLeaderboard,
  getMyAgents,
  hireAgent,
  type AgentLifecycleVersion,
  type HiredAgent,
  type ProtectedPublishedAgent,
} from "@/lib/api";
import type {
  Agent,
  SwarmHealthResponse,
  MarketplaceEarningsResponse,
  SwarmHealthState,
} from "@/lib/types";
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
  const [legacyHireError, setLegacyHireError] = useState<string | null>(null);
  const [health, setHealth] = useState<SwarmHealthResponse | null>(null);
  const [earnings, setEarnings] = useState<MarketplaceEarningsResponse | null>(null);
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [publishedAgents, setPublishedAgents] = useState<ProtectedPublishedAgent[]>([]);
  const [draftAgents, setDraftAgents] = useState<AgentLifecycleVersion[]>([]);
  const [loadingPublished, setLoadingPublished] = useState(true);
  const [publishedError, setPublishedError] = useState<string | null>(null);
  const [selectedPublishedAgent, setSelectedPublishedAgent] = useState<ProtectedPublishedAgent | null>(null);
  const [goal, setGoal] = useState("");
  const [recommendedSkillIds, setRecommendedSkillIds] = useState<readonly string[]>([]);
  const [recommendationStatus, setRecommendationStatus] = useState<string | null>(null);
  const [recommendationBusy, setRecommendationBusy] = useState(false);

  const fetchProtectedAgents = useCallback(async () => {
    setLoadingPublished(true);
    setPublishedError(null);
    try {
      const lifecycle = await getAgentLifecycle();
      setPublishedAgents(lifecycle.agents);
      setDraftAgents(lifecycle.drafts);
    } catch (error) {
      setPublishedAgents([]);
      setPublishedError(error instanceof Error ? error.message : "Published agents could not be loaded.");
    } finally {
      setLoadingPublished(false);
    }
  }, []);

  useEffect(() => {
    void fetchProtectedAgents();
  }, [fetchProtectedAgents]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("create") === "1") setShowCreateAgent(true);
  }, []);

  async function recommendForGoal(): Promise<void> {
    const normalized = goal.toLowerCase();
    const requested = [
      ...(normalized.includes("risk") || normalized.includes("downside") ? ["risk-analysis"] : []),
      ...(normalized.includes("market") || normalized.includes("price") ? ["market-analysis"] : []),
      ...(normalized.includes("research") || normalized.includes("evidence") ? ["research"] : []),
    ];
    const bounded = requested.length > 0 ? [...new Set(requested)] : ["research"];
    setRecommendationBusy(true);
    setRecommendationStatus(null);
    try {
      const result = await getAgentRecommendations(bounded);
      if (result.readiness === "REFUSED") {
        setRecommendedSkillIds([]);
        setRecommendationStatus(`Recommendation refused: ${result.reasons.join(", ") || "No reason returned"}.`);
      } else {
        setRecommendedSkillIds(result.pinnedSkills.map((skill) => skill.id));
        setRecommendationStatus("Deterministic capability match from server-reviewed skill identifiers.");
      }
    } catch (error) {
      setRecommendedSkillIds([]);
      setRecommendationStatus(error instanceof Error ? error.message : "Protected recommendations are unavailable.");
    } finally {
      setRecommendationBusy(false);
    }
  }

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
        model: "Unspecified",
        provider: "Unverified",
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
    model: "Unspecified",
    provider: "Unverified",
    creator: "AlphaDawg",
    isActive: true,
    walletAddress: h.walletAddress ?? undefined,
  }));

  async function handleHire(registryName: string, displayName: string) {
    if (!userId) return;
    setHiringName(displayName);
    setLegacyHireError(null);
    try {
      await hireAgent(userId, registryName);
      await fetchMyAgents();
    } catch (err) {
      setLegacyHireError(err instanceof ApiError && (err.status === 401 || err.status === 403)
        ? "Fresh wallet authorization required. Reauthenticate and provide a fresh signature, then retry this legacy hire."
        : err instanceof Error ? err.message : "The legacy hire could not be completed.");
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
  const viewerPublishedAgents = publishedAgents.filter((agent) => agent.ownedByViewer);
  const availablePublishedAgents = publishedAgents.filter((agent) => !agent.ownedByViewer);
  const recommendedAgents = recommendedSkillIds.length === 0 ? [] : availablePublishedAgents.filter((agent) =>
    agent.capabilities.some((capability) => recommendedSkillIds.includes(capability)),
  );

  // Top-5 ELO standings — drawn from the same leaderboard fetch so the strip
  // at the top of the marketplace is always coherent with the cards below.
  const leaderboardStandings = [...allAgents]
    .sort((a, b) => b.reputation - a.reputation)
    .slice(0, 5);

  return (
    <main className="mx-auto min-w-0 max-w-[90rem] space-y-8 overflow-x-clip px-4 py-6 sm:px-6 lg:px-8">
      <section className="space-y-4" aria-labelledby="protected-agent-registry-title">
        <div className="relative overflow-hidden rounded-xl border border-dawg-500/30 bg-black p-5 sm:p-8">
          <div className="brand-hairline absolute inset-x-0 top-0 h-0.5" aria-hidden="true" />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <ShieldCheckIcon size={22} className="text-dawg-400" aria-hidden />
                <h1 id="protected-agent-registry-title" className="text-3xl font-semibold tracking-[-0.035em] text-void-100 sm:text-4xl">
                  Protected agent registry
                </h1>
                <Badge variant="amber">Immutable versions</Badge>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-void-400">
                Publish an authenticated agent version or submit a job against a version published by another owner. Published status confirms the registry record only; execution evidence is reported per job.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateAgent(true)}
              className="instrument-button instrument-button-primary shrink-0"
            >
              <PlusIcon size={16} weight="bold" aria-hidden /> Publish agent
            </button>
          </div>
        </div>

        <div className="grid min-w-0 gap-3 rounded-xl border border-void-800 bg-void-900 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0"><label htmlFor="agent-goal" className="text-xs font-semibold text-void-300">What do you need done?</label><input id="agent-goal" value={goal} onChange={(event) => setGoal(event.target.value)} maxLength={240} placeholder="Research evidence and flag downside risk" className="mt-2 min-h-11 w-full rounded-[10px] border border-void-700 bg-black px-3 text-sm text-void-100" /><p className="mt-2 text-xs text-void-500">Matches bounded words to server-reviewed capabilities. It does not claim an LLM searched the marketplace.</p></div>
          <button type="button" onClick={() => void recommendForGoal()} disabled={recommendationBusy || goal.trim().length < 2} className="instrument-button instrument-button-primary">{recommendationBusy ? "Matching" : "Recommend agents"}</button>
        </div>
        {recommendationStatus && <p role="status" className="text-xs text-void-400">{recommendationStatus}</p>}
        {recommendedSkillIds.length > 0 && <ProtectedAgentGroup title="Recommended for this goal" subtitle={`Capability match: ${recommendedSkillIds.join(", ")}`} agents={recommendedAgents} empty="No external published version matches these reviewed capabilities." onRun={setSelectedPublishedAgent} />}

        {loadingPublished ? (
          <EmptyState>
            <DawgSpinner size={56} label="Loading published agents…" />
          </EmptyState>
        ) : publishedError ? (
          <div role="alert" className="flex min-h-[160px] flex-col items-center justify-center rounded-2xl border border-blood-500/25 bg-blood-900/10 px-4 text-center">
            <p className="text-sm text-blood-300">{publishedError}</p>
            <button
              type="button"
              onClick={() => void fetchProtectedAgents()}
              className="mt-3 min-h-11 rounded-xl border border-void-700 px-4 text-sm font-semibold text-void-200 hover:bg-void-800"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <DraftAgentGroup agents={draftAgents} />
            <ProtectedAgentGroup
              title="Published by you"
              subtitle="Immutable protected versions owned by the authenticated wallet."
              agents={viewerPublishedAgents}
              empty="You have not published a protected agent version yet."
              onRun={setSelectedPublishedAgent}
            />
            <ProtectedAgentGroup
              title="Hireable external versions"
              subtitle="Versions published by other owners. Runtime availability is not inferred from publication."
              agents={availablePublishedAgents}
              empty="No agent versions from other owners are published yet."
              onRun={setSelectedPublishedAgent}
            />
          </div>
        )}
      </section>

      <div className="flex items-end justify-between gap-4 border-t border-void-800 pt-8">
        <div>
          <p className="instrument-label">Legacy surface</p>
          <h2 className="mt-2 text-xl font-semibold text-void-100">Observed hunt-pack marketplace</h2>
          <p className="mt-1 text-sm text-void-500">Non-authoritative historical and community data, separated from protected publication.</p>
        </div>
        <Badge variant="gray">Legacy</Badge>
      </div>

      {/* ── HERO — Nasdaq LED marketplace board ─────────────────────── */}
      <section
        className="nasdaq-led relative overflow-hidden rounded-xl border border-void-800"
        aria-label="Legacy AlphaDawg hunt-pack marketplace board"
      >
        <div className="h-[3px] w-full bg-gradient-to-r from-transparent via-dawg-500 to-transparent" />
        <div className="nasdaq-dot-matrix pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />

        <div className="relative">
          {/* Row 1: exchange strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dawg-500/20 px-5 py-2 text-xs uppercase">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-void-500" aria-hidden="true" />
                <span className="nasdaq-led-dim text-[18px] leading-none">LEGACY DATA</span>
              </span>
              <span className="nasdaq-led-dim text-[18px] leading-none">||</span>
              <span className="text-[18px] leading-none">
                PACK
                <span className="nasdaq-led-dim mx-2">·</span>
                <span className="nasdaq-led-bright">LEGACY HUNT PACK</span>
              </span>
              <span className="nasdaq-led-dim text-[18px] leading-none">||</span>
              <span className="nasdaq-led-dim hidden text-[16px] leading-none md:inline">
                OBSERVED HEALTH · EARNINGS · ELO
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="nasdaq-led-dim text-[16px] leading-none tabular-nums">
                {user?.inftTokenId != null ? `LEAD DAWG #${user.inftTokenId}` : "LEAD DAWG · NO TOKEN RECORD"}
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
                Browse the existing hunt-pack leaderboard. Health, earnings,
                storage, and iNFT identity appear only when the corresponding
                record is available.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <LedMarketTile
                label="YOUR PACK"
                value={loadingPack ? "Unavailable" : String(packSize)}
                sub="SPECIALISTS HIRED"
                tone="bright"
              />
              <LedMarketTile
                label="PACK EARNED"
                value={
                  loadingPack
                    ? "Unavailable"
                    : packEarningsUsd > 0
                      ? `$${packEarningsUsd.toFixed(3)}`
                      : "$0.000"
                }
                sub="CUMULATIVE USDC"
                tone="green"
              />
              <LedMarketTile
                label="SWARM ONLINE"
                value={swarmTotal > 0 ? `${swarmOnline}/${swarmTotal}` : "Unavailable"}
                sub="OBSERVED HEALTH"
                tone={swarmOnline === swarmTotal && swarmTotal > 0 ? "green" : "bright"}
              />
              <LedMarketTile
                label="AVAILABLE"
                value={loadingMarketplace ? "Unavailable" : String(availableCount)}
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
          title="Legacy hunt pack"
          subtitle="Specialists used by the existing Lead Dawg hunt flow"
          count={loadingPack ? null : packSize}
          right={
            <span className="inline-flex items-center gap-1.5 rounded-md border border-void-700/50 bg-void-800/60 px-2.5 py-1 font-mono text-[11px] text-void-400">
              <span className="h-1.5 w-1.5 rounded-full bg-dawg-400" />
              {user?.inftTokenId != null
                ? `Lead Dawg · iNFT #${user.inftTokenId}`
                : "Lead Dawg · no token record"}
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
          title="Legacy iNFT marketplace"
          subtitle="Existing community specialist hire flow"
          count={loadingMarketplace ? null : availableCount}
          right={
            <Badge variant="gray">Legacy flow</Badge>
          }
        />
        {legacyHireError && <div role="alert" className="rounded-xl border border-blood-500/30 bg-blood-900/20 p-3"><p className="text-sm font-semibold text-blood-200">Legacy hire needs reauthentication</p><p className="mt-1 text-sm text-blood-300">{legacyHireError}</p></div>}

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
              <span className="text-void-600">Check back after the next registry refresh.</span>
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
          onClose={() => {
            setShowCreateAgent(false);
            void fetchProtectedAgents();
          }}
          onCreated={() => void fetchProtectedAgents()}
        />
      )}
      {selectedPublishedAgent && (
        <KernelJobDialog
          agent={selectedPublishedAgent}
          onClose={() => setSelectedPublishedAgent(null)}
        />
      )}
    </main>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────

function ProtectedAgentGroup({
  title,
  subtitle,
  agents,
  empty,
  onRun,
}: {
  title: string;
  subtitle: string;
  agents: ProtectedPublishedAgent[];
  empty: string;
  onRun: (agent: ProtectedPublishedAgent) => void;
}) {
  return (
    <div className="space-y-3">
      <SectionHeader title={title} subtitle={subtitle} count={agents.length} />
      {agents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-void-800 bg-void-900/40 px-4 py-8 text-center text-sm text-void-500">
          {empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {agents.map((agent) => (
            <ProtectedAgentCard key={agent.versionId} agent={agent} onRun={() => onRun(agent)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProtectedAgentCard({
  agent,
  onRun,
}: {
  agent: ProtectedPublishedAgent;
  onRun: () => void;
}) {
  return (
    <Card className="min-w-0 overflow-hidden border-dawg-500/20">
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-void-100">{agent.name}</h3>
              <EvidenceStatus state={agent.canonicalState === "CANONICAL" ? "verified" : "unavailable"} label={agent.canonicalState === "CANONICAL" ? "Canonical" : agent.canonicalState} />
              {agent.ownedByViewer && <Badge variant="gray">Yours</Badge>}
            </div>
            {agent.fullSubname && (
              <p className="mt-0.5 font-mono text-xs text-dawg-400">{agent.fullSubname}</p>
            )}
            <p className="mt-2 text-sm leading-relaxed text-void-400">{agent.description}</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-mono text-xl font-semibold leading-none text-dawg-300">V{agent.version}</div>
            <div className="mt-1 font-mono text-[10px] text-void-500">
              {agent.priceAtomic} {agent.asset}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {agent.capabilities.map((capability) => (
            <span key={capability} className="rounded-md border border-void-700 bg-void-950 px-2 py-1 font-mono text-[10px] text-void-300">
              {capability}
            </span>
          ))}
        </div>

        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          <CopyableIdentifier label="Owner wallet" value={agent.ownerWallet} />
          <CopyableIdentifier label="Manifest hash" value={agent.manifestHash} />
          <CopyableIdentifier label="Creator parent" value={agent.creatorParent} />
          <CopyableIdentifier label="Agent subname" value={agent.fullSubname} />
          <CopyableIdentifier label="Authority owner" value={agent.authorityOwner} />
          <CopyableIdentifier label="Authority delegate" value={agent.authorityDelegate ?? "Unavailable"} />
          <CopyableIdentifier label="Release SHA" value={agent.authorityReleaseSha} />
          <CopyableIdentifier label="Publication decision" value={agent.publicationDecisionId} />
        </div>

        <div className="flex flex-col gap-3 border-t border-void-800 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-md text-xs leading-relaxed text-void-500">
            {agent.ownedByViewer ? "Self-hire refused: buyer wallet must differ from the publishing owner." : "Runtime status is unknown until a job records its own evidence."}
          </p>
          <button
            type="button"
            onClick={onRun}
            disabled={agent.ownedByViewer || !agent.hireable || agent.canonicalState !== "CANONICAL"}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-dawg-500/40 bg-dawg-500/10 px-4 text-sm font-semibold text-dawg-300 transition-colors hover:border-dawg-500/70 hover:bg-dawg-500/15"
          >
            {agent.ownedByViewer ? "Published by you" : "Submit protected job"}
          </button>
        </div>
      </CardBody>
    </Card>
  );
}

function DraftAgentGroup({ agents }: { agents: AgentLifecycleVersion[] }) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Your persisted drafts" subtitle="Private lifecycle records; never shown as published or hireable." count={agents.length} />
      {agents.length === 0 ? <EmptyState>No saved protected drafts.</EmptyState> : <div className="grid gap-3 lg:grid-cols-2">{agents.map((agent) => <Card key={agent.versionId} className="min-w-0 overflow-hidden"><CardBody className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-void-100">{agent.name}</h3><EvidenceStatus state="unavailable" label={agent.lifecycleState} /></div><p className="text-sm text-void-500">Draft version {agent.version}; not published or hireable.</p><div className="grid min-w-0 gap-2 sm:grid-cols-2"><CopyableIdentifier label="Version ID" value={agent.versionId} /><CopyableIdentifier label="Manifest hash" value={agent.manifestHash} /></div></CardBody></Card>)}</div>}
    </div>
  );
}

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
      iNFT · no token record
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
        Storage evidence · unavailable
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
            value={earningsUsd != null ? `$${earningsUsd.toFixed(3)}` : "Unavailable"}
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
              <span className="text-void-700">Unavailable</span>
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
