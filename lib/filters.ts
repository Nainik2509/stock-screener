/**
 * Pure filter types and logic for the screener table.
 * No React dependency — importable from anywhere.
 */

import type { ScreenerRow } from "@/lib/types";

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export type MovementFilter = "all" | "gainers" | "losers" | "big";
export type CapBucket = "all" | "mega" | "large" | "mid" | "small";
export type Week52Filter = "all" | "near-high" | "near-low";

export interface ScreenerFilters {
  /** Partial match on symbol or company name. */
  search: string;
  movement: MovementFilter;
  cap: CapBucket;
  /**
   * P/E bounds kept as strings so they mirror <input type="number"> values
   * without silent coercion; empty string = "no bound".
   */
  peMin: string;
  peMax: string;
  week52: Week52Filter;
}

export const DEFAULT_FILTERS: ScreenerFilters = {
  search: "",
  movement: "all",
  cap: "all",
  peMin: "",
  peMax: "",
  week52: "all",
};

// ---------------------------------------------------------------------------
// Market-cap bucket thresholds (Finnhub unit: millions USD)
// ---------------------------------------------------------------------------

const CAP = {
  mega: 200_000, // > $200 B
  large: 10_000, // $10 B – $200 B
  mid: 2_000,    // $2 B – $10 B
  // small: < $2 B
} as const;

// ---------------------------------------------------------------------------
// Core filter function
// ---------------------------------------------------------------------------

export function applyFilters(
  rows: ScreenerRow[],
  f: ScreenerFilters,
): ScreenerRow[] {
  const search = f.search.trim().toLowerCase();

  // Parse P/E bounds once; NaN means "no bound".
  const peMin = f.peMin === "" ? NaN : parseFloat(f.peMin);
  const peMax = f.peMax === "" ? NaN : parseFloat(f.peMax);
  const hasPeFilter = !isNaN(peMin) || !isNaN(peMax);

  return rows.filter((row) => {
    // --- Search ---
    if (
      search.length > 0 &&
      !row.symbol.toLowerCase().includes(search) &&
      !row.name.toLowerCase().includes(search)
    ) {
      return false;
    }

    // --- Movement ---
    if (f.movement === "gainers" && row.changePct <= 0) return false;
    if (f.movement === "losers" && row.changePct >= 0) return false;
    // "big mover" threshold: ≥ 1 % (meaningful for large-caps)
    if (f.movement === "big" && Math.abs(row.changePct) < 1) return false;

    // --- Market-cap bucket ---
    if (f.cap !== "all") {
      const mc = row.marketCap;
      if (f.cap === "mega" && mc <= CAP.mega) return false;
      if (
        f.cap === "large" &&
        (mc > CAP.mega || mc <= CAP.large)
      )
        return false;
      if (f.cap === "mid" && (mc > CAP.large || mc <= CAP.mid)) return false;
      if (f.cap === "small" && mc > CAP.mid) return false;
    }

    // --- P/E ratio ---
    // When a range is active, exclude rows whose P/E is unknown.
    if (hasPeFilter) {
      const pe = row.peRatio;
      if (pe === undefined || !Number.isFinite(pe)) return false;
      if (!isNaN(peMin) && pe < peMin) return false;
      if (!isNaN(peMax) && pe > peMax) return false;
    }

    // --- 52-week proximity ---
    // "Near high": within 10 % below the 52-week high.
    if (f.week52 === "near-high") {
      const h = row.week52High;
      if (h === undefined || row.price < h * 0.9) return false;
    }
    // "Near low": within 10 % above the 52-week low.
    if (f.week52 === "near-low") {
      const l = row.week52Low;
      if (l === undefined || row.price > l * 1.1) return false;
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// URL serialisation helpers (only non-default values are written to the URL)
// ---------------------------------------------------------------------------

export function filtersToParams(
  f: ScreenerFilters,
): Record<string, string> {
  const p: Record<string, string> = {};
  if (f.search !== "") p["q"] = f.search;
  if (f.movement !== "all") p["move"] = f.movement;
  if (f.cap !== "all") p["cap"] = f.cap;
  if (f.peMin !== "") p["peMin"] = f.peMin;
  if (f.peMax !== "") p["peMax"] = f.peMax;
  if (f.week52 !== "all") p["wk52"] = f.week52;
  return p;
}

const VALID_MOVEMENT: MovementFilter[] = ["all", "gainers", "losers", "big"];
const VALID_CAP: CapBucket[] = ["all", "mega", "large", "mid", "small"];
const VALID_WK52: Week52Filter[] = ["all", "near-high", "near-low"];

function oneOf<T extends string>(
  value: string | null,
  valid: readonly T[],
  fallback: T,
): T {
  if (value !== null && (valid as readonly string[]).includes(value)) {
    return value as T;
  }
  return fallback;
}

export function paramsToFilters(params: URLSearchParams): ScreenerFilters {
  return {
    search: params.get("q") ?? "",
    movement: oneOf(params.get("move"), VALID_MOVEMENT, "all"),
    cap: oneOf(params.get("cap"), VALID_CAP, "all"),
    peMin: params.get("peMin") ?? "",
    peMax: params.get("peMax") ?? "",
    week52: oneOf(params.get("wk52"), VALID_WK52, "all"),
  };
}

export function isDefaultFilters(f: ScreenerFilters): boolean {
  return (
    f.search === "" &&
    f.movement === "all" &&
    f.cap === "all" &&
    f.peMin === "" &&
    f.peMax === "" &&
    f.week52 === "all"
  );
}
