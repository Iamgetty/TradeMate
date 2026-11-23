#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" || -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "Cloudflare deployment credentials are not configured." >&2
  exit 1
fi
# Cloudflare Workers Builds starts from a clean checkout. Generate vinext's
# Vite/Cloudflare config and deploy script in that checkout before deploying.
npx --yes vinext@1.4.0 init --platform=cloudflare --cdn-cache=none --data-cache=none --image-optimization=none --no-prerender --name=trademate
# Keep the Node/Render Next.js config unchanged in the repository; the
# Cloudflare build uses the same ephemeral standalone-output adjustment as CI.
python - <<'PY'
from pathlib import Path
path = Path("next.config.mjs")
source = path.read_text()
setting = "  output: 'standalone'," + chr(10)
if source.count(setting) != 1:
    raise SystemExit("Expected exactly one standalone output setting in next.config.mjs")
path.write_text(source.replace(setting, ""))
PY
npm run deploy:vinext -- --env staging
