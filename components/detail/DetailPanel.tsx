"use client";

import { useEffect, useReducer } from "react";
import type { ScreenerRow, StockDetail } from "@/lib/types";
import { fmtChange, fmtChangePct, fmtMarketCap, fmtPrice } from "@/lib/formatters";
import { Range52W } from "@/components/detail/Range52W";
import { StatItem } from "@/components/detail/StatItem";
import { PanelSkeleton } from "@/components/detail/PanelSkeleton";
import { InsightCard } from "@/components/detail/InsightCard";

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

type ApiResponse =
  | { data: StockDetail }
  | { error: { code: string; message: string } };

/** All fetch states collapsed into a discriminated union. */
type FetchState =
  | { status: "loading" }
  | { status: "success"; detail: StockDetail }
  | { status: "error"; message: string };

type FetchAction =
  | { type: "start" }
  | { type: "success"; detail: StockDetail }
  | { type: "error"; message: string };

function fetchReducer(_prev: FetchState, action: FetchAction): FetchState {
  switch (action.type) {
    case "start":
      return { status: "loading" };
    case "success":
      return { status: "success", detail: action.detail };
    case "error":
      return { status: "error", message: action.message };
  }
}

// ---------------------------------------------------------------------------
// Module-level utilities
// ---------------------------------------------------------------------------

/** Format an optional number with `fn`, falling back to an em-dash. */
function fmt(v: number | undefined, fn: (n: number) => string): string {
  return v !== undefined ? fn(v) : "—";
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function SectionHeading({ children }: { children: string }) {
  return (
    <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
      {children}
    </h3>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close detail panel"
      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  );
}

function FetchError({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-100 bg-red-50 p-5 text-center dark:border-red-900/30 dark:bg-red-950/20">
      <p className="text-sm font-semibold text-red-700 dark:text-red-400">
        Failed to load detail
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-red-500 dark:text-red-500">
        {message}
      </p>
    </div>
  );
}

/**
 * A compact card used in the 2×2 "Today's Trading" grid.
 * `accent` colours the value green (Day High) or red (Day Low).
 */
function TradingCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "up" | "down";
}) {
  const valueCls =
    accent === "up"
      ? "text-green-600 dark:text-green-400"
      : accent === "down"
        ? "text-red-500 dark:text-red-400"
        : "text-slate-800 dark:text-slate-100";

  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3.5 dark:bg-slate-800/60">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className={`mt-1.5 text-sm font-semibold tabular-nums ${valueCls}`}>
        {value}
      </p>
    </div>
  );
}

/**
 * All data-rich sections rendered once the detail fetch succeeds.
 * Receives `detail: StockDetail` (never null) to avoid repeated null-checks.
 */
