/**
 * Provider-agnostic LLM adapter types.
 *
 * The rest of the app only ever sees an `LLMResult` — never a raw provider
 * payload. Errors are returned (never thrown) so callers don't have to wrap
 * every call in try/catch, mirroring the `FinnhubResult` convention.
 */

export interface LLMError {
  code: string;
  message: string;
}

export type LLMResult =
  | { ok: true; text: string; model: string }
  | { ok: false; error: LLMError };

/**
 * A single concrete provider (Gemini, OpenAI, …). `generate` issues one
 * completion and returns the raw text, or throws on transport/parse failure —
 * the orchestrator in `index.ts` converts thrown errors into an `LLMResult`.
 */
export interface LLMProvider {
  /** Human-readable name shown in the UI, e.g. "Gemini 2.0 Flash". */
  readonly displayName: string;
  /** Generate a completion for `prompt`, aborting when `signal` fires. */
  generate(prompt: string, signal: AbortSignal): Promise<string>;
}
