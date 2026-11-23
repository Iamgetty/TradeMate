#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
mapfile -t manifests < <(find dist -type f \( -name 'wrangler.json' -o -name 'wrangler.jsonc' \) -print)
if [[ "${#manifests[@]}" -ne 1 ]]; then
  echo "Expected exactly one generated Wrangler manifest; found ${#manifests[@]}." >&2
  printf '%s\n' "${manifests[@]}" >&2
  exit 1
fi
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" || -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "Cloudflare deployment credentials are not configured." >&2
  exit 1
fi
npx wrangler deploy --config "${manifests[0]}"
