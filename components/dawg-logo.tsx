interface DawgLogoProps {
  className?: string;
  /** Adds the `dawg-logo-animated` class which enables hover ear-wiggle. */
  animated?: boolean;
  /** Omit the yellow rounded background (for use over pre-colored surfaces). */
  transparent?: boolean;
  /** Accessible label; defaults to "AlphaDawg". */
  title?: string;
}

/**
 * AlphaDawg brand mark. Dog head with shades on yellow.
 *
 * Class hooks used by animations in `globals.css`:
 * - `.dawg-ears`    — ear-wiggle on hover
 * - `.dawg-glasses` — glint/shine
 */
export function DawgLogo({
  className,
  animated = false,
  transparent = false,
  title = "AlphaDawg",
}: DawgLogoProps) {
  const classes = [
    "dawg-logo",
    animated ? "dawg-logo-animated" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <svg
      viewBox="0 0 240 240"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={classes}
    >
      <title>{title}</title>
      {!transparent && <rect width="240" height="240" rx="36" fill="#FFC700" />}

      <g
        stroke="#000000"
        strokeWidth="9"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <g className="dawg-ears" fill="#FFFFFF">
          <path d="M102 82 Q94 22 118 18 Q138 24 128 78 Z" />
          <path d="M132 72 Q148 30 172 38 Q194 54 182 90 Q174 106 156 98 Z" />
        </g>

        <path
          fill="#FFFFFF"
          d="M40 200 L40 148 L24 148 L24 132 L40 132 L40 120 Q40 104 56 100 L82 94 Q88 78 116 78 L150 78 Q180 78 184 122 L206 122 Q218 122 218 136 L218 188 Q218 208 198 208 L58 208 Q40 208 40 200 Z"
        />
        <rect x="10" y="132" width="18" height="16" fill="#000000" />
      </g>

      <g
        className="dawg-glasses"
        fill="#000000"
        stroke="#000000"
        strokeWidth="5"
        strokeLinejoin="round"
      >
        <path d="M52 130 Q52 118 66 118 L144 118 Q158 118 162 132 L168 148 L184 144 Q202 140 206 156 Q208 174 190 178 L168 181 Q156 182 152 170 L146 156 L62 164 Q48 166 48 150 L48 138 Q48 130 52 130 Z" />
      </g>
    </svg>
  );
}
