# Trusted client addresses for server authentication reads

The ingress and gateway configuration was installed on the inspected Oracle
installation on 2026-09-06. Caddy's loaded configuration contains both provenance
injection points and the retry pages. Kong's running nginx configuration trusts
only the reserved web /32; its declarative authentication policy is byte-for-byte
unchanged. The web overlay, non-root proof mount and reserved IP were verified
through a subsequent container recreation. The application forwarding helper and
this configuration must be deployed together and checked after each replacement.

Once that helper is deployed, public client addresses no longer share a single
Next-server 600/minute bucket. The 600/minute IP limit, separate 60/minute
token/signup limit, key-auth, ACL and Auth's JWT/current-user checks remain intact.
Users behind the same NAT still share their IP bucket.

## Trust boundary

Public and private web Caddy proxies overwrite `X-Beanmap-Client-IP` with
`{remote_host}`, and overwrite `X-Beanmap-Client-Proof` with a random 256-bit
server secret. These are upstream request headers, never response headers.
The public API proxy removes both and `X-Beanmap-Auth-Client-IP`.

Next compares the proof in constant time, admits one canonical IPv4/IPv6 address,
and forwards only the address as `X-Beanmap-Auth-Client-IP` for exact internal
GET `/auth/v1/user`. It removes all three headers for other requests, including
refresh/token/signup. The proof never leaves Next. Missing/invalid configuration
fails back to the old bounded shared bucket; it never trusts a caller's claim.

Kong's real-IP module trusts only the exact reserved web `/32`. It ignores that
header from every other source, including host Caddy and untrusted containers.
A separate Docker bridge provides fixed web/gateway addresses. Its dynamic pool
excludes both fixed addresses, so another automatically addressed container cannot
claim the web address during recreation. A root or Docker-administrator compromise
is outside this trust boundary, just as it already controls the running app.

This is **per-client-IP**, not per account. Users behind the same NAT still share
600/minute. Tailscale Serve's private owner-only app arrives from loopback; private
requests therefore share a loopback bucket. No caller-provided Tailscale or CDN
forwarded address is trusted for this policy. Adding a CDN needs separate ingress
verification; do not switch `{remote_host}` to an unverified forwarded value.

## Reapply or review the installed configuration

Keep a root-only backup of the existing public/private Caddyfiles, Caddy unit
configuration, and exact existing app/Kong Compose commands. Check the current
web container name is `beanlogapp-web-1`, Kong is `supabase-kong`, and app Compose
network key is `supabase_net`; the inspected installation has those names.

```sh
sudo python3 ops/production/provision-auth-client-ip.py plan --output /var/lib/beanmap-deploy/auth-client-ip-plan.json
```

Review the non-secret plan. It excludes all existing Docker IPv4 subnets and host
IPv4 routes. An existing network is reusable only with the exact owner label,
reserved pool, expected containers and fixed addresses. If review passes:

```sh
sudo python3 ops/production/provision-auth-client-ip.py apply --plan /var/lib/beanmap-deploy/auth-client-ip-plan.json
```

`apply` rechecks the plan against current state. It creates only the dedicated
network, root-owned proof files, app/Kong overlays and a Caddy EnvironmentFile
drop-in. It does **not** reload Caddy or recreate any service. The secret is bound
read-only into the non-root web container, group-readable only by GID1001.
No secret is printed. The generated overlays preserve original networks and add
no public ports. Existing Kong route/plugin configuration is not rewritten.

Generate separate candidates from the actual current files (use unused output
names). If the retry-page candidate is also pending, compose the edits on that
candidate so one feature does not overwrite the other.

```sh
sudo python3 ops/production/prepare-client-ip-caddy.py /etc/caddy/Caddyfile --output /etc/caddy/Caddyfile.client-ip-candidate
sudo python3 ops/production/prepare-client-ip-caddy.py /etc/caddy/beanmap-private.Caddyfile --private --output /etc/caddy/beanmap-private.client-ip-candidate
```

The public candidate's private import must point temporarily to the private
candidate for validation. Keep the reviewed live import path for final install.
Validate using **both** environment files, without printing adapted JSON:

```sh
sudo systemd-run --wait --pipe --collect --property=EnvironmentFile=/etc/beanmap-private-console/caddy.env --property=EnvironmentFile=/etc/beanmap-auth-client-ip/caddy.env /usr/bin/caddy validate --config /etc/caddy/Caddyfile.client-ip-candidate --adapter caddyfile
```

## Apply the reviewed candidates in order

