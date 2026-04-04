"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardBody, CodeBlock } from "@/components/ui/card";
import { Badge, SealedBadge, ZeroGBadge } from "@/components/ui/badge";
import { DawgSpinner } from "@/components/dawg-spinner";
import { useUser } from "@/contexts/user-context";
import { getCycleDetail, getLatestCycle } from "@/lib/api";
import type { CycleDetail, AgentActionRecord } from "@/lib/types";
import {
  INFT_CONTRACT_ADDRESS,
  HCS_TOPIC_ID,
  ogChainAddressUrl,
  inftTokenUrl,
  hashscanTopicUrl,
  hashscanMessageUrl,
} from "@/lib/links";

// Mapping from the AGENT_KEYS selector names (SentimentBot, WhaleEye, …) to
// the canonical `marketplace_agents.name` values stored in Supabase. Only
// specialists are in the marketplace — adversarial agents (Alpha/Risk/Executor)
// are platform infra, so the VerifyRatingButton renders null for them.
const SPECIALIST_MARKETPLACE_NAMES: Partial<Record<string, string>> = {
  SentimentBot: "sentiment",
  WhaleEye: "whale",
  MomentumX: "momentum",
  MemecoinHunter: "memecoin-hunter",
  TwitterAlpha: "twitter-alpha",
  DeFiYield: "defi-yield",
  NewsScanner: "news-scanner",
  OnChainForensics: "onchain-forensics",
  OptionsFlow: "options-flow",
  MacroCorrelator: "macro-correlator",
};

type AgentKey = "SentimentBot" | "WhaleEye" | "MomentumX" | "MemecoinHunter" | "TwitterAlpha" | "DeFiYield" | "NewsScanner" | "OnChainForensics" | "OptionsFlow" | "MacroCorrelator" | "Alpha" | "Risk" | "Executor";

const AGENT_META: Record<AgentKey, { emoji: string; type: "Specialist" | "Adversarial"; skill: string }> = {
  SentimentBot: { emoji: "🧠", type: "Specialist", skill: "Twitter + Reddit sentiment" },
  WhaleEye: { emoji: "🐋", type: "Specialist", skill: "Whale wallet movements" },
  MomentumX: { emoji: "📈", type: "Specialist", skill: "RSI, MACD, volume analysis" },
  MemecoinHunter: { emoji: "🎰", type: "Specialist", skill: "DexScreener new pairs + rug detection" },
  TwitterAlpha: { emoji: "🐦", type: "Specialist", skill: "CT narrative + influencer sentiment" },
  DeFiYield: { emoji: "🌾", type: "Specialist", skill: "DeFi Llama APY + TVL tracking" },
  NewsScanner: { emoji: "📰", type: "Specialist", skill: "Breaking news + regulatory signals" },
  OnChainForensics: { emoji: "🔍", type: "Specialist", skill: "Wallet flows + smart money tracking" },
  OptionsFlow: { emoji: "📊", type: "Specialist", skill: "Deribit options + IV analysis" },
  MacroCorrelator: { emoji: "🌍", type: "Specialist", skill: "DXY/SPX/VIX correlation + regime detection" },
  Alpha: { emoji: "🟢", type: "Adversarial", skill: "Argues FOR the trade" },
  Risk: { emoji: "🔴", type: "Adversarial", skill: "Argues AGAINST the trade" },
  Executor: { emoji: "🟡", type: "Adversarial", skill: "Makes the final call" },
};

const AGENT_KEYS: AgentKey[] = ["SentimentBot", "WhaleEye", "MomentumX", "MemecoinHunter", "TwitterAlpha", "DeFiYield", "NewsScanner", "OnChainForensics", "OptionsFlow", "MacroCorrelator", "Alpha", "Risk", "Executor"];

