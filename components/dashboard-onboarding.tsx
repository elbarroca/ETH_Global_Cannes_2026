"use client";

import { useEffect, useCallback } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { DawgLogo } from "@/components/dawg-logo";

export const DASHBOARD_ONBOARDING_STORAGE_KEY = "alphadawg_dashboard_tour_v1_done";

interface DashboardOnboardingModalProps {
  open: boolean;
  onDismiss: () => void;
}

const SECTION_LABEL = "text-[10px] font-semibold uppercase tracking-[0.2em] text-dawg-400/80";

export function DashboardOnboardingModal({ open, onDismiss }: DashboardOnboardingModalProps) {
  const handleGotIt = useCallback(() => {
    try {
      localStorage.setItem(DASHBOARD_ONBOARDING_STORAGE_KEY, "1");
    } catch {
      // ignore quota / private mode
    }
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleGotIt();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleGotIt]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dashboard-onboarding-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-void-950/80 backdrop-blur-md cursor-default"
        aria-label="Close onboarding"
        onClick={handleGotIt}
      />
      <Card className="relative w-full max-w-lg max-h-[min(92vh,680px)] overflow-hidden border border-dawg-500/25 bg-void-900/95 shadow-2xl shadow-dawg-500/15 ring-1 ring-dawg-500/20">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-dawg-400/50 to-transparent" />
        <CardBody className="overflow-y-auto max-h-[min(92vh,680px)] px-5 py-6 sm:px-7 sm:py-7 space-y-5">
          <div className="flex gap-4 items-start">
            <div className="shrink-0 rounded-xl border border-dawg-500/20 bg-void-950/80 p-2 shadow-inner">
              <DawgLogo
                size={48}
                src="/logo-square.png"
                className="h-12 w-12 rounded-lg"
                unoptimized
              />
            </div>
            <div className="min-w-0 pt-0.5">
              <p className={`${SECTION_LABEL} mb-1`}>Welcome</p>
              <h2 id="dashboard-onboarding-title" className="text-xl font-bold text-void-50 tracking-tight">
                How AlphaDawg works
              </h2>
            </div>
          </div>

          <p className="text-sm text-void-300 leading-relaxed">
            A <strong className="text-gold-300 font-semibold">hunt</strong> is one full turn: your agent hires specialists with micropayments,
            runs an adversarial debate in sealed inference, then commits the decision to Hedera and optional 0G storage.
          </p>

          <div
            className="rounded-xl border border-amber-500/25 bg-amber-950/25 px-4 py-3 space-y-1.5"
            role="note"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400/95 flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
              About timestamps
            </p>
            <p className="text-sm text-amber-100/90 leading-snug">
              Times on hunt cards are <strong className="text-amber-200">when that hunt finished</strong>, not the current clock.
              The feed still syncs in the background — check &ldquo;Hunt feed synced&rdquo; under the header.
            </p>
          </div>

          <div className="rounded-xl border border-void-700/80 bg-void-950/40 p-4 space-y-3">
            <p className={SECTION_LABEL}>First steps</p>
            <ol className="space-y-2.5">
              {[
                "Connect your wallet and fund the agent wallet (Arc USDC).",
                <>Set a <strong className="text-void-100 font-semibold">Hunt goal</strong> — it drives every cycle.</>,
                <>Optional: open <strong className="text-void-100 font-semibold">Pack</strong> or create a specialist.</>,
                <>Start <strong className="text-void-100 font-semibold">Auto-hunt</strong> or trigger hunts from Telegram / dashboard.</>,
                "Expand a hunt to see audit links, swap hashes, and proofs.",
              ].map((content, i) => (
                <li key={i} className="flex gap-3 text-sm text-void-300 leading-snug">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-dawg-500/35 bg-dawg-500/10 font-mono text-xs font-bold text-dawg-300"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span className="pt-0.5 min-w-0">{content}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-xl border border-void-700/80 bg-void-950/40 p-4 space-y-3">
            <p className={SECTION_LABEL}>Terms</p>
            <dl className="grid gap-2.5 sm:grid-cols-2">
              {[
                { k: "TEE / Sealed", c: "text-teal-400", d: "Inference in a trusted environment; outputs attested." },
                { k: "x402", c: "text-emerald-400", d: "Micropayments on Arc (e.g. $0.001) per specialist call." },
                { k: "HCS", c: "text-blue-400", d: "Hedera Consensus Service — immutable cycle audit log." },
                { k: "OG / 0G", c: "text-purple-400", d: "Decentralized storage for rich records and memory." },
              ].map(({ k, c, d }) => (
                <div
                  key={k}
                  className="rounded-lg border border-void-800/90 bg-void-900/60 px-3 py-2.5"
                >
                  <dt className={`text-xs font-bold ${c} mb-0.5`}>{k}</dt>
                  <dd className="text-[11px] text-void-400 leading-relaxed">{d}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-lg border border-void-800 bg-void-950/60 px-3.5 py-2.5">
            <p className="text-[11px] text-void-500 leading-relaxed">
              <span className="text-void-400 font-medium">Layout:</span> the right column is live swarm / network activity.
              The center column is <strong className="text-void-400">your</strong> completed hunts — they only change when a new hunt finishes.
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:items-center gap-2 pt-1 border-t border-void-800/80">
            <p className="text-[10px] text-void-600 text-center sm:text-right sm:mr-auto">
              Press <kbd className="px-1.5 py-0.5 rounded bg-void-800 border border-void-700 font-mono text-void-400">Esc</kbd> or click outside to close
            </p>
            <button
              type="button"
              onClick={handleGotIt}
              className="w-full sm:w-auto px-8 py-3 bg-dawg-500 hover:bg-dawg-400 active:bg-dawg-500 text-void-950 text-sm font-bold rounded-xl transition-colors shadow-lg shadow-dawg-500/20"
            >
              Got it
            </button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
