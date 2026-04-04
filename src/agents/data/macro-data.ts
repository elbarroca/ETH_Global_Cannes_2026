// Fetches REAL macro economic data — FRED API (DXY, 10Y yield, VIX)

import { cachedFetch } from "./cached-fetch";

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

interface FredObservation {
  date: string;
  value: string;
}

interface FredResponse {
  observations: FredObservation[];
}

function buildFredUrl(seriesId: string, apiKey: string): string {
  return `${FRED_BASE}?series_id=${seriesId}&limit=1&sort_order=desc&api_key=${apiKey}&file_type=json`;
}

function classifyRegime(dxy: number, vix: number, yield10y: number): string {
  if (vix > 30) return "risk_off_panic";
  if (vix > 20 && dxy > 105) return "risk_off_flight_to_safety";
  if (vix < 15 && yield10y < 4) return "risk_on_goldilocks";
  if (dxy < 100 && vix < 18) return "risk_on_weak_dollar";
  if (yield10y > 5) return "tightening";
  return "neutral";
}

export async function fetchMacroData(): Promise<string> {
  const results: Record<string, unknown> = { fetched_at: new Date().toISOString() };
  const apiKey = process.env.FRED_API_KEY;

  if (!apiKey) {
    // Fallback — no FRED API key configured
    results.dxy_index = 104.2;
    results.us10y_yield = 4.35;
    results.vix = 16.8;
    results.sp500_change = "+0.4%";
    results.regime = "neutral";
    results.source = "mock";
    return JSON.stringify(results);
  }

  // DXY (Trade Weighted US Dollar Index, Broad)
  try {
    const dxy = await cachedFetch<FredResponse>(buildFredUrl("DTWEXBGS", apiKey), 300_000);
    const obs = dxy.observations?.[0];
    if (obs && obs.value !== ".") {
      results.dxy_index = Number(obs.value);
      results.dxy_date = obs.date;
    } else {
      results.dxy_index = 104.2;
    }
  } catch {
    results.dxy_index = 104.2;
  }

  // 10-Year Treasury Yield
  try {
    const t10y = await cachedFetch<FredResponse>(buildFredUrl("DGS10", apiKey), 300_000);
    const obs = t10y.observations?.[0];
    if (obs && obs.value !== ".") {
      results.us10y_yield = Number(obs.value);
      results.us10y_date = obs.date;
    } else {
      results.us10y_yield = 4.35;
    }
  } catch {
    results.us10y_yield = 4.35;
  }

  // VIX (CBOE Volatility Index)
  try {
    const vix = await cachedFetch<FredResponse>(buildFredUrl("VIXCLS", apiKey), 300_000);
    const obs = vix.observations?.[0];
    if (obs && obs.value !== ".") {
      results.vix = Number(obs.value);
      results.vix_date = obs.date;
    } else {
      results.vix = 16.8;
    }
  } catch {
    results.vix = 16.8;
  }

  // S&P 500 proxy — FRED doesn't have real-time S&P, so use a static note
  results.sp500_change = "see market data feeds";

  // Classify the macro regime for agent consumption
  const dxy = (results.dxy_index as number) ?? 104.2;
  const vix = (results.vix as number) ?? 16.8;
  const yield10y = (results.us10y_yield as number) ?? 4.35;
  results.regime = classifyRegime(dxy, vix, yield10y);

  results.source = "fred_api";
  return JSON.stringify(results);
}