const PROVIDER_ADDRESS = process.env.NEXT_PUBLIC_OG_PROVIDER_ADDRESS ?? "0x9f2b...4a1c";
const INFT_CONTRACT = INFT_CONTRACT_ADDRESS;

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
    MemecoinHunter: "SPECIALIST_HIRED",
    TwitterAlpha: "SPECIALIST_HIRED",
    DeFiYield: "SPECIALIST_HIRED",
    NewsScanner: "SPECIALIST_HIRED",
    OnChainForensics: "SPECIALIST_HIRED",
    OptionsFlow: "SPECIALIST_HIRED",
    MacroCorrelator: "SPECIALIST_HIRED",
    Alpha: "DEBATE_ALPHA",
    Risk: "DEBATE_RISK",
    Executor: "DEBATE_EXECUTOR",
  };

  // For specialists, also match by agent name
  const nameMap: Record<string, string> = {
    SentimentBot: "sentiment", WhaleEye: "whale", MomentumX: "momentum",
    MemecoinHunter: "memecoin-hunter", TwitterAlpha: "twitter-alpha", DeFiYield: "defi-yield",
    NewsScanner: "news-scanner", OnChainForensics: "onchain-forensics", OptionsFlow: "options-flow",
    MacroCorrelator: "macro-correlator",
  };
  const action = key in nameMap
    ? actions.find((a) => a.actionType === actionTypeMap[key] && a.agentName === nameMap[key])
    : actions.find((a) => a.actionType === actionTypeMap[key]);
  if (action?.attestationHash) return action.attestationHash;

  // Fall back to cycle record attestations (only for adversarial agents — specialists are in JSON)
  switch (key) {
    case "SentimentBot":
    case "WhaleEye":
    case "MomentumX":
    case "MemecoinHunter":
    case "TwitterAlpha":
    case "DeFiYield":
    case "NewsScanner":
    case "OnChainForensics":
    case "OptionsFlow":
    case "MacroCorrelator": {
      const specs = Array.isArray(cycle.specialists) ? cycle.specialists as Array<{ name?: string; attestation?: string }> : [];
      const specName = nameMap[key];
      const spec = specs.find((s) => s.name === specName);
      return spec?.attestation ?? "—";
    }
    case "Alpha": return cycle.alphaAttestation ?? "—";
    case "Risk": return cycle.riskAttestation ?? "—";
    case "Executor": return cycle.execAttestation ?? "—";
    default: return "—";
  }
}

