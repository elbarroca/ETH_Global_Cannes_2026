import Link from "next/link";
import { getStats } from "@/lib/api";
import { WalletConnectButton } from "@/components/wallet-connect";

export const revalidate = 30;

export default async function LandingPage() {
  const stats = await getStats();

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <span className="text-xl font-bold text-indigo-400">⚡ VaultMind</span>
        <WalletConnectButton />
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-32 gap-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-sm">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          Live on Base Sepolia · Hedera Testnet
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight max-w-4xl">
          Your AI.{" "}
          <span className="text-indigo-400">Provable decisions.</span>{" "}
          Glass box.
        </h1>

        <p className="text-xl text-slate-400 max-w-2xl leading-relaxed">
          An economy of AI agents. Each investor gets their own. Your agent hires
          specialist sub-agents via $0.001 nanopayments, debates adversarially inside
          TEE enclaves, and logs every decision to Hedera immutably.
        </p>

        <div className="flex gap-4 mt-4">
          <Link
            href="/onboard"
            className="px-8 py-3 bg-indigo-500 hover:bg-indigo-600 rounded-lg font-semibold text-white transition-colors"
          >
            Get Started →
          </Link>
          <Link
            href="/dashboard"
            className="px-8 py-3 border border-slate-700 hover:border-indigo-500 rounded-lg font-semibold text-slate-300 transition-colors"
          >
            View Dashboard
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="flex justify-center gap-8 px-6 py-8 border-y border-slate-800">
        <StatCard label="Total Value Locked" value={`$${stats.tvl.toLocaleString()}`} />
        <StatCard label="Cycles Run" value={stats.cyclesRun.toLocaleString()} />
        <StatCard label="Active Agents" value={stats.activeAgents.toLocaleString()} />
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-24 grid grid-cols-1 md:grid-cols-3 gap-6">
        <FeatureCard
          icon="💰"
          title="Pay-per-use AI"
          body="Your agent hires specialist analysts via x402 nanopayments. $0.001 per inference. No subscriptions, no waste."
        />
        <FeatureCard
          icon="🔒"
          title="TEE Proofs"
          body="Every inference runs inside 0G Compute's tamper-proof enclaves. Cryptographic attestation on every decision."
        />
        <FeatureCard
          icon="📋"
          title="Immutable Audit"
          body="Every decision logged to Hedera HCS. Permanent, timestamped, publicly verifiable. Your agent can't hide."
        />
      </section>

      <footer className="text-center py-8 text-slate-600 text-sm border-t border-slate-800">
        Built at ETH Global Cannes 2026 · VaultMind
      </footer>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-bold text-indigo-400">{value}</div>
      <div className="text-sm text-slate-500 mt-1">{label}</div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-indigo-500/50 transition-colors">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{body}</p>
    </div>
  );
}
