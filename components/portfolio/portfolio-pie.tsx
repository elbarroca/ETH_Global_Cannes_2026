"use client";

// Hand-rolled SVG pie chart for the portfolio page.
//
// We intentionally do NOT pull a chart library for a single chart — the only
// reason to would be axis tooltips and we can draw those in ~40 lines of
// polar-to-cartesian math. Each slice is a single <path> with an `a` arc
// command, tinted from a fixed palette keyed on position symbol so ETH is
// always gold, USDC always teal, etc. across re-renders.

interface Position {
  symbol: string;
  amount: number;
  usdValue: number;
  sharePct: number;
}

// Muted, warm-leaning palette — matches @theme void + dawg (no neon rainbow).
const PALETTE: Record<string, string> = {
  USDC: "#3D8A82",
  USD: "#3D8A82",
  ETH: "#C9A227",
  WETH: "#9A7B1A",
  SYNTH: "#6B5B8C",
  UNI: "#8B5A6B",
  LINK: "#5A6B8B",
  AAVE: "#7A6B8C",
};
const FALLBACK = "#5C594F";

function colorFor(symbol: string): string {
  return PALETTE[symbol.toUpperCase()] ?? FALLBACK;
}

// Polar → cartesian with SVG's Y-down coordinate system.
function pointAt(cx: number, cy: number, radius: number, angleRad: number): [number, number] {
  return [cx + radius * Math.cos(angleRad), cy + radius * Math.sin(angleRad)];
}

function slicePath(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  // Guard the degenerate single-slice-100% case — SVG arcs can't span a full
  // circle, they'd close on themselves. Render as two half-arcs instead.
  const sweep = endAngle - startAngle;
  if (sweep >= Math.PI * 2 - 1e-6) {
    const mid = startAngle + Math.PI;
    const [x1, y1] = pointAt(cx, cy, radius, startAngle);
    const [xm, ym] = pointAt(cx, cy, radius, mid);
    return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${xm} ${ym} A ${radius} ${radius} 0 0 1 ${x1} ${y1} Z`;
  }
  const [x1, y1] = pointAt(cx, cy, radius, startAngle);
  const [x2, y2] = pointAt(cx, cy, radius, endAngle);
  const largeArc = sweep > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

export function PortfolioPie({
  positions,
  totalUsd,
}: {
  positions: Position[];
  totalUsd: number;
}) {
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 8;

  if (positions.length === 0 || totalUsd <= 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-sm text-void-500">
        <div className="w-[280px] h-[280px] rounded-full border-2 border-void-800 flex items-center justify-center">
          <span className="text-void-600 text-xs">No positions yet</span>
        </div>
        <p className="mt-3 text-xs">Run your first BUY cycle to see allocations here.</p>
      </div>
    );
  }

  // Pre-compute slices so both the SVG and the legend iterate the same data.
  // We walk the positions with a cumulative-angle reduce so nothing mutates
  // a captured variable — the ESLint "no-reassign-after-render" rule flags
  // the more natural `let cursor; cursor = end;` loop even though it's
  // perfectly safe inside a pure computation, so we sidestep it entirely.
  const START_ANGLE = -Math.PI / 2; // 12 o'clock
  const cumulativeSweep = (index: number): number =>
    positions
      .slice(0, index)
      .reduce((acc, q) => acc + (q.sharePct / 100) * Math.PI * 2, 0);

  const slices = positions.map((p, i) => {
    const sweep = (p.sharePct / 100) * Math.PI * 2;
    const start = START_ANGLE + cumulativeSweep(i);
    const end = start + sweep;
    return {
      position: p,
      path: slicePath(cx, cy, radius, start, end),
      labelPoint: pointAt(cx, cy, radius * 0.6, (start + end) / 2),
      color: colorFor(p.symbol),
    };
  });

  return (
    <div className="flex flex-col md:flex-row items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Portfolio composition">
        {/* Outer ring accent */}
        <circle cx={cx} cy={cy} r={radius + 4} fill="none" stroke="#17150F" strokeWidth="1" opacity={0.9} />
        {slices.map((s, i) => (
          <path
            key={`${s.position.symbol}-${i}`}
            d={s.path}
            fill={s.color}
            stroke="#070605"
            strokeWidth="1"
            opacity={0.88}
          >
            <title>
              {s.position.symbol} · {s.position.sharePct.toFixed(1)}% · $
              {s.position.usdValue.toFixed(2)}
            </title>
          </path>
        ))}
        {/* Center hole with total NAV */}
        <circle cx={cx} cy={cy} r={radius * 0.45} fill="#070605" stroke="#17150F" strokeWidth="1" />
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          className="fill-void-600"
          style={{ fontSize: 9, letterSpacing: 2 }}
        >
          TOTAL NAV
        </text>
        <text
          x={cx}
          y={cy + 16}
          textAnchor="middle"
          className="fill-dawg-400 font-mono font-semibold"
          style={{ fontSize: 21 }}
        >
          ${totalUsd.toFixed(2)}
        </text>
      </svg>

      <ul className="space-y-2.5 min-w-[200px] w-full max-w-xs">
        {slices.map((s) => (
          <li
            key={s.position.symbol}
            className="flex items-center justify-between gap-4 text-sm border-b border-void-800/50 pb-2.5 last:border-0 last:pb-0"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm shrink-0 ring-1 ring-black/40"
                style={{ backgroundColor: s.color }}
              />
              <span className="font-medium text-void-300 truncate">{s.position.symbol}</span>
            </div>
            <div className="text-right font-mono tabular-nums shrink-0">
              <div className="text-void-200 text-sm">
                {s.position.sharePct.toFixed(1)}%
              </div>
              <div className="text-void-600 text-[10px]">
                ${s.position.usdValue.toFixed(2)}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
