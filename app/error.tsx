"use client";

import { useEffect } from "react";

/**
 * Route-segment error boundary for the root page. Catches unexpected
 * render/hydration errors that bubble up past the component-level
 * ErrorBoundary wrappers. Shows a calm recovery UI rather than a blank page.
 *
 * `unstable_retry` re-renders the route segment without a full navigation.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Log so the error is visible in the console during development.
    console.error("[page error]", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-slate-400 dark:text-slate-500"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Something went wrong
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          The screener ran into an unexpected error. Your data was not affected.
        </p>
      </div>

      <button
        type="button"
        onClick={() => unstable_retry()}
        className="mt-1 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        Reload screener
      </button>
    </div>
  );
}
