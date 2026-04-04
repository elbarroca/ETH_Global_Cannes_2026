"use client";

import Image from "next/image";

interface DawgSpinnerProps {
  /** Pixel diameter of the coin. Defaults to 20 (inline / button size). */
  size?: number;
  /** Optional text shown directly underneath the spinning coin. */
  label?: string;
  /** Tailwind classes applied to the label span. */
  labelClassName?: string;
  /** Extra classes on the outer wrapper. */
  className?: string;
}

/**
 * Inline AlphaDawg coin spinner — renders the logo as a rotating coin with
 * an optional label stacked underneath. Drop this anywhere you would normally
 * render a plain "Loading…" string, including inside buttons.
 *
 * The coin reuses the same `dawg-coin` / `dawg-coin-spin` CSS as the full
 * `DawgLoader` overlay, so the spin cadence and drop-shadow match the page
 * loader — the only difference is scale and the absence of the blast exit.
 */
export function DawgSpinner({
  size = 20,
  label,
  labelClassName = "text-void-400",
  className = "",
}: DawgSpinnerProps) {
  // Request a raster roughly 2x the display size so the coin stays crisp
  // on retina without making Next/Image cry.
  const rasterSize = Math.max(32, size * 2);

  return (
    <span
      className={`inline-flex flex-col items-center justify-center gap-1.5 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span
        className="dawg-loader-stage inline-block"
        style={{ width: size, height: size }}
      >
        <span
          className="dawg-coin dawg-coin-spin block rounded-full overflow-hidden bg-dawg-500"
          style={{ width: size, height: size }}
        >
          <Image
            src="/logo.png"
            alt=""
            width={rasterSize}
            height={rasterSize}
            draggable={false}
            className="w-full h-full object-cover select-none"
          />
        </span>
      </span>
      {label && (
        <span
          className={`font-mono text-[11px] leading-none tracking-wide ${labelClassName}`}
        >
          {label}
        </span>
      )}
    </span>
  );
}
