import "server-only";

import type { LLMError, LLMProvider, LLMResult } from "@/lib/llm/types";
import { createGeminiProvider } from "@/lib/llm/gemini";
import { createOpenAIProvider } from "@/lib/llm/openai";

export type { LLMResult } from "@/lib/llm/types";

/**
 * Total wall-clock budget shared across all provider attempts, so a slow (or a
 * slow-then-fallback) chain can never hang the request beyond this.
 */
const TOTAL_TIMEOUT_MS = 15_000;

/**
 * Build the ordered list of providers to attempt.
 *
 * Default order is **Gemini 2.0 Flash → OpenAI gpt-4o-mini**: Gemini is the
 * preferred primary (genuine free tier), with OpenAI as an automatic fallback
 * if Gemini fails at runtime (quota, outage, etc.). Setting `LLM_PROVIDER=openai`
 * flips the order so OpenAI is primary and Gemini the fallback.
 *
 * Only providers whose API key is present are included. Swapping/adding a
 * provider only touches this file — the route and UI are provider-agnostic.
 */
function buildProviderChain(): {
  providers: LLMProvider[];
  configError?: string;
} {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const override = process.env.LLM_PROVIDER?.trim().toLowerCase();

  const gemini = geminiKey ? createGeminiProvider(geminiKey) : undefined;
  const openai = openaiKey ? createOpenAIProvider(openaiKey) : undefined;

  // OpenAI-first only when explicitly overridden; otherwise Gemini-first.
  const ordered =
    override === "openai" ? [openai, gemini] : [gemini, openai];
  const providers = ordered.filter(
    (p): p is LLMProvider => p !== undefined,
  );

  if (providers.length === 0) {
    return {
      providers,
      configError:
        "No LLM API key configured (set GEMINI_API_KEY or OPENAI_API_KEY)",
    };
  }
  return { providers };
}

/**
 * Generate an insight for `prompt`, trying each configured provider in order and
 * falling back to the next when one fails. Returns a typed result (never throws)
 * so any failure stays isolated to the insight feature. If every provider fails,
 * the most recent error is returned for the caller to map to a friendly message.
 */
export async function generateInsight(prompt: string): Promise<LLMResult> {
  const { providers, configError } = buildProviderChain();
  if (providers.length === 0) {
    return {
      ok: false,
      error: { code: "CONFIG", message: configError ?? "No LLM provider configured" },
    };
  }

  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  let lastError: LLMError | undefined;

  for (const provider of providers) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining);
    try {
      const text = await provider.generate(prompt, controller.signal);
      return { ok: true, text, model: provider.displayName };
    } catch (error) {
      // Record the failure and fall through to the next provider (if any).
      if (error instanceof Error && error.name === "AbortError") {
        lastError = {
          code: "TIMEOUT",
          message: `LLM request timed out after ${TOTAL_TIMEOUT_MS}ms`,
        };
      } else {
        lastError = {
          code: "LLM_ERROR",
          message: error instanceof Error ? error.message : "Unknown LLM error",
        };
      }
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ok: false,
    error: lastError ?? { code: "LLM_ERROR", message: "All LLM providers failed" },
  };
}
