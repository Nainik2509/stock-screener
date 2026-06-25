/**
 * Normalized DTOs returned to the rest of the app. These are intentionally
 * decoupled from the raw Finnhub shapes in `lib/finnhub/types.ts` so the UI
 * depends on stable, intentful types rather than provider quirks.
 *
 * This module is type-only and safe to import from client components.
 */

/** Where a price value came from. */
export type DataSource = "rest" | "ws";

/** Freshness label for a live price update: live socket vs REST polling. */
export type PriceSource = "ws" | "poll";

/**
 * The minimal real-time update pushed to the browser over SSE. Deliberately
 * small and decoupled from Finnhub's raw socket frames.
 */
export interface PriceUpdate {
  symbol: string;
  price: number;
  changePct: number;
  source: PriceSource;
  /** epoch milliseconds */
  ts: number;
}

/** A normalized real-time quote. All numbers are finite (never NaN). */
export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  prevClose: number;
  high: number;
  low: number;
  open: number;
  /** epoch milliseconds */
  updatedAt: number;
}

/** Company profile / fundamentals that change rarely. */
export interface StockProfile {
  symbol: string;
  name: string;
  /** market cap in millions of `currency` (Finnhub's unit) */
  marketCap: number;
  industry: string;
  currency: string;
  logo?: string;
}

/** Slow-moving valuation metrics. Fields are optional (Finnhub may omit them). */
export interface StockMetrics {
  symbol: string;
  peRatio?: number;
  week52High?: number;
  week52Low?: number;
  avgVolume?: number;
}

/** A normalized symbol search hit. */
export interface SymbolSearchResult {
  symbol: string;
  description: string;
  type: string;
}

/**
 * The merged shape powering a single screener list row. Covers the required
 * row fields: ticker, company name, current price, daily movement
 * (change + percent), plus analyst metrics (market cap always; P/E and 52-week
 * range when cheaply available).
 */
export interface ScreenerRow {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  prevClose: number;
  marketCap: number;
  peRatio?: number;
  week52High?: number;
  week52Low?: number;
  /** `rest` from the initial snapshot; `ws` once a live trade updates it. */
  source: DataSource;
  /** true when the value is last-known but a refresh failed. */
  stale: boolean;
  /** epoch milliseconds */
  updatedAt: number;
}

/**
 * The richer single-stock detail shape. Extends the list row with intraday and
 * fundamental fields surfaced on the detail view.
 *
 * Note on `volume`: the Finnhub free tier does not expose intraday cumulative
 * volume on the quote endpoint, so this carries the 10-day average trading
 * volume (from /stock/metric) as a reasonable proxy. See docs/DECISIONS.md.
 */
export interface StockDetail extends ScreenerRow {
  open: number;
  /** intraday high */
  high: number;
  /** intraday low */
  low: number;
  industry: string;
  currency: string;
  logo?: string;
  /** 10-day average trading volume (free-tier proxy for volume) */
  volume?: number;
}

/**
 * A typed result wrapper so callers never see thrown raw errors. Every Finnhub
 * client function resolves to one of these instead of throwing.
 */
export type FinnhubResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: FinnhubError };

export interface FinnhubError {
  code: string;
  message: string;
}

/** Outcome of a batched screener fetch that tolerates partial failures. */
export interface ScreenerRowsResult {
  rows: ScreenerRow[];
  failures: Array<{ symbol: string; error: FinnhubError }>;
}
