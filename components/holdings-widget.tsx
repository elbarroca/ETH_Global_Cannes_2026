"use client";

import { Card, CardBody } from "@/components/ui/card";

// Compact widget showing the user's current on-chain holdings.
// Reads from the user record's JSONB `fund.holdings` sub-field (or from the
// enriched cycle response when rendered alongside a committed cycle).

export function HoldingsWidget({
  depositedUsdc,
  holdings,
}: {
  depositedUsdc: number;
  holdings: Record<string, number>;
}) {
  const entries = Object.entries(holdings ?? {}).filter(([, v]) => v > 0);

  return (
    <Card>
      <CardBody className="py-4 space-y-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-void-600">
            Your holdings
          </div>
          <div className="text-2xl font-bold text-void-100 mt-1 font-mono">
            ${depositedUsdc.toFixed(2)}{" "}
            <span className="text-sm font-normal text-void-500">USDC</span>
          </div>
        </div>

        {entries.length > 0 ? (
          <div className="space-y-1 border-t border-void-800/50 pt-3">
            {entries.map(([token, amount]) => (
              <div key={token} className="flex items-center justify-between text-xs">
                <span className="text-void-400 font-semibold">{token}</span>
                <span className="font-mono text-void-200">{amount.toFixed(8)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-void-600 border-t border-void-800/50 pt-3">
            No token positions yet. Holdings appear after your first BUY cycle.
          </div>
        )}
      </CardBody>
    </Card>
  );
}
