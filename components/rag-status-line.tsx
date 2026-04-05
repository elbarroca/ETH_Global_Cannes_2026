"use client";

import { useEffect, useState } from "react";

interface RagUserStatus {
  userId: string;
  latestCycleNumber: number | null;
  priorCidsOnLatest: number;
  hasRagOnLatest: boolean;
}

/**
 * One-line DB-backed RAG hint for the signed-in user (prior CIDs on latest committed cycle).
 * Live 0G read proof: run `npx tsx scripts/inspect-rag-eligibility.ts` locally.
 */
export function RagStatusLine({ userId }: { userId: string }) {
  const [data, setData] = useState<RagUserStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/rag/status?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((j: RagUserStatus) => {
        if (!cancelled && j && typeof j.hasRagOnLatest === "boolean") setData(j);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!data) return null;

  return (
    <div className="rounded-lg border border-gold-500/20 bg-gold-500/[0.04] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gold-400/90 mb-1">0G RAG (agents)</p>
      {data.latestCycleNumber == null ? (
        <p className="text-xs text-void-500">No committed hunts in DB for this user yet.</p>
      ) : data.hasRagOnLatest ? (
        <p className="text-xs text-void-400 leading-relaxed">
          Latest hunt <span className="font-mono text-void-300">#{data.latestCycleNumber}</span> cites{" "}
          <span className="text-gold-400/90 font-mono">{data.priorCidsOnLatest}</span> prior 0G blob
          {data.priorCidsOnLatest === 1 ? "" : "s"} in <code className="text-void-500">narrative.priorCids</code>{" "}
          (what was loaded for prompts). Open hunt → <span className="text-void-500">0G proof</span> for full hashes.
        </p>
      ) : (
        <p className="text-xs text-void-500 leading-relaxed">
          Latest hunt <span className="font-mono">#{data.latestCycleNumber}</span> has no prior-context CIDs yet — e.g.
          first hunt(s), or older cycles without a storage <code className="text-void-600">sh</code> pointer. Run more
          hunts; after prior commits include 0G roots, the next hunt can show RAG lines.
        </p>
      )}
      <p className="text-[10px] text-void-600 mt-1.5">
        CLI live check (downloads from 0G):{" "}
        <code className="text-void-500">npx tsx scripts/inspect-rag-eligibility.ts</code>
      </p>
    </div>
  );
}
