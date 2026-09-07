#!/usr/bin/env python3
"""Prepare private-console credentials on the server without printing values.

This command only writes its own runtime directory and the Studio directories.
It never edits the existing Supabase .env, restarts services, runs SQL, changes
Tailscale, or rotates existing credentials. Run as root on the deployment host.
"""

from __future__ import annotations

import argparse
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import stat
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit


RUNTIME = Path("/etc/beanmap-private-console")
EXPECTED_DNS = "oracle-free.tail6e4bc0.ts.net"


class ProvisionError(Exception):
    pass


def studio_management_ip(text: str) -> str:
    values = re.findall(r"^BEANMAP_STUDIO_IP=([^\r\n]+)$", text, re.MULTILINE)
    if len(values) != 1:
        raise ProvisionError("Set one BEANMAP_STUDIO_IP in the private-console deployment .env")
    try:
        address = ipaddress.IPv4Address(values[0].strip())
    except ipaddress.AddressValueError as error:
        raise ProvisionError("BEANMAP_STUDIO_IP must be a literal management IPv4 address") from error
    if not address.is_private or address.is_loopback or address.is_link_local or address.is_unspecified:
        raise ProvisionError("BEANMAP_STUDIO_IP must be a private bridge address")
    return str(address)


def command_json(args: list[str]) -> object:
    try:
        result = subprocess.run(args, capture_output=True, timeout=20, check=False)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise ProvisionError(f"Could not inspect {args[0]}; no values were printed") from error
    if result.returncode:
        # Docker/CLI errors may include command details or credentials.
        raise ProvisionError(f"Inspection command failed: {args[0]}")
    try:
        return json.loads(result.stdout)
    except (ValueError, UnicodeError) as error:
        raise ProvisionError(f"Invalid inspection response: {args[0]}") from error


def container_env(name: str) -> dict[str, str]:
    info = command_json(["docker", "inspect", name])
    if not isinstance(info, list) or len(info) != 1:
        raise ProvisionError(f"Expected one existing container: {name}")
    if not info[0].get("State", {}).get("Running"):
        raise ProvisionError(f"Required container is not running: {name}")
    return dict(item.split("=", 1) for item in info[0]["Config"]["Env"] if "=" in item)


def required(values: dict[str, str], key: str) -> str:
    value = values.get(key, "")
    if not value:
        raise ProvisionError(f"Required source key is empty: {key}")
    validate_value(value)
    return value


def validate_value(value: str) -> str:
    if any(ord(character) < 32 or ord(character) == 127 for character in value):
        raise ProvisionError("A source value contains an unsupported control character")
    return value


def raw_env(values: dict[str, str]) -> str:
    """Compose format:raw avoids expansion of dollar signs and quote characters."""
    return "".join(f"{key}={validate_value(value)}\n" for key, value in values.items())


def systemd_env(values: dict[str, str]) -> str:
    def quoted(value: str) -> str:
        return '"' + validate_value(value).replace("\\", "\\\\").replace('"', '\\"') + '"'

    return "".join(f"{key}={quoted(value)}\n" for key, value in values.items())


def reject_symlink(path: Path) -> None:
    if path.is_symlink():
        raise ProvisionError(f"Refusing symbolic link: {path}")


def ensure_directory(path: Path, mode: int, gid: int = 0, uid: int = 0) -> None:
    reject_symlink(path)
    path.mkdir(mode=mode, parents=True, exist_ok=True)
    if not path.is_dir():
        raise ProvisionError(f"Expected a directory: {path}")
    os.chown(path, uid, gid)
    os.chmod(path, mode)


