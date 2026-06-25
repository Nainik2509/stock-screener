import "server-only";

import type {
  FinnhubError,
  FinnhubResult,
  ScreenerRow,
  ScreenerRowsResult,
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

// Bound concurrent upstream calls so a full-universe fetch can't blow past the
// 60 calls/min rate limit in a single burst.
const MAX_CONCURRENCY = 5;

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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Coalesce a possibly-missing/null/NaN provider number to `number | undefined`. */
function optionalNumber(value: unknown): number | undefined {
  return isFiniteNumber(value) ? value : undefined;
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
        marketCap: optionalNumber(p.marketCapitalization) ?? 0,
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
        peRatio: optionalNumber(m.peTTM ?? m.peBasicExclExtraTTM),
        week52High: optionalNumber(m["52WeekHigh"]),
        week52Low: optionalNumber(m["52WeekLow"]),
        avgVolume: optionalNumber(m["10DayAverageTradingVolume"]),
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
 * Compose a single screener row from a live quote + company profile. Metrics
 * (P/E, 52-week range) are only included when already cached, so building the
 * initial list stays cheap (quote + profile only). A failed quote fails the
 * row; a failed profile degrades gracefully (symbol as name, marketCap 0).
 */
export async function getScreenerRow(
  symbol: string,
): Promise<FinnhubResult<ScreenerRow>> {
  const sym = symbol.toUpperCase();
  const [quoteRes, profileRes] = await Promise.all([
    getQuote(sym),
    getProfile(sym),
  ]);

  if (!quoteRes.ok) return quoteRes;
  const quote = quoteRes.data;
  const profile = profileRes.ok ? profileRes.data : undefined;
  const metrics = cache.get<StockMetrics>(`metrics:${sym}`);

  const row: ScreenerRow = {
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
  };
  return { ok: true, data: row };
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
