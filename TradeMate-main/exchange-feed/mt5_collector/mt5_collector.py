#!/usr/bin/env python3
"""Read-only MetaTrader 5 quote bridge for TradeMate.

Requires a running, logged-in MT5 desktop terminal. This script only reads
market ticks; it has no order/deal/trading functionality.
"""
import csv
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from datetime import datetime, timezone

try:
    import MetaTrader5 as mt5
except ImportError:
    print("Missing MetaTrader5 package. Run: py -m pip install -r requirements.txt", file=sys.stderr)
    raise SystemExit(2)

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = Path(os.getenv("MT5_SYMBOLS_CONFIG", BASE_DIR / "symbols.json"))
ENDPOINT = os.getenv("TRADEMATE_MT5_ENDPOINT", "").rstrip("/")
TOKEN = os.getenv("MT5_INGEST_TOKEN", "")
POLL_SECONDS = max(1.0, float(os.getenv("MT5_POLL_SECONDS", "1")))
BATCH_SECONDS = max(1.0, float(os.getenv("MT5_BATCH_SECONDS", "2")))
CSV_PATH = Path(os.getenv("MT5_CSV_PATH", str(Path.home() / "Downloads" / "exness_mt5_live_quotes.csv")))


def load_symbols():
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    if not isinstance(config, list) or not config:
        raise ValueError("symbols.json must be a non-empty list")
    if len(config) > 100:
        raise ValueError("Maximum 100 configured symbols per collector")
    for item in config:
        if not all(isinstance(item.get(k), str) and item[k].strip()
                   for k in ("mt5_symbol", "symbol", "instrumentType")):
            raise ValueError("Each symbol needs mt5_symbol, symbol and instrumentType")
    return config


def post_quotes(quotes):
    body = json.dumps({"quotes": quotes}).encode("utf-8")
    request = urllib.request.Request(
        ENDPOINT + "/mt5/quotes",
        data=body,
        headers={
            "Authorization": "Bearer " + TOKEN,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        if response.status not in (200, 202):
            raise RuntimeError("Ingestion returned HTTP " + str(response.status))
        return json.loads(response.read().decode("utf-8"))


def write_csv(quotes):
    """Replace the local CSV with the latest available quote snapshot."""
    CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CSV_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["symbol", "bid", "ask", "last", "volume", "timestamp_utc"])
        for quote in quotes:
            timestamp = datetime.fromtimestamp(
                quote["timestamp"] / 1000, timezone.utc
            ).isoformat()
            writer.writerow([
                quote["sourceSymbol"],
                quote["bid"] or 0,
                quote["ask"] or 0,
                quote["last"] or 0,
                quote.get("volume", 0),
                timestamp,
            ])


def main():
    if not ENDPOINT.startswith("https://"):
        raise ValueError("TRADEMATE_MT5_ENDPOINT must be an HTTPS URL")
    if not TOKEN or len(TOKEN) < 32:
        raise ValueError("Set MT5_INGEST_TOKEN to the secure token configured on the server")
    symbols = load_symbols()

    if not mt5.initialize():
        raise RuntimeError("MT5 initialize failed: " + str(mt5.last_error()))

    try:
        for item in symbols:
            if not mt5.symbol_select(item["mt5_symbol"], True):
                print("WARNING: symbol unavailable in Market Watch:", item["mt5_symbol"])

        print("MT5 read-only bridge running for", len(symbols), "configured symbols.")
        print("Press Ctrl+C to stop. No orders will be submitted.")
        last_send = 0.0
        backoff = 2.0
        while True:
            if not mt5.terminal_info() or not mt5.terminal_info().connected:
                print("MT5 terminal disconnected; waiting...")
                time.sleep(3)
                continue

            quotes = []
            for item in symbols:
                tick = mt5.symbol_info_tick(item["mt5_symbol"])
                if tick is None or not tick.time_msc:
                    continue
                bid = float(tick.bid) if tick.bid and tick.bid > 0 else None
                ask = float(tick.ask) if tick.ask and tick.ask > 0 else None
                last = float(tick.last) if tick.last and tick.last > 0 else None
                if bid is None and ask is None and last is None:
                    continue
                quotes.append({
                    "symbol": item["symbol"],
                    "sourceSymbol": item["mt5_symbol"],
                    "instrumentType": item["instrumentType"],
                    "bid": bid,
                    "ask": ask,
                    "last": last,
                    "timestamp": int(tick.time_msc),
                    "volume": int(tick.volume),
                })

            now = time.monotonic()
            if quotes and now - last_send >= BATCH_SECONDS:
                write_csv(quotes)
                print("Saved", len(quotes), "quotes to", CSV_PATH)
                try:
                    result = post_quotes(quotes)
                    print("Accepted", result.get("accepted", 0), "quotes")
                    last_send = now
                    backoff = 2.0
                except (urllib.error.URLError, TimeoutError, RuntimeError, ValueError) as exc:
                    print("Ingestion error:", exc, "- retrying in", int(backoff), "seconds")
                    time.sleep(backoff)
                    backoff = min(backoff * 2, 60.0)
            time.sleep(POLL_SECONDS)
    finally:
        mt5.shutdown()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopped.")
    except Exception as exc:
        print("ERROR:", exc, file=sys.stderr)
        raise SystemExit(1)
