#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [[ ! -f package.json || "$(node -p "require('./package.json').name")" != "trademate-web" ]]; then
  echo "Run this script from the TradeMate web application." >&2
  exit 1
fi
# Initialize vinext's native Cloudflare integration in the disposable
# Workers Builds checkout. This generates vite.config.ts and cloudflare.config.ts.
npx --yes vinext@1.4.0 init --platform=cloudflare --cdn-cache=none --data-cache=none --image-optimization=none --no-prerender --name=trademate
# Next standalone output is for Node/Render. Remove it only from this
# ephemeral Cloudflare checkout; the tracked Next config remains unchanged.
python - <<'PY'
from pathlib import Path
path = Path("next.config.mjs")
source = path.read_text()
setting = "  output: 'standalone'," + chr(10)
if source.count(setting) != 1:
    raise SystemExit("Expected exactly one standalone output setting in next.config.mjs")
path.write_text(source.replace(setting, ""))
PY
npm install --no-audit --no-fund
npm run build:vinext
worker_dir=".cloudflare/output/v1/workers/default/bundle"
worker="$(find "$worker_dir" -maxdepth 1 -type f -name 'worker-entry-*.js' -print -quit)"
if [[ -z "$worker" || ! -s "$worker" ]]; then
  echo "vinext did not emit a hashed Cloudflare Worker entry in $worker_dir." >&2
  exit 1
fi
echo "Cloudflare Worker bundle verified: $worker"
