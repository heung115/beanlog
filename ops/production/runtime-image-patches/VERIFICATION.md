# Runtime patch verification — 2026-09-09

## Database contracts already deployed

Application revision `23ffb09f23ca025f1159d02d16f9ca0641304f18` contains migrations
00034 and 00035 from PR #8. A fresh disposable production account's four direct
PostgREST create requests (31 tags, 21 components, weight 0, sort order -1) all
returned 403 / SQLSTATE 42501. The account was deleted; no email was sent or
existing user modified. These requests verify revoked public RPC execution, not
the inner validator, which the public requests cannot reach.

Read-only production checks confirmed inclusive boundaries of 30 tags, 20
components, weight 1 and sort order 0. A restored offline database passed actual
create/update/direct-writer constraint tests and both DDL owners' future-table,
identity-sequence and explicit-sequence permission canaries. Application roles
received no default grants, even before enabling RLS. Existing scalar constraints
are NOT VALID to avoid rewriting historical data, but enforce subsequent writes;
the aggregate check found no existing violation of these four bounds.

## PostgreSQL candidate

- Base: `sha256:c61e973bda4604a04677fa7aeacc49928d5e0a5ef0eb66c9ca426723b3ae6bf3`.
- Candidate: `sha256:50c0b1bc0d0650eeea6c8fdf6b40ce7ac143e9c4457b3ca91499c7dc07882144`.
- Only Alpine curl/libcurl changed from 8.20.0-r0 to **8.22.0-r0**; the official
  [Alpine stable package](https://pkgs.alpinelinux.org/package/v3.23/main/aarch64/curl)
  is pinned and authenticated by APK package signatures.
- All 20,063 files under the existing Nix store have identical hashes. PostgreSQL
  remains 17.11; Supabase extensions and their separate Nix library dependencies
  remain unchanged. In particular, this is not an upgrade of pg_net's Nix libcurl.
- A fresh production snapshot restored into an isolated, network-disabled
  candidate database matched all 64 table fingerprints, sequences and roles.
  Restoring the same snapshot with the old image produced identical schema/RLS/ACL
  output. The deployed function ACL checker and synthetic Vault roundtrip passed.
- Both temporary databases, four volumes and plaintext snapshot files were
  removed. The measured 29.789 seconds covers this local validation, not a full
  service recovery-time objective.
- Trivy 0.74.0 with the audit's still-valid database reported **0 fixed-available
  High/Critical** package findings in the candidate. This does not mean all
  severities, unfixed advisories or unindexed Nix dependencies have no findings.

The container replacements and their post-deployment checks are recorded
separately from candidate results. Production uses reviewed immutable IDs and the
image-only rollout procedure in [README.md](README.md).

## PostgREST candidate

- Base: `sha256:9cdfdf899e1c1be1a78a5ca5912568ea143344e3d503f4ca0b3aec39e8bc776e`.
- Candidate: `sha256:6ff5557cc4f235639ab4d5227e3db429547de37fa7e481f098e306e1f8f1f036`.
- Removed 39 compiler/development/header packages. PostgREST 14.12 and all 20 executable/linked-library file hashes remain identical, as do all retained package versions.
- A disposable internal-network PostgreSQL 17.11 fixture passed TLS-required connection (confirmed using pg_stat_ssl), schema read and insert/update/delete under nonroot/read-only/cap-drop restrictions. This does not reproduce the production CA trust chain.
- Same Trivy database: Critical/High 5/156 → 0/0; every original Critical/High finding belonged to unused linux-libc-dev headers. Medium 94 remain. This is removal of build-only packages, not a host-kernel upgrade.
- Verification cleanup uses per-run UUIDs, ownership labels and immutable IDs recorded only after successful creation. A separate sentinel container survived the cleanup regression. No production network, data volume or published port was used.

## Private Meta and Studio candidates

- Meta base `sha256:855f489860828f8cdb6f4110a467d2670ba5a2cec1ef7d2c5b7f7fcd93601b0b`
  → candidate `sha256:a00bb79d9de0e98323c4ac822cdfc741d8e8911753ca7b80a338228458d4ab0f`.
  The same Meta v0.96.6 service uses a separately locked Fastify 5.12.3 and
  find-my-way 9.9.0 dependency graph, compatible CORS/Swagger/metrics plugins,
  and the Fastify 5 loggerInstance startup option. Both application route trees
  initialize, malformed-content-type validation and prototype-method checks pass,
  and a disposable PostgreSQL fixture passed 19 management HTTP assertions.
- Studio base `sha256:fbd09e43b4928bb4b3368808d2baa26ef7183dc4345b04c5ffe1e5a779927c42`
  → candidate `sha256:a567424f246a1d610a5e01c3624dacc55a7d951a59f07e22216d96aa23d1f8b8`.
  Next's actual Sharp resolution now reaches 0.35.4 / libvips 8.18.6. Obsolete
  native Sharp packages and 17 build-only packages were removed. Six image-format
  decode/resize/encode probes and the image-optimizer module load passed.
- Trivy fixed-available High/Critical findings in both final merged root
  filesystems: 0. Image-layer analysis still reported replaced package paths;
  these were checked against actual module resolution and the merged rootfs.
  Do not describe this as zero findings across every scanner mode or severity.
- Studio's bundled Next package remains 16.2.11. Its later AVIF advisory's native
  dependency is patched through Sharp; the separate Windows precondition is
  absent on this Linux image. A future supported Studio/Next release upgrade
  remains distinct from this narrowly scoped native-library replacement.
