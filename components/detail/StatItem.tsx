/**
 * A single label/value row inside a rounded-bordered card.
 * Horizontal padding lives here so text never presses against a rounded border.
 * The container must have `overflow-hidden` so `last:border-0` clips correctly.
 */
export function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 last:border-0 dark:border-slate-800">
      <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className="truncate text-right text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
        {value}
      </span>
    </div>
  );
}
