# Exchange-feed operational reliability audit

**Baseline:** `main` as reviewed 13 November 2026.  
**Scope:** source and Render operational-log review only. No runtime behaviour, provider configuration, secrets, deployments or production data were changed.

## Current topology

- The standalone Node.js service in `exchange-feed/server.js` maintains Binance spot/futures, Bybit spot/linear and Coinbase spot WebSocket connections.
- The service broadcasts normalized snapshots to browser clients once per second.
- Twelve Data provides a separate mixed FX/equity reference-price refresh path.
- The read-only MT5 quote store validates quote timestamps and keeps public MT5 broadcasting disabled unless both required environment flags are enabled.
- The web app's `feed-client.js` connects to this service and aggregates fresh books for the selected instrument.

## Findings

### EF-01 — Reconnect backoff is reset too early

The shared `connect()` helper resets `attempt = 0` immediately on every WebSocket `open`. If a provider repeatedly opens and then closes before the connection remains stable, each close schedules another one-second retry. The nominal exponential backoff therefore does not protect against repeated short-lived connections.

**Evidence:** Render application logs on 13 November 2026 show recurring Binance spot and Bybit linear/spot close → reconnect → connected cycles. The sampled cycles did reconnect; this is evidence of connection churn, not proof of a sustained outage or provider fault.

**Recommendation:** Reset the retry counter only after a meaningful stability window or sustained market-data receipt. Add bounded exponential backoff with jitter, a single outstanding reconnect timer per provider, and clean timer/socket shutdown. Do not retry faster merely because the TCP/WebSocket handshake succeeds.

### EF-02 — The current health endpoint is process liveness, not feed readiness

`GET /health` currently returns HTTP 200 and `ok: true` with feed status metadata regardless of how many upstream feeds are active. The service separately marks a feed live only when market messages arrive within `FEED_IDLE_MS`, and individual order books are marked stale after `STALE_MS`.

This means a healthy Node process can still have zero active upstream feeds while Render's single health check remains green. Conversely, making the platform restart the service whenever a provider is down could create a harmful restart loop.

**Recommendation:** Preserve a cheap process-liveness endpoint for platform restarts. Add a separate readiness/diagnostic response that reports active/total feeds, per-provider last-message age, stale-book counts, quote-source freshness and a clear degraded state. Do not expose credentials or sensitive upstream details. Decide whether readiness should return a degraded HTTP status or a 200 diagnostic payload; keep liveness independent.

### EF-03 — No dedicated WebSocket reconnect/health regression suite found

The exchange-feed package currently runs Node's built-in test runner and includes `mt5-quotes.test.js`. The reviewed inventory did not show tests for the shared WebSocket reconnect helper, reconnect timer duplication, provider silence, feed readiness or stale-book transitions.

**Recommendation:** Extract the reconnect policy and health aggregation into small testable modules or inject a WebSocket factory/clock into the existing helper. Test:
- a socket that opens and closes repeatedly does not reset the retry budget;
- backoff grows to a bounded maximum and includes deterministic-testable jitter;
- only one reconnect timer exists per feed;
- successful stable market-data receipt resets the retry budget;
- stale/silent feeds become inactive without crashing the process;
- liveness stays healthy while readiness reports degraded;
- recovery restores readiness and stale books are not reused as fresh snapshots;
- shutdown clears timers and closes sockets without reconnecting.

## Operational observations

- The sampled logs include successful reconnections and Twelve Data refreshes (8/8 mixed FX/equity reference prices). This is positive recovery evidence, but it does not establish continuous quote freshness for every instrument.
- The Render exchange-feed service's latest recorded deployment at audit time was commit `f5caec79a0b7e6e54f39e39e66a03c3b4ea6ff35`, deployed 8 November 2026. The API and web services have more recent deployments. This is a release-alignment item to review, not a claim that the feed deployment is broken.
- Render metrics returned sparse samples and no HTTP request/latency series for the sampled period; that is insufficient for a reliable availability or performance conclusion.
- The web/API public health URLs were not independently verified by the available browser retrieval, so this audit does not claim end-to-end health acceptance.

## Safe implementation sequence

1. Add deterministic unit tests for reconnect policy and health aggregation without opening real provider connections.
2. Implement stable-session backoff, jitter, single-timer protection and graceful shutdown.
3. Add separate liveness and readiness/diagnostic semantics; retain the current platform health path as liveness unless a reviewed operational decision says otherwise.
4. Add integration tests using fake WebSocket providers for provider silence, reconnect, recovery and stale-book handling.
5. Deploy the feed service independently after exact-head CI and review; then verify per-provider message freshness, stale-book counts and recovery in Render logs/metrics.
6. Update the three-service deployment acceptance register only after actual end-to-end evidence exists.

No real provider trading, order execution, MT5 order placement, public MT5 quote redistribution, credential changes or production data changes are included in this audit.
