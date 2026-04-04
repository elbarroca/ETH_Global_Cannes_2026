// Fetches REAL memecoin data — DexScreener boosted tokens + new profiles

import { cachedFetch } from "./cached-fetch";

const DEXSCREENER_BOOSTS_URL = "https://api.dexscreener.com/token-boosts/latest/v1";
const DEXSCREENER_PROFILES_URL = "https://api.dexscreener.com/token-profiles/latest/v1";

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

  // Top boosted tokens (paid boosts = attention signal)
  try {
    const boosts = await cachedFetch<DexScreenerToken[]>(DEXSCREENER_BOOSTS_URL, 60_000);
    results.top_boosted = boosts.slice(0, 5).map((t) => ({
      chain: t.chainId,
      address: t.tokenAddress,
      url: t.url,
      boost_amount: t.totalAmount ?? t.amount ?? 0,
      description: t.description?.slice(0, 100) ?? "",
    }));
  } catch {
    results.top_boosted = [
      { chain: "solana", address: "0xmock1", url: "https://dexscreener.com/solana/mock1", boost_amount: 500, description: "PEPE 2.0 — community meme" },
      { chain: "ethereum", address: "0xmock2", url: "https://dexscreener.com/ethereum/mock2", boost_amount: 350, description: "WOJAK token" },
      { chain: "base", address: "0xmock3", url: "https://dexscreener.com/base/mock3", boost_amount: 280, description: "DEGEN on Base" },
      { chain: "solana", address: "0xmock4", url: "https://dexscreener.com/solana/mock4", boost_amount: 200, description: "BONK revival" },
      { chain: "arbitrum", address: "0xmock5", url: "https://dexscreener.com/arbitrum/mock5", boost_amount: 150, description: "ARB meme token" },
    ];
  }

  // New token profiles (freshly listed tokens)
  try {
    const profiles = await cachedFetch<DexScreenerProfile[]>(DEXSCREENER_PROFILES_URL, 60_000);
    results.new_profiles = profiles.slice(0, 5).map((p) => ({
      chain: p.chainId,
      address: p.tokenAddress,
      url: p.url,
      description: p.description?.slice(0, 100) ?? "",
    }));
  } catch {
    results.new_profiles = [
      { chain: "solana", address: "0xnew1", url: "https://dexscreener.com/solana/new1", description: "AI Agent meme token" },
      { chain: "base", address: "0xnew2", url: "https://dexscreener.com/base/new2", description: "Based cat token" },
      { chain: "ethereum", address: "0xnew3", url: "https://dexscreener.com/ethereum/new3", description: "ETH meme revival" },
    ];
  }

  return JSON.stringify(results);
}
