import "server-only";

import { round2 } from "@/lib/finnhub/math";
import type {
  FinnhubError,
  FinnhubResult,
  ScreenerRow,
  ScreenerRowsResult,
  StockDetail,
  StockMetrics,
  StockProfile,
  StockQuote,
  SymbolSearchResult,
} from "@/lib/types";
import type {
  FinnhubMetrics,
  FinnhubProfile2,
  FinnhubQuote,
  FinnhubSearchResponse,
} from "@/lib/finnhub/types";
import * as cache from "@/lib/finnhub/cache";

const BASE_URL = "https://finnhub.io/api/v1";
const REQUEST_TIMEOUT_MS = 8_000;
const SEARCH_TTL_MS = 60_000;

// Bound concurrent upstream calls to spread load across the 60 calls/min free
// tier. Each screener row now fetches quote + profile + metrics (3 calls),
// so concurrency 3 means at most 9 simultaneous calls per batch — manageable
// for the burst allowance; metrics are cached for 1 h so steady-state is far
// cheaper than the cold-start figure. See docs/DECISIONS.md §13.
const MAX_CONCURRENCY = 3;

// ---------------------------------------------------------------------------
// Low-level request helper
// ---------------------------------------------------------------------------

function fail(code: string, message: string): { ok: false; error: FinnhubError } {
  return { ok: false, error: { code, message } };
}

/**
 * Perform an authenticated Finnhub GET and parse JSON into the raw shape `T`.
 * Network/timeout/non-200 outcomes are mapped into the typed error envelope so
 * callers never have to catch thrown errors. 429 is surfaced as RATE_LIMITED.
 */
