#!/usr/bin/env bash

# This script is installed as /usr/local/sbin/beanmap-deploy on the Oracle
# host and invoked through the beanlog-deploy SSH account's forced command.
set -euo pipefail

if [[ "${1:-}" != "deploy" || "$#" -ne 1 ]]; then
  echo "deployment command is restricted" >&2
  exit 2
fi

# Also serialize forced-command/manual deployments with each other. The poller
# owns a different lock while it verifies CI, so this does not deadlock it.
/usr/bin/install -d -m 0700 /var/lib/beanmap-deploy
exec 8>/var/lib/beanmap-deploy/deploy-execution.lock
/usr/bin/flock 8

compose_files=(-f /srv/beanlog/app/docker-compose.yml)
if [[ -f /srv/beanlog/app/docker-compose.client-ip.yml ]]; then
  compose_files+=(-f /srv/beanlog/app/docker-compose.client-ip.yml)
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

# The verified poller supplies its commit SHA. A forced-command deployment of
# an archive still gets a distinct content identity without needing Git on host.
deployment_id="${NEXT_DEPLOYMENT_ID:-}"
if [[ -z "$deployment_id" ]]; then
  deployment_id="$(/usr/bin/sha256sum "$archive")"
  deployment_id="${deployment_id%% *}"
fi
if [[ ! "$deployment_id" =~ ^[0-9a-f]{40}$ && ! "$deployment_id" =~ ^[0-9a-f]{64}$ ]]; then
  echo "deployment id must be a verified commit or archive digest" >&2
  exit 2
fi

# Runtime env files and local state are deliberately preserved on the host.
/usr/bin/rsync -a --delete \
  --exclude='.env*' \
  --exclude='.audit-report.md' \
  --exclude='CONTEXT.md' \
  --exclude='.staging/' \
  "$release_dir/" /srv/beanlog/app-src/

/usr/bin/docker compose \
  --project-directory /srv/beanlog/app \
  "${compose_files[@]}" \
  build --build-arg "NEXT_DEPLOYMENT_ID=$deployment_id"

# Keep the old containers serving throughout the build. Only replacement is in
# the brief interruption window; Caddy serves a retry page if the web is absent.
/usr/bin/docker compose \
  --project-directory /srv/beanlog/app \
  "${compose_files[@]}" \
  up -d --no-build --remove-orphans --wait

/usr/bin/docker compose \
  --project-directory /srv/beanlog/app \
  "${compose_files[@]}" \
  ps
