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
  const { history, loading, hasMore, loadMore } = useCycleHistory(8);

  const cycles = history.map((record) => mapEnrichedResponseToCycle(record));

  return (
    <main className="max-w-7xl mx-auto px-5 py-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <h1 className="text-lg font-bold text-void-100">Hunt log</h1>
        <p className="text-sm text-void-500">
          All hunts recorded on Hedera HCS + 0G Sealed Inference
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
      {!loading && cycles.length === 0 && (
        <div className="bg-void-900 border border-void-800 rounded-2xl px-6 py-12 text-center">
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
    </main>
  );
}
