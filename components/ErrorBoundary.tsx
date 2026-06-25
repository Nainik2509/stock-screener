"use client";

import { unstable_catchError as catchError } from "next/error";
import type { ErrorInfo } from "next/error";

interface Props {
  /** Short human-readable label shown in the fallback — e.g. "stock detail panel". */
  label?: string;
}

/**
 * Reusable component-level error boundary, built on Next.js 16's
 * `unstable_catchError`. Catches unexpected render errors in the child tree
 * and shows a calm, contained fallback instead of crashing the page.
 *
 * Usage:
 *   <ErrorBoundary label="screener table">
 *     <ScreenerTable ... />
 *   </ErrorBoundary>
 */
function ErrorFallback(
  { label }: Props,
  { error, unstable_retry }: ErrorInfo,
) {
  const thing = label ?? "this section";
  // Log for debugging; in production this would go to an error tracker.
  console.error(`[ErrorBoundary: ${thing}]`, error);

  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
        Something went wrong in {thing}.
      </p>
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        Try again
      </button>
    </div>
  );
}

export const ErrorBoundary = catchError(ErrorFallback);
