#!/usr/bin/env bash
# Run as root on the approved Oracle host from a private staged directory.
# Files beside this script are the reviewed generator and optimizer snippet.
set -euo pipefail
[[ "$EUID" -eq 0 ]] || { echo 'Root is required for the approved Caddy update.' >&2; exit 1; }
staged="$(cd "$(dirname "$0")" && pwd)"
case "$staged" in /srv/beanlog/security-rollout-20260908/image-optimizer-*) ;; *) echo 'Unexpected staging directory' >&2; exit 1;; esac
exec 9>/run/beanmap-image-optimizer-rollout.lock
flock -n 9 || { echo 'Another optimizer rollout is active.' >&2; exit 1; }
config=/etc/caddy/Caddyfile
snippet=/etc/caddy/beanmap-disable-image-optimizer.Caddyfile
candidate="$staged/Caddyfile.candidate"
[[ ! -e "$staged/Caddyfile.before" ]] || { echo 'This rollout directory has already been used.' >&2; exit 1; }
cp --preserve=all "$config" "$staged/Caddyfile.before"
if [[ -e "$snippet" ]]; then cp --preserve=all "$snippet" "$staged/snippet.before"; fi
python3 "$staged/prepare-image-optimizer-caddy.py" "$config" --output "$candidate"
install -o root -g root -m 0644 "$staged/beanmap-disable-image-optimizer.Caddyfile" "$snippet"
replaced=0
rollback() {
  result=$?
  trap - EXIT
  if [[ "$result" -ne 0 ]]; then
    if [[ "$replaced" -eq 1 ]]; then
      cp --preserve=all "$staged/Caddyfile.before" /etc/caddy/.Caddyfile.image-rollback
      mv -f /etc/caddy/.Caddyfile.image-rollback "$config"
    fi
    if [[ -e "$staged/snippet.before" ]]; then
      cp --preserve=all "$staged/snippet.before" "$snippet"
    else
      rm -f "$snippet"
    fi
    if [[ "$replaced" -eq 1 ]]; then
      systemctl reload caddy >"$staged/rollback.log" 2>&1 || echo 'Caddy rollback reload failed; inspect private log.' >&2
    fi
    echo 'Optimizer rollout failed; pre-change Caddy files restored.' >&2
  fi
  exit "$result"
}
trap rollback EXIT
systemd-run --quiet --wait --pipe --collect \
  --property=EnvironmentFile=/etc/beanmap-private-console/caddy.env \
  /usr/bin/caddy validate --config "$candidate" --adapter caddyfile >"$staged/validate.log" 2>&1
# Refuse to replace a configuration changed by a concurrent operator.
cmp -s "$config" "$staged/Caddyfile.before"
cp --preserve=all "$config" /etc/caddy/.Caddyfile.image-candidate
cat "$candidate" > /etc/caddy/.Caddyfile.image-candidate
mv -f /etc/caddy/.Caddyfile.image-candidate "$config"
replaced=1
systemctl reload caddy >"$staged/reload.log" 2>&1
systemctl is-active --quiet caddy
for path in '/_next/image?url=%2Ficon-192.png&w=64&q=75' '/_next/image/extra'; do
  status="$(curl --silent --output /dev/null --max-time 15 --write-out '%{http_code}' \
    --resolve beanmap.site:443:127.0.0.1 "https://beanmap.site$path")"
  [[ "$status" == 404 ]]
done
status="$(curl --silent --output /dev/null --max-time 20 --write-out '%{http_code}' \
  --resolve beanmap.site:443:127.0.0.1 https://beanmap.site/ko/login)"
[[ "$status" == 200 ]]
printf 'Caddy optimizer guard applied: optimizer 404, login 200, service active.\n'
