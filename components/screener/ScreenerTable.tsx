"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PriceUpdate, ScreenerRow } from "@/lib/types";
import {
  DEFAULT_FILTERS,
  applyFilters,
  filtersToParams,
  paramsToFilters,
} from "@/lib/filters";
import type { ScreenerFilters } from "@/lib/filters";
import { FilterBar } from "@/components/filter/FilterBar";
import { StatusBadge } from "@/components/screener/StatusBadge";
import type { ConnectionStatus } from "@/components/screener/StatusBadge";
import { StockRow } from "@/components/screener/StockRow";
import type { FlashDir } from "@/components/screener/StockRow";
import {
  EmptyState,
  LoadError,
  NoMatches,
} from "@/components/screener/ScreenerEmpty";

interface Props {
  initialRows: ScreenerRow[];
  initialError?: boolean;
}

/**
 * Live screener table. Responsibilities:
 *  - Seed row state from the RSC initial fetch.
 *  - Maintain one SSE connection to /api/stream and merge price updates in place.
 *  - Manage filter state, sync it to the URL, and apply filters to the row list.
 *  - Delegate rendering sub-tasks to focused sub-components.
 */
export default function ScreenerTable({
  initialRows,
  initialError = false,
}: Props) {
  // -------------------------------------------------------------------------
  // Row + live-update state
  // -------------------------------------------------------------------------

  const [rows, setRows] = useState<ScreenerRow[]>(() =>
    [...initialRows].sort((a, b) => b.marketCap - a.marketCap),
  );
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  // Partial so indexed access is explicitly T | undefined (noUncheckedIndexedAccess).
  const [flashes, setFlashes] = useState<Partial<Record<string, FlashDir>>>({});

  // Track last price per symbol to compute flash direction.
  const prevPrices = useRef<Map<string, number>>(
    new Map(initialRows.map((r) => [r.symbol, r.price])),
  );

  const handleUpdate = useCallback((update: PriceUpdate) => {
    const prev = prevPrices.current.get(update.symbol);
    prevPrices.current.set(update.symbol, update.price);

    if (prev !== undefined && prev !== update.price) {
      const dir: FlashDir = update.price > prev ? "up" : "down";
      setFlashes((f) => ({ ...f, [update.symbol]: dir }));
      setTimeout(() => {
        setFlashes((f) => {
          const next = { ...f };
          delete next[update.symbol];
          return next;
        });
      }, 900);
    }

    // Update only the changed row; sort order is stable (sorted by marketCap).
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.symbol === update.symbol);
      if (idx === -1) return prev;
      // idx is in-bounds (findIndex guarantees); assertion required by
      // noUncheckedIndexedAccess.
      const existing = prev[idx]!;
      const next = [...prev];
      next[idx] = {
        ...existing,
        price: update.price,
        change: Math.round((update.price - existing.prevClose) * 100) / 100,
        changePct: update.changePct,
        stale: false,
        updatedAt: update.ts,
      };
      return next;
    });

    setStatus(update.source === "ws" ? "live" : "polling");
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/stream");

    es.onmessage = (event: MessageEvent) => {
      // event.data is typed as `any` in the DOM lib; narrow before use.
      if (typeof event.data !== "string") return;
      try {
        const update = JSON.parse(event.data) as PriceUpdate;
        handleUpdate(update);
      } catch {
        // Malformed SSE frame — ignore and continue.
      }
    };

    es.onerror = () => {
      setStatus("error");
    };

    return () => {
      es.close();
    };
  }, [handleUpdate]);

  // -------------------------------------------------------------------------
  // Filter state — initialised from URL search params on mount
  // -------------------------------------------------------------------------

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [filters, setFilters] = useState<ScreenerFilters>(() =>
    paramsToFilters(searchParams),
  );

  const updateFilters = useCallback(
    (next: ScreenerFilters) => {
      setFilters(next);
      // Reflect filters in the URL so the view is shareable and
      // refresh-recoverable without triggering a server re-fetch (the RSC
      // page does not consume searchParams).
      const params = new URLSearchParams(filtersToParams(next));
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const resetFilters = useCallback(
    () => updateFilters(DEFAULT_FILTERS),
    [updateFilters],
  );

  // Apply all active filters to the full row list. Recomputes when either
  // rows (SSE update) or filters (user interaction) change.
  const displayRows = useMemo(
    () => applyFilters(rows, filters),
    [rows, filters],
  );

  // Formatted once per mount — the date doesn't change mid-session.
  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    [],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Page title */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Market Overview
        </h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Showing {displayRows.length} of {rows.length} stocks · sorted by
          market cap
        </p>
      </div>

      {/* Non-fatal load error */}
      {initialError && rows.length === 0 && <LoadError />}

      {/* Filter bar — always visible */}
      <FilterBar
        filters={filters}
        onChange={updateFilters}
        matchCount={displayRows.length}
        totalCount={rows.length}
      />

      {/* Empty states */}
      {rows.length === 0 && !initialError ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {/* Status bar */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {todayLabel}
            </span>
            <StatusBadge status={status} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-500">
                  <th className="w-10 px-3 py-3 text-center">#</th>
                  <th className="px-4 py-3">Symbol</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Company</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Change</th>
                  <th className="hidden px-4 py-3 text-right lg:table-cell">
                    Mkt Cap
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {displayRows.length === 0 ? (
                  <NoMatches onReset={resetFilters} />
                ) : (
                  displayRows.map((row, i) => (
                    <StockRow
                      key={row.symbol}
                      row={row}
                      rank={i + 1}
                      flashDir={flashes[row.symbol]}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer note */}
          <div className="border-t border-slate-100 px-4 py-2.5 text-right text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
            {status === "polling"
              ? "Prices delayed · REST polling fallback (market closed or socket idle)"
              : status === "live"
                ? "Prices updating in real-time via Finnhub WebSocket"
                : "Prices from last successful fetch"}
          </div>
        </div>
      )}
    </div>
  );
}
