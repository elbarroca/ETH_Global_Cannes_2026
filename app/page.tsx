import Link from "next/link";

const MIRROR_BASE = "https://testnet.mirrornode.hedera.com/api/v1";

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
    } catch { /* non-fatal */ }
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
    } catch { /* non-fatal */ }
  }

  return { huntsRun, totalSupply };
}

export default async function LandingPage() {
  const stats = await getStats();

  return (
    <div className="flex flex-col items-center">
      {/* Hero */}
      <section className="relative flex w-full flex-col items-center justify-center px-6 pb-20 pt-32">
        {/* Background glow — warm dawg yellow */}
        <div className="absolute top-20 h-[400px] w-[600px] rounded-full bg-dawg-500/15 blur-[120px]" />

        <h1
          className="fade-in-up relative z-10 text-center text-5xl font-bold leading-tight tracking-tight md:text-7xl text-void-100"
          style={{ animationDelay: "0ms" }}
        >
          Your AI Pack.{" "}
          <span className="bg-gradient-to-r from-dawg-400 to-gold-400 bg-clip-text text-transparent">
            Hunts Alpha.
          </span>
        </h1>
        <p
          className="fade-in-up relative z-10 mt-4 max-w-xl text-center text-lg text-void-400"
          style={{ animationDelay: "120ms" }}
        >
          Glass box, not black box. Every hire, every debate, every trade decision — cryptographically verified and logged on-chain.
        </p>

        <div
          className="fade-in-up relative z-10 mt-10 flex gap-4"
          style={{ animationDelay: "240ms" }}
        >
          <Link
            href="/dashboard"
            className="shine-sweep rounded-xl bg-dawg-500 hover:bg-dawg-400 px-8 py-3 font-semibold text-void-950 transition-colors"
          >
            Launch Dashboard
          </Link>
          <Link
            href="/deposit"
            className="rounded-xl bg-void-800 border border-void-700 px-8 py-3 font-semibold text-void-300 hover:text-void-100 transition-colors"
          >
            View Portfolio
          </Link>
        </div>
      </section>

      {/* Stats Bar */}
      <section
        className="fade-in-up bg-void-900 border border-void-800 mx-6 -mt-4 grid w-full max-w-4xl grid-cols-3 gap-px overflow-hidden rounded-2xl"
        style={{ animationDelay: "360ms" }}
      >
        <StatCard label="Hunts Run" value={stats.huntsRun.toString()} />
        <StatCard label="Total Supply" value={stats.totalSupply} />
        <StatCard label="Hunt Cost" value="$0.003/hunt" />
      </section>

      {/* How It Works */}
      <section className="mx-auto mt-24 grid w-full max-w-5xl grid-cols-1 gap-6 px-6 pb-20 md:grid-cols-3">
        <FeatureCard
          step="01"
          title="Hire Specialists"
          description="Your agent pays 3 AI specialists $0.001 each via x402 nanopayments. Sentiment, whale tracking, momentum analysis."
          delayMs={480}
        />
        <FeatureCard
          step="02"
          title="Adversarial Debate"
          description="Alpha argues FOR, Risk argues AGAINST, Executor decides. All run inside TEE enclaves with attestation proofs."
          delayMs={560}
        />
        <FeatureCard
          step="03"
          title="Prove On-Chain"
          description="Every decision logged to Hedera HCS. One-click verification on Hashscan. Immutable and auditable forever."
          delayMs={640}
        />
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 bg-void-850 px-6 py-5">
      <span className="font-mono text-2xl font-bold text-void-100">{value}</span>
      <span className="text-xs text-void-500 uppercase tracking-wider">{label}</span>
    </div>
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
      className="fade-in-up bg-void-900 border border-void-800 rounded-2xl p-6"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span className="font-mono text-xs text-dawg-400">{step}</span>
      <h3 className="mt-2 text-lg font-semibold text-void-100">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-void-400">{description}</p>
    </div>
  );
}
