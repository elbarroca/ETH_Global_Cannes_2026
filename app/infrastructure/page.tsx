import type { Metadata } from "next";
import Link from "next/link";
import { CopyableIdentifier, EvidenceStatus } from "@/components/ui/evidence";
import {
  LIVE_CONTRACTS as CONFIGURED_ASSETS,
  NARYO_CONTRACT_ADDRESS,
  hashscanContractUrl,
} from "@/lib/links";

export const metadata: Metadata = {
  title: "Stack — AlphaDawg",
  description: "Configured testnet identifiers and the boundary to authenticated per-job evidence.",
};

const STACK_ROWS = [
  ...CONFIGURED_ASSETS.map((asset) => ({
    label: asset.label,
    chain: asset.chain,
    href: asset.href,
    identifier: asset.identifier,
  })),
  {
    label: "AlphaDawgAuditLog (Naryo)",
    chain: "Hedera",
    href: hashscanContractUrl(NARYO_CONTRACT_ADDRESS),
    identifier: NARYO_CONTRACT_ADDRESS,
  },
] as const;

export default function InfrastructurePage() {
  return (
    <main className="mx-auto max-w-5xl space-y-8 px-5 py-10 sm:px-6 sm:py-14">
      <header className="max-w-3xl space-y-3">
        <p className="text-xs font-mono uppercase tracking-widest text-dawg-400">Infrastructure</p>
        <h1 className="text-3xl font-bold tracking-tight text-void-100 md:text-5xl">
          Configuration is not proof
        </h1>
        <p className="text-base leading-relaxed text-void-400 md:text-lg">
          This page lists identifiers configured in the current testnet frontend. Canonical ENS,
          0G Compute, Storage, receipt, delivery, and settlement evidence is evaluated on each
          authenticated protected job.
        </p>
      </header>

      <section className="rounded-2xl border border-dawg-500/25 bg-dawg-500/5 p-5" aria-labelledby="verified-evidence-title">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="verified-evidence-title" className="text-lg font-semibold text-void-100">
              Currently verified evidence
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-void-500">
              No job is selected on this page, so no execution evidence is promoted here. Open a
              job receipt to see its ordered Proof Rail.
            </p>
          </div>
          <EvidenceStatus state="unavailable" label="Select a job" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/dashboard" className="inline-flex min-h-11 items-center rounded-xl bg-dawg-500 px-4 text-sm font-bold text-black hover:bg-dawg-400">
            Open protected jobs
          </Link>
          <Link href="/verify" className="inline-flex min-h-11 items-center rounded-xl border border-void-700 px-4 text-sm font-semibold text-void-200 hover:bg-void-800">
            Open verifier
          </Link>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="configured-identifiers-title">
        <div>
          <h2 id="configured-identifiers-title" className="text-lg font-semibold text-void-100">
            Configured identifiers
          </h2>
          <p className="mt-1 text-sm text-void-500">
            Explorer links help inspection; their presence does not assert current activity or A5 authority.
          </p>
        </div>
        <ul className="grid gap-3 md:grid-cols-2">
          {STACK_ROWS.map((row) => (
            <li key={`${row.chain}-${row.identifier}`} className="min-w-0 rounded-2xl border border-void-800 bg-void-900/60 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-void-100">{row.label}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-void-600">{row.chain} · configured</p>
                </div>
                <EvidenceStatus state="unavailable" label="Not job proof" />
              </div>
              <CopyableIdentifier label="Identifier" value={row.identifier} href={row.href} />
            </li>
          ))}
        </ul>
      </section>

      <details className="rounded-2xl border border-void-800 bg-void-900/40">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-void-200">
          Operator commands
        </summary>
        <div className="space-y-3 border-t border-void-800 px-5 py-4 text-sm text-void-500">
          <p>These commands start local operator processes; they are instructions, not current-status claims.</p>
          <pre className="overflow-x-auto rounded-xl border border-void-800 bg-black p-3 font-mono text-xs text-void-300"><code>{`npm run dev\nnpm run naryo:up`}</code></pre>
        </div>
      </details>
    </main>
  );
}
