"use client";

// NAV-over-time line chart rendered with hand-rolled SVG.
//
// X axis = cycle number (or time — cycle is more useful because hunts are
//          the natural unit for this product).
// Y axis = navAfter USD, autoscaled to [min, max] of the series.
//
// Points are color-coded by action: BUY = green, SELL = red, HOLD = gold.
// The line connects every point sequentially. Hover title tags surface
// cycle number, action, asset, pct, and nav.

interface EvolutionPoint {
  cycleNumber: number;
  timestamp: string;
  action: string;
  asset: string;
  pct: number;
  navAfter: number;
  swapTxHash: string | null;
  attribution: {
    specialist: string | null;
    confidence: number | null;
    signal: string | null;
  };
}

const ACTION_COLORS: Record<string, string> = {
  BUY: "#39FF7A",
  SELL: "#FF5A5A",
  HOLD: "#FFC700",
};

export function EvolutionChart({ evolution }: { evolution: EvolutionPoint[] }) {
  // Filter to just the points that actually moved NAV — cycles with a swap.
  // HOLD cycles with unchanged NAV would flatten the line and hide signal.
  const points = evolution.filter((p) => p.navAfter > 0);

  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center h-[220px] border border-void-800 rounded-lg text-xs text-void-600">
        Need at least 2 committed hunts to draw the evolution chart.
      </div>
    );
  }

  const width = 720;
  const height = 240;
  const padL = 56;
  const padR = 16;
  const padT = 16;
  const padB = 32;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const navs = points.map((p) => p.navAfter);
  const minNav = Math.min(...navs);
  const maxNav = Math.max(...navs);
  const navRange = maxNav - minNav || 1;
  // Pad the y domain by 5% either side so points don't touch the edges.
  const yMin = minNav - navRange * 0.05;
  const yMax = maxNav + navRange * 0.05;

  const minCycle = points[0].cycleNumber;
  const maxCycle = points[points.length - 1].cycleNumber;
  const xRange = maxCycle - minCycle || 1;

  const xScale = (cycleNumber: number): number =>
    padL + ((cycleNumber - minCycle) / xRange) * innerW;
  const yScale = (nav: number): number =>
    padT + innerH - ((nav - yMin) / (yMax - yMin)) * innerH;

  const pathD = points
    .map((p, i) => {
      const x = xScale(p.cycleNumber);
      const y = yScale(p.navAfter);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  // Y-axis gridline values — 4 evenly-spaced marks.
  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((t) => yMin + (yMax - yMin) * t);

  return (
    <div className="overflow-x-auto">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Portfolio NAV evolution"
        className="min-w-full"
      >
        {/* Horizontal grid lines + y-axis labels */}
        {gridValues.map((v, i) => {
          const y = yScale(v);
          return (
            <g key={i}>
              <line
                x1={padL}
                x2={width - padR}
                y1={y}
                y2={y}
                stroke="#1F1B18"
                strokeDasharray="2 4"
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-void-500 font-mono"
                style={{ fontSize: 10 }}
              >
                ${v.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* X-axis line + labels (first, middle, last) */}
        <line
          x1={padL}
          x2={width - padR}
          y1={height - padB}
          y2={height - padB}
          stroke="#332A24"
          strokeWidth="1"
        />
        {[points[0], points[Math.floor(points.length / 2)], points[points.length - 1]].map(
          (p, i) => (
            <text
              key={i}
              x={xScale(p.cycleNumber)}
              y={height - padB + 16}
              textAnchor="middle"
              className="fill-void-500 font-mono"
              style={{ fontSize: 10 }}
            >
              #{p.cycleNumber}
            </text>
          ),
        )}

        {/* Connecting line */}
        <path d={pathD} fill="none" stroke="#FFC700" strokeWidth="2" opacity={0.9} />

        {/* Per-cycle points, colored by action */}
        {points.map((p) => {
          const x = xScale(p.cycleNumber);
          const y = yScale(p.navAfter);
          const color = ACTION_COLORS[p.action.toUpperCase()] ?? "#94A3B8";
          return (
            <g key={p.cycleNumber}>
              <circle cx={x} cy={y} r={5} fill={color} stroke="#000" strokeWidth="1.5">
                <title>
                  Hunt #{p.cycleNumber} · {p.action} {p.pct}% {p.asset} · NAV $
                  {p.navAfter.toFixed(2)}
                  {p.attribution.specialist ? ` · driven by ${p.attribution.specialist}` : ""}
                </title>
              </circle>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 px-4 text-[11px] text-void-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#39FF7A]" />
          BUY
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF5A5A]" />
          SELL
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFC700]" />
          HOLD
        </span>
      </div>
    </div>
  );
}
