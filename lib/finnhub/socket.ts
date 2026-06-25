import "server-only";

import { getScreenerRows } from "@/lib/finnhub/client";
import { UNIVERSE } from "@/lib/finnhub/universe";
import { round2 } from "@/lib/finnhub/math";
import type { FinnhubTrade, FinnhubWsMessage } from "@/lib/finnhub/types";
import type { PriceUpdate } from "@/lib/types";

/**
 * A single, process-wide manager for one upstream Finnhub WebSocket connection
 * that is shared by every SSE client. Responsibilities:
 *  - open one socket, subscribe the whole universe, keep the latest price per
 *    symbol in memory;
 *  - reconnect with exponential backoff if the socket drops;
 *  - when no live trades arrive (US market closed), fall back to gentle REST
 *    /quote polling so the app still feels live;
 *  - let server code subscribe to updates (subscribe/emit), each update tagged
 *    with its source ("ws" live vs "poll" delayed).
 *
 * IMPORTANT TRADE-OFF: the shared connection + in-memory state assume the app
 * runs as a SINGLE Node process (how we run it). Multiple instances would each
 * open their own socket and hold separate state; horizontal scaling would need
 * externalized fan-out (e.g. Redis pub/sub). Documented in docs/DECISIONS.md.
 */

type Listener = (update: PriceUpdate) => void;

const FINNHUB_WS_URL = "wss://ws.finnhub.io";

// No trades for this long => assume the market is quiet and start polling.
const QUIET_THRESHOLD_MS = 15_000;
const MODE_CHECK_MS = 5_000;

// 25 symbols / 30s ~= 50 calls/min, comfortably under the 60/min REST limit.
const POLL_INTERVAL_MS = 30_000;

const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

class FinnhubSocketManager {
  private ws: WebSocket | null = null;
  private readonly latest = new Map<string, PriceUpdate>();
  private readonly prevClose = new Map<string, number>();
  private readonly listeners = new Set<Listener>();
  private startPromise: Promise<void> | null = null;
  private lastTradeAt = 0;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private modeTimer: ReturnType<typeof setInterval> | null = null;

  /** Idempotent: prime the snapshot and open the socket exactly once. */
  ensureStarted(): Promise<void> {
    if (this.startPromise === null) {
      this.startPromise = this.start();
    }
    return this.startPromise;
  }

  private async start(): Promise<void> {
    await this.primeSnapshot();
    this.connect();
    this.modeTimer = setInterval(() => this.evaluateMode(), MODE_CHECK_MS);
  }

  /** Seed initial prices + previous-close (for % change math) from REST. */
  private async primeSnapshot(): Promise<void> {
    const { rows } = await getScreenerRows(UNIVERSE);
    for (const row of rows) {
      this.prevClose.set(row.symbol, row.prevClose);
      this.latest.set(row.symbol, {
        symbol: row.symbol,
        price: row.price,
        changePct: row.changePct,
        source: "poll",
        ts: row.updatedAt,
      });
    }
  }

  getSnapshot(): PriceUpdate[] {
    return Array.from(this.latest.values());
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(update: PriceUpdate): void {
    this.latest.set(update.symbol, update);
    for (const listener of this.listeners) {
      // One misbehaving subscriber must never break delivery to the others.
      try {
        listener(update);
      } catch {
        /* ignore */
      }
    }
  }

  private connect(): void {
    const token = process.env.FINNHUB_API_KEY;
    if (token === undefined || token.length === 0) {
      // Without a key we can't open the socket (and REST polling can't fetch
      // either). Nothing to crash here - clients just get the empty snapshot.
      return;
    }

    const socket = new WebSocket(`${FINNHUB_WS_URL}?token=${token}`);
    this.ws = socket;

    socket.addEventListener("open", () => {
      this.reconnectAttempts = 0;
      for (const symbol of UNIVERSE) {
        socket.send(JSON.stringify({ type: "subscribe", symbol }));
      }
    });

    socket.addEventListener("message", (event: MessageEvent) => {
      this.handleMessage(event.data);
    });

    socket.addEventListener("close", () => {
      if (this.ws === socket) this.ws = null;
      this.scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      // 'error' is always followed by 'close', where reconnect is scheduled.
      // Close defensively so we never leak a half-open socket.
      try {
        socket.close();
      } catch {
        /* ignore */
      }
    });
  }

  private handleMessage(data: unknown): void {
    if (typeof data !== "string") return;

    let message: FinnhubWsMessage;
    try {
      message = JSON.parse(data) as FinnhubWsMessage;
    } catch {
      return;
    }

    if (message.type !== "trade" || !Array.isArray(message.data)) return;
    this.lastTradeAt = Date.now();
    for (const trade of message.data) this.applyTrade(trade);
  }

  private applyTrade(trade: FinnhubTrade): void {
    if (typeof trade.s !== "string" || !Number.isFinite(trade.p)) return;

    const symbol = trade.s;
    const price = round2(trade.p);
    const prev = this.prevClose.get(symbol);
    const changePct =
      prev !== undefined && prev > 0
        ? round2(((price - prev) / prev) * 100)
        : (this.latest.get(symbol)?.changePct ?? 0);
    const ts = Number.isFinite(trade.t) && trade.t > 0 ? trade.t : Date.now();

    this.emit({ symbol, price, changePct, source: "ws", ts });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;

    const backoff = Math.min(
      MAX_BACKOFF_MS,
      BASE_BACKOFF_MS * 2 ** this.reconnectAttempts,
    );
    const jitter = Math.floor(Math.random() * 500);
    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, backoff + jitter);
  }

  /** Switch between live socket and polling based on trade freshness. */
  private evaluateMode(): void {
    const quiet = Date.now() - this.lastTradeAt > QUIET_THRESHOLD_MS;
    if (quiet) this.startPolling();
    else this.stopPolling();
  }

  private startPolling(): void {
    if (this.pollTimer !== null) return;
    void this.poll();
    this.pollTimer = setInterval(() => void this.poll(), POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer === null) return;
    clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private async poll(): Promise<void> {
    const { rows } = await getScreenerRows(UNIVERSE);
    for (const row of rows) {
      this.prevClose.set(row.symbol, row.prevClose);
      this.emit({
        symbol: row.symbol,
        price: row.price,
        changePct: row.changePct,
        source: "poll",
        ts: row.updatedAt,
      });
    }
  }
}

// True process-wide singleton. Stash the instance on globalThis so repeated
// imports and dev HMR reloads reuse one manager (and thus one upstream socket).
type ManagerGlobal = typeof globalThis & {
  __finnhubSocketManager?: FinnhubSocketManager;
};

export function getSocketManager(): FinnhubSocketManager {
  const globalRef = globalThis as ManagerGlobal;
  if (globalRef.__finnhubSocketManager === undefined) {
    globalRef.__finnhubSocketManager = new FinnhubSocketManager();
  }
  return globalRef.__finnhubSocketManager;
}
