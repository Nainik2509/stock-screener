import { fmtPrice } from "@/lib/formatters";

interface Props {
  low: number;
  high: number;
  current: number;
}

/**
 * Horizontal bar showing where the current price sits between the 52-week low
 * and high. Percentage is clamped to [0, 100] so the marker stays visible even
 * when a fresh quote momentarily falls outside the stored 52-week bounds.
 *
 * A floating price label is anchored above the marker dot and kept 5–95%
 * so it never clips into the panel edge.
 */
export function Range52W({ low, high, current }: Props) {
  const pct =
    high > low
      ? Math.max(0, Math.min(100, ((current - low) / (high - low)) * 100))
      : 50;

  // Keep the label from clipping at the left or right panel edge.
  const labelPct = Math.max(5, Math.min(95, pct));

  return (
    <div>
      {/* Floating current-price label above the marker */}
      <div className="relative mb-2 h-5">
        <span
          className="absolute -translate-x-1/2 text-xs font-semibold tabular-nums text-blue-600 dark:text-blue-400"
          style={{ left: `${labelPct}%` }}
        >
          {fmtPrice(current)}
        </span>
      </div>

      {/* Track */}
      <div className="relative h-3 rounded-full bg-slate-100 dark:bg-slate-800">
        {/* Filled progress */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-400 to-blue-500 dark:from-blue-600 dark:to-blue-500"
          style={{ width: `${pct}%` }}
        />
        {/* Marker dot */}
        <div
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600 shadow-md dark:border-slate-900 dark:bg-blue-400"
          style={{ left: `${pct}%` }}
        />
      </div>

      {/* Low / position / High labels */}
      <div className="mt-2 flex items-start justify-between text-xs">
        <div>
          <p className="font-semibold tabular-nums text-slate-700 dark:text-slate-300">
            {fmtPrice(low)}
          </p>
          <p className="text-slate-400 dark:text-slate-500">52W Low</p>
        </div>
        <div className="text-center text-slate-400 dark:text-slate-500">
          <p className="font-medium text-slate-500 dark:text-slate-400">
            {pct.toFixed(0)}%
          </p>
          <p>of range</p>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums text-slate-700 dark:text-slate-300">
            {fmtPrice(high)}
          </p>
          <p className="text-slate-400 dark:text-slate-500">52W High</p>
        </div>
      </div>
    </div>
  );
}
