import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  ChartLineUpIcon,
  CheckCircleIcon,
  GitBranchIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  TargetIcon,
} from "@phosphor-icons/react/dist/ssr";

export const metadata: Metadata = {
  title: "AlphaDawg | Protected recurring goals",
  description: "Define a recurring goal, hire immutable agents, and inspect exact evidence.",
};

const LANES = [
  { label: "Research", detail: "Collect source evidence", icon: MagnifyingGlassIcon },
  { label: "Risk", detail: "Test limits and refusals", icon: ShieldCheckIcon },
  { label: "Market", detail: "Read conditions and signals", icon: ChartLineUpIcon },
] as const;

const FLOW = [
  ["Goal", "Set the objective, cadence, agent count, and hard atomic limits."],
  ["Agents", "Match reviewed external canonical versions by required capability."],
  ["Report", "Converge parallel jobs into one evidence-linked conclusion."],
  ["Proof", "Inspect ENS, MCP, compute, storage, receipt, and financial outcome."],
] as const;

export default function LandingPage() {
  return (
    <main>
      <section className="mx-auto grid max-w-[90rem] items-center gap-9 px-4 py-8 sm:px-6 md:py-12 lg:grid-cols-[minmax(0,0.82fr)_minmax(34rem,1.18fr)] lg:gap-12 lg:py-16">
        <div className="max-w-xl">
          <p className="instrument-label text-dawg-400">Protected recurring goals</p>
          <h1 className="mt-5 max-w-[13ch] text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-void-100 sm:text-5xl lg:text-6xl">
            One goal. A verified agent loop.
          </h1>
          <p className="mt-5 max-w-[32rem] text-base leading-relaxed text-void-400 sm:text-lg">
            Define one objective. Immutable agents run in parallel. Every result stays bounded by evidence and approval.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/dashboard" className="instrument-button instrument-button-primary">
              Define a protected goal <ArrowRightIcon size={17} aria-hidden />
            </Link>
            <Link href="/marketplace?view=available" className="instrument-button instrument-button-secondary">
              Explore agents <ArrowRightIcon size={17} aria-hidden />
            </Link>
          </div>
          <p className="mt-4 max-w-lg text-xs leading-relaxed text-void-500">
            New wallets onboard first, then explicitly authorize the workspace. Neither signature authorizes a transaction.
          </p>
        </div>

        <section aria-labelledby="orchestration-model" className="instrument-panel overflow-hidden p-4 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="instrument-label">Protected flow</p>
              <h2 id="orchestration-model" className="mt-2 text-lg font-semibold text-void-100">One objective, parallel evidence</h2>
            </div>
            <GitBranchIcon size={24} className="text-dawg-400" aria-hidden />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(9rem,0.68fr)_1.6rem_minmax(15rem,1.18fr)_1.6rem_minmax(10rem,0.72fr)] lg:items-center">
            <div className="border-l-2 border-dawg-500 py-2 pl-4">
              <div className="flex items-center gap-2 text-dawg-300"><TargetIcon size={18} aria-hidden /><p className="text-sm font-semibold">Goal input</p></div>
              <p className="mt-3 text-sm leading-relaxed text-void-300">Monitor liquidity evidence and report bounded execution risk.</p>
              <p className="mt-3 font-mono text-[0.6875rem] text-void-500">2 agents max / policy capped</p>
            </div>

            <ArrowRightIcon className="hidden text-void-600 lg:block" aria-hidden />

            <div>
              <p className="mb-2 text-xs font-semibold text-void-500">Immutable agent lanes</p>
              <ol className="space-y-2">
                {LANES.map(({ label, detail, icon: Icon }) => (
                  <li key={label} className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-3 rounded-[10px] bg-void-850 px-3 py-2.5">
                    <Icon size={19} className="text-dawg-400" aria-hidden />
                    <div><p className="text-sm font-semibold text-void-100">{label}</p><p className="mt-0.5 text-xs text-void-500">{detail}</p></div>
                  </li>
                ))}
              </ol>
            </div>

            <ArrowRightIcon className="hidden text-void-600 lg:block" aria-hidden />

            <div className="border-l-2 border-dawg-500 py-2 pl-4">
              <div className="flex items-center gap-2"><ShieldCheckIcon size={19} className="text-dawg-400" aria-hidden /><p className="text-sm font-semibold text-void-100">Converged report</p></div>
              <p className="mt-3 text-base font-semibold leading-snug text-void-100">Conclusion first. Exact jobs and receipts stay linked.</p>
              <p className="mt-3 text-xs leading-relaxed text-void-500">Missing evidence remains unavailable. A failed job promotes nothing as verified.</p>
            </div>
          </div>
        </section>
      </section>

      <section aria-labelledby="product-loop" className="border-t border-void-800">
        <div className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6 lg:py-12">
          <div className="grid gap-8 lg:grid-cols-[0.55fr_1.45fr] lg:gap-14">
            <div>
              <h2 id="product-loop" className="text-2xl font-semibold tracking-tight text-void-100 sm:text-3xl">Publish, hire, prove</h2>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-void-400">Publication proves registry eligibility. Every hire still earns its own runtime evidence.</p>
            </div>
            <ol className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {FLOW.map(([title, detail], index) => (
                <li key={title} className="min-w-0">
                  <div className="flex items-center gap-2"><CheckCircleIcon size={18} className="text-dawg-400" aria-hidden /><h3 className="font-semibold text-void-100">{title}</h3></div>
                  <p className="mt-2 text-sm leading-relaxed text-void-400">{detail}</p>
                  {index === FLOW.length - 1 && <Link href="/verify" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-dawg-300">Inspect proof <ArrowRightIcon className="ml-2" size={16} aria-hidden /></Link>}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </main>
  );
}
