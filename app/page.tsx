import type { Metadata } from "next";
import Link from "next/link";
import { landingPrimaryHeroClass, landingSecondaryClass } from "@/components/landing/landing-cta";
import { LandingArchitectureFlow } from "@/components/landing/landing-architecture-flow";
import { LandingGlassSection } from "@/components/landing/landing-glass-section";
import { LandingMarketplaceSection } from "@/components/landing/landing-marketplace-section";
import { LandingProofPipeline } from "@/components/landing/landing-proof-pipeline";
import {
  HCS_TOPIC_ID,
  HTS_FUND_TOKEN_ID,
  INFT_CONTRACT_ADDRESS,
  NARYO_CONTRACT_ADDRESS,
  hashscanTopicUrl,
  hashscanTokenUrl,
  hashscanContractUrl,
  ogChainAddressUrl,
} from "@/lib/links";

export const metadata: Metadata = {
  title: "AlphaDawg",
  description:
    "Glass-box AI pack: hire specialists with x402, adversarial debate in TEE, prove every decision on Hedera and 0G — marketplace, reputation, on-chain audit.",
  openGraph: {
    title: "AlphaDawg",
    description: "Your AI pack hunts alpha — provable swarm economy for the chain.",
  },
};

const MIRROR_BASE = "https://testnet.mirrornode.hedera.com/api/v1";

/** Pillar copy merged from former Product page — full depth. */
const PILLARS = [
  {
    n: "01",
    title: "Hire specialists",
    body:
      "Your lead agent pays real specialists per call via Arc x402 nanopayments ($0.001). Sentiment, whale flow, momentum, on-chain forensics — each runs through sealed 0G inference with attestation.",
  },
  {
    n: "02",
    title: "Adversarial debate",
    body:
      "Alpha argues for exposure, Risk argues against, Executor decides with explicit position sizing. Debate transcripts and reasoning are structured for audit — not a black-box score.",
  },
  {
    n: "03",
    title: "Prove and remember",
    body:
      "Cycles commit to Hedera HCS; rich records anchor to 0G Storage. Prior hunts load back into context (RAG) so the pack learns from its own history — evolving memory, not one-shot prompts.",
  },
] as const;

async function getStats() {
  const topicId = process.env.HCS_AUDIT_TOPIC_ID;
  const tokenId = process.env.HTS_FUND_TOKEN_ID;
  let huntsRun = 0;
  let totalSupply = "0";

  if (topicId) {
    try {
      const res = await fetch(
        `${MIRROR_BASE}/topics/${topicId}/messages?limit=1&order=desc`,
        { next: { revalidate: 30 } },
      );
      if (res.ok) {
        const data = await res.json();
        huntsRun = data.messages?.[0]?.sequence_number ?? 0;
      }
    } catch {
      /* non-fatal */
    }
  }

  if (tokenId) {
    try {
      const res = await fetch(`${MIRROR_BASE}/tokens/${tokenId}`, {
        next: { revalidate: 60 },
      });
      if (res.ok) {
        const data = await res.json();
        totalSupply = data.total_supply ?? "0";
      }
    } catch {
      /* non-fatal */
    }
  }

  return { huntsRun, totalSupply };
}

function formatSupplyDisplay(raw: string): string {
  const s = raw.replace(/\s/g, "");
  if (!/^\d+$/.test(s)) return raw.length > 14 ? `${raw.slice(0, 10)}…` : raw;
  if (s.length <= 12) return s;
  const n = BigInt(s);
  if (n >= 1_000_000_000_000n) return `${(Number(n / 1_000_000_000_000n) / 1).toFixed(1)}T`;
  if (n >= 1_000_000_000n) return `${(Number(n / 1_000_000_000n) / 1).toFixed(1)}B`;
  if (n >= 1_000_000n) return `${(Number(n / 1_000_000n) / 1).toFixed(1)}M`;
  return `${s.slice(0, 8)}…`;
}

