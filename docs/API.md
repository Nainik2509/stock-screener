# API Reference

Internal API consumed by the frontend. All handlers run on the **Node runtime**,
never expose raw Finnhub payloads, and return a consistent envelope:

- Success: `{ "data": <payload> }`
- Error: `{ "error": { "code": string, "message": string } }`

Routes never throw to the client; failures map to a status via `lib/http.ts`.

Legend: ✅ implemented · 🔜 planned.

## Common error codes

| Code | HTTP | Meaning |
| --- | --- | --- |
| `BAD_REQUEST` | 400 | Malformed input (e.g. bad symbol format) |
| `SYMBOL_NOT_ALLOWED` | 400 | Symbol is valid but not in the tracked universe |
| `INVALID_SYMBOL` | 404 | Finnhub has no data for the symbol |
| `RATE_LIMITED` | 429 | Finnhub rate limit hit (response sets `Retry-After`) |
| `NETWORK` | 502 | Upstream network failure |
| `TIMEOUT` | 504 | Upstream request exceeded the ~8s timeout |
| `CONFIG` | 500 | `FINNHUB_API_KEY` missing |
| `INTERNAL` / `UNKNOWN` | 500 | Unexpected server error |

---

## ✅ GET /api/stocks

The full screener list — one normalized row per universe ticker.

- **Method:** `GET`
- **Params:** none
- **Caching:** `Cache-Control: public, max-age=0, s-maxage=8, stale-while-revalidate=32`
- **External dependency:** Finnhub `/quote` + `/stock/profile2` (cached)
- **Resilience:** partial failures are tolerated — succeeds with whatever loaded
  and lists the rest under `failures`. Returns an error status only if **no** rows
  load (the dominant error is surfaced).

### Response `200`

```json
{
  "data": {
    "count": 25,
    "failures": [],
    "rows": [
      {
        "symbol": "NVDA",
        "name": "NVIDIA Corp",
        "price": 199,
        "change": -1.04,
        "changePct": -0.52,
        "prevClose": 200.04,
        "marketCap": 4815799.84,
        "source": "rest",
        "stale": false,
        "updatedAt": 1782331200000
      }
    ]
  }
}
```

Rows are sorted by `marketCap` descending. `marketCap` is in **millions** of the
listing currency.

### Example

```bash
curl http://localhost:3000/api/stocks
```

---

## ✅ GET /api/stock/[symbol]

Richer detail for a single stock: list-row fields plus intraday and fundamental
data.

- **Method:** `GET`
- **Path param:** `symbol` — case-insensitive; must match `^[A-Z.]{1,6}$` and be
  in the universe.
- **Caching:** `s-maxage=8, stale-while-revalidate=32`
- **External dependency:** Finnhub `/quote` + `/stock/profile2` + `/stock/metric`

### Response `200`

```json
{
  "data": {
    "symbol": "AAPL",
    "name": "Apple Inc",
    "price": 293.08,
    "change": -1.22,
    "changePct": -0.41,
    "prevClose": 294.3,
    "open": 295.36,
    "high": 299.7,
    "low": 292.94,
    "marketCap": 4304570.25,
    "industry": "Technology",
    "currency": "USD",
    "logo": "https://.../AAPL.png",
    "peRatio": 35.73,
    "week52High": 317.4,
    "week52Low": 199.26,
    "volume": 49.84,
    "source": "rest",
    "stale": false,
    "updatedAt": 1782331200000
  }
}
```

> `volume` is the **10-day average** trading volume (free-tier proxy; `/quote`
> has no intraday volume). Optional fields (`peRatio`, `week52High/Low`, `volume`,
> `logo`) may be absent when Finnhub omits them.

### Error examples

```bash
curl http://localhost:3000/api/stock/AAP@   # 400 BAD_REQUEST
curl http://localhost:3000/api/stock/GME    # 400 SYMBOL_NOT_ALLOWED
```

---

## ✅ GET /api/stream

Server-Sent Events (SSE) stream of live price updates, fed by the shared upstream
Finnhub WebSocket singleton with a REST `/quote` poll fallback when the US market
is closed.

- **Method:** `GET` (open a long-lived connection, e.g. browser `EventSource`)
- **Runtime:** Node; **never cached** (`Cache-Control: no-store, no-transform`)
- **Response headers:** `Content-Type: text/event-stream`, `X-Accel-Buffering: no`
- **External dependency:** Finnhub WebSocket `wss://ws.finnhub.io` (+ REST
  `/quote` fallback)

### Behavior

1. On connect, immediately emits the **current snapshot** (one event per known
   symbol).
2. Then streams each new update as it arrives (live socket or poll fallback).
3. A `: keep-alive` comment is sent every 15s so proxies don't time out.
4. Per-client resources are cleaned up on disconnect; one client leaving never
   affects others.

### Event payload

Each `data:` line is a compact update (never Finnhub's raw frame):

```
data: {"symbol":"AAPL","price":293.08,"changePct":-0.41,"source":"poll","ts":1782331200000}
```

| Field | Type | Notes |
| --- | --- | --- |
| `symbol` | string | Ticker |
| `price` | number | Latest price |
| `changePct` | number | % change vs previous close |
| `source` | `"ws"` \| `"poll"` | `ws` = live socket, `poll` = REST fallback (delayed) |
| `ts` | number | epoch milliseconds |

> `source` lets the UI show a "live" vs "delayed" badge. During US market hours
> you'll see `ws` ticks; outside them, `poll` refreshes (~every 30s).

### Example

```bash
curl -N http://localhost:3000/api/stream
```

(`-N` disables curl buffering so events appear as they stream.)

## 🔜 POST /api/insight/[symbol]

Returns `{ insight, model }` generated by the LLM adapter from a server-built
summary of the stock's real Finnhub data. Documented here once implemented.
