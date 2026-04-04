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
 * Badge variants are styled as miniature LED chips: pure black fill, a
 * subtle accent border, and glowing pixel-font text. This keeps them
 * visually coherent with the Nasdaq Marketsite aesthetic that drives the
 * rest of the dashboard.
 */
const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  green:  "bg-black text-[#39FF7A] border border-emerald-500/40 glow-green",
  red:    "bg-black text-[#FF5A5A] border border-blood-500/40 glow-red",
  amber:  "bg-black text-[#FFCC00] border border-dawg-500/40 glow-dawg",
  purple: "bg-black text-[#C497FF] border border-purple-500/40 glow-purple",
  blue:   "bg-black text-[#7DB7FF] border border-blue-500/40",
  teal:   "bg-black text-[#5EEAD4] border border-teal-500/40 glow-teal",
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
      className={`font-pixel inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[14px] leading-none uppercase tracking-wider ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export function SealedBadge({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="font-pixel glow-dawg inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[14px] leading-none uppercase tracking-wider bg-black text-[#FFCC00] border border-dawg-500/40 hover:border-dawg-500/70 transition-colors"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-dawg-400 shadow-[0_0_8px_rgba(255,199,0,0.9)] animate-pulse" />
      SEALED
    </button>
  );
}

export function LiveBadge() {
  return (
    <span className="font-pixel glow-green inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[14px] leading-none uppercase tracking-wider bg-black text-[#39FF7A] border border-emerald-500/40">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse" />
      LIVE
    </span>
  );
}

export function ZeroGBadge({ label = "0G iNFT" }: { label?: string }) {
  return (
    <span className="font-pixel glow-purple inline-flex items-center px-2 py-0.5 rounded-md text-[14px] leading-none uppercase tracking-wider bg-black text-[#C497FF] border border-purple-500/40">
      {label}
    </span>
  );
}
