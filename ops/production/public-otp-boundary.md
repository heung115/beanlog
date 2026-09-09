# Controlled Auth grants and email issuance

Public `POST /auth/v1/otp` can disclose whether an email address exists: with
`create_user:false`, Auth responds differently for existing and missing users.
Beanmap does not expose a public passwordless email-login flow. Its supported OTP
use is authenticated account deletion, handled by the Go API over its direct
internal Auth connection.

The legacy `/magiclink` route also creates email OTPs and is unused by the app;
it shares this server-only boundary to prevent an alternate ingress.

Password recovery and resend are separate enumeration cases. Two native
`/recover` requests disclose the existing-address cooldown (`200,429`) while an
absent address still receives `200,200`. `/resend` has the same distinction for an
**unconfirmed** existing account. A confirmed-account probe does not cover that
state. Public `/recover` and `/resend` are therefore blocked as well.

The controlled Auth Caddy snippet returns an empty 404 for public `/otp`,
`/magiclink`, `/recover`, and `/resend` requests
before Auth receives the email. The existing raw-URI allowlist rejects encoded,
duplicate-slash, and traversal spellings. Kong separately rejects OTP, magic-link,
resend and child paths after conservative normalization, including OPTIONS; these
have no trusted-IP or request-header override. Forged source or deletion-identity
headers cannot enable them. Recovery and signup instead require the existing
fixed Next socket peer and verified client-IP header.

The Go account-deletion handler continues using `AUTH_URL=http://supabase-auth:9999`
and `/otp` directly. It verifies the caller's Auth user and current session, uses
the user's actual confirmed email, reserves the per-account send/attempt budget
before the remote call, and derives a private rate identity from the verified
subject. The public gateway change does not change that handler, its limits, or
its internal `/verify` and fresh-session checks. Signup assertions and all other
gateway budgets remain in effect. The existing Next password-reset action uses
the internal Kong URL and actual trusted fetch helper. It maps per-address
throttles to the same `sent` result, preserving its safe recovery callback and
10/minute IP budget. Refresh, OAuth and logout retain their existing routes.
No application code invokes `/resend`.

## Password grant timing boundary

Direct Auth password grants perform password verification for a known address
but return earlier for an unknown address. The public token route now accepts
only the exact single query `grant_type=refresh_token`, POST JSON (or its OPTIONS
preflight). All other grants are available only through the verified Next socket
peer and client-IP proof. Existing `signInWithPassword`, `exchangeCodeForSession`
and `refreshSession` calls use the standard password, pkce and refresh_token
queries; the first two remain on the private server route. The application login
timing normalization is a separate coordinated application change.

The JSON restriction is part of the security boundary. [Auth v2.195.0 Token](https://github.com/supabase/auth/blob/v2.195.0/internal/api/token.go#L37)
selects its handler with `r.FormValue("grant_type")`; an URL-encoded or multipart
body can take precedence over the URL query. Checking only a refresh query would
therefore allow a body override. Caddy and Kong both reject non-JSON public token
requests and ambiguous, duplicate, encoded or additional query keys. Canonical
public refresh remains available. The verified server peer retains password and
PKCE access without trusting arbitrary public forwarding headers.

## Verification

`scripts/test-auth-client-ip.py` runs real Caddy and Kong with no published host
ports. The OTP regression compares existing/absent request status, empty body, and
all stable response headers (HTTP Date is excluded because it changes with time).
Each endpoint is requested twice per address to cover cooldown distinctions.
It also checks encoded/traversal/subpath forms, forged forwarding headers,
preflight rejection, independent client/operation limits, admin availability,
and the trusted web IP after recreation. Recovery through the actual Next fetch
helper and fixed web peer has 10 successes followed by a rate-limit response.
Run the existing fixture and the
production-version variant:

```sh
python3 -B scripts/test-auth-client-ip.py
BEANMAP_TEST_KONG_IMAGE=kong/kong:3.9.3 python3 -B scripts/test-auth-client-ip.py
python3 -B ops/production/test_otp_boundary.py
```

`scripts/test-internal-auth-otp.py` exercises real Auth against an isolated
PostgreSQL and Mailpit with generated fixtures, without delivering external mail.
Its real existing account and absent email receive the same public refusal, while
the direct internal request sends one code and verification succeeds. No token,
code, password, real email address, or response object is included in its report.
The resend fixture uses an unconfirmed account. Internal recovery still delivers
its code to Mailpit and verifies it for the same subject. Next password-reset
action tests cover 429 normalization and callback construction.
The gateway fixture separately checks wrong-existing and absent password grants,
query and form-body overrides, canonical public refresh, and internal password and
PKCE calls. Real Auth also verifies a public refresh of the synthetic account.
Existing Go account-deletion handler tests also cover verified subject binding,
the outgoing private header, and attempt reservations.

## Coordinated production application

Rebase this change onto current main and stage those exact reviewed source files
into a fresh root-private directory. This ingress change does not depend on the
runtime image patch version, but must not run concurrently with another rollout.
Do not reuse an earlier Compose overlay or replace the app/API image.

`apply-otp-boundary.py prepare --state-dir <new-private-path>` reads the current
live configuration and pins its hashes. It requires the reviewed previous
snippet/handler, direct internal Go Auth URL, and verified Next internal Kong URL.
It validates the candidate
with current Caddy and the current Kong image. Candidate validation uses the live
Kong declaration; it never rewrites Compose files, image pins, keys, or the
declaration.

After the coordinated GO,
`apply-otp-boundary.py apply --state-dir <prepared-private-path>` verifies the
hashes again, installs only the Caddy snippet and Kong plugin handler, reloads
Caddy, and restarts the same Kong container. Its immutable image ID, container
configuration, and unrelated file hashes must remain unchanged. A failure restores
the two original files and reloads the existing services. Backups remain private.

Complete with a small number of ordinary health/negative checks, then rerun the
existing disposable-account enumeration probe against the newly blocked path.
Require identical 404 status/stable headers/empty body for existing and absent
emails. Verify that no email was sent and clean up the synthetic account. Do not
run production request bursts or send codes to real users.