async function request<T>(
  path: string,
  params: Record<string, string>,
): Promise<FinnhubResult<T>> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (apiKey === undefined || apiKey.length === 0) {
    return fail("CONFIG", "FINNHUB_API_KEY is not set");
  }

  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { "X-Finnhub-Token": apiKey },
      signal: controller.signal,
      cache: "no-store",
    });

    if (res.status === 429) {
      return fail("RATE_LIMITED", "Finnhub rate limit exceeded (HTTP 429)");
    }
    if (!res.ok) {
      return fail(`HTTP_${res.status}`, `Finnhub request failed (HTTP ${res.status})`);
    }

    // res.json() is untyped; cast to the declared raw shape for this endpoint.
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return fail("TIMEOUT", `Finnhub request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    const message = error instanceof Error ? error.message : "Unknown network error";
    return fail("NETWORK", message);
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Caching wrapper (errors are not cached)
// ---------------------------------------------------------------------------

// Internal carrier so a failed FinnhubResult can propagate out of the cache's
// throw-to-skip-caching contract without being stored.
class ResultError extends Error {
  readonly finnhubError: FinnhubError;
  constructor(error: FinnhubError) {
    super(error.message);
    this.name = "ResultError";
    this.finnhubError = error;
  }
}

async function cachedResult<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<FinnhubResult<T>>,
): Promise<FinnhubResult<T>> {
  try {
    const data = await cache.getOrSet<T>(key, ttlMs, async () => {
      const result = await load();
      if (!result.ok) throw new ResultError(result.error);
      return result.data;
    });
    return { ok: true, data };
  } catch (error) {
    if (error instanceof ResultError) return { ok: false, error: error.finnhubError };
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail("UNKNOWN", message);
  }
}

// ---------------------------------------------------------------------------
// Numeric helpers (never let NaN/null leak into DTOs)
// ---------------------------------------------------------------------------

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Coalesce a possibly-missing/null/NaN provider number to `number | undefined`. */
function optionalNumber(value: unknown): number | undefined {
  return isFiniteNumber(value) ? value : undefined;
}

/** Like `optionalNumber`, but rounded to 2 decimals when present. */
function optionalRounded(value: unknown): number | undefined {
  const n = optionalNumber(value);
  return n === undefined ? undefined : round2(n);
}

// ---------------------------------------------------------------------------
// Typed REST wrappers (raw -> normalized DTO, cached)
// ---------------------------------------------------------------------------

export function getQuote(symbol: string): Promise<FinnhubResult<StockQuote>> {
  const sym = symbol.toUpperCase();
  return cachedResult(`quote:${sym}`, cache.TTL.QUOTE_MS, async () => {
    const raw = await request<FinnhubQuote>("/quote", { symbol: sym });
    if (!raw.ok) return raw;

    const q = raw.data;
    // Finnhub returns a zero-filled quote (c === 0, pc === 0) for unknown symbols.
    if (!isFiniteNumber(q.c) || (q.c === 0 && q.pc === 0)) {
      return fail("INVALID_SYMBOL", `No quote available for ${sym}`);
    }

    const updatedAt = isFiniteNumber(q.t) && q.t > 0 ? q.t * 1000 : Date.now();
    return {
      ok: true,
      data: {
        symbol: sym,
        price: round2(q.c),
        change: round2(q.d ?? 0),
        changePct: round2(q.dp ?? 0),
        prevClose: round2(q.pc),
        high: round2(q.h),
        low: round2(q.l),
        open: round2(q.o),
        updatedAt,
      },
    };
  });
}

export function getProfile(symbol: string): Promise<FinnhubResult<StockProfile>> {
  const sym = symbol.toUpperCase();
  return cachedResult(`profile:${sym}`, cache.TTL.PROFILE_MS, async () => {
    const raw = await request<FinnhubProfile2>("/stock/profile2", { symbol: sym });
    if (!raw.ok) return raw;

    const p = raw.data;
    // profile2 returns {} for unknown symbols; a missing name means no data.
    if (p.name === undefined || p.name.length === 0) {
      return fail("INVALID_SYMBOL", `No profile available for ${sym}`);
    }

    return {
      ok: true,
      data: {
        symbol: sym,
        name: p.name,
        marketCap: round2(optionalNumber(p.marketCapitalization) ?? 0),
        industry: p.finnhubIndustry ?? "Unknown",
        currency: p.currency ?? "USD",
        logo: p.logo !== undefined && p.logo.length > 0 ? p.logo : undefined,
      },
    };
  });
}

export function getMetrics(symbol: string): Promise<FinnhubResult<StockMetrics>> {
  const sym = symbol.toUpperCase();
  return cachedResult(`metrics:${sym}`, cache.TTL.METRICS_MS, async () => {
    const raw = await request<FinnhubMetrics>("/stock/metric", {
      symbol: sym,
      metric: "all",
    });
    if (!raw.ok) return raw;

    const m = raw.data.metric ?? {};
    return {
      ok: true,
      data: {
        symbol: sym,
        peRatio: optionalRounded(m.peTTM ?? m.peBasicExclExtraTTM),
        week52High: optionalRounded(m["52WeekHigh"]),
        week52Low: optionalRounded(m["52WeekLow"]),
        avgVolume: optionalRounded(m["10DayAverageTradingVolume"]),
      },
    };
  });
}

export function searchSymbols(
  query: string,
): Promise<FinnhubResult<SymbolSearchResult[]>> {
  const q = query.trim();
  if (q.length === 0) return Promise.resolve({ ok: true, data: [] });

  return cachedResult(`search:${q.toLowerCase()}`, SEARCH_TTL_MS, async () => {
    const raw = await request<FinnhubSearchResponse>("/search", { q });
    if (!raw.ok) return raw;

    const items = Array.isArray(raw.data.result) ? raw.data.result : [];
    return {
      ok: true,
      data: items.map((item) => ({
        symbol: item.symbol,
        description: item.description,
        type: item.type,
      })),
    };
  });
}

// ---------------------------------------------------------------------------
// Screener row composition
// ---------------------------------------------------------------------------

/**
 * Compose a single screener row from a live quote, company profile, and
 * fundamentals metrics. All three are fetched in parallel and cached at
 * different TTLs (quote ~8 s, profile ~12 h, metrics ~1 h), so the steady-
 * state cost after the first cold load is essentially just one quote call per
 * symbol. A failed quote fails the row; profile/metrics failures degrade
 * gracefully so P/E and 52-week fields are undefined rather than crashing.
 */
export async function getScreenerRow(
  symbol: string,
): Promise<FinnhubResult<ScreenerRow>> {
  const sym = symbol.toUpperCase();
  const [quoteRes, profileRes, metricsRes] = await Promise.all([
    getQuote(sym),
    getProfile(sym),
    getMetrics(sym),
  ]);

  if (!quoteRes.ok) return quoteRes;
  const quote = quoteRes.data;
  const profile = profileRes.ok ? profileRes.data : undefined;
  const metrics = metricsRes.ok ? metricsRes.data : undefined;

  return {
    ok: true,
    data: {
      symbol: sym,
      name: profile?.name ?? sym,
      price: quote.price,
      change: quote.change,
      changePct: quote.changePct,
      prevClose: quote.prevClose,
      marketCap: profile?.marketCap ?? 0,
      peRatio: metrics?.peRatio,
      week52High: metrics?.week52High,
      week52Low: metrics?.week52Low,
      source: "rest",
      stale: false,
      updatedAt: quote.updatedAt,
    },
  };
}

/**
 * Compose the richer single-stock detail from quote + profile + metrics. Unlike
 * the list row, this fetches metrics (P/E, 52-week range, avg volume) since the
 * detail view is opened for one symbol at a time, well within the rate budget.
 * A failed quote fails the request; profile/metrics failures degrade to
 * sensible fallbacks so a partial detail still renders.
 */
export async function getStockDetail(
  symbol: string,
): Promise<FinnhubResult<StockDetail>> {
  const sym = symbol.toUpperCase();
  const [quoteRes, profileRes, metricsRes] = await Promise.all([
    getQuote(sym),
    getProfile(sym),
    getMetrics(sym),
  ]);

  if (!quoteRes.ok) return quoteRes;
  const quote = quoteRes.data;
  const profile = profileRes.ok ? profileRes.data : undefined;
  const metrics = metricsRes.ok ? metricsRes.data : undefined;

  const detail: StockDetail = {
    symbol: sym,
    name: profile?.name ?? sym,
    price: quote.price,
    change: quote.change,
    changePct: quote.changePct,
    prevClose: quote.prevClose,
    open: quote.open,
    high: quote.high,
    low: quote.low,
    marketCap: profile?.marketCap ?? 0,
    industry: profile?.industry ?? "Unknown",
    currency: profile?.currency ?? "USD",
    logo: profile?.logo,
    peRatio: metrics?.peRatio,
    week52High: metrics?.week52High,
    week52Low: metrics?.week52Low,
    volume: metrics?.avgVolume,
    source: "rest",
    stale: false,
    updatedAt: quote.updatedAt,
  };
  return { ok: true, data: detail };
}

/**
 * Fetch many screener rows with bounded concurrency, tolerating partial
 * failures: a single symbol erroring out never fails the whole batch. Returns
 * the rows that succeeded plus a list of per-symbol failures.
 */
export async function getScreenerRows(
  symbols: readonly string[],
): Promise<ScreenerRowsResult> {
  const results = await mapWithConcurrency(symbols, MAX_CONCURRENCY, (sym) =>
    getScreenerRow(sym),
  );

  const rows: ScreenerRow[] = [];
  const failures: ScreenerRowsResult["failures"] = [];
  results.forEach((result, index) => {
    const sym = symbols[index] ?? "";
    if (result.ok) rows.push(result.data);
    else failures.push({ symbol: sym, error: result.error });
  });
  return { rows, failures };
}

// ---------------------------------------------------------------------------
// Concurrency limiter (small p-limit-style worker pool)
// ---------------------------------------------------------------------------

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      const item = items[index];
      if (item === undefined) continue;
      results[index] = await fn(item);
    }
  };

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
