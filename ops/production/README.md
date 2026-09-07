# Production fixes: read-only cache, release identity, upstream retry page

These files target the existing Oracle installation: one web container at
`127.0.0.1:3100`, Caddy on the host, and the verified-commit deploy poller. They do
not turn this into a zero-downtime deployment. No step prunes Docker data or
changes database permissions. The separate authentication client-IP candidate
coordinates gateway and ingress configuration as described below.

## Release identity and read-only metadata cache

The Docker production build requires `NEXT_DEPLOYMENT_ID`. The builder embeds it
in Next's config and assets; the runner inherits exactly the same value. The
image also exposes a non-secret `site.beanmap.deployment-id` label. Set it to the
verified commit SHA when building outside the supplied deploy wrapper.

The updated poller passes its verified SHA to the wrapper. Forced-command archive
deployments without a SHA use a SHA-256 digest of their archive. The wrapper
serializes source/image changes, completes the build while the old web is still
running, and then replaces containers. It intentionally retains the existing
runtime Compose, environment files, ingress secrets, and Docker networks.

Before the next production deployment, install the updated scripts at their
existing paths (preserve the existing ownership/execution restrictions):

```sh
sudo install -o root -g root -m 0755 scripts/beanmap-deploy-wrapper.sh /usr/local/sbin/beanmap-deploy
sudo install -o root -g root -m 0755 scripts/beanmap-deploy-poller.sh /usr/local/sbin/beanmap-deploy-poller
```

Check the poller's actual unit path first if the installed filename differs.
The normal verified deployment then builds the new `Dockerfile` with the release
argument; no replacement of the host's secret-bearing Compose is needed.

`next.config.ts` disables ISR disk writes in production and retains Next's bounded
memory cache. Build-time metadata in `.next/server/app` remains readable, so the
read-only image does not need a broad writable filesystem mount.

Post-deployment verification should compare the deployed SHA, the image label,
and the runtime `NEXT_DEPLOYMENT_ID` (these are not secrets), then inspect HTML
chunk URLs for the matching `dpl` value. Read robots, sitemap, favicon, and the
OpenGraph image twice and check that no new metadata `EROFS` appears. The first
request of a fresh process matters; a warm cache alone is not sufficient.

## Caddy retry page during the short replacement window

The error handler only replaces Caddy connection failures (502/503/504). It does
not intercept application responses, including the app's own authentication
recovery 503. HTML GET/HEAD requests receive a localized retry page with actual
status 503, `Retry-After: 5`, and `Cache-Control: no-store`. Other requests receive
a short text error. No request is automatically retried and no form POST is
replayed. The user's URL is preserved, including a login return destination.

Prepare/install static files outside the application container so they remain
available while the web is replaced:

```sh
sudo install -d -o root -g root -m 0755 /opt/beanmap-errors
sudo install -o root -g root -m 0644 ops/production/maintenance.ko.html /opt/beanmap-errors/
sudo install -o root -g root -m 0644 ops/production/maintenance.en.html /opt/beanmap-errors/
sudo install -o root -g root -m 0644 ops/production/beanmap-upstream-errors.Caddyfile /etc/caddy/
sudo python3 ops/production/prepare-caddy-errors.py /etc/caddy/Caddyfile --output /etc/caddy/Caddyfile.retry-candidate
```

The preparation tool refuses to overwrite the live Caddyfile or an existing
candidate, rejects unexpected site structure or a competing upstream error
handler, and changes only one snippet import inside `beanmap.site` plus a
top-level import. Existing admin rejection, deploy webhook, API host, and 413
handling stay in place. It does not print configuration contents.

Validate the candidate with the same environment as the existing Caddy service.
This installation uses `/etc/beanmap-private-console/caddy.env`; do not print or
source its secret values into an interactive shell. For example, a transient
validation process can read the same systemd EnvironmentFile:

```sh
sudo systemd-run --wait --pipe --collect --property=EnvironmentFile=/etc/beanmap-private-console/caddy.env /usr/bin/caddy validate --config /etc/caddy/Caddyfile.retry-candidate --adapter caddyfile
```

