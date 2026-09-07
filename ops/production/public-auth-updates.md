# Public Auth account-update boundary

Apply and verify this gateway policy together with the application change; editing
the repository alone does not activate it. Application recovery proofs alone do not protect a public Supabase Auth
`PUT /auth/v1/user` call. Secure password change also accepts sessions created
within the last 24 hours, so the public gateway must enforce this boundary.

## Allowed traffic and assumptions

The public API handle imports `beanmap_public_auth_updates` before forwarding to
Kong. PUT/PATCH is denied by default with HTTP 405. Only a literal canonical
`/rest/v1/<table>` URI (optionally followed by a query string) is accepted for these
methods. The allowed table name contains ASCII letters, digits and underscores,
starting with a letter or underscore. URI matching occurs before any rewrite,
using the full raw URI rather than a decoded path. Encoded separators, encoded
letters, dot segments, double slashes, and nested paths do not gain an exception.

This keeps the existing PostgREST profile PATCH path working while rejecting all
public Auth account updates, including password, email and metadata. The app has
no supported third-party public account-update client. Future email/metadata UI
must use a server action with appropriate authorization and recent identity proof.
Storage/functions PUT/PATCH is also rejected; adding a feature using these methods
requires a separate narrowly scoped exception and normalization review.

GET/POST/OPTIONS remain unchanged, including login, OAuth authorize/callback,
recovery email, OTP/code exchange, current-user lookup, logout and CORS preflight.
REST authentication, RLS and grants continue to apply to allowed table updates.

`createClient()` must use the existing internal `SUPABASE_SERVER_URL` (the
`beanmap-auth-gateway` service), rather than falling back to the public URL, for
password updates. The proof-validated server action is then permitted to call
Auth internally. The internal gateway is not publicly published. The public
Caddy policy does not protect against compromised web/API/Kong code that can
reach internal Auth. Keep container separation and Auth reauthentication enabled.

## Apply and verify

1. Deploy the application recovery-proof change and verify its internal Auth URL.
   Stage a disposable account recovery against the pinned Auth image. Ordinary
   sessions must not pass the application action; a fresh recovery link must.
2. Install `ops/production/beanmap-public-auth-updates.Caddyfile` as root-owned
   0644 `/etc/caddy/beanmap-public-auth-updates.Caddyfile`.
3. Generate a separate configuration candidate from the current host Caddyfile:

   ```sh
   sudo python3 ops/production/prepare-auth-update-caddy.py /etc/caddy/Caddyfile --output /etc/caddy/Caddyfile.auth-update-candidate
   ```

   The generator preserves provenance headers, private-route rejection and error
   handling. It refuses ambiguous routes, duplicate upstreams and public path
   rewrites. It does not overwrite the source or an existing candidate. Do not
   replace production configuration with the repository's example Caddyfile.
4. Validate the candidate with the existing Caddy service environment, including
   its private EnvironmentFile, as described in `README.md`. Keep a root-readable
   backup, install the validated candidate preserving the live file's ownership
   and permissions, then reload Caddy through systemd. Do not print adapted
   configuration or secret environment values.
5. Using a disposable account, verify public Auth PUT/PATCH returns 405 even with
   a valid fresh bearer token, and no password changes. Verify ordinary login,
   OAuth, recovery, profile edits and the authorized password-reset flow still
   work. The proof action must reach internal Auth. Confirm no alternative public
   listener or gateway route bypasses the Caddy policy.

`bash scripts/test-infra-caddy.sh` runs a disposable local pinned Caddy container
against a dummy upstream that accepts every request. The tests send raw encoded,
double-slash and traversal request targets with a bearer token and ensure rejected
requests never reach the dummy gateway. Positive cases cover OAuth/login/recovery,
REST PATCH/PUT and the internal password-update path. They do not change real
accounts or exercise the production Auth service.

If rollback removes this policy, direct public Auth changes become reachable
again; record that the public stolen-session boundary is open until repaired.
Do not disable the recovery-proof check as a rollback workaround.
