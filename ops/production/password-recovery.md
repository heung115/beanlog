# Password recovery authorization

The reset page and password-update action require an opaque 256-bit HttpOnly cookie
with a matching server-side proof. The callback issues it only after Auth verifies
the exact returned access token and either its recent `recovery` AMR claim (PKCE)
or a successful `verifyOtp({ type: "recovery", token_hash })` response. Local integration against pinned Auth `v2.192.0` confirmed that recovery OTP
sessions carry AMR `otp`; this version also accepts a fresh magic-link email token
through typed recovery verification. This branch therefore accepts recent verified
email possession as reauthentication, not a strict recovery-only token category.
The email token remains one-time; an arbitrary active user session is insufficient.
The authoritative typed verification response is the evidence for this branch. URL `mode`,
`type`, `next`, and the Supabase JS `redirectType` are never authorization evidence.
Both the PKCE code callback and `verifyOtp({ type: "recovery", token_hash })` remain
supported. Normal OAuth redirects continue without issuing recovery proofs.

The proof binds the verified user ID and Auth session ID, expires after ten minutes,
and is consumed before the password update. An exclusive file creation lets only
one concurrent request consume it; replaying the original cookie cannot reset again.
If an attempted update fails, the form explains the error and links to a fresh
recovery email. Form validation errors do not consume the proof.

Proof records live in the web container's private `/tmp/beanmap-recovery-<uid>`
directory (0700; files 0600). They contain IDs and expiry, never access tokens,
refresh tokens, email addresses, or passwords. Issuance removes files older than
ten minutes and rejects capacity when 2048 active records/markers are observed.
The production tmpfs already has a 64 MiB hard limit. Do not expose, back up, or
share this directory with other applications. Container replacement loses pending
proofs and safely requires a fresh recovery link. Multiple workers in one container
share proofs; multiple web replicas require a shared atomic proof store before
scaling. Missing storage or unsupported/missing recovery claims deny the reset.

## Auth boundary

The application proof must be deployed together with the [public Auth update
boundary](public-auth-updates.md). Once that Caddy policy is applied, public
PUT/PATCH calls to Auth are rejected before the gateway, including encoded and
traversal variants. Only canonical PostgREST table updates remain available to
public PUT/PATCH callers. The password action uses the private internal Auth
gateway, after proof validation. Existing OAuth, login, logout and recovery
GET/POST requests continue through the public endpoint.

Until Caddy is applied, a stolen bearer token can still bypass the app by calling
public Auth directly. Keep the Auth secure password-change setting as defense in
depth, but it alone permits sessions created within the last 24 hours. A compromised
web/API/Kong container with internal access remains outside the public Caddy
boundary. Do not claim that this protects against container code execution.

Local integration against Auth `v2.192.0` exercised disposable email recovery
end to end. Repeat this against any different production Auth version before
deployment. Unit tests cover callback proof issuance, rejection of
normal-code callbacks forged as recovery, exact-token identity failures, binding,
expiry, concurrent consume and cookie replay; they do not replace that integration
check.

Local browser coverage verifies Korean/English token-hash and emailed PKCE reset
completion, actual AMR/session-ID shape, ordinary-session page/action rejection,
consumed-proof replay, same-password failure guidance, and fresh email
reauthentication with email-token replay rejection.

Upstream references inspected for the implementation:

- [Auth PKCE exchange uses its stored authentication method](https://github.com/supabase/auth/blob/v2.186.0/internal/api/token.go)
- [Auth recovery authentication method](https://github.com/supabase/auth/blob/v2.186.0/internal/models/factor.go)
- [Auth session AMR claims and timestamps](https://github.com/supabase/auth/blob/v2.186.0/internal/models/sessions.go)
- Installed `@supabase/auth-js` `GoTrueClient._exchangeCodeForSession` derives
  `redirectType` from browser storage; that SDK hint is intentionally ignored.
