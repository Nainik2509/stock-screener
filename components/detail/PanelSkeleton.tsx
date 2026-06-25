/** Animated placeholder that mirrors the DetailPanel content layout. */
export function PanelSkeleton() {
  return (
    <div className="animate-pulse space-y-7">
      {/* Today's Trading — 2×2 card grid */}
      <div>
        <div className="mb-2.5 h-2.5 w-24 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl bg-slate-50 px-4 py-3.5 dark:bg-slate-800/60"
            >
              <div className="h-2.5 w-16 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="mt-3 h-4 w-20 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          ))}
        </div>
      </div>

      {/* 52-Week Range */}
      <div>
        <div className="mb-2.5 h-2.5 w-24 rounded bg-slate-200 dark:bg-slate-700" />
        {/* Floating label placeholder */}
        <div className="mb-2 h-5 w-12 rounded bg-slate-200 dark:bg-slate-700" />
        {/* Track */}
        <div className="h-3 w-full rounded-full bg-slate-200 dark:bg-slate-700" />
        <div className="mt-2 flex justify-between">
          <div>
            <div className="h-3 w-14 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-1 h-2.5 w-10 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
          <div>
            <div className="h-3 w-14 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-1 h-2.5 w-12 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
      </div>

      {/* Valuation & Size — 3 rows */}
      <div>
        <div className="mb-2.5 h-2.5 w-28 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
          {[88, 64, 76].map((w) => (
            <div
              key={w}
              className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-0 dark:border-slate-800"
            >
              <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-700" />
              <div
                className="h-3 rounded bg-slate-200 dark:bg-slate-700"
                style={{ width: `${w}px` }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Company — 3 rows */}
      <div>
        <div className="mb-2.5 h-2.5 w-16 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
          {[96, 72, 36].map((w) => (
            <div
              key={w}
              className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-0 dark:border-slate-800"
            >
              <div className="h-3 w-16 rounded bg-slate-200 dark:bg-slate-700" />
              <div
                className="h-3 rounded bg-slate-200 dark:bg-slate-700"
                style={{ width: `${w}px` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
