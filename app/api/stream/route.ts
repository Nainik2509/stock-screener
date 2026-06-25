import { getSocketManager } from "@/lib/finnhub/socket";
import type { PriceUpdate } from "@/lib/types";

// SSE must run on the Node runtime and must never be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Comment line sent periodically so intermediaries don't time the stream out.
const KEEPALIVE_MS = 15_000;

/**
 * GET /api/stream - Server-Sent Events of live price updates.
 *
 * On connect we immediately flush the current known prices, then forward each
 * new update (from the live socket or the polling fallback) as it happens. Each
 * event carries a `source` ("ws" | "poll") so the UI can show a freshness badge.
 * Per-client resources are cleaned up on disconnect without affecting others.
 */
export async function GET(request: Request): Promise<Response> {
  const manager = getSocketManager();
  // Idempotent across all connections: primes the snapshot + opens the socket.
  await manager.ensureStarted();

  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => {};
  let keepAlive: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const cleanup = (): void => {
    if (closed) return;
    closed = true;
    unsubscribe();
    if (keepAlive !== undefined) clearInterval(keepAlive);
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (update: PriceUpdate): void => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(update)}\n\n`),
          );
        } catch {
          // Controller already closed (client gone mid-write); ignore.
        }
      };

      // 1) immediate snapshot of current known prices
      for (const update of manager.getSnapshot()) send(update);

      // 2) stream subsequent updates
      unsubscribe = manager.subscribe(send);

      // 3) keep-alive heartbeat
      keepAlive = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          /* ignore */
        }
      }, KEEPALIVE_MS);
    },
    cancel() {
      cleanup();
    },
  });

  // Also clean up if the underlying request is aborted.
  request.signal.addEventListener("abort", cleanup);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
