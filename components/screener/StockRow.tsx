import type { ScreenerRow } from "@/lib/types";
import { fmtChange, fmtChangePct, fmtMarketCap, fmtPrice } from "@/lib/formatters";

/** Direction of the last price movement — drives the CSS flash animation. */
export type FlashDir = "up" | "down";

interface Props {
  row: ScreenerRow;
  rank: number;
  /** Undefined means no flash is active for this row. */
  flashDir: FlashDir | undefined;
  /** Opens the detail panel for this stock. */
  onClick: () => void;
  /** Highlights the row when its detail panel is open. */
  isSelected: boolean;
}

/**
 * A single screener table row. Purely presentational — no hooks, no state.
 */
export function StockRow({ row, rank, flashDir, onClick, isSelected }: Props) {
  const isUp = row.change >= 0;
  const changeCls = isUp
    ? "text-green-600 dark:text-green-400"
    : "text-red-600 dark:text-red-400";

  return (
    <tr
      onClick={onClick}
      aria-selected={isSelected}
      className={[
        "cursor-pointer transition-colors duration-150",
        isSelected
          ? "bg-blue-50/80 dark:bg-blue-950/20"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/40",
        flashDir === "up" ? "price-flash-up" : "",
        flashDir === "down" ? "price-flash-down" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Rank */}
      <td className="w-10 px-3 py-3.5 text-center text-xs tabular-nums text-slate-400 dark:text-slate-500">
        {rank}
      </td>

      {/* Symbol — full name shown inline on mobile (Company column hidden) */}
      <td className="px-4 py-3.5">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
            {row.symbol}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 sm:hidden">
            {row.name}
          </span>
        </div>
      </td>

      {/* Company name — hidden on very small screens (shown inline above) */}
      <td className="hidden px-4 py-3.5 text-sm text-slate-600 dark:text-slate-300 sm:table-cell">
        {row.name}
      </td>

      {/* Price */}
      <td className="px-4 py-3.5 text-right">
        <span className="tabular-nums text-sm font-semibold text-slate-800 dark:text-slate-100">
          {fmtPrice(row.price)}
        </span>
        {row.stale && (
          <span
            className="ml-1 text-xs text-slate-400 dark:text-slate-500"
            title="Last known value — refresh failed"
          >
            ·
          </span>
        )}
      </td>

      {/* Daily change: dollar amount + % stacked */}
      <td className="px-4 py-3.5 text-right">
        <span
          className={`flex flex-col items-end leading-tight tabular-nums ${changeCls}`}
        >
          <span className="text-sm font-medium">{fmtChange(row.change)}</span>
          <span className="text-xs opacity-80">
            {fmtChangePct(row.changePct)}
          </span>
        </span>
      </td>

      {/* Market cap — hidden below lg breakpoint */}
      <td className="hidden px-4 py-3.5 text-right text-sm tabular-nums text-slate-600 dark:text-slate-300 lg:table-cell">
        {fmtMarketCap(row.marketCap)}
      </td>
    </tr>
  );
}
