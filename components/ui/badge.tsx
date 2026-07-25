import { type ReactNode } from "react";

type BadgeVariant =
  | "green"
  | "red"
  | "amber"
  | "purple"
  | "blue"
  | "teal"
  | "gray"
  | "indigo";

/**
 * Compact evidence labels shared across the product shell.
 */
const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  green:  "bg-emerald-950/30 text-emerald-300 border border-emerald-500/35",
  red:    "bg-blood-900/25 text-blood-300 border border-blood-500/35",
  amber:  "bg-dawg-900/25 text-dawg-300 border border-dawg-500/35",
  purple: "bg-purple-950/25 text-purple-300 border border-purple-500/35",
  blue:   "bg-blue-950/25 text-blue-300 border border-blue-500/35",
  teal:   "bg-teal-950/25 text-teal-300 border border-teal-500/35",
  gray:   "bg-black text-void-300 border border-void-700",
  indigo: "bg-black text-void-300 border border-void-700",
};

export function Badge({
  variant = "gray",
  children,
  className = "",
}: {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1 px-2 py-1 rounded-md font-mono text-[10px] font-semibold leading-none uppercase tracking-wider ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export function SealedBadge({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-dawg-500/40 bg-dawg-900/25 px-2 py-1 font-mono text-[10px] font-semibold leading-none uppercase tracking-wider text-dawg-300 transition-colors hover:border-dawg-500/70"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-dawg-400" />
      ATTESTATION
    </button>
  );
}

export function LiveBadge({ variant = "dark" }: { variant?: "dark" | "light" }) {
  if (variant === "light") {
    return (
      <span className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-neutral-900 bg-white px-2 py-1 font-mono text-[10px] font-semibold leading-none uppercase tracking-wider text-emerald-800">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
        OBSERVED
      </span>
    );
  }
  return (
    <span className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-emerald-500/35 bg-emerald-950/30 px-2 py-1 font-mono text-[10px] font-semibold leading-none uppercase tracking-wider text-emerald-300">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      OBSERVED
    </span>
  );
}

export function ZeroGBadge({ label = "0G iNFT" }: { label?: string }) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-md border border-purple-500/35 bg-purple-950/25 px-2 py-1 font-mono text-[10px] font-semibold leading-none uppercase tracking-wider text-purple-300">
      {label}
    </span>
  );
}
