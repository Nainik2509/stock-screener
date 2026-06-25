/**
 * Pure number-formatting helpers used by screener UI components.
 * No React dependency — safe to import anywhere.
 */

export function fmtPrice(price: number): string {
  return price.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtChange(change: number): string {
  return (change >= 0 ? "+" : "") + change.toFixed(2);
}

export function fmtChangePct(pct: number): string {
  return (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";
}

/**
 * Finnhub returns `marketCapitalization` in *millions* of the listing
 * currency. Convert to the full value, then abbreviate for readability.
 *
 * Examples: 4_304_570 → "$4.30T", 8_500 → "$8.50B", 450 → "$450.00M"
 */
export function fmtMarketCap(millions: number): string {
  const v = millions * 1_000_000;
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toLocaleString("en-US")}`;
}