After successful validation, preserve a root-readable backup of the current
Caddyfile, install the reviewed candidate as `/etc/caddy/Caddyfile` preserving the current service-readable ownership/mode, and reload
through `systemctl reload caddy` so the existing service environment and admin
socket configuration apply. Do not dump adapted JSON or replace the whole
Caddyfile from a template. Revert by restoring the backup and reloading; the
static pages themselves do not expose operational state.

Validate the unavailable-upstream case locally/staging, not by stopping the live
web. Verify the ordinary live public and private paths after installation.

## Focused local checks

`tests/infra-runtime.test.mjs` loads the real production Next config and cache
implementation. Its Caddy integration case is enabled only when
`BEANMAP_CADDY_QA_URL` points to a disposable fixture with `/upstream-503` returning
an intentional app 503 and `/ko/admin` returning 404. It checks both languages,
no-store/retry headers, POST non-HTML handling, and preservation of those two
existing responses.

Run `BEANMAP_QA_NODE=/path/to/node22 bash scripts/test-infra-caddy.sh` for the disposable fixture, and `bash -n` for both deployment scripts. Integration evidence and the local
Caddy fixture used for this change are recorded in `docs/fix-audit-infra.md`.

## Authentication shared-server limit

The [trusted client-IP configuration](auth-client-ip.md) is installed for ingress
and Kong, including a reserved network, exact web /32 trust and secret proof of
Caddy provenance. The web overlay and proof mount survive recreation. Deploy the
application helper with this configuration and verify separate client-IP read
buckets before considering the feature active. The existing 600/minute IP limit, 60/minute
login/signup policy and authentication checks remain unchanged. Both isolated
Caddy/Kong tests and production boundary checks pass. Users sharing a client NAT
still share a bucket; this is not per-user limiting.

The static retry pages, complete Caddy candidate and updated deployment wrapper
were installed and verified on 2026-09-06. A pre-existing poller rollback flaw was
discovered during rollout. The forward-only correction was installed and the
known-good release restored before final application deployment. Automatic entry
was paused during recovery; resume it only after version and state verification.
Do not reinstall the earlier poller version.

References: [Caddy error handling](https://caddyserver.com/docs/caddyfile/directives/handle_errors),
[Caddy static response status](https://caddyserver.com/docs/caddyfile/directives/file_server),
[Kong rate limiting](https://developer.konghq.com/plugins/rate-limiting/).

## Automatic and manual deployment state

The poller advances only from a known deployed commit to a verified descendant.
A stale or diverging candidate is skipped; unknown, missing or malformed deployed
state stops automatic replacement. Git errors are failures, not successful skips.
Delayed triggers are not deleted because a newer webhook may be replacing them.

Initial bootstrap requires an explicitly verified manual deployment and a matching
40-character commit in `/var/lib/beanmap-deploy/deployed-sha`; an empty state file
is not permission to choose any successful historical build. The normal poller
updates that file only after the wrapper succeeds. The wrapper by itself does
not update it.

For a manual deployment or intentional rollback, stop
`beanmap-deploy-poller.timer` and `beanmap-deploy-webhook.service`, and check that
`beanmap-deploy-poller.service` has finished. Do not kill an active build merely
to bypass its lock. Verify the desired commit and CI, deploy its exact archive
through the wrapper, then verify the running services and archive/source identity.
Only after those checks, atomically replace the root-owned 0600 state file with
the actually deployed commit. Changing only the state file is not a rollback.
Keep automated entry stopped until the running version and state are synchronized;
resume both units through the release coordinator after review.

## Security audit remediation candidate (2026-09-07)

The [container boundary runbook](security-boundary.md) provides management-network
isolation, an idempotent IMDS forwarding guard, compatible Compose overlays, and
bounded Supabase runtime/auth policies. These are reviewed local candidates;
production activation and restored-database compatibility checks remain pending.
