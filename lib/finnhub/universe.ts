/**
 * The screener's fixed universe of liquid US tickers.
 *
 * NOTE: only the *symbol list* is hardcoded here, which is explicitly allowed.
 * No prices, quotes, or fundamentals are hardcoded - all market data is fetched
 * live from Finnhub at runtime.
 *
 * Size is kept to ~25 (<= 30) on purpose to stay within the Finnhub free tier:
 *   - WebSocket cap is ~50 symbols per connection.
 *   - REST budget is ~60 calls/min; 25 symbols x (quote + profile) = 50 calls,
 *     leaving headroom (profiles are cached for ~12h, so steady-state is far less).
 */
export const UNIVERSE: readonly string[] = [
  "AAPL",
  "MSFT",
  "NVDA",
  "AMZN",
  "GOOGL",
  "META",
  "TSLA",
  "AVGO",
  "JPM",
  "V",
  "MA",
  "UNH",
  "HD",
  "COST",
  "PEP",
  "KO",
  "NFLX",
  "AMD",
  "CRM",
  "ADBE",
  "INTC",
  "DIS",
  "BAC",
  "WMT",
  "XOM",
] as const;
