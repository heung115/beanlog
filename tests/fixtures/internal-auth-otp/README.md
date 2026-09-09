# Real internal Auth OTP compatibility fixture

Run from the repository root against a Docker daemon that already has the selected images:

```sh
python3 scripts/test-internal-auth-otp.py \
  --auth-image beanlog-auth:v2.195.0-go1.26.6-p3 \
  --postgres-image postgres:17-alpine
```

All selectors are resolved to immutable local image IDs before creating resources. No images are pulled or built. The runner creates a UUID-labelled internal Docker network, memory-backed PostgreSQL, Auth, Mailpit, a local mail-template server/client and Caddy using the repository's actual controlled-signup snippet. There are no published ports or production network/volume connections. Each container has CPU, memory and process limits. Only successful created immutable IDs with matching owner labels are removed; the runner removes its containers and network even on assertion failure. Credentials are generated at runtime, passed through private temporary files/stdin and never printed. All recipients use `local.test`.

The regression creates synthetic confirmed and unconfirmed accounts through the admin API without sending mail, and verifies that a separate address has no account. It checks identical public `/otp` and `/magiclink` denial for confirmed and absent accounts. It also checks two successive `/recover` requests per confirmed/absent address and two successive `/resend` requests per unconfirmed/absent address. These denial responses must be 404 with an empty body and equal stable headers. It also checks two public wrong-password grants each for the confirmed and absent addresses, rejects a form-body password grant overriding a canonical refresh query, and validates that a real refresh token still succeeds through the canonical public JSON refresh route for the same subject. None of the public boundary or refresh requests may deliver mail.

It then exercises the contract used by `server/handlers/account_deletion.go`: exact authenticated `/user`, internal `/otp` with `create_user:false`, delivery to the verified email, `/verify` returning a fresh session for the same subject, and local logout retaining the original session. Direct internal `/recover` must deliver a recovery code to the synthetic account; `/verify` with type `recovery` must accept that code for the expected subject. Logging out the temporary recovery session must retain the original session.

The fixture does not delete application data or change a password. The separate gateway fixture covers the actual Next trusted-fetch helper and Kong peer/header gate for recovery. The separate Go `TestAccountDeletion*` tests cover trusted subject-derived rate headers, verified email selection, persistent attempt reservation and completion handling.

The final bounded probes inspect direct internal legacy `/magiclink` and `/resend` behavior using separate synthetic absent addresses. They report only projected statuses and account/mail booleans. On Auth v2.195.0 security-p3, `/magiclink` accepted `create_user:false` but created an absent account and sent mail, confirming why this unused public signup alias must share the public denial boundary. This is a standalone Auth database without the production consent trigger; it does not prove that production would successfully create the account. `/resend` returned 200 for both a confirmed account and an absent address without creating or mailing the absent account. That diagnostic is limited to the confirmed-account case; it does not establish safety for unconfirmed accounts. The public regression therefore separately covers unconfirmed accounts, where native resend throttling can reveal account existence.

The fixture does not establish production deployment state or sustained-load behavior. The operator is responsible for separately cleaning any image archives or images they temporarily imported to make the selected images available.
