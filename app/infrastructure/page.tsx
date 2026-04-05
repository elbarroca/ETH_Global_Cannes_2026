import type { Metadata } from "next";
import Link from "next/link";
import {
  LIVE_CONTRACTS,
  NARYO_CONTRACT_ADDRESS,
  hashscanContractUrl,
} from "@/lib/links";

export const metadata: Metadata = {
  title: "Stack — AlphaDawg",
  description:
    "0G Compute & Storage, Hedera HCS/HTS, Arc x402 nanopayments, Naryo multichain listener — the chains and contracts behind AlphaDawg.",
  openGraph: {
    title: "Stack — AlphaDawg",
    description: "Where audit, memory, payments, and identity live on-chain.",
  },
};

const NARYO_ROW = {
  label: "AlphaDawgAuditLog (Naryo)",
  chain: "Hedera",
  description:
    "Hedera EVM contract — event emitter for the Naryo listener (cycle, hire, deposit, heartbeat, cross-chain correlation).",
  href: hashscanContractUrl(NARYO_CONTRACT_ADDRESS),
  identifier: NARYO_CONTRACT_ADDRESS,
} as const;

type StackRow = {
  label: string;
  chain: string;
  description: string;
  href: string;
  identifier: string;
};

const STACK_ROWS: StackRow[] = [
  ...LIVE_CONTRACTS.map((c) => ({
    label: c.label,
    chain: c.chain,
    description: c.description,
    href: c.href,
    identifier: c.identifier,
  })),
  NARYO_ROW,
];

export default function InfrastructurePage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16 space-y-12">
      <header className="space-y-3 text-center">
        <p className="text-xs font-mono uppercase tracking-widest text-dawg-400">Infrastructure</p>
        <h1 className="text-4xl md:text-5xl font-bold text-void-100 tracking-tight">
          Multichain by design
        </h1>
        <p className="text-lg text-void-400 max-w-2xl mx-auto leading-relaxed">
          Sealed inference and memory on 0G, immutable audit on Hedera, nanopayments on Arc — wired
          for bounties that require real SDK usage, not slideware.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-void-500">Live contracts & topics</h2>
        <ul className="space-y-3">
          {STACK_ROWS.map((row) => (
            <li
              key={row.identifier}
              className="rounded-xl border border-void-800 bg-void-900/60 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-void-100">{row.label}</span>
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-void-800 text-void-400">
                    {row.chain}
                  </span>
                </div>
                <p className="text-xs text-void-500 mt-1 max-w-xl">{row.description}</p>
                <p className="text-[10px] font-mono text-void-600 mt-1 break-all">{row.identifier}</p>
              </div>
              <a
                href={row.href}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-sm text-dawg-400 hover:underline font-medium"
              >
                Explorer ↗
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-void-800 bg-void-900/40 p-6 space-y-3">
        <h2 className="text-lg font-semibold text-void-100">Naryo listener</h2>
        <p className="text-sm text-void-400 leading-relaxed">
          The multichain feed on the dashboard is populated by HTTP POSTs from the Naryo Docker stack
          (<code className="text-void-300">npm run naryo:up</code>) to Next.js on port 3000, with a
          Hedera Mirror fallback when the DB is empty. Run <code className="text-void-300">npm run dev</code>{" "}
          alongside Naryo so <code className="text-void-300">host.docker.internal:3000</code> receives events.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link href="/verify" className="text-sm text-dawg-400 hover:underline">
            TEE verification →
          </Link>
          <Link href="/dashboard" className="text-sm text-void-400 hover:text-void-200">
            Dashboard →
          </Link>
        </div>
      </section>
    </div>
  );
}
