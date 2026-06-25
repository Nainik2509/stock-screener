"use client";

import type { ReactNode } from "react";
import type {
  CapBucket,
  MovementFilter,
  ScreenerFilters,
  Week52Filter,
} from "@/lib/filters";
import { DEFAULT_FILTERS, isDefaultFilters } from "@/lib/filters";

// ---------------------------------------------------------------------------
// Module-level constants (never change — no reason to recreate on render)
// ---------------------------------------------------------------------------

const MOVEMENTS: { value: MovementFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "gainers", label: "Gainers" },
  { value: "losers", label: "Losers" },
  { value: "big", label: "≥ 1% move" },
];

const CAPS: { value: CapBucket; label: string; title: string }[] = [
  { value: "all", label: "All", title: "All market caps" },
  { value: "mega", label: "Mega", title: "Market cap > $200 B" },
  { value: "large", label: "Large", title: "Market cap $10 B – $200 B" },
  { value: "mid", label: "Mid", title: "Market cap $2 B – $10 B" },
  { value: "small", label: "Small", title: "Market cap < $2 B" },
];

const WK52S: { value: Week52Filter; label: string; title: string }[] = [
  { value: "all", label: "All", title: "No 52-week filter" },
  {
    value: "near-high",
    label: "Near High",
    title: "Price within 10% of 52-week high (momentum signal)",
  },
  {
    value: "near-low",
    label: "Near Low",
    title: "Price within 10% of 52-week low (potential reversal)",
  },
];

// Shared input class for P/E number inputs (hide browser spin buttons)
const NUMBER_INPUT_CLS =
  "w-20 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs " +
  "text-slate-800 placeholder-slate-400 outline-none transition-colors " +
  "focus:border-slate-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 " +
  "dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-slate-500 " +
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none " +
  "[&::-webkit-outer-spin-button]:appearance-none";

// ---------------------------------------------------------------------------
// Internal primitives
// ---------------------------------------------------------------------------

interface ChipProps {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: ReactNode;
}

function Chip({ active, onClick, title, children }: ChipProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={[
        "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-100",
        active
          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
          : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

interface FilterRowProps {
  label: string;
  children: ReactNode;
}

function FilterRow({ label, children }: FilterRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 shrink-0 text-xs font-semibold text-slate-400 dark:text-slate-500">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component — controlled; all state and URL sync live in ScreenerTable
// ---------------------------------------------------------------------------

interface Props {
  filters: ScreenerFilters;
  onChange: (next: ScreenerFilters) => void;
  matchCount: number;
  totalCount: number;
}

export function FilterBar({ filters, onChange, matchCount, totalCount }: Props) {
  const set = <K extends keyof ScreenerFilters>(
    key: K,
    value: ScreenerFilters[K],
  ) => onChange({ ...filters, [key]: value });

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* Search */}
      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search ticker or company name…"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-sm text-slate-800 placeholder-slate-400 outline-none transition-colors focus:border-slate-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-slate-500 dark:focus:bg-slate-800/60"
          />
          {filters.search.length > 0 && (
            <button
              type="button"
              onClick={() => set("search", "")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Filter rows */}
      <div className="flex flex-col gap-3 px-4 py-3">
        <FilterRow label="Movement">
          {MOVEMENTS.map(({ value, label }) => (
            <Chip
              key={value}
              active={filters.movement === value}
              onClick={() => set("movement", value)}
            >
              {label}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="Cap size">
          {CAPS.map(({ value, label, title }) => (
            <Chip
              key={value}
              title={title}
              active={filters.cap === value}
              onClick={() => set("cap", value)}
            >
              {label}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="52-Week">
          {WK52S.map(({ value, label, title }) => (
            <Chip
              key={value}
              title={title}
              active={filters.week52 === value}
              onClick={() => set("week52", value)}
            >
              {label}
            </Chip>
          ))}
        </FilterRow>

        {/* P/E range — hint moved to placeholder + title to keep the row compact */}
        <FilterRow label="P/E ratio">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              placeholder="Min"
              title="Minimum P/E ratio (stocks without P/E data are excluded)"
              value={filters.peMin}
              min={0}
              onChange={(e) => set("peMin", e.target.value)}
              className={NUMBER_INPUT_CLS}
            />
            <span className="text-xs text-slate-400 dark:text-slate-500">–</span>
            <input
              type="number"
              placeholder="Max"
              title="Maximum P/E ratio (stocks without P/E data are excluded)"
              value={filters.peMax}
              min={0}
              onChange={(e) => set("peMax", e.target.value)}
              className={NUMBER_INPUT_CLS}
            />
          </div>
        </FilterRow>
      </div>

      {/* Footer: match count + conditional reset */}
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {matchCount}
          </span>{" "}
          of {totalCount} stocks
        </span>

        {!isDefaultFilters(filters) && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            Reset filters
          </button>
        )}
      </div>
    </div>
  );
}
