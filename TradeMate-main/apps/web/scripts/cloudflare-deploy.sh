#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" || -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "Cloudflare deployment credentials are not configured." >&2
  exit 1
fi
# Deploy to a dedicated staging Worker. Never target the shared production
# Worker name ("trademate") from this staging pipeline.
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
# The generated Wrangler config uses the explicit staging Worker name above.
# Do not select an undeclared Wrangler environment: that previously deployed
# to the shared base Worker instead of creating an isolated staging script.
npx cf deploy --force --keep-vars
