import "server-only";

import type { LLMProvider } from "@/lib/llm/types";

const MODEL = "gemini-2.0-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/** Minimal subset of the Gemini generateContent response we read. */
interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

/**
 * Google Gemini provider (free tier, no credit card required).
 * Auth uses the `x-goog-api-key` header so the key never appears in the URL/logs.
 */
export function createGeminiProvider(apiKey: string): LLMProvider {
  return {
    displayName: "Gemini 2.0 Flash",
    async generate(prompt: string, signal: AbortSignal): Promise<string> {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 256 },
        }),
      });

      // res.json() is untyped; cast to the declared subset.
      const data = (await res.json()) as GeminiResponse;

      if (!res.ok) {
        const detail = data.error?.message ?? `HTTP ${res.status}`;
        throw new Error(`Gemini request failed: ${detail}`);
      }
      if (data.promptFeedback?.blockReason !== undefined) {
        throw new Error(
          `Gemini blocked the prompt (${data.promptFeedback.blockReason})`,
        );
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text === undefined || text.length === 0) {
        throw new Error("Gemini returned an empty response");
      }
      return text;
    },
  };
}
