import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { landingPrimaryHeroClass, landingSecondaryClass } from "@/components/landing/landing-cta";
import { LandingArchitectureFlow } from "@/components/landing/landing-architecture-flow";
import { LandingGlassSection } from "@/components/landing/landing-glass-section";
import { LandingMarketplaceSection } from "@/components/landing/landing-marketplace-section";
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
    "Publish immutable agents, submit protected jobs, and inspect canonical per-job evidence.",
  openGraph: {
    title: "AlphaDawg",
    description: "Immutable agent versions with authenticated, per-job proof state.",
  },
};

const MIRROR_BASE = "https://testnet.mirrornode.hedera.com/api/v1";

/** Pillar copy merged from former Product page — full depth. */
const PILLARS = [
  {
    n: "01",
    title: "Hire specialists",
    body:
      "Publish an immutable specialist version or select an existing one. Ownership, price, capabilities, and proof policy come from the authenticated kernel record.",
  },
  {
    n: "02",
    title: "Adversarial debate",
    body:
      "The legacy hunt flow keeps Alpha, Risk, and Executor reasoning visible, while A5 protected jobs stay separate from legacy authority.",
  },
  {
    n: "03",
    title: "Prove and remember",
    body:
      "Each protected job exposes an ordered Proof Rail for ENS, 0G Compute, Storage, canonical receipt, delivery, and financial outcome—only when those records exist.",
  },
] as const;

async function getStats() {
  const topicId = process.env.HCS_AUDIT_TOPIC_ID;
  const tokenId = process.env.HTS_FUND_TOKEN_ID;
  let huntsRun: number | null = null;
  let totalSupply: string | null = null;

  if (topicId) {
    try {
      const res = await fetch(
        `${MIRROR_BASE}/topics/${topicId}/messages?limit=1&order=desc`,
        { next: { revalidate: 30 } },
      );
      if (res.ok) {
        const data = await res.json();
        huntsRun = typeof data.messages?.[0]?.sequence_number === "number"
          ? data.messages[0].sequence_number
          : null;
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
        totalSupply = typeof data.total_supply === "string" ? data.total_supply : null;
      }
    } catch {
      /* non-fatal */
    }
  }

  return { huntsRun, totalSupply };
}

function formatSupplyDisplay(raw: string | null): string {
  if (raw === null) return "—";
  const s = raw.replace(/\s/g, "");
  if (!/^\d+$/.test(s)) return raw.length > 14 ? `${raw.slice(0, 10)}…` : raw;
  if (s.length <= 12) return s;
  const n = BigInt(s);
  if (n >= 1_000_000_000_000n) return `${(Number(n / 1_000_000_000_000n) / 1).toFixed(1)}T`;
  if (n >= 1_000_000_000n) return `${(Number(n / 1_000_000_000n) / 1).toFixed(1)}B`;
  if (n >= 1_000_000n) return `${(Number(n / 1_000_000n) / 1).toFixed(1)}M`;
  return `${s.slice(0, 8)}…`;
}

export default async function LandingPage() {
  const stats = await getStats();
  const supplyDisplay = formatSupplyDisplay(stats.totalSupply);

  return (
    <div className="flex w-full flex-col items-center overflow-x-clip">
      {/* Hero */}
      <section className="relative flex w-full flex-col items-center justify-center px-6 pb-12 pt-28 md:pt-32">
        <div className="absolute top-20 h-[400px] w-[600px] rounded-full bg-dawg-500/15 blur-[120px]" />

        <p
          className="fade-in-up relative z-10 text-xs font-mono uppercase tracking-widest text-dawg-400 mb-4"
          style={{ animationDelay: "0ms" }}
        >
          Protected agent control surface
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
          Publish immutable agent versions, submit one idempotent job, and inspect the evidence
          that actually exists—from ENS authority through canonical receipt and settlement.
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

      <figure className="fade-in-up mx-auto mt-12 w-full max-w-6xl px-6 md:mt-14">
        <div className="overflow-hidden rounded-2xl border border-dawg-500/25 bg-black shadow-[0_20px_80px_-36px_rgba(255,199,0,0.34)]">
          <Image
            src="/alphadawg-dashboard-rc.png"
            alt="AlphaDawg release-candidate dashboard showing the Nasdaq board and protected A5 job totals"
            width={1440}
            height={1000}
            className="h-auto w-full"
            sizes="(max-width: 768px) 100vw, 1152px"
          />
        </div>
        <figcaption className="mt-3 text-center font-mono text-[10px] uppercase tracking-wider text-void-600">
          Release-candidate dashboard · local fixture data · current evidence is shown per authenticated job
        </figcaption>
      </figure>

      <LandingArchitectureFlow />

      {/* Purpose */}
      <section className="fade-in-up w-full max-w-2xl mx-auto px-6 py-12 text-center">
        <p className="text-sm md:text-base text-void-400 leading-relaxed">
          Use the <span className="text-void-300">protected A5 path</span> for immutable publication,
          job control, and evidence. The existing hunt, Telegram, portfolio, and legacy marketplace
          remain available as compatibility workflows. Read the{" "}
          <a href="#glass-box" className="text-dawg-400 hover:underline font-medium">
            thesis
          </a>{" "}
          above, then inspect the runtime path below.
        </p>
      </section>

      {/* Stats Bar */}
      <section
        className="fade-in-up mx-6 grid w-[calc(100%-3rem)] max-w-4xl grid-cols-1 gap-px overflow-hidden rounded-2xl border-x border-b border-t border-void-800 border-t-dawg-500/20 bg-void-900 shadow-[0_0_0_1px_rgba(251,191,36,0.06)] sm:grid-cols-3"
      >
        <StatCard label="Observed HCS sequence" value={stats.huntsRun?.toString() ?? "—"} />
        <StatCard label="Total supply" value={supplyDisplay} />
        <StatCard label="A5 verification" value="Per job" />
      </section>

      {/* On-chain proof strip */}
      <section className="fade-in-up mx-6 mt-12 w-[calc(100%-3rem)] max-w-4xl md:mt-14">
        <div className="rounded-2xl border border-void-800 bg-void-900/70 px-5 py-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-void-500 mb-3">
            Configured explorer identifiers
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
            Identifier configuration is not current job proof. Mirror values above remain — when the configured upstream cannot be observed.
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
