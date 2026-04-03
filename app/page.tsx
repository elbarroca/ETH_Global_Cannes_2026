import Link from "next/link";

const MIRROR_BASE = "https://testnet.mirrornode.hedera.com/api/v1";

async function getStats() {
  const topicId = process.env.HCS_AUDIT_TOPIC_ID;
  const tokenId = process.env.HTS_FUND_TOKEN_ID;
  let cyclesRun = 0;
  let totalSupply = "0";

  if (topicId) {
    try {
      const res = await fetch(
        `${MIRROR_BASE}/topics/${topicId}/messages?limit=1&order=desc`,
        { next: { revalidate: 30 } },
      );
      if (res.ok) {
        const data = await res.json();
        cyclesRun = data.messages?.[0]?.sequence_number ?? 0;
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

  return { cyclesRun, totalSupply };
}

export default async function LandingPage() {
  const stats = await getStats();

  return (
    <div className="flex flex-col items-center">
      {/* Hero */}
      <section className="relative flex w-full flex-col items-center justify-center px-6 pb-20 pt-32">
        {/* Background glow */}
        <div className="absolute top-20 h-[400px] w-[600px] rounded-full bg-vault-primary/20 blur-[120px]" />

        <h1 className="relative z-10 text-center text-5xl font-bold leading-tight tracking-tight md:text-7xl">
          Your AI.{" "}
          <span className="bg-gradient-to-r from-vault-primary to-vault-accent bg-clip-text text-transparent">
            Provable
          </span>{" "}
          Decisions.
        </h1>
        <p className="relative z-10 mt-4 max-w-xl text-center text-lg text-slate-400">
          Glass box, not black box. Every hire, every debate, every trade decision — cryptographically verified and logged on-chain.
        </p>

        <div className="relative z-10 mt-10 flex gap-4">
          <Link
            href="/dashboard"
            className="rounded-xl bg-vault-primary px-8 py-3 font-semibold text-white transition hover:bg-vault-accent glow-primary"
          >
            Launch Dashboard
          </Link>
          <Link
            href="/portfolio"
            className="glass-card rounded-xl px-8 py-3 font-semibold text-slate-300 transition hover:text-white"
          >
            View Portfolio
          </Link>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="glass-card mx-6 -mt-4 grid w-full max-w-4xl grid-cols-3 gap-px overflow-hidden rounded-2xl">
        <StatCard label="Cycles Run" value={stats.cyclesRun.toString()} />
        <StatCard label="Total Supply" value={stats.totalSupply} />
        <StatCard label="Agent Cost" value="$0.003/cycle" />
      </section>

      {/* How It Works */}
      <section className="mx-auto mt-24 grid w-full max-w-5xl grid-cols-1 gap-6 px-6 pb-20 md:grid-cols-3">
        <FeatureCard
          step="01"
          title="Hire Specialists"
          description="Your agent pays 3 AI specialists $0.001 each via x402 nanopayments. Sentiment, whale tracking, momentum analysis."
        />
        <FeatureCard
          step="02"
          title="Adversarial Debate"
          description="Alpha argues FOR, Risk argues AGAINST, Executor decides. All run inside TEE enclaves with attestation proofs."
        />
        <FeatureCard
          step="03"
          title="Prove On-Chain"
          description="Every decision logged to Hedera HCS. One-click verification on Hashscan. Immutable and auditable forever."
        />
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 bg-white/5 px-6 py-5">
      <span className="font-mono text-2xl font-bold text-white">{value}</span>
      <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function FeatureCard({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="gradient-border p-6">
      <span className="font-mono text-xs text-vault-primary">{step}</span>
      <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>
    </div>
  );
}
