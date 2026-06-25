import { getScreenerRows } from "@/lib/finnhub/client";
import { UNIVERSE } from "@/lib/finnhub/universe";
import { jsonError, jsonOk, statusForCode } from "@/lib/http";
import type { FinnhubError } from "@/lib/types";

// Live data: run on the Node runtime, always execute (don't statically cache the
// handler); CDN freshness is controlled via Cache-Control on the response.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Quotes are cached ~8s in the data layer; mirror that as the response freshness.
const FRESH_SECONDS = 8;

/**
 * GET /api/stocks - the full screener list.
 * Returns one normalized row per universe ticker (symbol, name, price, change,
 * % change, market cap). Tolerates partial failures: succeeds with whatever
 * loaded, reporting any per-symbol failures. Only if nothing loads do we return
 * a representative error status.
 */
export async function GET(): Promise<Response> {
  try {
    const { rows, failures } = await getScreenerRows(UNIVERSE);

    if (rows.length === 0 && failures.length > 0) {
      const dominant = pickDominantError(failures.map((f) => f.error));
      return jsonError(dominant.code, dominant.message, statusForCode(dominant.code));
    }

    // Default ordering: largest companies first.
    rows.sort((a, b) => b.marketCap - a.marketCap);

    return jsonOk({ rows, count: rows.length, failures }, FRESH_SECONDS);
  } catch {
    // Defensive: the data layer is designed not to throw, but never crash here.
    return jsonError("INTERNAL", "Failed to load the screener list", 500);
  }
}

/** Prefer the most actionable error when the whole batch failed. */
function pickDominantError(errors: readonly FinnhubError[]): FinnhubError {
  const priority = ["CONFIG", "RATE_LIMITED", "TIMEOUT", "NETWORK"];
  for (const code of priority) {
    const match = errors.find((e) => e.code === code);
    if (match !== undefined) return match;
  }
  return errors[0] ?? { code: "UNKNOWN", message: "Unknown error" };
}
