// Specialist pick post-filter.
//
// The 0G sealed inference layer runs a 7B model. Even when the specialist
// prompt says "each asset MUST be a ticker from the universe table", the 7B
// model hallucinates off-universe tickers — notably non-EVM chain-native
// assets like ADA, SOL, BTC, XRP that CoinGecko's global top 20 puts in
// front of the model via training data leakage. A code-level guard is the
// only reliable enforcement.
//
// This module:
//   · Filters specialist picks to tokens that exist in EVM_TRADEABLE for the
//     active execution chain.
//   · When ALL picks violate, substitutes a single synthetic fallback pick
//     (first whitelisted ticker, usually WETH) inheriting the original
//     signal/confidence so alpha always has a tradeable option.
//   · Exposes audit fields (`substituted`, `droppedAssets`) so the narrative
//     can surface "the system caught the hallucination and recovered".
//
// See docs/SYSTEM_STATE_AND_FIXES.md Problem 1 for the full motivation.

import { EVM_TRADEABLE, getTradableTickers, type ExecutionChain } from "./token-universe";
import type { TokenPick } from "../../types/index";

function getActiveChain(): ExecutionChain {
  const raw = (process.env.AGENT_EXECUTION_CHAIN ?? "arc").toLowerCase();
  return (raw in EVM_TRADEABLE ? raw : "arc") as ExecutionChain;
}

function getDefaultFallbackTicker(chain: ExecutionChain): string {
  // First whitelisted entry per chain — all chains have WETH as entry 0.
  return EVM_TRADEABLE[chain][0]?.symbol ?? "WETH";
}

export interface PickFilterResult {
  picks: TokenPick[];
  /** true if we had to drop everything and fall back to the default ticker. */
  substituted: boolean;
  /** The original violating tickers, uppercased — empty if input was empty. */
  droppedAssets: string[];
}

/**
 * Enforce the EVM whitelist on a specialist's picks. Used on every
 * SpecialistResult coming back from the Fly.io containers before the picks
 * reach the debate layer.
 *
 * @param picks              The specialist's raw picks[] (may be undefined).
 * @param originalSignal     Specialist's top-level signal (BUY/SELL/HOLD) — used
 *                           when we synthesize a fallback and the picks array
 *                           is empty entirely.
 * @param originalConfidence Specialist's top-level confidence — used for the
 *                           synthesized fallback pick.
 */
export function filterTradeablePicks(
  picks: TokenPick[] | undefined,
  originalSignal: string,
  originalConfidence: number,
): PickFilterResult {
  const chain = getActiveChain();
  // getTradableTickers() includes ETH as an alias for WETH, so a specialist
  // saying "ETH" is accepted — we just canonicalize it to WETH below.
  const allowed = getTradableTickers();
  const fallback = getDefaultFallbackTicker(chain);

  // No picks emitted at all → synthesize a fallback from the top-level signal.
  if (!picks || picks.length === 0) {
    return {
      picks: [
        {
          asset: fallback,
          signal: normalizeSignal(originalSignal),
          confidence: clampConfidence(originalConfidence),
          reason: "fallback: specialist emitted no picks",
        },
      ],
      substituted: true,
      droppedAssets: [],
    };
  }

  const dropped: string[] = [];
  const kept: TokenPick[] = [];
  for (const p of picks) {
    const sym = (p.asset ?? "").toUpperCase();
    if (sym && allowed.has(sym)) {
      // Canonicalize the "ETH" alias to "WETH" — the swap router expects
      // the ERC-20 wrapped form, even though the 7B model colloquially
      // refers to the native token.
      const canonical = sym === "ETH" ? "WETH" : sym;
      kept.push({ ...p, asset: canonical });
    } else if (sym) {
      dropped.push(sym);
    }
  }

  if (kept.length > 0) {
    return { picks: kept, substituted: false, droppedAssets: dropped };
  }

  // Every single pick violated the whitelist → substitute one synthetic pick.
  const first = picks[0];
  return {
    picks: [
      {
        asset: fallback,
        signal: normalizeSignal(first?.signal ?? originalSignal),
        confidence: clampConfidence(first?.confidence ?? originalConfidence),
        reason: `fallback: ${dropped.join(",")} not tradeable on ${chain}`,
      },
    ],
    substituted: true,
    droppedAssets: dropped,
  };
}

function normalizeSignal(raw: string): TokenPick["signal"] {
  const up = String(raw ?? "").toUpperCase();
  if (up === "BUY" || up === "SELL" || up === "HOLD") return up;
  return "HOLD";
}

function clampConfidence(n: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export interface AssetValidationResult {
  asset: string;
  substituted: boolean;
  original?: string;
}

/**
 * Gate a final-decision asset field against the EVM whitelist.
 *
 * `filterTradeablePicks` filters specialist `picks[]`, but debate agents
 * (alpha/risk/executor) emit a single top-level `asset` field in their JSON
 * output. The 7B model can still hallucinate off-chain tickers there (e.g.
 * "SIREN", "ADA") even after the picks filter runs. This function is the
 * last line of defense before the asset lands in `finalAsset`, the narrative
 * headline, HCS `d.asset`, and the `cycles` Prisma row.
 *
 * Resolution order:
 *   1. Canonicalize `ETH` → `WETH` (swap router expects the wrapped form)
 *   2. If `primary` is whitelisted, return it unchanged
 *   3. Else try `fallback` (usually alpha's asset) the same way
 *   4. Else return the chain's default fallback ticker (WETH on Arc),
 *      flagging `substituted: true` with the original ticker for audit
 */
export function validateTradeableAsset(
  primary: string | null | undefined,
  fallback?: string | null,
): AssetValidationResult {
  const chain = getActiveChain();
  const allowed = getTradableTickers();
  const defaultTicker = getDefaultFallbackTicker(chain);

  const canon = (a: string | null | undefined): string | null => {
    if (!a) return null;
    const up = String(a).trim().toUpperCase();
    if (!up) return null;
    return up === "ETH" ? "WETH" : up;
  };

  const p = canon(primary);
  if (p && allowed.has(p)) {
    // getTradableTickers() includes ETH as an alias for WETH — canonicalize
    // back to WETH for the returned asset regardless.
    return { asset: p === "ETH" ? "WETH" : p, substituted: false };
  }

  const f = canon(fallback);
  if (f && allowed.has(f)) {
    return {
      asset: f === "ETH" ? "WETH" : f,
      substituted: true,
      original: p ?? undefined,
    };
  }

  return {
    asset: defaultTicker,
    substituted: true,
    original: p ?? undefined,
  };
}
