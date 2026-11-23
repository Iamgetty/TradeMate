#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [[ ! -f package.json || "$(node -p "require('./package.json').name")" != "trademate-web" ]]; then
  echo "Run this script from the TradeMate web application." >&2
  exit 1
fi
# Keep the Cloudflare adapter isolated from the canonical Next.js/Node build.
# These flags match the currently passing isolated Cloudflare compatibility CI job.
npx --yes vinext@1.4.0 init --skip-check --platform=cloudflare --cdn-cache=none --data-cache=none --image-optimization=none --no-prerender --name=trademate
npm install --no-audit --no-fund
npm run build:vinext
if ! find dist -type f \( -name 'wrangler.json' -o -name 'wrangler.jsonc' \) -print -quit | grep -q .; then
  echo "Cloudflare build completed without a Wrangler deployment manifest." >&2
  exit 1
fi
echo "Cloudflare Workers build and deployment manifest verified."
