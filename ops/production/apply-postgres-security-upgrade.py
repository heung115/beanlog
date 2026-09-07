#!/usr/bin/env python3
"""Oracle-host DB-only rollout after the coordinator has approved the window.

Creates logical and stopped-cluster physical backups before replacing only db.
Never restores/deletes the production data directory. Requires explicit --apply.
"""
import argparse
import hashlib
import json
import os
import pathlib
import subprocess
import time

OLD_IMAGE = "sha256:7383f3aa50be9ea0c38fe0a3b5360cc651d511364fe424375650f0efe699eca6"
NEW_IMAGE = "sha256:c61e973bda4604a04677fa7aeacc49928d5e0a5ef0eb66c9ca426723b3ae6bf3"
COMPOSE_DIR = pathlib.Path("/srv/beanlog/supabase/docker")
COMPOSE_FILES = ["docker-compose.yml", "docker-compose.override.yml",
                 "docker-compose.client-ip.yml", "docker-compose.security.yml"]
DATA = COMPOSE_DIR / "volumes/db/data"
CONFIG = pathlib.Path("/var/lib/docker/volumes/beanlogsupabase_db-config/_data")


def output(*command):
    return subprocess.check_output(command, text=True).strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--backup-directory", required=True)
    args = parser.parse_args()
    if not args.apply or os.geteuid() != 0:
        raise SystemExit("Run as root with --apply only after coordinated approval")
    os.umask(0o077)
    backup = pathlib.Path(args.backup_directory).resolve()
    if backup.exists():
        raise SystemExit("Refusing to reuse an existing rollout backup directory")
    if not str(backup).startswith("/srv/beanlog/security-"):
        raise SystemExit("Backup must use a dedicated /srv/beanlog/security-* directory")
    backup.mkdir(mode=0o700, parents=True)
    compose = ["docker", "compose", "--project-name", "beanlogsupabase",
               "--env-file", str(COMPOSE_DIR / ".env")]
    for name in COMPOSE_FILES:
        path = COMPOSE_DIR / name
        if not path.is_file():
            raise SystemExit("Required compose file missing: " + name)
        compose += ["-f", str(path)]
    # Parse configuration in memory only: it includes secrets and must not be printed.
    config = json.loads(output(*compose, "config", "--format", "json"))
    db = config["services"]["db"]
    configured_id = output("docker", "image", "inspect", db["image"], "--format", "{{.Id}}")
    if configured_id != NEW_IMAGE or db.get("read_only") is not True:
        raise SystemExit("Merged DB configuration does not match the rehearsed image/security policy")
    live_id = output("docker", "inspect", "supabase-db", "--format", "{{.Image}}")
    if live_id != OLD_IMAGE:
        raise SystemExit("Live DB image differs from rehearsed source; reassess before rollout")
    free = os.statvfs(backup)
    if free.f_bavail * free.f_frsize < 2 * 1024 ** 3:
        raise SystemExit("Less than 2 GiB available; refusing stop-and-backup")

    rollback_file = backup / "rollback-db-image.yml"
    rollback_file.write_text("services:\n  db:\n    image: " + OLD_IMAGE + "\n")
    with (backup / "latest-cluster.sql").open("wb") as handle:
        subprocess.run(["docker", "exec", "supabase-db", "pg_dumpall", "-U",
                        "supabase_admin", "--clean", "--if-exists"], stdout=handle, check=True)
    print("Latest logical backup complete", flush=True)
    changed = False
    try:
        subprocess.run(["docker", "stop", "--time", "60", "supabase-db"],
                       stdout=subprocess.DEVNULL, check=True)
        changed = True
        state = output("docker", "run", "--rm", "--network", "none", "--user", "100:101",
                       "--mount", "type=bind,src=" + str(DATA) + ",dst=/backup,readonly",
                       "--entrypoint", "pg_controldata", OLD_IMAGE, "/backup")
        cluster_state = next((line.split(":", 1)[1].strip() for line in state.splitlines()
                              if line.startswith("Database cluster state:")), "")
        if cluster_state != "shut down":
            raise RuntimeError("Database did not reach a clean shut down state")
        for source, name in [(DATA, "data.tar"), (CONFIG, "db-config.tar")]:
            subprocess.run(["tar", "--xattrs", "--acls", "--numeric-owner", "-C", str(source),
                            "-cpf", str(backup / name), "."], check=True)
        checksums = []
        for name in ["latest-cluster.sql", "data.tar", "db-config.tar"]:
            path = backup / name
            if path.stat().st_size == 0:
                raise RuntimeError("Empty backup: " + name)
            with path.open("rb") as handle:
                digest = hashlib.file_digest(handle, "sha256").hexdigest()
            checksums.append(digest + "  " + name)
        (backup / "SHA256SUMS").write_text("\n".join(checksums) + "\n")
        print("Stopped-cluster data/config backups complete", flush=True)
        subprocess.run([*compose, "up", "-d", "--no-deps", "--pull", "never", "db"], check=True)
        for _ in range(30):
            health = output("docker", "inspect", "supabase-db", "--format",
                            "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}")
            if health == "healthy":
                break
            time.sleep(2)
        else:
            raise RuntimeError("Candidate did not become healthy within 60 seconds")
        version = output("docker", "exec", "supabase-db", "psql", "-U", "supabase_admin",
                         "-d", "postgres", "-Atc", "SHOW server_version_num")
        actual_id = output("docker", "inspect", "supabase-db", "--format", "{{.Image}}")
        if version != "170011" or actual_id != NEW_IMAGE:
            raise RuntimeError("Unexpected live version/image after startup")
        (backup / "result.json").write_text(json.dumps({"status": "healthy", "version": version,
                                                         "old_image": OLD_IMAGE, "new_image": NEW_IMAGE}) + "\n")
        print("Production DB healthy on PostgreSQL 17.11; clients may now be validated", flush=True)
    except BaseException:
        if changed:
            # Same-major image rollback only. Preserve all current data; never
            # overwrite production from a stale backup automatically.
            print("Candidate failed; restoring the previous DB image without restoring data", flush=True)
            subprocess.run([*compose, "-f", str(rollback_file), "up", "-d", "--no-deps",
                            "--pull", "never", "db"], check=True)
        raise


if __name__ == "__main__":
    main()