def atomic_write(path: Path, content: str, mode: int = 0o600, gid: int = 0) -> bool:
    reject_symlink(path)
    encoded = content.encode("utf-8")
    if path.exists():
        if not stat.S_ISREG(path.stat().st_mode):
            raise ProvisionError(f"Expected a regular file: {path}")
        if path.read_bytes() == encoded:
            os.chown(path, 0, gid)
            os.chmod(path, mode)
            return False
    fd, temporary = tempfile.mkstemp(prefix=".prepare-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as handle:
            os.fchmod(handle.fileno(), mode)
            os.fchown(handle.fileno(), 0, gid)
            handle.write(encoded)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return True


def persisted_token(path: Path) -> str:
    reject_symlink(path)
    if not path.exists():
        return secrets.token_hex(32)
    value = path.read_text().strip()
    if not re.fullmatch(r"[a-f0-9]{64}", value):
        raise ProvisionError(f"Existing credential has an unexpected format: {path}")
    return value


def tailscale_owner(status: object) -> tuple[str, str]:
    if not isinstance(status, dict) or status.get("BackendState") != "Running":
        raise ProvisionError("Tailscale is not running")
    self_node = status.get("Self", {})
    if self_node.get("Tags"):
        raise ProvisionError("The private-console owner must be an untagged user device")
    owner = status.get("User", {}).get(str(self_node.get("UserID")), {}).get("LoginName", "")
    # These values enter the Caddyfile parser; admit only simple identity/host tokens.
    if not re.fullmatch(r"[A-Za-z0-9._+@-]+", owner):
        raise ProvisionError("Unable to determine a safe Tailscale owner identity")
    dns = self_node.get("DNSName", "").rstrip(".").lower()
    if dns != EXPECTED_DNS:
        raise ProvisionError("Tailscale DNS differs from the reviewed app private origin")
    return owner, dns


def prepare() -> None:
    if os.geteuid() != 0:
        raise ProvisionError("Run this preparation command as root on the server")
    # Validate all inputs before creating any credentials.
    studio_ip = studio_management_ip(Path(__file__).with_name(".env").read_text())
    db = container_env("supabase-db")
    gateway = container_env("supabase-kong")
    rest = container_env("supabase-rest")
    auth = container_env("supabase-auth")
    owner, dns = tailscale_owner(command_json(["tailscale", "status", "--json"]))
    schemas = required(rest, "PGRST_DB_SCHEMAS")
    if "beanmap_private" in {name.strip() for name in schemas.split(",")}:
        raise ProvisionError("beanmap_private must not be exposed through PostgREST")
    api_url = required(auth, "API_EXTERNAL_URL").rstrip("/")
    parsed_url = urlsplit(api_url)
    if parsed_url.scheme != "https" or not parsed_url.hostname or parsed_url.username or parsed_url.password:
        raise ProvisionError("Expected an existing HTTPS Supabase API URL")
    db_password = required(db, "POSTGRES_PASSWORD")
    db_name = required(db, "POSTGRES_DB")
    studio = {
        "POSTGRES_DB": db_name,
        "POSTGRES_PASSWORD": db_password,
        "PGRST_DB_SCHEMAS": schemas,
        "PGRST_DB_MAX_ROWS": rest.get("PGRST_DB_MAX_ROWS", "1000"),
        "PGRST_DB_EXTRA_SEARCH_PATH": rest.get("PGRST_DB_EXTRA_SEARCH_PATH", "public"),
        "SUPABASE_PUBLIC_URL": api_url,
        "SUPABASE_ANON_KEY": required(gateway, "SUPABASE_ANON_KEY"),
        "SUPABASE_SERVICE_KEY": required(gateway, "SUPABASE_SERVICE_KEY"),
        "AUTH_JWT_SECRET": required(db, "JWT_SECRET"),
        "SUPABASE_PUBLISHABLE_KEY": gateway.get("SUPABASE_PUBLISHABLE_KEY", ""),
        "SUPABASE_SECRET_KEY": gateway.get("SUPABASE_SECRET_KEY", ""),
    }
    # Validate optional values before writing anything, too.
    raw_env(studio)
    ensure_directory(RUNTIME, 0o700)
    ingress_secret = persisted_token(RUNTIME / "admin_ingress_secret")
    crypto_key = persisted_token(RUNTIME / "meta_crypto_key")
    studio["PG_META_CRYPTO_KEY"] = crypto_key
    meta = {
        "PG_META_DB_NAME": db_name,
        "PG_META_DB_PASSWORD": db_password,
        "CRYPTO_KEY": crypto_key,
    }
    # Only the app's UID/GID 1001 can read this bind-mounted file inside containers.
    atomic_write(RUNTIME / "admin_ingress_secret", ingress_secret + "\n", 0o440, 1001)
    atomic_write(RUNTIME / "meta_crypto_key", crypto_key + "\n")
    atomic_write(RUNTIME / "studio.env", raw_env(studio))
    atomic_write(RUNTIME / "meta.env", raw_env(meta))
    atomic_write(RUNTIME / "caddy.env", systemd_env({
        "BEANMAP_TAILSCALE_OWNER": owner,
        "BEANMAP_TAILSCALE_DNS": dns,
        "BEANMAP_STUDIO_IP": studio_ip,
        "BEANMAP_ADMIN_INGRESS_SECRET": ingress_secret,
    }))
    ensure_directory(Path("/var/lib/beanmap-private-studio"), 0o750)
    # The compose override explicitly runs Studio as the image's node UID/GID 1000.
    ensure_directory(Path("/var/lib/beanmap-private-studio/snippets"), 0o750, 1000, 1000)
    ensure_directory(Path("/var/lib/beanmap-private-studio/functions"), 0o750, 1000, 1000)
    print("Private-console runtime files prepared; existing secret values were preserved.")
    print("No service, database, public listener, or Tailscale configuration was changed.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    try:
        prepare()
    except ProvisionError as error:
        print(f"Preparation stopped: {error}", file=sys.stderr)
        return 1
    except (OSError, KeyError, TypeError, ValueError):
        print("Preparation stopped because local inspection or file preparation failed; no values were printed.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
