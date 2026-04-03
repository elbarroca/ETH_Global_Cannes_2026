import { type ReactNode } from "react";

type BadgeVariant =
  | "green"
  | "red"
  | "amber"
  | "purple"
  | "blue"
  | "gray"
  | "indigo";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-600",
  amber: "bg-amber-50 text-amber-700",
  purple: "bg-purple-50 text-purple-700",
  blue: "bg-blue-50 text-blue-700",
  gray: "bg-gray-100 text-gray-600",
  indigo: "bg-indigo-50 text-indigo-700",
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
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export function SealedBadge({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono bg-emerald-50 text-emerald-700 hover:opacity-80 transition-opacity"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      sealed
    </button>
  );
}

export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
      live
    </span>
  );
}

export function ZeroGBadge({ label = "0G iNFT" }: { label?: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono bg-purple-50 text-purple-700">
      {label}
    </span>
  );
}
