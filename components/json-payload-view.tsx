import { Fragment, type ReactNode } from "react";

const SUMMARY_KEYS = [
  "eventType",
  "nodeId",
  "name",
  "topicId",
  "sequenceNumber",
  "sourceChain",
  "txHash",
  "correlationId",
] as const;

function formatChipValue(v: unknown, max = 44): string {
  if (v == null) return String(v);
  if (typeof v === "string") return v.length > max ? `${v.slice(0, max - 1)}…` : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "bigint") return `${v}n`;
  if (typeof v === "object" && v !== null && "value" in v) {
    const inner = (v as { value: unknown }).value;
    if (typeof inner === "string") return inner.length > max ? `${inner.slice(0, max - 1)}…` : inner;
  }
  try {
    const s = JSON.stringify(v);
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
  } catch {
    return "…";
  }
}

/** Compact key=value chips for the feed row (replaces raw JSON.stringify summary). */
export function PayloadSummaryChips({
  payload,
  hideKeys,
}: {
  payload: unknown;
  /** e.g. hide `eventType` when the row shows a CONTRACT / TRANSACTION badge */
  hideKeys?: string[];
}) {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const hidden = new Set(hideKeys ?? []);
  const o = payload as Record<string, unknown>;
  const used = new Set<string>();
  const chips: { key: string; value: string }[] = [];

  for (const k of SUMMARY_KEYS) {
    if (hidden.has(k)) continue;
    if (!(k in o) || o[k] === undefined) continue;
    used.add(k);
    chips.push({ key: k, value: formatChipValue(o[k]) });
  }

  const rest = Object.keys(o).filter((k) => !used.has(k) && !hidden.has(k));
  for (const k of rest.slice(0, Math.max(0, 4 - chips.length))) {
    chips.push({ key: k, value: formatChipValue(o[k]) });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {chips.map(({ key, value }) => (
        <span
          key={key}
          className="inline-flex items-baseline gap-0.5 max-w-full rounded-md px-1.5 py-0.5 bg-void-950/80 border border-void-700/50 text-[9px] font-mono leading-tight"
          title={`${key}: ${value}`}
        >
          <span className="text-emerald-400/90 shrink-0">{key}</span>
          <span className="text-void-600">:</span>
          <span className="text-void-300 break-all min-w-0">{value}</span>
        </span>
      ))}
    </div>
  );
}

function JsonScalar({ value }: { value: unknown }): ReactNode {
  if (value === null) return <span className="text-void-500">null</span>;
  if (value === undefined) return <span className="text-void-600">undefined</span>;
  if (typeof value === "string") {
    return (
      <span className="text-dawg-300/95">
        &quot;
        {value}
        &quot;
      </span>
    );
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return <span className="text-purple-300 tabular-nums">{String(value)}</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-sky-400">{String(value)}</span>;
  }
  return <span className="text-void-400">{String(value)}</span>;
}

function JsonBlock({ value, depth }: { value: unknown; depth: number }): ReactNode {
  const indent = 10 + depth * 12;

  if (value === null || value === undefined) {
    return <JsonScalar value={value} />;
  }
  if (typeof value !== "object") {
    return <JsonScalar value={value} />;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-void-500">[]</span>;
    }
    return (
      <Fragment>
        <span className="text-void-600">[</span>
        {value.map((item, i) => (
          <div key={i} style={{ marginLeft: indent }} className="block font-mono">
            <JsonBlock value={item} depth={depth + 1} />
            {i < value.length - 1 ? <span className="text-void-600">,</span> : null}
          </div>
        ))}
        <span className="text-void-600">]</span>
      </Fragment>
    );
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return <span className="text-void-500">{"{}"}</span>;
  }

  return (
    <Fragment>
      <span className="text-void-600">{"{"}</span>
      {entries.map(([k, v], i) => (
        <div
          key={k}
          style={{ marginLeft: indent }}
          className="block font-mono break-words border-l border-emerald-900/20 pl-2 -ml-px"
        >
          <span className="text-emerald-400/90">&quot;{k}&quot;</span>
          <span className="text-void-600">: </span>
          <JsonBlock value={v} depth={depth + 1} />
          {i < entries.length - 1 ? <span className="text-void-600">,</span> : null}
        </div>
      ))}
      <span className="text-void-600">{"}"}</span>
    </Fragment>
  );
}

/** Styled tree for object/array JSON. */
export function JsonPayloadTree({ value }: { value: unknown }) {
  return (
    <div className="text-[10px] leading-relaxed text-void-300 select-text overflow-x-auto">
      <JsonBlock value={value} depth={0} />
    </div>
  );
}

export function JsonPayloadPanel({
  value,
  onCopy,
  copied,
}: {
  value: unknown;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="mt-0 border-t border-void-800/60 pt-2 pb-1 px-1">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-void-500">Payload</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCopy();
          }}
          className="text-[9px] font-mono px-2 py-0.5 rounded-md border border-void-700/70 bg-void-900/60 text-void-400 hover:text-void-200 hover:border-void-600 transition-colors"
        >
          {copied ? "Copied" : "Copy JSON"}
        </button>
      </div>
      <div className="rounded-lg border border-void-800/90 bg-black/40 p-2.5 max-h-44 overflow-auto shadow-[inset_0_0_20px_rgba(0,0,0,0.35)]">
        <JsonPayloadTree value={value} />
      </div>
    </div>
  );
}
