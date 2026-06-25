/**
 * Raw Finnhub REST response shapes (exact API field names).
 *
 * These mirror the provider's payloads 1:1 and are intentionally permissive:
 * many numeric fields are optional/null because Finnhub omits them for some
 * symbols or returns zero-filled objects for unknown tickers. They are
 * normalized into the app DTOs in `lib/types.ts` before reaching the rest of
 * the app. These are type-only declarations (no runtime/secret access).
 */

/** GET /quote */
export interface FinnhubQuote {
  /** current price */
  c: number;
  /** change */
  d: number | null;
  /** percent change */
  dp: number | null;
  /** high price of the day */
  h: number;
  /** low price of the day */
  l: number;
  /** open price of the day */
  o: number;
  /** previous close */
  pc: number;
  /** UNIX timestamp (seconds) */
  t: number;
}

/** GET /stock/profile2 (returns {} for unknown symbols) */
export interface FinnhubProfile2 {
  name?: string;
  ticker?: string;
  /** market capitalization, in millions of `currency` */
  marketCapitalization?: number;
  finnhubIndustry?: string;
  exchange?: string;
  currency?: string;
  logo?: string;
  shareOutstanding?: number;
  ipo?: string;
  weburl?: string;
}

/**
 * Subset of GET /stock/metric?metric=all -> `metric`.
 * Finnhub returns a large bag of metrics; we declare only what we consume.
 * Values can be missing or null, so every field is optional.
 */
export interface FinnhubMetricValues {
  peTTM?: number | null;
  peBasicExclExtraTTM?: number | null;
  "52WeekHigh"?: number | null;
  "52WeekLow"?: number | null;
  "10DayAverageTradingVolume"?: number | null;
  "3MonthAverageTradingVolume"?: number | null;
}

/** GET /stock/metric?metric=all */
export interface FinnhubMetrics {
  metric?: FinnhubMetricValues;
  metricType?: string;
  symbol?: string;
}

/** One trade tick from the WebSocket `trade` message `data` array. */
export interface FinnhubTrade {
  /** symbol */
  s: string;
  /** last price */
  p: number;
  /** UNIX timestamp (milliseconds) */
  t: number;
  /** volume */
  v: number;
  /** trade conditions */
  c?: string[] | null;
}

/**
 * A message from `wss://ws.finnhub.io`. We only act on `trade`; the server also
 * sends `{ "type": "ping" }` keep-alives which we ignore (the transport layer
 * already answers protocol pings automatically).
 */
export interface FinnhubWsMessage {
  type: string;
  data?: FinnhubTrade[];
}

/** One item from GET /search -> `result` */
export interface FinnhubSearchItem {
  symbol: string;
  displaySymbol: string;
  description: string;
  type: string;
}

/** GET /search?q=... */
export interface FinnhubSearchResponse {
  count: number;
  result: FinnhubSearchItem[];
}
