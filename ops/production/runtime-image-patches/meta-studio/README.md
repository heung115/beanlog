# Meta / Studio runtime patch candidates — 2026-09-09

Candidates only; no production services or Compose definitions were changed.

| Image | Locked base image ID | Candidate image ID |
|---|---|---|
| Meta v0.96.6 | `sha256:855f489860828f8cdb6f4110a467d2670ba5a2cec1ef7d2c5b7f7fcd93601b0b` | `sha256:a00bb79d9de0e98323c4ac822cdfc741d8e8911753ca7b80a338228458d4ab0f` |
| Studio 2026.08.03 | `sha256:fbd09e43b4928bb4b3368808d2baa26ef7183dc4345b04c5ffe1e5a779927c42` | `sha256:a567424f246a1d610a5e01c3624dacc55a7d951a59f07e22216d96aa23d1f8b8` |

Tags are `beanmap-postgres-meta:v0.96.6-security-p4` and `beanmap-studio:2026.08.03-security-p4`. Dockerfiles pin the actual local base image IDs, not mutable tags. These IDs refer to previously hardened custom images already on the deployment host. The official dependency-builder image is also pinned by digest. npm lockfiles preserve exact public package versions and integrity checksums. Dependency-fetching stages require network; final overlay stages were built with network disabled.

## Changes

Meta keeps its application release and Node 20.20.2, upgrading Fastify 4.29.1 → 5.12.3 and find-my-way 8.2.2 → 9.9.0. Compatible plugin versions are @fastify/cors 11.3.0, @fastify/swagger 9.8.1 and fastify-metrics 12.1.0; pino 9.14.0 is pinned across the new graph. The two existing custom logger call sites use Fastify 5's `loggerInstance`. No API schemas or DB logic were changed. Package links resolve to the complete locked dependency graph in `/opt/beanmap-meta-runtime`, avoiding accidental fallback to older transitive dependencies.

Studio keeps compiled Next 16.2.11 and Node 22.23.2. The Sharp resolved by the actual Next module upgrades from 0.34.5 → 0.35.4; its native libvips is 8.18.6 and libheif is 1.23.2. The obsolete `@img/sharp-*` native package directories are removed. Existing pnpm links retain their old path anchor but resolve to `/opt/beanmap-studio-runtime/node_modules/sharp`. This is not merely a top-level package installation: the test resolves Sharp through the production Next module.

Studio's 17 installed build/development packages, including linux-libc-dev and compiler headers, are explicitly purged. No autoremove is used; existing runtime libraries are preserved. Kernel header findings represented inactive build headers, not the running host kernel. Meta had no installed compiler/header packages requiring removal.

## Verification

All candidate executions used no published ports, no production data/config mounts, bounded CPU/memory/PIDs, and either no network or one private Docker internal network. Test containers and the private network were removed in finally cleanup.

- Meta runtime: exact dependency versions; tab-suffixed Content-Type bypass rejected with 415; ordinary missing required JSON property rejected with 400; inherited prototype HTTP methods safely rejected; 40 registered application paths compile; actual health and metrics handlers return 200.
- Fresh PostgreSQL 17 integration: 19 Meta HTTP cases covering schemas, table/column creation, table introspection, parameterized query, row CRUD, SQL parse/format, table/schema deletion; real metrics endpoint returns 200.
- Studio: actual profile/projects/default page and tables proxy return 200; Studio → Meta → PostgreSQL query returns the expected row.
- Studio Sharp: PNG, JPEG, WebP, AVIF, TIFF and GIF encoding, decoding and resize round trips; actual Next image-optimizer module loads; exact Sharp/libvips/native versions asserted.

Remote evidence under `/srv/beanlog/security-runtime-20260909/meta-studio` (root-private): `build-pinned.log`, `test-meta.log`, `test-studio.log`, `test-integration.log`, `trivy-meta.json`, `trivy-studio.json`, `trivy-rootfs-meta.json`, `trivy-rootfs-studio.json`.

Trivy 0.74.0, DB updated 2026-09-08T07:08, HIGH/CRITICAL + ignore-unfixed:

| Scan | Meta | Studio |
|---|---:|---:|
| Original image-layer analyzer | 2 old package entries | 1 old package entry |
| Exported final filesystem analyzer | **0** | **0** |

The layer analyzer retains deleted package.json records when a directory becomes a symlink (old Fastify/find-my-way/Sharp paths). Runtime package resolution and an independently exported final filesystem confirm those old versions are absent. Preserve both scan records and report the analyzer discrepancy; do not claim the original image scan itself returned zero. The final filesystem evidence does not rely on ignore rules or altered severity settings.

## Scope and remaining advisory qualifications

- Fastify CVE-2026-25223 fixed starting 5.7.2: https://github.com/fastify/fastify/security/advisories/GHSA-jx2c-rxcm-jvmq
- find-my-way CVE-2026-47219 fixed starting 9.7.0: https://github.com/delvedor/find-my-way/security/advisories/GHSA-c96f-x56v-gq3h
- Sharp native decoder advisory recommends 0.35.3 / libvips 8.18.3 or later: https://github.com/lovell/sharp/security/advisories/GHSA-f88m-g3jw-g9cj
- Fastify 5 migration contract: https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/
- Next 16.2.11 is retained. The later AVIF/libheif advisory also names Next package version ranges, while its underlying decoder is replaced here with current Sharp/libheif. This is a decoder remediation, not an assertion that Next 16.2.11 is a fully patched upstream release: https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4
- A separate Next Windows-filesystem RCE advisory affects this package version but requires Windows; these containers are Linux: https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36
- Node 20 support lifecycle and a full upstream Studio/Next rebuild remain separate maintenance work. Do not generalize these targeted scan results into an absence of all known vulnerabilities.

## Reproduce

Run `build.sh` on the host holding the two pinned custom bases. Run the standalone JS tests with the corresponding candidate image, read-only root, no network, a read-only script mount and `/tmp` tmpfs. Run `python3 test-integration.py` on an isolated Docker host with `postgres:17-alpine` pre-pulled. It provisions UUID-named disposable fixtures, labels them, records successful container IDs and verifies ownership before cleanup; never substitute production network or mount definitions.

### Final-filesystem scan reproduction

Export each candidate with `docker create` / `docker export` into a new root-private candidate directory and remove only that created container. The export is the merged final filesystem (including whiteouts), not an extraction of each old layer. Mount the directory read-only at `/scan` and run:

```
docker run --rm -v <export-directory>:/scan:ro \
  -v /tmp/beanmap-trivy-cache:/cache aquasec/trivy:0.74.0 \
  rootfs --cache-dir /cache --cache-backend memory --skip-db-update \
  --quiet --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed \
  --format json /scan
```

The final successful integration run used only synthetic `isolated-fixture-only` credentials and its own empty database. That literal is test data, never a production credential. Its isolated `supabase_admin` role supplies Studio's normal role name; the first optional Studio query attempt failed until this missing fixture role was supplied, with no application changes.