1. Install the candidate public/private files preserving existing service-readable
   owner/mode, then `systemctl daemon-reload` and `systemctl reload caddy`.
   The inspected unit's ExecReload runs `/usr/bin/caddy reload --config
   /etc/caddy/Caddyfile --force --address unix//run/caddy/admin.sock`.
   Systemd starts this CLI with the updated EnvironmentFile, and the CLI expands
   its Caddyfile before sending configuration to the existing process. A different
   reload mechanism must be checked; simply sending a raw JSON config cannot be
   assumed to read the new environment. No full restart is required for the
   inspected unit. Verify ordinary public/private routes and public admin 404.
2. Recreate **Kong only**, preserving its existing base **and** production override
   and appending the new client-IP overlay. Do not omit the existing override:
   it enables the installed rate-limiting policy.

   ```sh
   cd /srv/beanlog/supabase/docker
   sudo docker compose -f docker-compose.yml -f docker-compose.override.yml -f docker-compose.client-ip.yml config --quiet
   sudo docker compose -f docker-compose.yml -f docker-compose.override.yml -f docker-compose.client-ip.yml up -d --no-deps --no-build --wait kong
   ```

   This is a single-instance gateway replacement and can briefly interrupt Auth.
   Keep its previous configuration available for rollback. Verify Kong health,
   exact `/32` trust, network attachment, and existing 600/60 policies without
   exposing environment secrets or creating production load.
3. Deploy the patched web through the updated deployment wrapper. It appends the
   existing fixed-path `docker-compose.client-ip.yml` automatically on build/up,
   so later releases preserve the static IP, proof mount and internal gateway.
   Old web stays on its previous internal URL until this deployment.
4. Verify a small ordinary sign-in/session/settings sequence; compare sanitized
   GET-user gateway source identities for distinct real client addresses. Do not
   generate 600-request bursts against production. Verify invalid sessions and
   public/private administrator boundaries normally.

The same new Kong overlay must remain on subsequent manual Kong recreations.
Omitting it fails back to source-IP sharing; it must not be treated as activated.

## Rollback

Restore and reload the previous Caddyfiles if ingress checks fail. To roll back
the web/network feature, remove the app overlay from its wrapper lookup path
into the root-only backup area and recreate web using the prior Compose command;
then recreate Kong with its prior complete Compose command without the new
overlay. This returns to the former bounded shared-IP policy. Restore prior
Caddy drop-ins and reload through its original environment as appropriate.
Keep the network and proof files until no service references them. Do not prune
networks, images, volumes, or data as part of this rollback.

## Validation and operational record

`python3 -B scripts/test-auth-client-ip.py` uses real Caddy2.10.2 and
Kong2.8.1 containers, the actual application fetch helper, and synthetic HMAC
signed JWTs checked by a disposable upstream. It does not substitute for a full
Supabase Auth regression; the existing real SDK auth recovery tests also pass.
No ports are published and no production requests are made.

- Client A:600 reads succeed;601st returns429. Client B still succeeds.
- Forging B's headers through web or directly to Kong cannot escape A's limit.
- Public API headers are stripped; missing API key and invalid JWT return401.
- Private fixture owner rejection404 and owner acceptance200 remain intact.
- Token requests:60 succeed;61st429. Other client's server token request also429,
  preserving the pre-existing shared write limit.
- A dynamically allocated container cannot occupy the absent web's reserved IP;
  recreating web restores the identical IP and a subsequent read succeeds.

`tests/auth-client-ip-config.test.mjs` checks route preservation, collision and
unknown-network refusal, exact `/32` trust, reserved pools, and candidate
idempotence/conflict rejection. Both generated public and actual private-template
Caddy candidates passed Caddy validation with synthetic environment values.

Production verification also confirmed public KO/EN login 200, forged public
admin 404, missing API key 401, private wrong-owner 404, private owner login 200 and
admin login redirect 307. Two public API requests carrying different forged
addresses retained the same 600/minute bucket (remaining 599→598). The ingress
proof was absent from the public response and readable by the non-root
UID/GID 1001 runtime through the expected read-only bind mount. All eight production containers were healthy.

During rollout a pre-existing deploy-poller flaw selected an older successful
commit after discarding a trigger that matched the deployed commit. Automatic
poller/webhook entry was paused. The known-good verified application was restored
at 21:39 KST; all 339 tracked source blobs matched its archive and all eight containers
were healthy. The separately reviewed rollback-prevention fix was installed and
its actual production Git history check rejected the stale ancestor. Automatic
entry was paused during recovery and may resume after release verification. These
restoration checks are recorded in the private rollout audit, not inferred from
configuration tests.
