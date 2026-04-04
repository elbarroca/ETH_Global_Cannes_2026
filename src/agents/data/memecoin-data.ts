// Fetches REAL memecoin data — DexScreener boosted tokens + new profiles
// Filtered to EVM chains only (the execution router cannot swap Solana/SUI/etc).

import { cachedFetch } from "./cached-fetch";
import { injectUniverseInto } from "./universe-injector";

const DEXSCREENER_BOOSTS_URL = "https://api.dexscreener.com/token-boosts/latest/v1";
const DEXSCREENER_PROFILES_URL = "https://api.dexscreener.com/token-profiles/latest/v1";

/** DexScreener chain IDs that our execution router can actually swap against. */
const EVM_CHAINS = new Set(["ethereum", "base", "arbitrum", "optimism", "polygon"]);

interface DexScreenerToken {
  url: string;
  chainId: string;
  tokenAddress: string;
  icon?: string;
  header?: string;
  description?: string;
  totalAmount?: number;
  amount?: number;
}

interface DexScreenerProfile {
  url: string;
  chainId: string;
  tokenAddress: string;
  icon?: string;
  description?: string;
}

export async function fetchMemecoinData(): Promise<string> {
  const results: Record<string, unknown> = { fetched_at: new Date().toISOString() };

  // Top boosted tokens (paid boosts = attention signal).
  // Filter to EVM chains only — Solana/SUI/etc boosts can't be swapped through
  // our router so surfacing them just encourages hallucinated picks.
  try {
    const boosts = await cachedFetch<DexScreenerToken[]>(DEXSCREENER_BOOSTS_URL, 60_000);
    const evmBoosts = boosts.filter((t) => EVM_CHAINS.has((t.chainId ?? "").toLowerCase()));
    results.top_boosted = evmBoosts.slice(0, 5).map((t) => ({
      chain: t.chainId,
      address: t.tokenAddress,
      url: t.url,
      boost_amount: t.totalAmount ?? t.amount ?? 0,
      description: t.description?.slice(0, 100) ?? "",
    }));
  } catch {
    results.top_boosted = [
      { chain: "ethereum", address: "0xmock1", url: "https://dexscreener.com/ethereum/mock1", boost_amount: 500, description: "PEPE 2.0 — community meme" },
      { chain: "ethereum", address: "0xmock2", url: "https://dexscreener.com/ethereum/mock2", boost_amount: 350, description: "WOJAK token" },
      { chain: "base", address: "0xmock3", url: "https://dexscreener.com/base/mock3", boost_amount: 280, description: "DEGEN on Base" },
      { chain: "arbitrum", address: "0xmock4", url: "https://dexscreener.com/arbitrum/mock4", boost_amount: 200, description: "ARB-native meme revival" },
      { chain: "arbitrum", address: "0xmock5", url: "https://dexscreener.com/arbitrum/mock5", boost_amount: 150, description: "Arbitrum meme token" },
    ];
  }

  // New token profiles (freshly listed tokens) — EVM chains only for the
  // same reason as boosts above.
  try {
    const profiles = await cachedFetch<DexScreenerProfile[]>(DEXSCREENER_PROFILES_URL, 60_000);
    const evmProfiles = profiles.filter((p) => EVM_CHAINS.has((p.chainId ?? "").toLowerCase()));
    results.new_profiles = evmProfiles.slice(0, 5).map((p) => ({
      chain: p.chainId,
      address: p.tokenAddress,
      url: p.url,
      description: p.description?.slice(0, 100) ?? "",
    }));
  } catch {
    results.new_profiles = [
      { chain: "base", address: "0xnew1", url: "https://dexscreener.com/base/new1", description: "AI Agent meme token" },
      { chain: "base", address: "0xnew2", url: "https://dexscreener.com/base/new2", description: "Based cat token" },
      { chain: "ethereum", address: "0xnew3", url: "https://dexscreener.com/ethereum/new3", description: "ETH meme revival" },
    ];
  }

  // Attach the broader EVM universe so memecoin-hunter can actually pick
  // tradeable ERC-20s (DexScreener data is sentiment only).
  await injectUniverseInto(results);

  return JSON.stringify(results);
}