const ARCH_ROWS: { path: string; body: string }[] = [
  {
    path: "app/",
    body: "Next.js App Router — dashboard UI and primary /api/* routes (what the browser hits).",
  },
  {
    path: "src/agents/",
    body: "Cycle orchestration — hire specialists, adversarial pipeline, heartbeat, Telegram.",
  },
  {
    path: "src/og/ · src/hedera/ · src/payments/",
    body: "0G sealed inference & storage, Hedera HCS/HTS, Arc x402 buyer and seller paths.",
  },
  {
    path: "contracts/ · openclaw/",
    body: "Solidity on 0G Chain where needed; OpenClaw workspaces for agent prompts and procedures.",
  },
];

export default async function LandingPage() {
  const stats = await getStats();
  const supplyDisplay = formatSupplyDisplay(stats.totalSupply);

  return (
    <div className="flex flex-col items-center">
      {/* Hero */}
      <section className="relative flex w-full flex-col items-center justify-center px-6 pb-12 pt-28 md:pt-32">
        <div className="absolute top-20 h-[400px] w-[600px] rounded-full bg-dawg-500/15 blur-[120px]" />

        <p
          className="fade-in-up relative z-10 text-xs font-mono uppercase tracking-widest text-dawg-400 mb-4"
          style={{ animationDelay: "0ms" }}
        >
          Swarm economy · on-chain audit
        </p>
        <h1
          className="fade-in-up relative z-10 text-center text-5xl font-bold leading-tight tracking-tight md:text-7xl text-void-100 max-w-4xl"
          style={{ animationDelay: "60ms" }}
        >
          Your AI Pack.{" "}
          <span className="font-pixel bg-gradient-to-r from-dawg-400 to-gold-400 bg-clip-text text-transparent uppercase tracking-wider">
            Hunts Alpha.
          </span>
        </h1>
        <p
          className="fade-in-up relative z-10 mt-5 max-w-2xl text-center text-base md:text-lg text-void-400 leading-relaxed"
          style={{ animationDelay: "120ms" }}
        >
          An{" "}
          <span className="text-void-300">agent hiring economy</span>, not a black-box fund. Your lead
          agent pays specialist &ldquo;dogs&rdquo; per hunt via{" "}
          <span className="text-void-300">Arc x402</span> nanopayments, runs adversarial debate in TEE,
          and commits every cycle to{" "}
          <span className="text-void-300">Hedera</span> so judges can verify in one click.
        </p>

        <div
          className="fade-in-up relative z-10 mt-10 flex flex-wrap justify-center gap-3 md:gap-4"
          style={{ animationDelay: "240ms" }}
        >
          <Link href="/dashboard" className={landingPrimaryHeroClass}>
            Launch Dashboard
          </Link>
          <Link href="/portfolio" className={landingSecondaryClass}>
            View Portfolio
          </Link>
        </div>
      </section>

      <LandingGlassSection />
      <LandingArchitectureFlow />
      <LandingProofPipeline />

      {/* Purpose */}
      <section className="fade-in-up w-full max-w-2xl mx-auto px-6 py-12 text-center">
        <p className="text-sm md:text-base text-void-400 leading-relaxed">
          Control the swarm from{" "}
          <span className="text-void-300">Telegram</span> or this{" "}
          <span className="text-void-300">Next.js</span> app: each hunt hires specialists, settles
          micropayments, and leaves a trail you can trace. Dive into the{" "}
          <a href="#glass-box" className="text-dawg-400 hover:underline font-medium">
            thesis
          </a>{" "}
          above, then the architecture and proof sections below.
        </p>
      </section>

      {/* Stats Bar */}
      <section
        className="fade-in-up border-t border-dawg-500/20 bg-void-900 border-x border-b border-void-800 mx-6 grid w-full max-w-4xl grid-cols-1 sm:grid-cols-3 gap-px overflow-hidden rounded-2xl shadow-[0_0_0_1px_rgba(251,191,36,0.06)]"
      >
        <StatCard label="Hunts run" value={stats.huntsRun.toString()} />
        <StatCard label="Total supply" value={supplyDisplay} />
        <StatCard label="Hunt cost" value="$0.003/hunt" />
      </section>

      {/* Architecture */}
      <section className="fade-in-up w-full max-w-4xl mx-auto px-6 mt-14 md:mt-16">
        <p className="text-xs font-mono uppercase tracking-widest text-dawg-400 mb-4">
          Architecture at a glance
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {ARCH_ROWS.map((row) => (
            <div
              key={row.path}
              className="rounded-xl border border-void-800 bg-void-900/80 px-4 py-3 shadow-[0_0_0_1px_rgba(251,191,36,0.05)]"
            >
              <p className="font-mono text-[11px] text-void-500 leading-snug">{row.path}</p>
              <p className="mt-1.5 text-sm text-void-300 leading-relaxed">{row.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-void-600">
          Contracts, topics, and listeners are listed on the Stack page (nav).
        </p>
      </section>

      {/* On-chain proof strip */}
      <section className="fade-in-up mx-6 mt-12 md:mt-14 w-full max-w-4xl">
        <div className="rounded-2xl border border-void-800 bg-void-900/70 px-5 py-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-void-500 mb-3">
            Verify on explorers
          </p>
          <div className="flex flex-wrap gap-2">
            <ProofLink href={hashscanTopicUrl(HCS_TOPIC_ID)} label="HCS topic" sub={HCS_TOPIC_ID} />
            <ProofLink href={hashscanTokenUrl(HTS_FUND_TOKEN_ID)} label="HTS fund" sub={HTS_FUND_TOKEN_ID} />
            <ProofLink
              href={hashscanContractUrl(NARYO_CONTRACT_ADDRESS)}
              label="Naryo AuditLog"
              sub={truncateId(NARYO_CONTRACT_ADDRESS)}
            />
            <ProofLink href={ogChainAddressUrl(INFT_CONTRACT_ADDRESS)} label="iNFT contract" sub={truncateId(INFT_CONTRACT_ADDRESS)} />
          </div>
          <p className="mt-3 text-xs text-void-600">
            Same identifiers are on the Stack page (nav). Stats above pull live sequence / supply from the Mirror API
            when env is configured.
          </p>
        </div>
      </section>

      {/* Pillars — full Product copy */}
      <section id="how-it-works" className="mx-auto mt-20 md:mt-24 w-full max-w-5xl px-6 scroll-mt-24">
        <p className="text-xs font-mono uppercase tracking-widest text-dawg-400 mb-6 text-center">
          How the pack runs
        </p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {PILLARS.map((p, i) => (
            <FeatureCard
              key={p.n}
              step={p.n}
              title={p.title}
              description={p.body}
              delayMs={480 + i * 80}
            />
          ))}
        </div>
      </section>

      <LandingMarketplaceSection />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 bg-void-850 px-4 py-6 sm:px-6 min-h-[120px]">
      <span className="font-pixel text-2xl sm:text-3xl leading-none tabular-nums nasdaq-led-bright glow-dawg max-w-full truncate text-center">
        {value}
      </span>
      <span className="text-[10px] font-mono text-void-500 uppercase tracking-wider text-center">{label}</span>
    </div>
  );
}

function truncateId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function ProofLink({
  href,
  label,
  sub,
}: {
  href: string;
  label: string;
  sub: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex flex-col gap-0.5 rounded-lg border border-void-700 bg-void-850 px-3 py-2 text-left hover:border-dawg-500/35 transition-colors min-w-[140px]"
    >
      <span className="text-[11px] font-medium text-void-200">{label}</span>
      <span className="text-[10px] font-mono text-void-500">{sub}</span>
    </a>
  );
}

function FeatureCard({
  step,
  title,
  description,
  delayMs,
}: {
  step: string;
  title: string;
  description: string;
  delayMs: number;
}) {
  return (
    <div
      className="fade-in-up bg-void-900 border border-void-800 rounded-2xl p-6 shadow-[0_0_0_1px_rgba(251,191,36,0.06)] h-full flex flex-col"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span className="font-mono text-xs text-dawg-400">{step}</span>
      <h3 className="mt-2 text-lg font-semibold text-void-100">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-void-400 flex-1">{description}</p>
    </div>
  );
}
