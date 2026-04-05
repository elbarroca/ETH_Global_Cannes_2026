/**
 * Response shape for GET /api/portfolio/[userId] — shared by the Portfolio page.
 */

export interface PortfolioEvolutionPoint {
  cycleId: string;
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

export interface PortfolioPositionResponse {
  symbol: string;
  amount: number;
  usdValue: number;
  sharePct: number;
  /** Weighted-average cost basis in USD per unit (0 if untracked). */
  costBasisPerUnit?: number;
  /** Mark-to-market P&L at current price vs cost basis (0 if untracked). */
  unrealizedPnl?: number;
}

export interface PortfolioPnl {
  /** Cumulative realized P&L from all closed / partial SELL cycles. */
  realized: number;
  /** Sum of unrealized P&L across open positions. */
  unrealized: number;
  /** realized + unrealized. */
  total: number;
}

export interface PortfolioResponse {
  current: {
    usdcDeposited: number;
    positions: PortfolioPositionResponse[];
    totalUsd: number;
  };
  evolution: PortfolioEvolutionPoint[];
  totalNav: number;
  /** New in the real-swap sprint: realized + unrealized P&L summary. Optional
   *  for backwards compat with older clients that don't read it yet. */
  pnl?: PortfolioPnl;
  cycleCount: number;
  swapCount: number;
}
