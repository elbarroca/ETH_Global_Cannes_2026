import Image from "next/image";

interface DawgLogoProps {
  className?: string;
  /** Adds the `dawg-logo-animated` class which enables hover tilt. */
  animated?: boolean;
  /** Accessible label; defaults to "AlphaDawg". */
  title?: string;
  /** Rendered pixel size. Defaults to 64. Keep this close to the displayed
   *  size so Next.js picks the right raster bucket. */
  size?: number;
}

/**
 * AlphaDawg brand mark.
 *
 * Renders the canonical logo raster from `public/logo.png` — the single source
 * of truth shared with favicon, apple-touch-icon, and OG card. This is a raster
 * by design so every surface displays the exact same artwork.
 */
export function DawgLogo({
  className,
  animated = false,
  title = "AlphaDawg",
  size = 64,
}: DawgLogoProps) {
  const classes = [
    "dawg-logo select-none",
    animated ? "dawg-logo-animated" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Image
      src="/logo.png"
      alt={title}
      width={size}
      height={size}
      priority
      draggable={false}
      className={classes}
    />
  );
}
