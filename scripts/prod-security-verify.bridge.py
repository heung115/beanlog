"""Run only on the authorized Oracle host; never export its administrative key."""
import json
from pathlib import Path
import re
import sys
import urllib.error
import urllib.request


def main():
    request = json.load(sys.stdin)
    settings = {}
    for line in Path("/etc/beanmap-private-console/studio.env").read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            settings[key] = value.strip().strip("\"'")
    key = settings["SUPABASE_SERVICE_KEY"]

    def admin(method, path, payload=None):
        body = None if payload is None else json.dumps(payload).encode()
        req = urllib.request.Request(
            "http://127.0.0.1:8000/auth/v1/admin/" + path,
            data=body, method=method,
            headers={"apikey": key, "Authorization": "Bearer " + key,
                     "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read()
            return json.loads(raw) if raw else {}

    email = request.get("email", "")
    if not re.fullmatch(r"beanmap-security-verify-[a-f0-9-]{36}-[ab]@local\.test", email):
        raise ValueError("Disposable email guard rejected")
    operation = request["operation"]
    if operation == "create":
        if len(request["password"]) < 32:
            raise ValueError("Disposable password guard rejected")
        created = admin("POST", "users", {
            "email": email, "password": request["password"], "email_confirm": True,
            "user_metadata": {"display_name": "Disposable security verification"},
        })
        return {"id": created["id"], "anonKey": settings["SUPABASE_ANON_KEY"]}
    user_id = request["id"]
    if not re.fullmatch(r"[a-f0-9-]{36}", user_id):
        raise ValueError("Disposable ID guard rejected")
    user = admin("GET", "users/" + user_id)
    if user.get("email") != email:
        raise ValueError("Disposable ownership guard rejected")
    if operation == "recovery":
        generated = admin("POST", "generate_link", {
            "type": "recovery", "email": email,
            "redirect_to": "https://beanmap.site/api/auth/callback?mode=recovery&locale=ko",
        })
        return {"tokenHash": generated["hashed_token"]}
    if operation == "delete":
        admin("DELETE", "users/" + user_id)
        return {"deleted": True}
    raise ValueError("Unsupported operation")


try:
    print(json.dumps(main()))
except urllib.error.HTTPError as error:
    # Response bodies and request headers may contain sensitive credentials.
    print(json.dumps({"error": "Administrative request failed", "status": error.code}))
    sys.exit(1)
except Exception:
    print(json.dumps({"error": "Administrative verification bridge failed"}))
    sys.exit(1)
