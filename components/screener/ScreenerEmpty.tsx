/** Shown when the initial list has no rows and no error (stream connecting). */
export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-slate-300 dark:text-slate-600"
        aria-hidden="true"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        No stock data loaded yet
      </p>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Connecting to the live feed…
      </p>
    </div>
  );
}

/** Non-fatal banner shown when the server-side seed fetch failed entirely. */
export function LoadError() {
  return (
    <div className="rounded-xl border border-red-100 bg-red-50 px-6 py-8 text-center dark:border-red-900/40 dark:bg-red-950/20">
      <p className="text-sm font-medium text-red-700 dark:text-red-400">
        Failed to load the initial stock list
      </p>
      <p className="mt-1 text-xs text-red-500 dark:text-red-500">
        Live prices will still stream in as the connection establishes.
      </p>
    </div>
  );
}
