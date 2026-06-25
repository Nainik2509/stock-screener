import "server-only";

import { NextResponse } from "next/server";
import type { FinnhubError } from "@/lib/types";

/**
 * Consistent JSON response helpers for route handlers. Success bodies are
 * `{ data }`; error bodies are `{ error: { code, message } }`. Routes never
 * leak raw provider payloads or stack traces to the client.
 */

interface SuccessBody<T> {
  data: T;
}

interface ErrorBody {
  error: FinnhubError;
}

/** Map a domain error code to an appropriate HTTP status. */
export function statusForCode(code: string): number {
  switch (code) {
    case "RATE_LIMITED":
      return 429;
    case "INVALID_SYMBOL":
    case "NOT_FOUND":
      return 404;
    case "BAD_REQUEST":
    case "SYMBOL_NOT_ALLOWED":
      return 400;
    case "TIMEOUT":
      return 504;
    case "NETWORK":
    case "LLM_ERROR":
      // Upstream provider (Finnhub / LLM) failed — we are the gateway.
      return 502;
    case "CONFIG":
      return 500;
    default:
      // Upstream HTTP_4xx/5xx and anything unknown are treated as bad gateway
      // (we are the gateway in front of Finnhub) unless it's clearly ours.
      if (code.startsWith("HTTP_")) return 502;
      return 500;
  }
}

function cacheControl(freshSeconds: number): string {
  // Allow shared caches (CDN) to serve a value for `freshSeconds` and to serve
  // a slightly stale value while revalidating, so prices stay live without
  // re-fetching on every request.
  return `public, max-age=0, s-maxage=${freshSeconds}, stale-while-revalidate=${freshSeconds * 4}`;
}

export function jsonOk<T>(data: T, freshSeconds: number): NextResponse {
  const body: SuccessBody<T> = { data };
  return NextResponse.json(body, {
    status: 200,
    headers: { "Cache-Control": cacheControl(freshSeconds) },
  });
}

export function jsonError(
  code: string,
  message: string,
  status: number = statusForCode(code),
): NextResponse {
  const body: ErrorBody = { error: { code, message } };
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (status === 429) headers["Retry-After"] = "5";
  return NextResponse.json(body, { status, headers });
}
