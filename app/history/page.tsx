"use client";

import { DawgSpinner } from "@/components/dawg-spinner";
import { ExpandableHuntCard } from "@/components/expandable-hunt-card";
import { InProgressHuntBanner } from "@/components/in-progress-hunt-banner";
import { useCycleHistory } from "@/hooks/use-vaultmind";
import { mapEnrichedResponseToCycle } from "@/lib/cycle-mapper";
import { useUser } from "@/contexts/user-context";

export default function HistoryPage() {
  const { userId } = useUser();
  // Smaller page size so the first paint lands quickly; users can still
  // "Load more" for deeper history. Each enriched row is heavy (narrative +
  // payments + specialist picks + debate reasoning), so 8/page keeps the
  // initial payload in a reasonable range on slow networks.
  const { history, loading, error, hasMore, loadMore, refetch } = useCycleHistory(8);

  const cycles = history.map((record) => mapEnrichedResponseToCycle(record));

  return (
    <main className="mx-auto max-w-[90rem] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-void-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="instrument-label">Recorded activity</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-void-100">Hunt log</h1></div>
        <p className="text-sm text-void-500">
          Legacy cycle records with proof links shown only when present
        </p>
      </div>

      {/* Live in-progress banner — reads from agent_actions so history shows
          the cycle currently being analyzed (specialists hired, debate
          mid-flight) between committed hunts. Disappears once the Cycle row
          lands for this cycleNumber. */}
      <InProgressHuntBanner userId={userId} />

      {/* Loading */}
      {loading && cycles.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <DawgSpinner size={48} label="Loading hunt history…" />
        </div>
      )}

      {/* Empty */}
      {error && (
        <div role="alert" className="rounded-2xl border border-blood-500/30 bg-blood-900/15 px-5 py-4">
          <p className="text-sm font-semibold text-blood-200">Hunt history is unavailable</p>
          <p className="mt-1 text-sm text-void-500">{error}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 min-h-11 rounded-xl border border-void-700 px-4 text-sm font-semibold text-void-200 hover:bg-void-800"
          >
            Retry history
          </button>
        </div>
      )}

      {!loading && !error && cycles.length === 0 && (
        <div className="rounded-xl border border-void-800 bg-black px-6 py-12 text-center">
          <p className="text-void-400 text-sm">
            No hunts recorded yet. Start your first hunt from the dashboard.
          </p>
        </div>
      )}

      {/* Hunt grid */}
      {cycles.length > 0 && userId && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {cycles.map((cycle) => (
            <ExpandableHuntCard
              key={
                cycle.dbId ??
                `${cycle.id}-${cycle.timestamp}-${cycle.hcs.sequenceNumber}`
              }
              cycle={cycle}
              userId={userId}
            />
          ))}
        </div>
      )}

      {/* Load more — only rendered after the initial page has landed.
          Previously the double-spinner scenario ("Loading hunt history…" AND
          "Loading more…" stacked) happened because hasMore defaulted to true
          and the same `loading` flag drove both indicators during first
          fetch. Guard on cycles.length > 0 so the load-more affordance only
          appears once there's something to append to. */}
      {hasMore && cycles.length > 0 && (
        loading ? (
          <div className="flex w-full justify-center py-3">
            <DawgSpinner size={32} label="Loading more…" />
          </div>
        ) : (
          <button
            onClick={loadMore}
            className="flex w-full items-center justify-center py-3 text-sm text-void-500 transition-colors hover:text-void-300"
          >
            Load more
          </button>
        )
      )}

      {!loading && !error && !hasMore && cycles.length > 0 && (
        <p className="py-3 text-center text-xs text-void-600">End of recorded hunt history.</p>
      )}
    </main>
  );
}
