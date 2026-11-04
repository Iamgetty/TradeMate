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

Create the working symbol list from the supplied template, then edit it only if your broker uses different names:

```powershell
Copy-Item .\symbols.example.json .\symbols.json
```

Keep the `symbol` field as the normalized TradeMate symbol; `mt5_symbol` must exactly match the broker's symbol (including suffixes such as m).

## First run: local CSV only

Do not configure an endpoint or token yet. Run:

```powershell
py .\mt5_collector.py
```

The collector will read ticks from the logged-in desktop MT5 terminal and refresh `%USERPROFILE%\Downloads\exness_mt5_live_quotes.csv`. It will not send data anywhere. Stop with Ctrl+C.

## Optional: send to a test feed later

Only after a test feed is deployed and its secret is configured, set the HTTPS URL and matching secret:

```powershell
$env:TRADEMATE_MT5_ENDPOINT = "https://YOUR-TEST-FEED-HOST"
$env:MT5_INGEST_TOKEN = "YOUR_LONG_RANDOM_SECRET"
py .\mt5_collector.py
```

Do not put secrets in symbols.json or commit them to GitHub.

## Safety notes
- Use a test/staging feed first, not production.
- The endpoint token must be at least 32 characters and must be stored as a Render secret/environment variable, not in source control.
- This collector sends MT5 bid/ask/last and broker tick timestamps. It does not imply that the broker permits public redistribution.
- CFD quotes must be identified as broker CFD prices. Obtain Exness and any relevant exchange permissions before public display.
