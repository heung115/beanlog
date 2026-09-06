#!/usr/bin/env python3
"""Produce a small, redacted operations snapshot. Run only as a systemd collector.

No request input is accepted. All subprocess argument vectors are fixed here or
come from a root-owned config file. Neither command stderr nor raw logs leave
this process. This program does not change containers or database contents.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor
import datetime as dt
import json
import math
import os
import re
import selectors
import shutil
import stat
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_CONFIG = {
    "output_dir": "/var/lib/beanmap-console",
    "backup_dir": "/srv/beanlog/backups",
    "disk_path": "/srv/beanlog",
    "containers": [
        {"name": "beanlogapp-web-1", "label": "웹"},
        {"name": "beanlogapp-api-1", "label": "API"},
        {"name": "supabase-db", "label": "데이터베이스"},
        {"name": "supabase-auth", "label": "로그인"},
        {"name": "supabase-rest", "label": "데이터 API"},
        {"name": "supabase-kong", "label": "API 게이트웨이"},
        {"name": "beanmap-private-studio", "label": "DB 관리 화면"},
        {"name": "beanmap-private-meta", "label": "DB 관리 연결"},
    ],
}
MAX_OUTPUT = 256 * 1024
MAX_CONFIG_SIZE = 16 * 1024
DOCKER = "/usr/bin/docker"
DB_SQL = """SELECT json_build_object(
  'sizeBytes', pg_database_size(current_database()),
  'connections', COALESCE((SELECT json_agg(json_build_object('state', state, 'count', n))
    FROM (SELECT COALESCE(state, 'unknown') AS state, count(*) AS n
      FROM pg_stat_activity WHERE datname = current_database()
      GROUP BY state ORDER BY state) grouped), '[]'::json));"""
# Target only safe state fields: State.Error and Health.Log contain arbitrary text.
INSPECT_FORMAT = ('{"status":{{json .State.Status}},"running":{{json .State.Running}},'
                  '"startedAt":{{json .State.StartedAt}},"restartCount":{{.RestartCount}},'
                  '"health":{{if .State.Health}}{{json .State.Health.Status}}{{else}}null{{end}}}')
STATES = {"created", "running", "paused", "restarting", "removing", "exited", "dead"}
DB_STATES = {"active", "idle", "idle in transaction", "idle in transaction (aborted)",
             "fastpath function call", "disabled", "unknown"}
GIN_RE = re.compile(
    r'^\[GIN\]\s+\d{4}/\d{2}/\d{2}\s+-\s+\d{2}:\d{2}:\d{2}\s+\|\s*'
    r'(?P<status>[1-5]\d\d)\s+\|\s*(?P<duration>\d+(?:\.\d+)?(?:ns|µs|μs|us|ms|s|m\d+(?:\.\d+)?s))\s+\|'
    r'[^|]*\|\s*(?P<method>GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\s+"(?P<uri>[^"\r\n]*)"\s*$')
TIMESTAMP_RE = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$')
ROUTES = (
    (re.compile(r"^/health$"), "/health"),
    (re.compile(r"^/api/health$"), "/api/health"),
    (re.compile(r"^/api/(beans|stats|profile|export|origins)$"), None),
    (re.compile(r"^/api/beans/filter-options$"), "/api/beans/filter-options"),
    (re.compile(r"^/api/beans/[^/]+$"), "/api/beans/:id"),
    (re.compile(r"^/api/origins/(countries|subregions)$"), None),
    (re.compile(r"^/api/origins/countries/[^/]+/regions$"), "/api/origins/countries/:id/regions"),
    (re.compile(r"^/api/origins/countries/[^/]+/regions/[^/]+/entities$"), "/api/origins/countries/:id/regions/:id/entities"),
    (re.compile(r"^/api/admin/(access|overview|catalog|audit)$"), None),
    (re.compile(r"^/api/admin/catalog/[^/]+/[^/]+$"), "/api/admin/catalog/:kind/:id"),
)


class CollectionError(Exception):
    """A safe, fixed error code; never carries command output."""


def utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def safe_number(value, minimum=0):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= minimum


def safe_timestamp(value):
    if not isinstance(value, str) or not TIMESTAMP_RE.fullmatch(value) or value.startswith("0001-"):
        return None
    return value


def command(args, timeout=4, max_bytes=MAX_OUTPUT, capture_stderr=False):
    """Capture bounded stdout without a shell; discard all stderr."""
    started = time.monotonic()
    try:
        child = subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                 stderr=subprocess.STDOUT if capture_stderr else subprocess.DEVNULL,
                                 env={"PATH": "/usr/bin:/bin", "LANG": "C.UTF-8"})
    except OSError:
        raise CollectionError("command_unavailable") from None
    chunks = []
    size = 0
    try:
        with selectors.DefaultSelector() as selector:
            selector.register(child.stdout, selectors.EVENT_READ)
            while selector.get_map():
                remaining = timeout - (time.monotonic() - started)
                if remaining <= 0:
                    raise CollectionError("command_timeout")
                for key, _ in selector.select(min(remaining, 0.2)):
                    data = os.read(key.fileobj.fileno(), 8192)
                    if not data:
                        selector.unregister(key.fileobj)
                        continue
                    size += len(data)
                    if size > max_bytes:
                        raise CollectionError("command_output_limit")
                    chunks.append(data)
            remaining = max(0.01, timeout - (time.monotonic() - started))
            try:
                code = child.wait(timeout=remaining)
            except subprocess.TimeoutExpired:
                raise CollectionError("command_timeout") from None
            if code != 0:
                raise CollectionError("command_failed")
        return b"".join(chunks).decode("utf-8", errors="replace")
    finally:
        if child.poll() is None:
            child.kill()
            child.wait()
        child.stdout.close()


def load_config(path=None):
    config = dict(DEFAULT_CONFIG)
    if path:
        config_path = Path(path)
        info = config_path.lstat()
        if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
            raise ValueError("config must be a root-owned regular file without group/other writes")
        if info.st_size > MAX_CONFIG_SIZE:
            raise ValueError("config is too large")
        custom = json.loads(config_path.read_text())
        if not isinstance(custom, dict) or set(custom) - set(DEFAULT_CONFIG):
            raise ValueError("unknown config fields")
        config.update(custom)
    for field in ("output_dir", "backup_dir", "disk_path"):
        if not isinstance(config[field], str) or not Path(config[field]).is_absolute():
            raise ValueError("config paths must be absolute")
    containers = config["containers"]
    if not isinstance(containers, list) or not 1 <= len(containers) <= 16:
        raise ValueError("expected 1 to 16 containers")
    seen = set()
    for item in containers:
        if not isinstance(item, dict) or set(item) != {"name", "label"}:
            raise ValueError("invalid container entry")
        if not isinstance(item["name"], str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,63}", item["name"]):
            raise ValueError("invalid container name")
        if item["name"] in seen or not isinstance(item["label"], str) or not 1 <= len(item["label"]) <= 40:
            raise ValueError("invalid container label or duplicate")
        seen.add(item["name"])
    return config


def atomic_json(path, data, mode):
    path = Path(path)
    encoded = (json.dumps(data, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n").encode()
    fd, temp_path = tempfile.mkstemp(prefix=".snapshot-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as output:
            os.fchmod(output.fileno(), mode)
            output.write(encoded)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temp_path, path)
        directory_fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)


def ensure_output_dir(path):
    directory = Path(path)
    directory.mkdir(mode=0o750, parents=True, exist_ok=True)
    info = directory.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.geteuid():
        raise ValueError("output directory must be owned by the collector and must not be a symlink")
    directory.chmod(0o750)


def cpu_snapshot(proc_root=Path("/proc")):
    fields = (proc_root / "stat").read_text().splitlines()[0].split()
    if not fields or fields[0] != "cpu" or len(fields) < 5:
        raise ValueError("invalid cpu counters")
    counters = [int(value) for value in fields[1:9]]
    # guest and guest_nice, fields 9 and 10, are already included in user/nice.
    total = sum(counters)
    idle = counters[3] + (counters[4] if len(counters) > 4 else 0)
    boot_id = (proc_root / "sys/kernel/random/boot_id").read_text().strip()
    return {"total": total, "idle": idle, "bootId": boot_id}


def cpu_percent(current, previous):
    if not isinstance(previous, dict) or current["bootId"] != previous.get("bootId"):
        return None
    if not all(safe_number(previous.get(key)) for key in ("total", "idle")):
        return None
    total = current["total"] - previous["total"]
    idle = current["idle"] - previous["idle"]
    if total <= 0 or idle < 0 or idle > total:
        return None
    return round(100 * (total - idle) / total, 1)


def host_stats(config, errors):
    result = {"cpuPercent": None, "memory": None, "disk": None, "uptimeSeconds": None}
    state_file = Path(config["output_dir"]) / "cpu-state.json"
    try:
        current = cpu_snapshot()
        try:
            previous = json.loads(state_file.read_text())
        except (OSError, ValueError):
            previous = None
        result["cpuPercent"] = cpu_percent(current, previous)
        atomic_json(state_file, current, 0o600)
    except (OSError, ValueError, IndexError):
        errors.append("host_cpu_unavailable")
    try:
        memory = {}
        for line in Path("/proc/meminfo").read_text().splitlines():
            key, value = line.split(":", 1)
            memory[key] = int(value.split()[0]) * 1024
        total, available = memory["MemTotal"], memory["MemAvailable"]
        if not 0 <= available <= total or total <= 0:
            raise ValueError("invalid memory")
        result["memory"] = {"totalBytes": total, "usedBytes": total - available,
                            "availableBytes": available, "percent": round((total - available) * 100 / total, 1)}
    except (OSError, ValueError, KeyError, IndexError):
        errors.append("host_memory_unavailable")
    try:
        disk = shutil.disk_usage(config["disk_path"])
        result["disk"] = {"totalBytes": disk.total, "usedBytes": disk.used,
                          "freeBytes": disk.free, "percent": round(disk.used * 100 / disk.total, 1)}
    except (OSError, ZeroDivisionError):
        errors.append("host_disk_unavailable")
    try:
        uptime = float(Path("/proc/uptime").read_text().split()[0])
        result["uptimeSeconds"] = int(uptime) if safe_number(uptime) else None
    except (OSError, ValueError, IndexError):
        errors.append("host_uptime_unavailable")
    return result


def container_state(entry, runner=command):
    result = {**entry, "status": "unknown", "health": None, "restartCount": None, "startedAt": None}
    try:
        data = json.loads(runner([DOCKER, "inspect", "--type", "container", "--format", INSPECT_FORMAT, entry["name"]]))
        if not isinstance(data, dict) or data.get("status") not in STATES:
            raise ValueError("invalid state")
        result["status"] = data["status"]
        result["health"] = data.get("health") if data.get("health") in {"starting", "healthy", "unhealthy"} else None
        result["restartCount"] = data.get("restartCount") if isinstance(data.get("restartCount"), int) and safe_number(data["restartCount"]) else None
        result["startedAt"] = safe_timestamp(data.get("startedAt"))
    except (CollectionError, ValueError, TypeError):
        pass
    return result


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def web_health():
    result = {"label": "웹 응답", "status": "unavailable", "httpStatus": None}
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    try:
        with opener.open("http://127.0.0.1:3100/api/health", timeout=2) as response:
            result["httpStatus"] = response.status
            result["status"] = "healthy" if response.status == 204 else "unhealthy"
    except urllib.error.HTTPError as error:
        result.update(status="unhealthy", httpStatus=error.code)
    except (OSError, urllib.error.URLError, ValueError):
        pass
    return result


def route_summary(uri):
    path = uri.split("?", 1)[0].split("#", 1)[0]
    for pattern, replacement in ROUTES:
        if pattern.fullmatch(path):
            return replacement or path
    return "기타 경로"


def parse_logs(raw, entry):
    requests = []
    errors = warnings = omitted = 0
    for line in raw.splitlines()[-60:]:
        timestamp, separator, body = line.partition(" ")
        timestamp = safe_timestamp(timestamp) if separator else None
        if not timestamp:
            body = line
        match = GIN_RE.fullmatch(body)
        if match:
            code = int(match["status"])
            if code >= 500:
                errors += 1
            elif code >= 400:
                warnings += 1
            requests.append({"service": entry["label"], "timestamp": timestamp, "method": match["method"],
                             "route": route_summary(match["uri"]), "status": code,
                             "duration": match["duration"], "level": "error" if code >= 500 else "warning" if code >= 400 else "info"})
            continue
        # Structured and free-form messages never leave this function.
        level = None
        if len(body) <= 65536:
            try:
                event = json.loads(body)
                if isinstance(event, dict):
                    candidate = event.get("level", event.get("severity"))
                    level = candidate.lower() if isinstance(candidate, str) else None
            except (ValueError, RecursionError):
                pass
        if level in {"error", "fatal", "panic", "critical"} or re.search(r"\b(ERROR|FATAL|PANIC|CRITICAL)\b", body):
            errors += 1
        elif level in {"warn", "warning"} or re.search(r"\b(WARN|WARNING)\b", body):
            warnings += 1
        omitted += 1
    return {"service": entry["label"], "status": "available", "errors": errors, "warnings": warnings,
            "omittedLines": omitted, "requests": requests[-20:]}


def container_logs(entry, runner=command):
    try:
        # Docker uses stdout/stderr for the container's corresponding streams.
        # Merge both for parsing, but on failure discard the entire result.
        raw = runner([DOCKER, "logs", "--timestamps", "--since", "15m", "--tail", "60", entry["name"]], capture_stderr=True)
        return parse_logs(raw, entry)
    except CollectionError:
        return {"service": entry["label"], "status": "unavailable", "errors": None,
                "warnings": None, "omittedLines": None, "requests": []}


def database_stats(runner=command):
    fallback = {"status": "unavailable", "sizeBytes": None, "connections": None, "totalConnections": None}
    try:
        raw = runner([DOCKER, "exec", "--env", "PGCONNECT_TIMEOUT=2", "--env",
                      "PGOPTIONS=-c statement_timeout=2000 -c lock_timeout=1000 -c default_transaction_read_only=on",
                      "supabase-db", "psql", "-X", "-q", "-A", "-t", "-U", "postgres", "-d", "postgres",
                      "-v", "ON_ERROR_STOP=1", "-c", DB_SQL], timeout=4, max_bytes=16384)
        data = json.loads(raw)
        if not isinstance(data, dict) or not isinstance(data.get("sizeBytes"), int) or not safe_number(data["sizeBytes"]):
            return fallback
        connections = data.get("connections")
        if not isinstance(connections, list) or len(connections) > len(DB_STATES):
            return fallback
        safe_connections = []
        for entry in connections:
            if not isinstance(entry, dict) or entry.get("state") not in DB_STATES or not isinstance(entry.get("count"), int) or not safe_number(entry["count"]):
                return fallback
            safe_connections.append({"state": entry["state"], "count": entry["count"]})
        return {"status": "available", "sizeBytes": data["sizeBytes"], "connections": safe_connections,
                "totalConnections": sum(item["count"] for item in safe_connections)}
    except (CollectionError, ValueError, TypeError):
        return fallback


def backup_stats(path, now=None):
    fallback = {"status": "unavailable", "lastModified": None, "ageSeconds": None, "sizeBytes": None}
    now = time.time() if now is None else now
    try:
        # Only metadata, never names or contents. Exclude directories/symlinks.
        latest = None
        with os.scandir(path) as entries:
            for entry in entries:
                if entry.is_file(follow_symlinks=False):
                    info = entry.stat(follow_symlinks=False)
                    if latest is None or info.st_mtime > latest.st_mtime:
                        latest = info
        if latest is None:
            return {**fallback, "status": "empty"}
        return {"status": "available", "lastModified": dt.datetime.fromtimestamp(latest.st_mtime, dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
                "ageSeconds": max(0, int(now - latest.st_mtime)), "sizeBytes": latest.st_size}
    except (OSError, ValueError):
        return fallback


def collect(config):
    started = time.monotonic()
    errors = []
    host = host_stats(config, errors)
    # Four bounded readers keep a failed daemon from delaying every service in
    # sequence. A oneshot systemd unit also prevents overlapping collections.
    with ThreadPoolExecutor(max_workers=4) as pool:
        container_jobs = [pool.submit(container_state, entry) for entry in config["containers"]]
        log_jobs = [pool.submit(container_logs, entry) for entry in config["containers"]]
        database_job = pool.submit(database_stats)
        web_job = pool.submit(web_health)
        containers = [job.result() for job in container_jobs]
        logs = [job.result() for job in log_jobs]
        database = database_job.result()
        health = web_job.result()
    snapshot = {"schemaVersion": 1, "generatedAt": utc_now(), "host": host, "containers": containers,
                "checks": [health], "database": database, "backup": backup_stats(config["backup_dir"]),
                "logs": {"windowMinutes": 15, "lineLimitPerService": 60, "scope": "stdout_stderr", "services": logs},
                "collection": {"durationSeconds": round(time.monotonic() - started, 2), "errors": errors}}
    atomic_json(Path(config["output_dir"]) / "status.json", snapshot, 0o640)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path)
    args = parser.parse_args()
    os.umask(0o027)
    config = load_config(args.config)
    ensure_output_dir(config["output_dir"])
    collect(config)


if __name__ == "__main__":
    main()
