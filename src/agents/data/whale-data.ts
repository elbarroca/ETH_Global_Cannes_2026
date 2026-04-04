// Fetches REAL on-chain whale proxy data — Etherscan + CoinGecko

import { cachedFetch } from "./cached-fetch";

function getCoinGeckoBase(): string {
  return process.env.COINGECKO_API_URL ?? "https://api.coingecko.com/api/v3";
}

function getCoinGeckoHeaders(): Record<string, string> | undefined {
  const key = process.env.COINGECKO_API_KEY;
  if (!key) return undefined;
  const header = key.startsWith("CG-") ? "x-cg-pro-api-key" : "x-cg-demo-api-key";
  return { [header]: key };
}

function getEtherscanBase(): string {
  return process.env.ETHERSCAN_API_URL ?? "https://api.etherscan.io/api";
}

export async function fetchWhaleData(): Promise<string> {
  const cg = getCoinGeckoBase();
  const cgHeaders = getCoinGeckoHeaders();
  const etherscan = getEtherscanBase();
  const etherscanKey = process.env.ETHERSCAN_API_KEY ?? "";
  if (!etherscanKey) console.warn("[whale-data] ETHERSCAN_API_KEY not set — gas/price data may be rate-limited");

  const results: Record<string, unknown> = { fetched_at: new Date().toISOString() };

  // ETH price from Etherscan (different source than sentiment for cross-ref)
  try {
    const price = await cachedFetch<{ result: { ethusd: string; ethbtc: string } }>(
      `${etherscan}?module=stats&action=ethprice&apikey=${etherscanKey}`,
    );
    results.eth_price_usd = Number(price.result?.ethusd);
    results.eth_price_btc = Number(price.result?.ethbtc);
  } catch {
    results.eth_price_usd = null;
  }

  // Gas oracle — high gas = network congestion from large txs (whale proxy)
  try {
    const gas = await cachedFetch<{
      result: { SafeGasPrice: string; ProposeGasPrice: string; FastGasPrice: string };
    }>(`${etherscan}?module=gastracker&action=gasoracle&apikey=${etherscanKey}`);
    const safe = Number(gas.result?.SafeGasPrice ?? 0);
    const fast = Number(gas.result?.FastGasPrice ?? 0);
    results.gas_safe_gwei = safe;
    results.gas_fast_gwei = fast;
    results.gas_spread = fast - safe;
    results.gas_assessment = fast > 50 ? "high_activity" : fast > 20 ? "moderate" : "low_activity";
  } catch {
    results.gas_assessment = "unavailable";
  }

  // Top exchange volumes — rising volume = distribution, falling = accumulation
  try {
    const exchanges = await cachedFetch<
      Array<{ name: string; trade_volume_24h_btc: number; trust_score: number }>
    >(`${cg}/exchanges?per_page=5`, 60_000, cgHeaders);
    results.top_exchanges = exchanges.slice(0, 5).map((ex) => ({
      name: ex.name,
      volume_btc_24h: Math.round(ex.trade_volume_24h_btc),
      trust: ex.trust_score,
    }));
    const totalVol = exchanges.reduce((sum, ex) => sum + ex.trade_volume_24h_btc, 0);
    results.total_top5_volume_btc = Math.round(totalVol);
  } catch {
    results.top_exchanges = [];
  }

  // ETH 24h volume + circulating supply
  try {
    const eth = await cachedFetch<{
      market_data: { total_volume: { usd: number }; circulating_supply: number };
    }>(
      `${cg}/coins/ethereum?localization=false&tickers=false&market_data=true&community_data=false`,
      60_000,
      cgHeaders,
    );
    results.eth_24h_volume_usd = Math.round(eth.market_data?.total_volume?.usd ?? 0);
    results.eth_circulating_supply = Math.round(eth.market_data?.circulating_supply ?? 0);
  } catch {
    // non-fatal
  }

  return JSON.stringify(results);
}
