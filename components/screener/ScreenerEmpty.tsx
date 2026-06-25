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

/** Shown when active filters reduce the list to zero matches. */
export function NoMatches({ onReset }: { onReset: () => void }) {
  return (
    <tr>
      <td colSpan={6}>
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            No stocks match these filters
          </p>
          <button
            type="button"
            onClick={onReset}
            className="mt-1 rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-50 dark:text-slate-400 dark:ring-slate-700 dark:hover:bg-slate-800"
          >
            Reset filters
          </button>
        </div>
      </td>
    </tr>
  );
}

interface LoadErrorProps {
  /** If provided, renders a "Try again" button alongside the message. */
  onRetry?: () => void;
  /** Shows a spinner on the retry button while loading. */
  retrying?: boolean;
}

/** Non-fatal banner shown when the server-side seed fetch failed entirely. */
export function LoadError({ onRetry, retrying = false }: LoadErrorProps) {
  return (
    <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-5 py-4 dark:border-amber-900/30 dark:bg-amber-950/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Could not load stock data
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-600 dark:text-amber-500">
            Check your API key and network connection. Live prices will stream
            in once the feed reconnects.
          </p>
        </div>
        {onRetry !== undefined && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:text-amber-400 dark:ring-amber-800 dark:hover:bg-amber-900/20"
          >
            {retrying ? "Loading…" : "Try again"}
          </button>
        )}
      </div>
    </div>
  );
}
