const USDC_DECIMALS = 6;
const NONNEGATIVE_DECIMAL = /^(0|[1-9]\d*)$/;

export function formatUsdcAtomic(amount: string): string {
  if (!NONNEGATIVE_DECIMAL.test(amount)) return "Unavailable";

  const padded = amount.padStart(USDC_DECIMALS + 1, "0");
  const whole = padded.slice(0, -USDC_DECIMALS);
  const fraction = padded.slice(-USDC_DECIMALS).replace(/0+$/, "");
  const usdc = fraction ? `${BigInt(whole).toLocaleString("en-US")}.${fraction}` : BigInt(whole).toLocaleString("en-US");
  const atomic = BigInt(amount).toLocaleString("en-US");

  return `${usdc} USDC (${atomic} atomic ${amount === "1" ? "unit" : "units"})`;
}

export function formatUsdc(amount: string): string {
  if (!NONNEGATIVE_DECIMAL.test(amount)) return "Unavailable";

  const padded = amount.padStart(USDC_DECIMALS + 1, "0");
  const whole = padded.slice(0, -USDC_DECIMALS);
  const fraction = padded.slice(-USDC_DECIMALS).replace(/0+$/, "");
  const usdc = fraction ? `${BigInt(whole).toLocaleString("en-US")}.${fraction}` : BigInt(whole).toLocaleString("en-US");

  return `${usdc} USDC`;
}
