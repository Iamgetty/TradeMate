# TradeMate MT5 quote collector

## Requirements
- Windows laptop with MetaTrader 5 installed, running and logged in to the intended Exness account.
- Python 3.10+.
- MT5 terminal must have the configured instruments available in Market Watch.
- Staging exchange-feed service at `https://feed.trademate.cfd`.

## Install
Open PowerShell in this folder:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -r requirements.txt
Copy-Item .\symbols.example.json .\symbols.json
```

Keep `symbol` normalized for TradeMate. `mt5_symbol` must exactly match the broker symbol (including suffixes such as `m`). Confirm each configured symbol exists in Market Watch before running.

## First run: local CSV-only validation (safe default)

Do not set endpoint or token. Run:

```powershell
py .\mt5_collector.py
```

It reads ticks from the local logged-in MT5 terminal and refreshes `%USERPROFILE%\\Downloads\\exness_mt5_live_quotes.csv`. No quotes are sent to TradeMate. Stop with Ctrl+C.

## Staging upload (gated)

The staging endpoint is `https://feed.trademate.cfd/mt5/quotes`. Remote upload remains disabled unless both `TRADEMATE_MT5_ENDPOINT` and `MT5_INGEST_TOKEN` are set.

**Do not enable upload until the staging feed runtime has the matching `MT5_INGEST_TOKEN` configured and tested.** **Current blocker:** `/trademate/staging/MT5_INGEST_TOKEN` has not been created, and the exchange-feed service is not configured to read it. Do not attempt remote upload yet. Do not put tokens in `symbols.json`, source control, chat, screenshots, or logs.

When the backend runtime and secret are explicitly configured, set the local session variables and run:

```powershell
$env:TRADEMATE_MT5_ENDPOINT = "https://feed.trademate.cfd"
$env:MT5_INGEST_TOKEN = "<retrieve securely; do not save or share>"
py .\mt5_collector.py
```

The collector will keep a local CSV snapshot and post quote batches to the HTTPS endpoint. Remove the session token when done:

```powershell
Remove-Item Env:\\MT5_INGEST_TOKEN
Remove-Item Env:\\TRADEMATE_MT5_ENDPOINT
```

## Safety / permission gates
- The collector is read-only: no order, deal or trade-management calls are present.
- It sends bid/ask/last, volume and broker tick timestamps only.
- These are Exness broker CFD prices where applicable; they are not necessarily exchange prices.
- Do not enable public broadcast/redistribution without written broker and relevant instrument permissions. The feed's public-broadcast and redistribution flags must remain disabled until approval.
