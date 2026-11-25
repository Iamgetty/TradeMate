#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

WORKER_NAME="${TRADEMATE_WORKER_NAME:-trademate-staging}"
API_ORIGIN="${TRADEMATE_API_ORIGIN:-https://api.trademate.cfd}"

if [[ "$WORKER_NAME" != "trademate-staging" && "$WORKER_NAME" != "trademate" ]]; then
  echo "Unsupported TradeMate Worker name: $WORKER_NAME" >&2
  exit 2
fi
if [[ "$API_ORIGIN" != https://* ]]; then
  echo "TRADEMATE_API_ORIGIN must be an HTTPS origin." >&2
  exit 2
fi
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" || -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "Cloudflare deployment credentials are not configured." >&2
  exit 1
fi

# The default is the isolated staging Worker. Production promotion must set
# TRADEMATE_WORKER_NAME=trademate explicitly in its separate, disabled trigger.
npx --yes vinext@1.4.0 init --platform=cloudflare --cdn-cache=none --data-cache=none --image-optimization=none --no-prerender --name="$WORKER_NAME"

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

# The generated Wrangler config is explicitly named for the selected Worker.
# cf deploy does not support --keep-vars, so restore the ASSETS and API-origin
# bindings after upload using the selected Worker name and API origin.
npx cf deploy --force

settings_json="$(TRADEMATE_API_ORIGIN="$API_ORIGIN" python - <<'PY'
import json
import os
print(json.dumps({"bindings":[
    {"name":"ASSETS","type":"assets"},
    {"name":"TRADEMATE_API_ORIGIN","type":"plain_text","text":os.environ["TRADEMATE_API_ORIGIN"]}
]}))
PY
)"
response="$(curl --fail --silent --show-error \
  --request PATCH \
  "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${WORKER_NAME}/settings" \
  --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  --form "settings=${settings_json};type=application/json")"
python -c 'import json,sys; result=json.load(sys.stdin); assert result.get("success") is True, result.get("errors")' <<< "$response"
echo "Worker $WORKER_NAME API origin binding verified: $API_ORIGIN"
