#!/usr/bin/env bash
set -euo pipefail
rules="$(cd "$(dirname "$0")" && pwd)"
fixture="$(mktemp -d /tmp/beanmap-image-caddy.XXXXXX)"
container="beanmap-image-caddy-qa-$$"
cleanup() {
  result=$?
  if [[ "$result" -ne 0 ]]; then docker logs "$container" >&2 || true; fi
  docker stop "$container" >/dev/null 2>&1 || true
  rm -rf "$fixture"
}
trap cleanup EXIT
cat > "$fixture/Caddyfile" <<'CADDY'
{
 admin off
 auto_https off
}
import /rules/beanmap-disable-image-optimizer.Caddyfile
:8080 {
 import beanmap_disable_image_optimizer
 handle {
  reverse_proxy 127.0.0.1:8081
 }
}
:8081 {
 header X-Fixture-Upstream reached
 respond 200
}
CADDY
docker run --detach --rm --name "$container" --publish 127.0.0.1::8080 \
  --volume "$rules:/rules:ro" --volume "$fixture/Caddyfile:/etc/caddy/Caddyfile:ro" \
  'caddy:2.10.2-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d' >/dev/null
address="$(docker port "$container" 8080/tcp)"
for attempt in {1..10}; do
  if curl --silent --fail --output /dev/null --max-time 1 "http://$address/ko/login"; then break; fi
  if [[ "$attempt" == 10 ]]; then exit 1; fi
  sleep 0.2
done
BEANMAP_IMAGE_CADDY_QA_URL="http://$address" python3 -B "$rules/test_image_optimizer_boundary.py"
