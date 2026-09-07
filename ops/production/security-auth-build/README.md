# Auth dependency rebuild — 2026-09-07

Candidate: `beanlog-auth:v2.195.0-go1.26.6-p3`. This preserves Auth v2.195.0,
its existing migrations, Alpine runtime and non-root user. Only the Auth executable
is replaced. The Dockerfile pins the existing p1 image's local immutable ID.
Image ID: `sha256:09d3dfe25eb2c08a467605af397f8b2edb0d5505634468eba55d186308f9743a`
The 18-check isolated PostgreSQL17.11 runtime/recovery rehearsal passed.
Production activation remains coordinated separately.

Build source: `/srv/beanlog/vendor/auth-v2.195.0`, copied to
`/private/tmp/beanmap-auth-security-p2` on the operator Mac. Full source archive:
`/srv/beanlog/security-auth-20260907/auth-source-p3.tar.gz`.
Source archive SHA-256:
`84cdb61aee225bfabb9a9207de3d17423b3c97a25f53fdf241967502b6c970be`.
The checked-in `auth.go.mod` and `auth.go.sum` record the final resolved graph.

Official dependency updates:

- `golang.org/x/crypto` 0.53.0 → 0.56.0 (including the audit's 0.55.0 minimum).
- `github.com/go-chi/chi/v5` 5.2.4 → 5.3.0.
- `google.golang.org/grpc` 1.82.1 → 1.83.1 (CVE-2026-84304 HTTP/2 fragment memory exhaustion).
- Required Go submodules: x/net 0.57.0, x/sync 0.22.0, x/sys 0.47.0, x/text 0.41.0.
- Go compiler remains 1.26.6; the dependency graph's minimum Go version becomes 1.26.0.

From the source directory, replace `go.mod` / `go.sum` with these recorded files:

```sh
GOTOOLCHAIN=go1.26.6 CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build \
  -trimpath -ldflags '-s -w -X github.com/supabase/auth/internal/utilities.Version=v2.195.0' \
  -o auth-security-p3 .
```

Binary SHA-256:
`3d20a1dbff80dafd3e36932a999c25725f00fbc1dbacac8bdcc62b78bc199b39`.
Build the candidate Dockerfile beside that executable. The image inherits a
non-root runtime user; the executable is owned by root and mode 0755.

## Verification and residual findings

- Latest Trivy database (updated 2026-09-07 07:11 UTC) reports zero **fixed**
  Critical/High findings in the final p3 image. This excludes unfixed findings and
  is not a claim that every vulnerability is absent.
- Candidate `auth --help` and `auth version` pass with network disabled, read-only
  filesystem, all capabilities removed, no-new-privileges, noexec/nosuid /tmp tmpfs,
  512 MiB memory, 128 PID and one CPU limit. Version output is v2.195.0.
- Auth crypto, security/PKCE, configuration, and rate-limit package tests pass.
- Full runtime rehearsal against the verified PostgreSQL17.11 production clone
  passed all 18 checks recorded in `rehearsal-results.json`: constrained startup,
  disabled phone auth, login/refresh rotation, old-session reauthentication guard,
  admin-generated recovery with no outbound mail, email OTP attestation, one-time
  token rejection, password replacement, 30-day timebox, and seven-day inactivity.
  Disposable users were deleted; the candidate container, internal network and
  temporary credentials file were removed. Clone returned to network `none`.
- Token package tests require a disposable PostgreSQL fixture and did not pass on
  the Mac because localhost:5432 had no test database. They were not run on live data. The separate runtime rehearsal above verifies
  the relevant login, refresh, recovery, and expiration behavior end to end.
- Production-root `govulncheck -show verbose .` reports two remaining symbol
  findings: GO-2026-5004 (`pgx/v4` 4.18.2) and GO-2026-4518 (`pgproto3/v2` 2.3.3).
  It reports zero other imported-package findings and one module-only OpenPGP
  advisory, GO-2026-5932, in an unused package with no fixed version.
- The pgx vulnerability requires the non-default simple protocol and a
  dollar-quoted query containing attacker-controlled placeholder substitutions.
  The audit found default protocol configuration and no such Auth query.
- The pgproto vulnerability requires a malicious/compromised database peer. The
  production-root scan conservatively finds a driver trace, so it must not be
  described as test-only or fully eliminated. Private network restrictions and
  the trusted PostgreSQL endpoint mitigate this precondition.
- Neither legacy driver module has a compatible patched release according to the
  Go advisory database. Replacing their major versions or maintaining a parser
  fork is a separate Auth dependency migration; this candidate does not claim to
  resolve those advisories.
- API `server/go.mod` also advances x/crypto to 0.56.0 and x/text to 0.41.0.
  API `go test ./...` passes. Its `govulncheck ./...` reports zero symbol/imported
  package findings and only the unused OpenPGP module advisory.

Sources: [SSH source-address](https://pkg.go.dev/vuln/GO-2026-6303),
[SSH established-channel DoS](https://pkg.go.dev/vuln/GO-2026-6355),
[SSH undecided-channel DoS](https://pkg.go.dev/vuln/GO-2026-6354),
[Chi RealIP](https://pkg.go.dev/vuln/GO-2026-5777),
[pgx dollar-quote sanitizer](https://pkg.go.dev/vuln/GO-2026-5004),
[pgproto parser](https://pkg.go.dev/vuln/GO-2026-4518).
