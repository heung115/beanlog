# New-password policy

Registration and password recovery use the same asynchronous local policy in the
browser and server action. Direct signup also calls it before making an Auth
request. Existing password login deliberately retains its previous validation;
this policy does not force a change or prevent legacy accounts from signing in.

- Minimum: 15 Unicode code points.
- Maximum: 72 UTF-8 bytes, the actual bcrypt input ceiling enforced by the deployed
  Supabase Auth v2.195.0. ASCII passphrases of 64–72 characters work. Unicode, spaces,
  password managers and paste are accepted within the byte ceiling.
- Exact original credentials reach Auth: no trimming, truncation, normalization or
  client-side password hashing is used for authentication.
- For blocklist comparison only, the complete value is NFKC-normalized and lowercased
  then SHA-256 hashed locally with Web Crypto. No password or hash is sent to a breach
  service. Repeated single-character values are rejected as well.
- The finite local list is not a guarantee against every compromised password.

## Public corpus and reproduction

Source: [SecLists, xato top one million](https://github.com/danielmiessler/SecLists/blob/12c08d06d170452a276b4cbd9ddf32f92fa15637/Passwords/Common-Credentials/xato-net-10-million-passwords-1000000.txt),
revision `12c08d06d170452a276b4cbd9ddf32f92fa15637`, retrieved 2026-09-09.
The upstream [MIT license](https://github.com/danielmiessler/SecLists/blob/12c08d06d170452a276b4cbd9ddf32f92fa15637/LICENSE)
is preserved in `licenses/SecLists-MIT.txt` (copyright Daniel Miessler).

The original file SHA-256 is
`424a3e03a17df0a2bc2b3ca749d81b04e79d59cb7aeec8876a5a3f308d0caf51`.
Only complete values within the new minimum/byte maximum are retained: shorter
values already fail the length check. Four public example/trivial values supplement
the source. The result contains 10,900 distinct digests. Plaintext corpus values,
including strings resembling contact details, are not republished in the artifact.

To reproduce, obtain that exact public source outside the repository, then run:

```sh
node scripts/build-password-blocklist.mjs PATH_TO_PINNED_PUBLIC_CORPUS
```

The generator checks the source checksum before writing and performs no network
requests. A corpus update requires reviewing its license, revision, checksum and
regression results; the build never downloads a moving list.

## Identity-service enforcement and limitation

Official deployed-version sources:
[password validation](https://github.com/supabase/auth/blob/v2.195.0/internal/api/password.go),
[configuration](https://github.com/supabase/auth/blob/v2.195.0/internal/conf/configuration.go),
[hash generation](https://github.com/supabase/auth/blob/v2.195.0/internal/crypto/password.go).
`GOTRUE_PASSWORD_MIN_LENGTH=15` is supported. Its check counts bytes, so the application
also counts Unicode code points. Public direct signup and user-update boundaries
must remain closed; otherwise direct Auth could bypass the local blocklist and
Unicode minimum. The native setting is defense in depth, not an unsupported hook
or a replacement for the application gate. Do not enable remote HIBP checks for this
local-only policy.

The current Auth version cannot support a uniform 64-character Unicode maximum or
128 ASCII characters. That platform limitation remains explicitly unresolved.
Changing hashing or upgrading Auth requires separate compatibility testing; existing
bcrypt hashes and login behavior are preserved in this change.
