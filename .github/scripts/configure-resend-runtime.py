#!/usr/bin/env python3
"""Install Resend credentials into the staging API environment without logging secrets."""
import json
import os
import re
import subprocess
import sys
import tempfile
import time

data = json.load(sys.stdin)
api_key = data.get("api_key", "")
from_email = data.get("from_email", "")
if not re.fullmatch(r"re_[A-Za-z0-9_-]+", api_key):
    raise SystemExit("RESEND_API_KEY is missing or has an invalid format; value not displayed.")
if not re.fullmatch(r"[^\\s@<>]+@[^\\s@<>]+\\.[^\\s@<>]+", from_email):
    raise SystemExit("RESEND_FROM_EMAIL is missing or invalid; value not displayed.")

path = "/etc/trademate/api.env"
directory = os.path.dirname(path)
os.makedirs(directory, mode=0o700, exist_ok=True)
try:
    with open(path, "r", encoding="utf-8") as handle:
        existing = handle.read()
except FileNotFoundError:
    existing = ""

lines = [
    line for line in existing.splitlines()
    if not re.match(r"^\\s*(?:RESEND_API_KEY|RESEND_FROM_EMAIL)\\s*=", line)
]

def systemd_quote(value):
    if any(char in value for char in ("\\r", "\\n", "\\x00")):
        raise SystemExit("Environment value contains an unsupported control character.")
    return '"' + value.replace("\\\\", "\\\\\\\\").replace('"', '\\"') + '"'

content = "\\n".join(lines).rstrip("\\n")
if content:
    content += "\\n"
content += "RESEND_API_KEY=" + systemd_quote(api_key) + "\\n"
content += "RESEND_FROM_EMAIL=" + systemd_quote(from_email) + "\\n"

fd, temporary = tempfile.mkstemp(prefix=".api.env.", dir=directory)
try:
    os.fchmod(fd, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write(content)
        handle.flush()
        os.fsync(handle.fileno())
    os.chown(temporary, 0, 0)
    os.replace(temporary, path)
    directory_fd = os.open(directory, os.O_DIRECTORY)
    try:
        os.fsync(directory_fd)
    finally:
        os.close(directory_fd)
finally:
    if os.path.exists(temporary):
        os.unlink(temporary)

subprocess.run(["systemctl", "restart", "trademate-api.service"], check=True, timeout=60)
time.sleep(2)
if subprocess.run(["systemctl", "is-active", "--quiet", "trademate-api.service"]).returncode:
    raise SystemExit("The staging API did not become active after restart.")
pid = subprocess.check_output(
    ["systemctl", "show", "trademate-api.service", "--property=MainPID", "--value"],
    text=True,
).strip()
if not pid.isdigit() or pid == "0":
    raise SystemExit("The staging API has no active main process.")
with open("/proc/" + pid + "/environ", "rb") as handle:
    entries = dict(
        item.split(b"=", 1)
        for item in handle.read().split(b"\\x00")
        if b"=" in item
    )
if entries.get(b"RESEND_API_KEY", b"").decode() != api_key:
    raise SystemExit("The active API process did not load RESEND_API_KEY.")
if entries.get(b"RESEND_FROM_EMAIL", b"").decode() != from_email:
    raise SystemExit("The active API process did not load RESEND_FROM_EMAIL.")
if os.stat(path).st_mode & 0o777 != 0o600:
    raise SystemExit("The runtime environment file permissions are not 0600.")

print("Resend settings are loaded by the active staging API process.")
print("Secret values were not printed. File permissions: 0600. Service: active.")
