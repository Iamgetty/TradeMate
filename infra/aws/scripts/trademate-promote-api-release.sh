#!/usr/bin/env bash
set -euo pipefail

SERVICE="trademate-api.service"
BASE="/opt/trademate/api/releases"
BACKUPS="/opt/trademate/api/backups"
HEALTH_URL="http://127.0.0.1:4000/api/health"

if [[ "$#" -ne 1 || ! "$1" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: trademate-promote-api-release <40-character-commit-sha>" >&2
  exit 64
fi

SHA="$1"
RELEASE_ROOT="$BASE/$SHA"
APP_DIR="$RELEASE_ROOT/TradeMate-main/apps/api"
MARKER="$RELEASE_ROOT/.release-sha"

if [[ ! -d "$APP_DIR" || ! -s "$APP_DIR/dist/main.js" || ! -f "$APP_DIR/package.json" || ! -d "$APP_DIR/node_modules" ]]; then
  echo "Release is incomplete: $APP_DIR" >&2
  exit 66
fi
if [[ "$(realpath -e "$APP_DIR")" != "$APP_DIR" ]]; then
  echo "Release path resolves through an unexpected symlink." >&2
  exit 65
fi
if [[ "$(stat -c '%U' "$RELEASE_ROOT")" != "github-runner" ]]; then
  echo "Release directory must be owned by github-runner." >&2
  exit 65
fi
if [[ -f "$MARKER" && "$(cat "$MARKER")" != "$SHA" ]]; then
  echo "Release SHA marker does not match requested SHA." >&2
  exit 65
fi

PREVIOUS_DIR="$(systemctl show "$SERVICE" -p WorkingDirectory --value)"
if [[ "$PREVIOUS_DIR" == "$APP_DIR" ]]; then
  echo "API is already running from release $SHA."
  exit 0
fi

DROPIN_DIR="/etc/systemd/system/${SERVICE}.d"
DROPIN="$DROPIN_DIR/20-release.conf"
BACKUP="$BACKUPS/trademate-api-release-before-$SHA"
mkdir -p "$DROPIN_DIR" "$BACKUPS"

if [[ -f "$DROPIN" ]]; then
  cp -a "$DROPIN" "$BACKUP"
  printf 'present\n' > "$BACKUP.state"
else
  printf 'absent\n' > "$BACKUP.state"
fi
printf '%s\n' "$PREVIOUS_DIR" > "$BACKUP.working-directory"

restore_previous() {
  if [[ "$(cat "$BACKUP.state")" == "present" ]]; then
    cp -a "$BACKUP" "$DROPIN"
  else
    rm -f "$DROPIN"
  fi
  systemctl daemon-reload || true
  systemctl restart "$SERVICE" || true
}

TMP="$DROPIN.tmp.$$"
printf '[Service]\nWorkingDirectory=%s\n' "$APP_DIR" > "$TMP"
chown root:root "$TMP"
chmod 0644 "$TMP"
mv -f "$TMP" "$DROPIN"

if ! systemctl daemon-reload || ! systemctl restart "$SERVICE"; then
  echo "Systemd could not start the new release; restoring $PREVIOUS_DIR." >&2
  restore_previous
  exit 1
fi

BODY=""
for attempt in $(seq 1 30); do
  if systemctl is-active --quiet "$SERVICE"; then
    BODY="$(curl --fail --silent --show-error --max-time 4 "$HEALTH_URL" 2>/dev/null || true)"
    if grep -q '"status":"ok"' <<<"$BODY" && grep -q '"service":"trademate-api"' <<<"$BODY"; then
      CURRENT="$(systemctl show "$SERVICE" -p WorkingDirectory --value)"
      if [[ "$CURRENT" == "$APP_DIR" ]]; then
        printf '%s\n' "$SHA" > /opt/trademate/api/current-release
        chown root:root /opt/trademate/api/current-release
        chmod 0644 /opt/trademate/api/current-release
        echo "API release $SHA promoted successfully."
        echo "$BODY"
        exit 0
      fi
    fi
  fi
  sleep 2
done

echo "New API release failed its local health check; restoring $PREVIOUS_DIR." >&2
restore_previous
for attempt in $(seq 1 15); do
  BODY="$(curl --fail --silent --show-error --max-time 4 "$HEALTH_URL" 2>/dev/null || true)"
  if grep -q '"status":"ok"' <<<"$BODY" && grep -q '"service":"trademate-api"' <<<"$BODY"; then
    echo "Previous API release restored and healthy."
    exit 1
  fi
  sleep 2
done
echo "CRITICAL: previous API release did not recover health." >&2
exit 70
