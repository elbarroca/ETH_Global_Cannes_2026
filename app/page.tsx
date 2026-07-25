import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  GitBranchIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react/dist/ssr";
import { WalletConnectButton } from "@/components/wallet-connect";

export const metadata: Metadata = {
  title: "AlphaDawg | Protected recurring goals",
  description: "Define a recurring goal, hire immutable agents, and inspect exact evidence.",
};

const FLOW = [
  ["Goal", "Objective, cadence, execution mode, and hard atomic limits."],
  ["Agents", "External canonical versions match by reviewed capability."],
  ["Report", "Parallel jobs converge into one evidence-linked conclusion."],
  ["Proof", "ENS, MCP, compute, storage, receipt, and financial outcome stay inspectable."],
] as const;

export default function LandingPage() {
  return (
    <main>
      <section className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-[90rem] items-center gap-12 px-4 py-10 sm:px-6 md:py-14 lg:grid-cols-[minmax(0,1.08fr)_minmax(26rem,0.92fr)] lg:gap-16">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <p className="instrument-label text-dawg-400">AlphaDawg protected workspace</p>
          </div>
          <h1 className="mt-6 max-w-[15ch] text-4xl font-semibold leading-[1.04] tracking-[-0.045em] text-void-100 sm:text-5xl lg:text-6xl">
            One goal. A verified agent loop.
          </h1>
          <p className="mt-5 max-w-[34rem] text-base leading-relaxed text-void-400 sm:text-lg">
            Define one recurring objective. Immutable agents run in parallel. Every result stays bounded by evidence and approval.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <WalletConnectButton />
            <Link href="/dashboard" className="instrument-button instrument-button-secondary">
              Enter workspace <ArrowRightIcon size={17} aria-hidden />
            </Link>
            <Link href="/marketplace?view=available" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-void-300 hover:text-void-100">
              Explore agents
            </Link>
          </div>
          <p className="mt-4 max-w-xl text-xs leading-relaxed text-void-500">
            New wallets onboard first, then explicitly authorize the workspace. Neither signature authorizes a transaction.
          </p>
        </div>

        <section aria-labelledby="orchestration-model" className="border-y border-void-800 py-6 sm:py-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="instrument-label">Actual orchestration</p>
              <h2 id="orchestration-model" className="mt-2 text-xl font-semibold text-void-100">One objective, parallel evidence</h2>
            </div>
            <GitBranchIcon size={25} className="text-dawg-400" aria-hidden />
          </div>
          <div className="mt-7 grid grid-cols-[minmax(0,1fr)_1.5rem_minmax(0,1fr)] items-center gap-2 text-sm">
            <div className="border-l-2 border-dawg-500 py-3 pl-4">
              <p className="font-semibold text-void-100">Recurring goal</p>
              <p className="mt-1 text-void-500">Policy + atomic caps</p>
            </div>
            <ArrowRightIcon className="text-void-600" aria-hidden />
            <div className="space-y-2">
              {["Research lane", "Risk lane", "Market lane"].map((lane) => (
                <div key={lane} className="border-l border-void-700 py-1.5 pl-3 text-void-300">{lane}</div>
              ))}
            </div>
          </div>
          <div className="ml-auto mt-4 max-w-[65%] border-t border-dawg-700 pt-4">
            <div className="flex items-start gap-3">
              <ShieldCheckIcon size={20} className="mt-0.5 shrink-0 text-dawg-400" aria-hidden />
              <div><p className="font-semibold text-void-100">Verified report</p><p className="mt-1 text-sm text-void-500">Conclusion first. Exact jobs and receipts remain linked.</p></div>
            </div>
          </div>
        </section>
      </section>

      <section aria-labelledby="product-loop" className="border-y border-void-800">
        <div className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[0.65fr_1.35fr]">
            <div>
              <p className="instrument-label text-dawg-400">Publish, hire, prove</p>
              <h2 id="product-loop" className="mt-3 text-3xl font-semibold tracking-tight text-void-100">The protected loop</h2>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-void-400">Publication proves registry eligibility. Each hire still earns its own runtime evidence.</p>
            </div>
            <ol className="divide-y divide-void-800 border-y border-void-800">
              {FLOW.map(([title, detail]) => (
                <li key={title} className="grid gap-2 py-4 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-start">
                  <h3 className="font-semibold text-void-100">{title}</h3>
                  <p className="text-sm leading-relaxed text-void-400">{detail}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-10 grid gap-5 border-t border-void-800 pt-8 md:grid-cols-2">
            <div className="flex gap-3"><CheckCircleIcon size={20} className="mt-0.5 shrink-0 text-dawg-400" aria-hidden /><div><h3 className="font-semibold text-void-100">Autonomous research</h3><p className="mt-1 text-sm text-void-400">Bounded agent runs may research and synthesize without wallet transaction authority.</p></div></div>
            <div className="flex gap-3"><ShieldCheckIcon size={20} className="mt-0.5 shrink-0 text-dawg-400" aria-hidden /><div><h3 className="font-semibold text-void-100">Wallet-approved execution</h3><p className="mt-1 text-sm text-void-400">Swap proposals remain disabled while A6 is blocked and always require explicit approval.</p></div></div>
          </div>

          <div className="mt-10 flex flex-col gap-4 border-t border-void-800 pt-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-sm text-void-400">Creator ENS, immutable version, authority, receipt, and refusal remain visible from catalog to proof.</p>
            <Link href="/dashboard" className="instrument-button instrument-button-primary">Define a protected goal <ArrowRightIcon size={17} aria-hidden /></Link>
          </div>
        </div>
      </section>
    </main>
  );
}