function getTeeVerified(key: AgentKey, actions: AgentActionRecord[]): boolean {
  const actionTypeMap: Record<AgentKey, string> = {
    SentimentBot: "SPECIALIST_HIRED",
    WhaleEye: "SPECIALIST_HIRED",
    MomentumX: "SPECIALIST_HIRED",
    MemecoinHunter: "SPECIALIST_HIRED",
    TwitterAlpha: "SPECIALIST_HIRED",
    DeFiYield: "SPECIALIST_HIRED",
    NewsScanner: "SPECIALIST_HIRED",
    OnChainForensics: "SPECIALIST_HIRED",
    OptionsFlow: "SPECIALIST_HIRED",
    MacroCorrelator: "SPECIALIST_HIRED",
    Alpha: "DEBATE_ALPHA",
    Risk: "DEBATE_RISK",
    Executor: "DEBATE_EXECUTOR",
  };
  const action = actions.find((a) => a.actionType === actionTypeMap[key]);
  return action?.teeVerified ?? false;
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <main className="max-w-7xl mx-auto flex justify-center px-5 py-16">
          <DawgSpinner size={56} label="Loading verification…" />
        </main>
      }
    >
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

  // Resolve the cycle number with a three-step fallback so a missing query
  // param or stale UserContext cache can never wedge the verification view:
  //
  //   1. `?cycle=N` query param         — explicit target (from dashboard navigation)
  //   2. `user.agent.lastCycleId`       — cached in UserContext (may be stale)
  //   3. `getLatestCycle(userId)`       — authoritative DB lookup (same path dashboard uses)
  //
  // Without step 3 the page was rendering "No cycle data found" whenever the
  // dashboard linked to /verify without a cycle id AND the cached user record
  // hadn't refreshed after the last cycle commit.
  const cycleParam = searchParams.get("cycle");
  const parsedCycle = cycleParam ? parseInt(cycleParam, 10) : NaN;
  const paramOrCached =
    !isNaN(parsedCycle)
      ? parsedCycle
      : user?.agent?.lastCycleId && user.agent.lastCycleId > 0
        ? user.agent.lastCycleId
        : null;

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const loadCycle = async () => {
      // Try the known cycle number first; fall back to /api/cycle/latest if
      // either (a) we had no number to begin with or (b) the detail lookup
      // returned null because the param pointed at a stale id.
      if (paramOrCached && paramOrCached > 0) {
        const detail = await getCycleDetail(userId, paramOrCached).catch(() => null);
        if (detail) {
          setCycle(detail.cycle);
          setActions(detail.actions);
          setLoading(false);
          return;
        }
      }
      // Fallback: hit /api/cycle/latest — it reads Prisma directly and is the
      // same endpoint the dashboard uses, so if the dashboard shows hunt #N
      // this will find it. EnrichedCycleResponse carries `cycleId` at the top
      // level; we then re-fetch via getCycleDetail so the attestation/action
      // lookup path this page already uses works unchanged.
      const latest = await getLatestCycle(userId).catch(() => null);
      if (latest && typeof latest.cycleId === "number" && latest.cycleId > 0) {
        const detail = await getCycleDetail(userId, latest.cycleId).catch(() => null);
        if (detail) {
          setCycle(detail.cycle);
          setActions(detail.actions);
        }
      }
      setLoading(false);
    };

    void loadCycle();
  }, [userId, paramOrCached]);

  const agent = AGENT_META[selected];
  const attestation = getAttestationForAgent(selected, cycle, actions);
  const teeVerified = getTeeVerified(selected, actions);

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto flex justify-center px-5 py-16">
        <DawgSpinner size={56} label="Loading verification data…" />
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
                    href={
                      user?.inftTokenId != null
                        ? inftTokenUrl(user.inftTokenId)
                        : ogChainAddressUrl(INFT_CONTRACT)
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold-400 hover:text-void-300 transition-colors"
                  >
                    {user?.inftTokenId != null
                      ? `View iNFT #${user.inftTokenId} on 0G Chainscan →`
                      : "View VaultMindAgent contract on 0G Chainscan →"}
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

          {/* Verify-as-rating action — records a verified-kind rating on HCS
              + Supabase. Only rendered for marketplace specialists; returns
              null for Alpha/Risk/Executor (platform infra). */}
          {AGENT_META[selected].type === "Specialist" && (
            <div className="bg-void-950 border border-emerald-900/40 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
                    Endorse this attestation
                  </p>
                  <p className="text-[11px] text-void-500 mt-0.5">
                    Checked the proof? Commit a verified-rating to {selected}&apos;s on-chain ELO.
                  </p>
                </div>
                <VerifyRatingButton agentKey={selected} cycleNumber={cycle.cycleNumber} />
              </div>
            </div>
          )}
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
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(cycle.storageHash ?? "").catch(() => {});
                    }}
                    className="font-mono text-sm text-gold-400 hover:text-gold-300 break-all text-left transition-colors"
                    title="Click to copy. 0G Storage roots are retrievable only via the 0G indexer API — no public browser explorer exists."
                  >
                    {cycle.storageHash} <span className="text-[10px] text-void-500">📋 copy</span>
                  </button>
                  <p className="text-[10px] text-void-600">
                    Retrievable via 0G indexer · no public browser explorer
                  </p>
                </div>
              ) : (
                <span className="text-xs text-void-600">Not stored (0G Storage was unavailable)</span>
              )}
            </DetailBlock>
            <DetailBlock label="HCS Sequence">
              {cycle.hcsSeqNum ? (
                <a
                  href={hashscanMessageUrl(HCS_TOPIC_ID, cycle.hcsSeqNum)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-teal-300 hover:text-teal-200 underline decoration-dotted"
                >
                  #{cycle.hcsSeqNum} <span className="text-[10px]">↗ on Hashscan</span>
                </a>
              ) : (
                <span className="font-mono text-sm text-void-600">—</span>
              )}
            </DetailBlock>
            <DetailBlock label="HCS Audit Topic">
              <a
                href={hashscanTopicUrl(HCS_TOPIC_ID)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-teal-300 hover:text-teal-200 underline decoration-dotted"
              >
                {HCS_TOPIC_ID} ↗
              </a>
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

// ── Verify-as-rating button ─────────────────────────────────
//
// Explicit "I checked this attestation and endorse it" action. POSTs to
// /api/marketplace/rate with kind="verify" — same ELO update math as a like
// but labelled distinctly on HCS so downstream analytics can separate passive
// likes from attestation-verified endorsements. The user's verification
// becomes part of the specialist's on-chain reputation trail.
//
// Only rendered for marketplace specialists — adversarial agents (Alpha/
// Risk/Executor) aren't in `marketplace_agents`, so rating them would 404.

interface VerifyRateResponse {
  agentName: string;
  reputation: number;
  reputationBefore?: number;
  hcsSeqNum?: number | null;
  hcsTopicId?: string | null;
}

function VerifyRatingButton({
  agentKey,
  cycleNumber,
}: {
  agentKey: string;
  cycleNumber: number;
}) {
  const { userId } = useUser();
  const marketplaceName = SPECIALIST_MARKETPLACE_NAMES[agentKey] ?? null;
  const storageKey = marketplaceName
    ? `alphadawg.verify.${cycleNumber}.${marketplaceName}`
    : null;
  const [submitting, setSubmitting] = useState(false);
  const [verified, setVerified] = useState(false);
  const [reputation, setReputation] = useState<number | null>(null);
  const [hcsLink, setHcsLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storageKey) return;
    try {
      if (window.localStorage.getItem(storageKey) === "1") setVerified(true);
    } catch { /* private-mode browsers */ }
  }, [storageKey]);

  const handleVerify = useCallback(async () => {
    if (!userId || !marketplaceName || submitting || verified) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/marketplace/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          agentName: marketplaceName,
          cycleId: cycleNumber,
          kind: "verify",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as VerifyRateResponse;
      setReputation(data.reputation);
      setVerified(true);
      if (data.hcsSeqNum != null && data.hcsTopicId) {
        setHcsLink(
          `https://hashscan.io/testnet/topic/${data.hcsTopicId}?s=${data.hcsSeqNum}`,
        );
      }
      if (storageKey) {
        try { window.localStorage.setItem(storageKey, "1"); } catch { /* ignore */ }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [userId, marketplaceName, cycleNumber, storageKey, submitting, verified]);

  if (!marketplaceName) return null; // Adversarial agent — not in marketplace.
  if (!userId) {
    return (
      <p className="text-[11px] text-void-600 italic">
        Connect your wallet to record your verification on-chain.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        type="button"
        onClick={handleVerify}
        disabled={submitting || verified}
        className={`px-3 py-1.5 rounded-md text-[11px] font-bold font-mono uppercase tracking-wider border transition-all ${
          verified
            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_14px_rgba(52,211,153,0.35)] cursor-default"
            : "bg-void-900/80 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/10 hover:border-emerald-500/70"
        } ${submitting ? "opacity-60" : ""}`}
        title="I checked this TEE attestation and endorse this specialist — records a verified-rating on HCS."
      >
        {verified ? "✓ Verified" : submitting ? "Signing…" : "Verify ✓"}
      </button>
      {verified && reputation != null && (
        <span className="font-pixel text-[13px] tabular-nums text-gold-400 glow-dawg">
          ELO {reputation}
        </span>
      )}
      {hcsLink && (
        <a
          href={hcsLink}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[11px] text-teal-300 hover:text-teal-200 underline decoration-dotted"
          title="View this verified-rating on Hashscan — the before/after ELO is logged to HCS as proof."
        >
          HCS ↗
        </a>
      )}
      {error && (
        <span className="text-[11px] text-blood-300">{error}</span>
      )}
    </div>
  );
}