function DetailContent({
  detail,
  currentPrice,
}: {
  detail: StockDetail;
  currentPrice: number | undefined;
}) {
  const price = currentPrice ?? detail.price;

  return (
    <div className="space-y-7">
      {/* ── Today's Trading ────────────────────────────────────────────── */}
      <div>
        <SectionHeading>Today&apos;s Trading</SectionHeading>
        <div className="grid grid-cols-2 gap-2">
          <TradingCard label="Open" value={fmt(detail.open, fmtPrice)} />
          <TradingCard
            label="Day High"
            value={fmt(detail.high, fmtPrice)}
            accent="up"
          />
          <TradingCard label="Prev. Close" value={fmtPrice(detail.prevClose)} />
          <TradingCard
            label="Day Low"
            value={fmt(detail.low, fmtPrice)}
            accent="down"
          />
        </div>
      </div>

      {/* ── 52-Week Range ───────────────────────────────────────────────── */}
      {detail.week52High !== undefined && detail.week52Low !== undefined && (
        <div>
          <SectionHeading>52-Week Range</SectionHeading>
          <Range52W
            low={detail.week52Low}
            high={detail.week52High}
            current={price}
          />
        </div>
      )}

      {/* ── Valuation & Size ────────────────────────────────────────────── */}
      <div>
        <SectionHeading>Valuation &amp; Size</SectionHeading>
        <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
          <StatItem
            label="P/E Ratio (TTM)"
            value={fmt(detail.peRatio, (v) => v.toFixed(1))}
          />
          <StatItem label="Market Cap" value={fmtMarketCap(detail.marketCap)} />
          <StatItem
            label="Avg. Volume (10d)"
            value={
              detail.volume !== undefined
                ? `${(detail.volume / 1_000).toFixed(1)}K / day`
                : "—"
            }
          />
        </div>
      </div>

      {/* ── Company ─────────────────────────────────────────────────────── */}
      <div>
        <SectionHeading>Company</SectionHeading>
        <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
          <StatItem label="Industry" value={detail.industry} />
          <StatItem label="Exchange" value={detail.exchange} />
          <StatItem label="Currency" value={detail.currency} />
        </div>
      </div>

      {/* ── AI Insight — isolated; failures never affect the rest ───────── */}
      {/* key={symbol} remounts the card on stock change, resetting to idle. */}
      <InsightCard key={detail.symbol} symbol={detail.symbol} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

interface Props {
  symbol: string;
  /** Live row from the SSE feed — overlays the stale fetched price. */
  liveRow: ScreenerRow | undefined;
  onClose: () => void;
}

/**
 * Slide-in detail panel for a single stock.
 *
 * Fetches full detail from /api/stock/[symbol] on open, but shows the live
 * SSE price (from liveRow) so the header price stays current while the panel
 * is open. Closes on: X button, Escape key, or clicking the backdrop.
 */
export function DetailPanel({ symbol, liveRow, onClose }: Props) {
  const [fetchState, dispatch] = useReducer(fetchReducer, { status: "loading" });

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Fetch full detail whenever the symbol changes. A single dispatch("start")
  // resets all sub-states atomically, avoiding multiple synchronous setState
  // calls in the effect body.
  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "start" });

    async function load() {
      try {
        const res = await fetch(`/api/stock/${encodeURIComponent(symbol)}`);
        // res.json() is typed `any` in the DOM lib; cast to our known envelope.
        const json = (await res.json()) as ApiResponse;
        if (cancelled) return;
        if ("error" in json) {
          dispatch({ type: "error", message: json.error.message });
        } else {
          dispatch({ type: "success", detail: json.data });
        }
      } catch (err) {
        if (!cancelled) {
          dispatch({
            type: "error",
            message: err instanceof Error ? err.message : "Unexpected error",
          });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  // Prefer live SSE price over the (stale) fetched snapshot.
  const detail =
    fetchState.status === "success" ? fetchState.detail : null;
  const price = liveRow?.price ?? detail?.price;
  const change = liveRow?.change ?? detail?.change;
  const changePct = liveRow?.changePct ?? detail?.changePct;
  const isUp = (change ?? 0) >= 0;

  return (
    <>
      {/* Backdrop — clicking it closes the panel */}
      <div
        className="fixed inset-0 z-30 bg-slate-900/20 dark:bg-slate-900/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sliding panel — aria-labelledby points at the ticker heading below */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-panel-title"
        className="fixed inset-y-0 right-0 z-40 flex w-full flex-col bg-white shadow-2xl dark:bg-slate-900 sm:w-[440px]"
      >
        {/* ── Fixed header ───────────────────────────────────────────────── */}
        <div className="border-b border-slate-100 px-5 pb-5 pt-4 dark:border-slate-800">
          {/* Top row: ticker label + close button */}
          <div className="flex items-center justify-between gap-2">
            <span
              id="detail-panel-title"
              className="font-mono text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500"
            >
              {symbol}
            </span>
            <CloseButton onClick={onClose} />
          </div>

          {/* Company name */}
          <p className="mt-1 truncate text-base font-semibold leading-snug text-slate-900 dark:text-slate-100">
            {detail?.name ??
              (fetchState.status === "loading" ? "Loading…" : symbol)}
          </p>

          {/* Price + change pill */}
          <div className="mt-3 flex flex-wrap items-end gap-2.5">
            <span className="text-2xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-100">
              {price !== undefined ? fmtPrice(price) : "—"}
            </span>

            {change !== undefined && changePct !== undefined && (
              <span
                className={[
                  "mb-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5",
                  "text-xs font-semibold tabular-nums",
                  isUp
                    ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                    : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
                ].join(" ")}
              >
                {fmtChange(change)}{" "}
                <span className="opacity-75">({fmtChangePct(changePct)})</span>
              </span>
            )}
          </div>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-6">
          {fetchState.status === "loading" && <PanelSkeleton />}

          {fetchState.status === "error" && (
            <FetchError message={fetchState.message} />
          )}

          {fetchState.status === "success" && (
            <DetailContent
              detail={fetchState.detail}
              currentPrice={price}
            />
          )}
        </div>
      </aside>
    </>
  );
}
