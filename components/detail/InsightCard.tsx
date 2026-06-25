"use client";

import { useReducer } from "react";

// ---------------------------------------------------------------------------
// Response envelope + local state machine
// ---------------------------------------------------------------------------

interface InsightResponse {
  data?: { symbol: string; insight: string; model: string };
  error?: { code: string; message: string };
}

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; insight: string; model: string }
  | { status: "error" };

type Action =
  | { type: "start" }
  | { type: "success"; insight: string; model: string }
  | { type: "error" };

function reducer(_prev: State, action: Action): State {
  switch (action.type) {
    case "start":
      return { status: "loading" };
    case "success":
      return { status: "success", insight: action.insight, model: action.model };
    case "error":
      return { status: "error" };
  }
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        className="opacity-20"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

/**
 * AI insight generator for the detail panel.
 *
 * Fully isolated: any failure here surfaces as an inline message and never
 * affects the screener table or the rest of the detail panel. The parent
 * remounts this component via `key={symbol}`, so opening a different stock
 * resets it back to the idle state automatically.
 */
export function InsightCard({ symbol }: { symbol: string }) {
  const [state, dispatch] = useReducer(reducer, { status: "idle" });

  async function generate() {
    dispatch({ type: "start" });
    try {
      const res = await fetch(`/api/insight/${encodeURIComponent(symbol)}`, {
        method: "POST",
      });
      // res.json() is typed `any` in the DOM lib; cast to our known envelope.
      const json = (await res.json()) as InsightResponse;

      if (res.ok && json.data) {
        dispatch({
          type: "success",
          insight: json.data.insight,
          model: json.data.model,
        });
      } else {
        dispatch({ type: "error" });
      }
    } catch {
      // Network/parse failure — stays contained to this card.
      dispatch({ type: "error" });
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4 dark:border-slate-700/60 dark:from-slate-800/40 dark:to-slate-900">
      {/* Heading row */}
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
          <SparkleIcon />
        </span>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          AI Insight
        </h4>
      </div>

      {/* Dynamic region — aria-live announces the result once it arrives. */}
      <div aria-live="polite" aria-busy={state.status === "loading"}>
        {/* Idle */}
        {state.status === "idle" && (
          <>
            <p className="mb-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Generate a short, analyst-style commentary for {symbol} based on
              its latest price, valuation, and 52-week position.
            </p>
            <GenerateButton onClick={generate} label="Generate Insight" />
          </>
        )}

        {/* Loading */}
        {state.status === "loading" && (
          <div className="flex items-center gap-2.5 py-1 text-sm text-slate-500 dark:text-slate-400">
            <Spinner />
            <span>Analyzing {symbol}…</span>
          </div>
        )}

        {/* Success */}
        {state.status === "success" && (
          <div>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              {state.insight}
            </p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Generated by {state.model}
              </span>
              <button
                type="button"
                onClick={generate}
                className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                Regenerate
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
              AI-generated from live data · not investment advice.
            </p>
          </div>
        )}

        {/* Error */}
        {state.status === "error" && (
          <div>
            <p className="mb-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Couldn&apos;t generate insight right now — please try again.
            </p>
            <GenerateButton onClick={generate} label="Try again" />
          </div>
        )}
      </div>
    </div>
  );
}

function GenerateButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
    >
      <SparkleIcon />
      {label}
    </button>
  );
}
