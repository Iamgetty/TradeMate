# TradeMate MT5 quote collector

## Requirements
- Windows laptop with MetaTrader 5 installed, running and logged in to the intended Exness account.
- Python 3.10+.
- MT5 terminal must have the configured instruments available in Market Watch.
- The exchange-feed service must have `MT5_INGEST_TOKEN` configured securely and the MT5 ingestion PR deployed to a test environment.

## Install
Open PowerShell in this folder:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -r requirements.txt
```

Edit `symbols.json` to match the exact symbols in your MT5 Market Watch. Keep the `symbol` field as the normalized TradeMate symbol; `mt5_symbol` must exactly match the broker's symbol (including suffixes such as m).

## Configure and run
Set the HTTPS URL of the test exchange-feed service and the same secret configured on that service:

```powershell
$env:TRADEMATE_MT5_ENDPOINT = "https://YOUR-TEST-FEED-HOST"
$env:MT5_INGEST_TOKEN = "YOUR_LONG_RANDOM_SECRET"
py .\mt5_collector.py
```

Stop with Ctrl+C. The script reads ticks only and never sends orders. Do not put secrets in symbols.json or commit them to GitHub.

## Safety notes
- Use a test/staging feed first, not production.
- The endpoint token must be at least 32 characters and must be stored as a Render secret/environment variable, not in source control.
- This collector sends MT5 bid/ask/last and broker tick timestamps. It does not imply that the broker permits public redistribution.
- CFD quotes must be identified as broker CFD prices. Obtain Exness and any relevant exchange permissions before public display.
