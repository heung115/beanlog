# Controlled email registration and versioned consent

Public `/auth/v1/signup` requests are denied at Caddy before route normalization.
Only canonical Auth/PostgREST paths used by the application remain public;
unused Storage, Realtime, Functions and GraphQL paths are no longer forwarded.
Kong additionally checks the actual socket peer against the reserved web address
before accepting signup, regardless of a forged forwarded-IP header.

The signup action checks the shared password policy and explicit terms acceptance.
It then requires the existing Caddy ingress proof and signs an assertion containing
the normalized email, both current legal document versions, server timestamp,
256-bit nonce and fixed signup source/path. The Auth users insert trigger verifies
the HMAC, version and freshness, stores the event in the same transaction, and removes
the assertion from user metadata. Editing user metadata cannot create consent.
A deferred foreign key binds the event to the successful Auth insert; rollback
removes both. The event is immutable and is erased when the account is deleted.

The signing key is a separate 32-byte random value stored as lowercase hex64 in
`SIGNUP_CONSENT_SECRET_FILE`, mounted read-only for web UID1001. Its decoded bytes
must equal the single root-provisioned row in
`beanmap_signup.signing_key(id=true, secret bytea)`. The schema, key, events and
trigger helpers have no public/anon/authenticated/service-role access. Neither
migration nor source code includes a production key.

`controlledSignup` uses a stateless, time-bounded Auth request. It does not return
Auth user objects, identity lists, status differences, cookies or session values.
Processed new, duplicate, rejected and interrupted requests have the same success
shape and a 3–3.25 second response floor, while the upstream request has a
2.5 second deadline. This reduces the previous direct account-enumeration signal;
it does not claim that every network or external email side channel is eliminated.
Delivery failures should be investigated through the existing Auth health/logs.

## Existing accounts and OAuth consent

No past consent is fabricated. Existing accounts keep their current state.
Privileged SQL provisioning by the actual `postgres` or `supabase_admin` session
is an operator boundary and does not claim accepted terms. The running Auth database
connection must use its dedicated `supabase_auth_admin` session user; using a
superuser for Auth would bypass this trigger boundary and must fail rollout review.
Auth administrator API account creation still requires a valid assertion.
Disposable account fixtures sign an explicit synthetic acceptance assertion.

New Google/Kakao accounts are marked pending inside the Auth insert transaction.
The existing session function keeps its OID and adds a pending-account check, so
both application API transactions and restrictive RLS deny their data access.
Auth authentication/logout remain usable. Existing accounts are not backfilled.

The checked OAuth action creates a short-lived HttpOnly, signed preconsent cookie
bound to the requested provider and the exact PKCE verifier cookie. The verified
code callback consumes it, verifies the actual Auth user and original session,
and signs a separate OAuth completion assertion. A missing, expired, forged or
mismatched proof sends the new user to a short explicit terms-checkbox page.
That page verifies the Auth session before signing acceptance. Neither flow
trusts a caller-provided user ID or session ID.

The only pending-account data exception is authenticated
`complete_oauth_consent(jsonb)`: it validates the original current session and a
purpose-separated HMAC bound to user, session, provider, versions, time and nonce.
The public request body is capped at4KB, the SQL argument at2KB, its lock wait at
one second, and the app request has a3.5-second deadline. A fixed per-account
10-minute budget allows10 attempts across session rotation. Verification failures
return false so the transaction commits the consumed attempt. Success inserts
one immutable event and removes pending state atomically. A consumed nonce cannot
complete a different account; retries after completion are idempotent and never
rewrite the event. The original session helper remains private.

## Coordinated activation

Provision the matching web/DB key, migrations00036/00037 and reviewed application first.
Keep the actual Auth database identity non-superuser. Existing minimal staging
must run through the loopback Caddy ingress so the production proof check remains
active; there is no production-bypassing QA branch in the signup code.

`apply-signup-boundary.py prepare --state-dir <new-private-directory>` prepares
Caddy/Kong/Compose/plugin candidates from the installed files and validates Caddy
and the real Kong image/renderer without changing a running service.
`apply` checks original/candidate hashes, migration/key readiness and the web secret
mount, reloads Caddy and recreates only Kong/Auth using all four current Compose
files. It sets Auth's supported password minimum to15, preserving other settings.
Failure restores the prior gateway configuration. Do not activate while the user
has requested source-only work.

Verification consists of the signup-consent Node tests, the disposable
`test-signup-consent.sql` and `test-oauth-consent.sql`, purpose-separated proof tests, candidate tests, and real local Caddy/Kong regression.
The gateway fixture checks canonical/encoded signup denial, forged-source denial,
normal internal signup, preserved refresh/Next recovery/direct internal OTP, independent rate budgets,
and absence of global-capacity consumption by already-blocked requests.
