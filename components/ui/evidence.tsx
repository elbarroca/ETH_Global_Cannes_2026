"use client";

import { useState } from "react";
import type { EvidenceState } from "@/src/kernel/types";

const EVIDENCE_PRESENTATION: Record<
  EvidenceState,
  { label: string; classes: string; dot: string }
> = {
  verified: {
    label: "Verified",
    classes: "border-emerald-500/35 bg-emerald-950/25 text-emerald-300",
    dot: "bg-emerald-400",
  },
  pending: {
    label: "Pending",
    classes: "border-dawg-500/35 bg-dawg-900/20 text-dawg-300",
    dot: "bg-dawg-400",
  },
  unavailable: {
    label: "Unavailable",
    classes: "border-void-700 bg-void-950 text-void-400",
    dot: "bg-void-600",
  },
  failed: {
    label: "Failed",
    classes: "border-blood-500/35 bg-blood-900/25 text-blood-300",
    dot: "bg-blood-400",
  },
};

export function EvidenceStatus({
  state,
  label,
  className = "",
}: {
  state: EvidenceState;
  label?: string;
  className?: string;
}) {
  const presentation = EVIDENCE_PRESENTATION[state];
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider ${presentation.classes} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${presentation.dot}`} aria-hidden="true" />
      {label ?? presentation.label}
    </span>
  );
}

function compactIdentifier(value: string): string {
  if (value.length <= 22) return value;
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

export function CopyableIdentifier({
  label,
  value,
  href,
  className = "",
}: {
  label: string;
  value: string;
  href?: string;
  className?: string;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  async function copyValue(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1_800);
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className={`min-w-0 rounded-lg border border-void-800 bg-void-950/70 p-2.5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-void-600">
          {label}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md px-2 py-1 text-[10px] font-semibold text-dawg-400 transition-colors hover:bg-dawg-500/10 hover:text-dawg-300"
            >
              Explorer
              <span className="sr-only"> for {label}</span>
            </a>
          )}
          <button
            type="button"
            onClick={copyValue}
            className="rounded-md px-2 py-1 text-[10px] font-semibold text-void-400 transition-colors hover:bg-void-800 hover:text-void-100"
            aria-label={`Copy ${label}`}
          >
            {copyState === "copied" ? "Copied" : copyState === "failed" ? "Retry" : "Copy"}
          </button>
        </div>
      </div>
      <code className="identifier-value mt-1 block font-mono text-xs text-void-300" title={value}>
        {compactIdentifier(value)}
      </code>
      <span className="sr-only" aria-live="polite">
        {copyState === "copied"
          ? `${label} copied to clipboard.`
          : copyState === "failed"
            ? `${label} could not be copied.`
            : ""}
      </span>
    </div>
  );
}
