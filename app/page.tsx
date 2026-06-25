import { Suspense } from "react";
import { getScreenerRows } from "@/lib/finnhub/client";
import { UNIVERSE } from "@/lib/finnhub/universe";
import ScreenerTable from "@/components/screener/ScreenerTable";
import type { ScreenerRow } from "@/lib/types";

/*
 * The home page is a React Server Component: it fetches the initial stock list
 * directly from the data layer (no HTTP round-trip to /api/stocks) so the HTML
 * delivered to the browser is already populated — no blank-flash or skeleton.
 *
 * Rendering handoff:
 *   1. RSC fetches data server-side → passes ScreenerRow[] as a prop.
 *   2. ScreenerTable (client component) takes over: opens the SSE connection
 *      and updates prices in place from /api/stream.
 */
export default async function HomePage() {
  let initialRows: ScreenerRow[] = [];
  let initialError = false;

  try {
    const { rows, failures } = await getScreenerRows(UNIVERSE);
    initialRows = rows;
    if (failures.length > 0) {
      // Partial success is fine — log on the server, carry on.
      const syms = failures.map((f) => f.symbol).join(", ");
      console.warn(`[screener] Failed to load: ${syms}`);
    }
  } catch {
    // Unexpected throw (should not happen — the data layer never throws, but
    // this is a safety net so a crash here doesn't break the route entirely).
    console.error("[screener] Unexpected error loading initial rows");
    initialError = true;
  }

  // Suspense is required by Next.js when a client component uses
  // useSearchParams() — it enables the rest of the page to prerender while
  // the component hydrates with the actual URL params on the client.
  // fallback={null}: the server already renders the populated table via RSC
  // props, so there is no visible loading gap to fill.
  return (
    <Suspense fallback={null}>
      <ScreenerTable initialRows={initialRows} initialError={initialError} />
    </Suspense>
  );
}
