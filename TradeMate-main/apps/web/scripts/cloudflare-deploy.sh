#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" || -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "Cloudflare deployment credentials are not configured." >&2
  exit 1
fi
# Native vinext deployment reads cloudflare.config.ts and deploys the Worker
# defined there. It builds the app as part of deployment.
npx --yes @vinext/cloudflare@1.4.0 deploy --env staging
