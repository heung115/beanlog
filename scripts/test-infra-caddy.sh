#!/usr/bin/env bash
# Disposable local Caddy fixture; never connects to production.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
container_name="beanmap-infra-caddy-qa-$$"
node_binary="${BEANMAP_QA_NODE:-node}"
image='caddy:2.10.2-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d'
cleanup() {
  docker stop "$container_name" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run --detach --rm --name "$container_name" \
  --publish 127.0.0.1::8080 \
  --volume "$root/ops/production:/rules:ro" \
  --volume "$root/tests/fixtures/infra/Caddyfile:/etc/caddy/Caddyfile:ro" \
  "$image" >/dev/null
address="$(docker port "$container_name" 8080/tcp)"
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl --silent --output /dev/null --max-time 1 "http://$address/ko/login"; then
    break
  fi
  if [[ "$attempt" == 10 ]]; then
    echo "Local Caddy fixture did not become ready" >&2
    exit 1
  fi
  sleep 0.2
done
BEANMAP_CADDY_QA_URL="http://$address" "$node_binary" --test "$root/tests/infra-runtime.test.mjs"
