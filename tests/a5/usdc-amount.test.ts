import assert from "node:assert/strict";
import test from "node:test";
import { formatUsdcAtomic } from "../../lib/format-usdc";

test("formats protected USDC prices without floating point", () => {
  assert.equal(formatUsdcAtomic("0"), "0 USDC (0 atomic units)");
  assert.equal(formatUsdcAtomic("1"), "0.000001 USDC (1 atomic unit)");
  assert.equal(formatUsdcAtomic("1000"), "0.001 USDC (1,000 atomic units)");
  assert.equal(formatUsdcAtomic("12345678901234567890"), "12,345,678,901,234.56789 USDC (12,345,678,901,234,567,890 atomic units)");
});

test("fails closed for malformed or negative atomic amounts", () => {
  for (const amount of ["", "-1", "+1", "01", "1.5", "1e6", " 1", "1 "]) {
    assert.equal(formatUsdcAtomic(amount), "Unavailable");
  }
});
