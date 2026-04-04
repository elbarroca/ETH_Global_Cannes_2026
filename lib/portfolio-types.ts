/**
 * Response shape for GET /api/portfolio/[userId] — shared by the Portfolio page
 * and any other callers.
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

export interface PortfolioNanoPaymentItem {
  index: number;
  from: string;
  to: string;
  amount: string;
  txHash: string;
  chain: string;
}

export interface PortfolioNanoPaymentsByHunt {
  cycleNumber: number;
  cycleId: string;
  createdAt: string;
  items: PortfolioNanoPaymentItem[];
}

export interface PortfolioResponse {
  current: {
    usdcDeposited: number;
    positions: Array<{
      symbol: string;
      amount: number;
      usdValue: number;
      sharePct: number;
    }>;
    totalUsd: number;
  };
  evolution: PortfolioEvolutionPoint[];
  nanoPaymentsByHunt: PortfolioNanoPaymentsByHunt[];
  totalNav: number;
  cycleCount: number;
  swapCount: number;
}
