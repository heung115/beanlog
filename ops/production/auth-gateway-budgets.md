# Authentication gateway identity and budgets

This policy supersedes the original GET-user-only policy in
`auth-client-ip.md`. Deploy it with the current-session and account-deletion
changes. It does not change the existing key-auth, ACL, Auth routes, trusted web
address, network isolation, password-update guard, or private operations console.

Caddy overwrites the public API's `X-Beanmap-Auth-Client-IP` with the socket peer.
Kong trusts only the reserved web `/32` and the inspected host bridge gateway
`/32`; no Docker subnet, forwarded list, CDN header, or anonymous caller is trusted.
The Next helper forwards the proof-verified address for allowlisted internal
Auth methods, including password, refresh, signup, recovery, OTP and verification.
The ingress proof never leaves Next. Public Auth administrator routes return404;
Kong independently requires the `service_role` consumer before charging an admin
budget, so rejected anonymous requests cannot consume cleanup capacity.

The `beanmap-auth-budgets` Kong plugin charges these fixed one-minute limits per
verified IP, after the existing API-key and ACL checks:

| Operation | Requests per minute |
|---|---:|
| GET user | 600 |
| Password/token exchange | 60 |
| Refresh token | 120 |
| Signup, recovery, OTP (each) | 10 |
| Verify, logout, user update (each) | 30 |
| Authorize, callback, other (each) | 60 |
| All public operations per IP | 900 |
| All public operations combined | 9,000 |
| Admin per IP / all admin combined | 300 / 1,200 |

The operation and IP checks run before the shared ceiling. A single IP cannot
consume more than900 of the9,000 public capacity. Administrators use a separate
pool. Shared capacity can still be exhausted by a distributed attack; these limits
bound resource use and do not promise immunity to distributed denial of service.
NAT users share an address. Counters use a dedicated10MiB shared dictionary with
125-second expiry, atomic increments and non-evicting allocation. Allocation or
counter failure returns503, and a restart resets counters.

Kong also overwrites `X-Beanmap-Auth-Rate-Identity` with `public:<verified IP>`
before Auth. `GOTRUE_RATE_LIMIT_HEADER` uses that header for Auth's native limits.
The Go API's direct, private Auth calls use `deletion:<HMAC(verified subject)>` with
an API-only secret; caller headers are never copied. The API DB also limits
per-user sends, attempts and resend intervals. Neither identity nor credentials
are logged by the custom plugin.

Access JWT lifetime becomes300seconds in both `JWT_EXPIRY` and `GOTRUE_JWT_EXP`.
Already-issued JWTs retain their original expiration; live session validation
provides immediate logout/recovery revocation. Confirmation and recovery mail
settings remain unchanged. The magic-link template includes both the numeric OTP
and the existing sign-in link, and must be deployed before changing its Auth URL.

## Prepare and activate on the reviewed host

Copy this directory's generator, rollout script, plugin directory and monitor
files together into a root-private rollout directory. `prepare` checks the actual
running image with the existing renderer in a networkless container, validates
Caddy with both existing environment files, and records original/candidate hashes.
It does not reload Caddy, recreate a service, contact SMTP or print secrets.

```sh
sudo python3 apply-auth-budgets.py prepare --state-dir /srv/beanlog/security-rollout-20260909/auth-budgets
```

Deploy the application/template, current-session migrations and API secret first.
After the coordinated API checks, apply that exact candidate:

```sh
sudo python3 apply-auth-budgets.py apply --state-dir /srv/beanlog/security-rollout-20260909/auth-budgets
```

Only Caddy, Kong and Auth are reloaded/recreated. The existing base, override,
client-IP and security Compose files are all preserved. Changed source hashes
abort activation. A service/configuration failure restores the four original
files and recreates Kong/Auth using the previous settings. Root-private originals
remain available; no database, volume, network or secret is deleted.

Do not rerun the older client-IP provisioning tool after activation: it represents
the original web-only trust and would remove this overlay's additional settings.
Use the complete current overlay for future Kong/Auth recreation.

## Checks and local alerts

`python3 -B scripts/test-auth-client-ip.py` uses isolated real Caddy/Kong containers
and the actual Next forwarding helper. It verifies separate IP buckets, forged
address/identity rejection, independent password/refresh/signup/recovery/OTP
budgets, public admin denial, admin cleanup capacity, aggregate IP exhaustion,
second-client availability, and fixed-address preservation after recreation.
No ports are published and no production load is generated.

`python3 -B ops/production/test_auth_budgets.py` checks candidate scope, trust,
expiry-only environment edits, and monitor thresholds. Run the normal app/security
checks as well. Production verification uses ordinary requests and disposable
local-test accounts; no burst test or outgoing email is necessary.

The plugin emits credential-free `beanmap_auth_budget` warnings on the first
rejection and every50subsequent denials in a window. The installed one-minute
monitor fails its local systemd service on shared-capacity/counter failures or
at least6warning events in each of two consecutive minutes. Recovery is logged.
It sends no external messages. Inspect:

```sh
systemctl status beanmap-auth-budget-monitor.service beanmap-auth-budget-monitor.timer
journalctl -u beanmap-auth-budget-monitor.service --since '10 minutes ago'
```

A failed monitor means inspect the reported scope and Auth/Kong health. Preserve
per-client limits while investigating; increasing the shared ceiling blindly can
move the outage into Auth or the database.
