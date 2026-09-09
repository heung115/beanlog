#!/bin/sh
set -eu

fail() {
  printf '%s\n' 'Staging ingress requires a readable 64-character hexadecimal client proof.' >&2
  exit 1
}
secret_file="${AUTH_CLIENT_IP_SECRET_FILE:-/run/secrets/auth_client_ip}"
[ -r "$secret_file" ] || fail
BEANMAP_AUTH_CLIENT_IP_SECRET="$(cat "$secret_file")"
[ "${#BEANMAP_AUTH_CLIENT_IP_SECRET}" -eq 64 ] || fail
case "$BEANMAP_AUTH_CLIENT_IP_SECRET" in *[!0-9a-f]*) fail ;; esac
export BEANMAP_AUTH_CLIENT_IP_SECRET
# Caddy may include expanded configuration in adaptation failures. Validate
# privately and return a generic error before starting the long-lived process.
if ! caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
  printf '%s\n' 'Staging ingress configuration is invalid.' >&2
  exit 1
fi
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
