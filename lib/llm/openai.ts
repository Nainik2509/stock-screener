import "server-only";

import type { LLMProvider } from "@/lib/llm/types";

const MODEL = "gpt-4o-mini";
const ENDPOINT = "https://api.openai.com/v1/chat/completions";

/** Minimal subset of the OpenAI chat-completions response we read. */
interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

/** OpenAI provider (gpt-4o-mini) — used when GEMINI is unavailable or overridden. */
export function createOpenAIProvider(apiKey: string): LLMProvider {
  return {
    displayName: "OpenAI GPT-4o mini",
    async generate(prompt: string, signal: AbortSignal): Promise<string> {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal,
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.4,
          max_tokens: 256,
          // The full persona + instructions live in the caller's prompt (the
          // single source of truth shared with Gemini), so this is a pure
          // transport with no provider-specific system message.
          messages: [{ role: "user", content: prompt }],
        }),
      });

      // res.json() is untyped; cast to the declared subset.
      const data = (await res.json()) as OpenAIResponse;

      if (!res.ok) {
        const detail = data.error?.message ?? `HTTP ${res.status}`;
        throw new Error(`OpenAI request failed: ${detail}`);
      }

      const text = data.choices?.[0]?.message?.content?.trim();
      if (text === undefined || text.length === 0) {
        throw new Error("OpenAI returned an empty response");
      }
      return text;
    },
  };
}
