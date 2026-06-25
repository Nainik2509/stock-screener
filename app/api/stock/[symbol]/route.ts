import { getStockDetail } from "@/lib/finnhub/client";
import { UNIVERSE } from "@/lib/finnhub/universe";
import { jsonError, jsonOk, statusForCode } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FRESH_SECONDS = 8;

// Basic shape guard before any membership check: 1-6 chars, letters/dot only.
const SYMBOL_PATTERN = /^[A-Z.]{1,6}$/;
const ALLOWED = new Set<string>(UNIVERSE);

/**
 * GET /api/stock/[symbol] - richer detail for a single stock: list-row fields
 * plus P/E, 52-week high/low, day high/low, previous close, volume, and
 * industry. The symbol is validated (format + restricted to our universe) so
 * the endpoint can't be used to hammer Finnhub with arbitrary tickers.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ symbol: string }> },
): Promise<Response> {
  try {
    const { symbol } = await context.params;
    const sym = symbol.toUpperCase();

    if (!SYMBOL_PATTERN.test(sym)) {
      return jsonError("BAD_REQUEST", `Invalid symbol format: ${symbol}`);
    }
    if (!ALLOWED.has(sym)) {
      return jsonError(
        "SYMBOL_NOT_ALLOWED",
        `${sym} is not in the tracked universe`,
      );
    }

    const result = await getStockDetail(sym);
    if (!result.ok) {
      return jsonError(
        result.error.code,
        result.error.message,
        statusForCode(result.error.code),
      );
    }

    return jsonOk(result.data, FRESH_SECONDS);
  } catch {
    return jsonError("INTERNAL", "Failed to load stock detail", 500);
  }
}
