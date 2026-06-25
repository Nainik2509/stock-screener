import { getStockDetail } from "@/lib/finnhub/client";
import { UNIVERSE } from "@/lib/finnhub/universe";
import { generateInsight } from "@/lib/llm";
import { jsonError, jsonOk, statusForCode } from "@/lib/http";
import {
  fmtChange,
  fmtChangePct,
  fmtMarketCap,
  fmtPrice,
} from "@/lib/formatters";
import type { StockDetail } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Basic shape guard before any membership check: 1-6 chars, letters/dot only.
const SYMBOL_PATTERN = /^[A-Z.]{1,6}$/;
const ALLOWED = new Set<string>(UNIVERSE);

/**
 * POST /api/insight/[symbol]
 *
 * Gathers the latest detail for one stock from our existing data layer, builds
 * a compact data-grounded prompt, and asks the configured LLM for a 2-3 sentence
 * analyst-style commentary. Returns only `{ insight, model }` — never the LLM
 * key or the raw provider payload. The symbol is validated against our universe
 * first so arbitrary values can't trigger LLM spend.
 */
export async function POST(
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

    // Pull the same rich detail the panel shows, so the prompt is grounded in
    // the exact numbers the analyst is looking at.
    const detailRes = await getStockDetail(sym);
    if (!detailRes.ok) {
      return jsonError(
        detailRes.error.code,
        detailRes.error.message,
        statusForCode(detailRes.error.code),
      );
    }

    const prompt = buildPrompt(detailRes.data);
    const result = await generateInsight(prompt);
    if (!result.ok) {
      return jsonError(
        result.error.code,
        result.error.message,
        statusForCode(result.error.code),
      );
    }

    // No CDN caching for generated text; each request produces fresh output.
    return jsonOk({ symbol: sym, insight: result.text, model: result.model }, 0);
  } catch {
    return jsonError("INTERNAL", "Failed to generate insight", 500);
  }
}

/**
 * Build a compact, data-only prompt. Every fact comes from `detail`; the model
 * is explicitly told not to invent numbers or give advice, which keeps the
 * output factual and grounded.
 */
function buildPrompt(d: StockDetail): string {
  const facts: string[] = [
    `Company: ${d.name} (${d.symbol})`,
    `Industry: ${d.industry}`,
    `Current price: ${fmtPrice(d.price)}`,
    `Change today: ${fmtChange(d.change)} (${fmtChangePct(d.changePct)})`,
    `Previous close: ${fmtPrice(d.prevClose)}`,
    `Day range: ${fmtPrice(d.low)} – ${fmtPrice(d.high)}`,
    `Market cap: ${fmtMarketCap(d.marketCap)}`,
  ];

  if (d.peRatio !== undefined) {
    facts.push(`P/E ratio (TTM): ${d.peRatio.toFixed(1)}`);
  }
  if (d.week52High !== undefined && d.week52Low !== undefined) {
    facts.push(
      `52-week range: ${fmtPrice(d.week52Low)} – ${fmtPrice(d.week52High)}`,
    );
    const span = d.week52High - d.week52Low;
    if (span > 0) {
      const pos = Math.round(((d.price - d.week52Low) / span) * 100);
      facts.push(`Position in 52-week range: ${pos}% (0%=low, 100%=high)`);
    }
  }

  return [
    "You are a calm, professional equity analyst.",
    "Using ONLY the data below, write 2-3 sentences of factual commentary on " +
      "this stock's current state. Reference the actual numbers (today's move, " +
      "valuation, and position versus its 52-week range). Do not invent data, " +
      "do not give buy/sell advice, and avoid hype. Write plain prose, no bullet points.",
    "",
    facts.join("\n"),
  ].join("\n");
}
