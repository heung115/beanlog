#!/usr/bin/env bash

# This script is installed as /usr/local/sbin/beanmap-deploy on the Oracle
# host and invoked through the beanlog-deploy SSH account's forced command.
set -euo pipefail

if [[ "${1:-}" != "deploy" || "$#" -ne 1 ]]; then
  echo "deployment command is restricted" >&2
  exit 2
fi

archive="$(mktemp /tmp/beanmap-deploy.XXXXXX.tar.gz)"
release_dir="$(mktemp -d /tmp/beanmap-release.XXXXXX)"
cleanup() {
  rm -f "$archive"
  rm -rf "$release_dir"
}
trap cleanup EXIT

cat > "$archive"
/usr/bin/tar -tzf "$archive" >/dev/null
/usr/bin/tar -xzf "$archive" -C "$release_dir"

# Runtime env files and local state are deliberately preserved on the host.
/usr/bin/rsync -a --delete \
  --exclude='.env*' \
  --exclude='.audit-report.md' \
  --exclude='CONTEXT.md' \
  --exclude='.staging/' \
  "$release_dir/" /srv/beanlog/app-src/

/usr/bin/docker compose \
  --project-directory /srv/beanlog/app \
  -f /srv/beanlog/app/docker-compose.yml \
  up -d --build --remove-orphans --wait

/usr/bin/docker compose \
  --project-directory /srv/beanlog/app \
  -f /srv/beanlog/app/docker-compose.yml \
  ps
