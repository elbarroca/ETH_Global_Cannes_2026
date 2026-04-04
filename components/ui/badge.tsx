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

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  green: "bg-emerald-950/50 text-emerald-400 border border-emerald-800/30",
  red: "bg-blood-900/50 text-blood-300 border border-blood-800/30",
  amber: "bg-gold-400/10 text-gold-400 border border-gold-400/20",
  purple: "bg-void-800/80 text-void-400 border border-void-700/50",
  blue: "bg-blue-950/50 text-blue-300 border border-blue-800/30",
  teal: "bg-teal-950/50 text-teal-300 border border-teal-800/30",
  gray: "bg-void-800/60 text-void-400 border border-void-700/40",
  indigo: "bg-void-800/80 text-void-400 border border-void-700/50",
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
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export function SealedBadge({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono bg-gold-400/10 text-gold-400 border border-gold-400/20 hover:bg-gold-400/15 transition-colors"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse" />
      sealed
    </button>
  );
}

export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono bg-dawg-500/15 text-dawg-300 border border-dawg-500/30">
      <span className="w-1.5 h-1.5 rounded-full bg-dawg-400 animate-pulse" />
      live
    </span>
  );
}

export function ZeroGBadge({ label = "0G iNFT" }: { label?: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono bg-void-800/60 text-void-400 border border-void-700/40">
      {label}
    </span>
  );
}
