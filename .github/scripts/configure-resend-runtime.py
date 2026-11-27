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
updates = {}

api_key = data.get("api_key", "")
from_email = data.get("from_email", "")
if api_key or from_email:
    if not re.fullmatch(r"re_[A-Za-z0-9_-]+", api_key):
        raise SystemExit("RESEND_API_KEY is missing or has an invalid format; value not displayed.")
    if not re.fullmatch(r"[^\\s@<>]+@[^\\s@<>]+\\.[^\\s@<>]+", from_email):
        raise SystemExit("RESEND_FROM_EMAIL is missing or invalid; value not displayed.")
    updates["RESEND_API_KEY"] = api_key
    updates["RESEND_FROM_EMAIL"] = from_email

persona_api_key = data.get("persona_api_key", "")
persona_template_id = data.get("persona_template_id", "")
if persona_api_key or persona_template_id:
    if not isinstance(persona_api_key, str) or not persona_api_key or re.search(r"[\\r\\n\\x00]", persona_api_key):
        raise SystemExit("PERSONA_API_KEY is missing or contains unsupported control characters; value not displayed.")
    if not isinstance(persona_template_id, str) or not re.fullmatch(r"itmpl_[A-Za-z0-9]+", persona_template_id):
        raise SystemExit("PERSONA_INQUIRY_TEMPLATE_ID is missing or invalid; value not displayed.")
    updates["PERSONA_API_KEY"] = persona_api_key
    updates["PERSONA_INQUIRY_TEMPLATE_ID"] = persona_template_id

if not updates:
    raise SystemExit("No supported runtime settings were supplied.")
path = "/etc/trademate/api.env"
directory = os.path.dirname(path)
os.makedirs(directory, mode=0o700, exist_ok=True)
try:
    with open(path, "r", encoding="utf-8") as handle:
        existing = handle.read()
except FileNotFoundError:
    existing = ""

setting_names = "|".join(re.escape(name) for name in updates)
lines = [
    line for line in existing.splitlines()
    if not re.match(r"^\\s*(?:" + setting_names + r")\\s*=", line)
]

def systemd_quote(value):
    if any(char in value for char in ("\r", "\n", "\x00")):
        raise SystemExit("Environment value contains an unsupported control character.")
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'

content = "\n".join(lines).rstrip("\n")
if content:
    content += "\n"
for name, value in updates.items():
    content += name + "=" + systemd_quote(value) + "\\n"

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
        for item in handle.read().split(b"\x00")
        if b"=" in item
    )
for name, value in updates.items():
    if entries.get(name.encode(), b"").decode() != value:
        raise SystemExit("The active API process did not load " + name + ".")
if os.stat(path).st_mode & 0o777 != 0o600:
    raise SystemExit("The runtime environment file permissions are not 0600.")

print("Requested runtime settings are loaded by the active staging API process.")
print("Secret values were not printed. File permissions: 0600. Service: active.")
