"""Run only on the authorized Oracle host; never export its administrative key."""
import base64
import hashlib
import hmac
import json
from pathlib import Path
import re
import subprocess
import sys
import secrets
import time
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
        # The guard above limits synthetic consent fixtures to disposable users.
        # The signing key never leaves this host or appears in the response.
        consent_key = Path("/etc/beanmap-private-console/signup-consent.secret").read_text().strip()
        if not re.fullmatch(r"[a-f0-9]{64}", consent_key):
            raise ValueError("Fixture signing configuration unavailable")
        consent = {"email": email.lower(), "terms_version": "2026-08-26", "privacy_version": "2026-08-26",
                   "issued_at": int(time.time()), "nonce": secrets.token_hex(32), "source": "email-signup", "path": "/signup"}
        canonical = "\n".join(str(value) for value in ["beanmap-signup-v1", consent["email"], consent["terms_version"],
            consent["privacy_version"], consent["issued_at"], consent["nonce"], consent["source"], consent["path"]])
        consent["signature"] = hmac.new(bytes.fromhex(consent_key), canonical.encode(), hashlib.sha256).hexdigest()
        created = admin("POST", "users", {
            "email": email, "password": request["password"], "email_confirm": True,
            "user_metadata": {"display_name": "Disposable security verification", "beanmap_signup_consent": consent},
        })
        return {"id": created["id"], "anonKey": settings["SUPABASE_ANON_KEY"]}
    user_id = request["id"]
    if not re.fullmatch(r"[a-f0-9-]{36}", user_id):
        raise ValueError("Disposable ID guard rejected")
    user = admin("GET", "users/" + user_id)
    if user.get("email") != email:
        raise ValueError("Disposable ownership guard rejected")
    if operation == "api-probe":
        bearer = request.get("bearer", "")
        if len(bearer) > 16384 or len(bearer.split(".")) != 3:
            raise ValueError("Probe bearer rejected")
        encoded = bearer.split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
        if claims.get("sub") != user_id or claims.get("role") != "authenticated":
            raise ValueError("Probe bearer ownership rejected")
        # An allowlist keeps this bridge from becoming an administrative HTTP
        # proxy. The Go API independently validates the submitted bearer.
        mode = request.get("probe")
        if mode == "create-canary":
            method, path = "POST", "/api/beans"
            payload = {"name": "Disposable session boundary canary", "roastery": "Verification",
                       "bean_type": "single_origin", "origin_country": "Kenya",
                       "process_method": "washed", "roast_level": "light",
                       "consumed_at": "2026-09-08", "place_type": "home", "overall_score": 8,
                       "note": "Disposable", "tags": [], "blend_components": []}
        elif mode in ("update-canary", "update-canary-missing-version", "update-canary-null-version"):
            bean_id = request.get("beanId", "")
            if not re.fullmatch(r"[a-f0-9-]{36}", bean_id):
                raise ValueError("Canary ID guard rejected")
            method, path = "PUT", "/api/beans/" + bean_id
            payload = {"name": "Disposable session boundary canary", "roastery": "Verification",
                       "bean_type": "single_origin", "origin_country": "Kenya",
                       "process_method": "washed", "roast_level": "light",
                       "consumed_at": "2026-09-08", "place_type": "home", "overall_score": 8,
                       "note": "Updated disposable", "tags": [], "blend_components": []}
            if mode == "update-canary-null-version":
                payload["expected_updated_at"] = None
            elif mode == "update-canary":
                version = request.get("expectedUpdatedAt", "")
                if not isinstance(version, str) or not re.fullmatch(r"[0-9TZ:+.\-]{20,40}", version):
                    raise ValueError("Canary version guard rejected")
                payload["expected_updated_at"] = version
        elif mode in ("origin-countries", "origin-regions", "origin-entities"):
            method, path, payload = "GET", "/api/origins/countries", None
            if mode != "origin-countries":
                country_id = str(request.get("countryId", ""))
                if not re.fullmatch(r"[1-9][0-9]{0,12}", country_id):
                    raise ValueError("Origin country guard rejected")
                path += "/" + country_id + "/regions"
            if mode == "origin-entities":
                region_id = str(request.get("regionId", ""))
                if not re.fullmatch(r"[1-9][0-9]{0,12}", region_id):
                    raise ValueError("Origin region guard rejected")
                path += "/" + region_id + "/entities"
        elif mode == "read-canary":
            method, path, payload = "GET", "/api/beans?limit=100", None
        elif mode == "read-profile":
            method, path, payload = "GET", "/api/profile", None
        elif mode == "update-profile":
            method, path = "PUT", "/api/profile"
            payload = {"display_name": "Disposable verified profile", "locale": "ko"}
        elif mode in ("delete-missing-proof", "delete-invalid-proof"):
            method, path = "POST", "/api/account/delete"
            payload = {} if mode == "delete-missing-proof" else {"challenge": "a" * 64, "code": "000000"}
        else:
            raise ValueError("Probe operation rejected")
        script = """let input='';process.stdin.setEncoding('utf8');
process.stdin.on('data',chunk=>input+=chunk);process.stdin.on('end',async()=>{
try {const {path,method,payload,bearer}=JSON.parse(input);
const response=await fetch('http://api:8080'+path,{method,
headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json'},
body:payload===null?undefined:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});
const text=await response.text();let data;try{data=JSON.parse(text)}catch{data=null}
console.log(JSON.stringify({status:response.status,data}));
}catch{process.exitCode=1}});"""
        completed = subprocess.run(["docker", "exec", "-i", "beanlogapp-web-1", "node", "-e", script],
            input=json.dumps({"path": path, "method": method, "payload": payload, "bearer": bearer}),
            text=True, capture_output=True, timeout=40, check=True)
        return json.loads(completed.stdout)
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
