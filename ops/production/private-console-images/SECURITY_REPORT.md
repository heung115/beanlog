# Dependency hardening verification — 2026-09-07

These reproducible images preserve the existing Meta v0.96.6 and Studio
2026.08.03 application releases and their Node versions. Only the listed
compatible dependency/runtime packages change. Production activation is managed
by the rollout workflow, not these build scripts.

| Candidate | Final image ID |
| --- | --- |
| Meta `beanmap-postgres-meta:v0.96.6-security-p3` | `sha256:855f489860828f8cdb6f4110a467d2670ba5a2cec1ef7d2c5b7f7fcd93601b0b` |
| Studio `beanmap-studio:2026.08.03-security-p3` | `sha256:fbd09e43b4928bb4b3368808d2baa26ef7183dc4345b04c5ffe1e5a779927c42` |

## Applied and checked

- Next's bundled tar delegates to locked tar **7.5.21**, including
  [CVE-2026-73566](https://github.com/advisories/GHSA-r292-9mhp-454m).
- Actual installed fast-uri packages retain their major version and advance to
  **2.4.5 / 3.1.6**. Builds verify the existing public API and ordinary URI parsing
  before replacing packages. The lock file records registry integrity hashes.
- GnuTLS >= **3.7.9-2+deb12u7**, OpenSSL >= **3.0.20-1~deb12u2**, libcap2 >=
  **1:2.66-4+deb12u3**. Studio additionally requires libssh2 >=
  **1.10.0-3+deb12u1** and linux-libc-dev >= **6.1.180-1**.
- npm/npx/pnpm/corepack tooling is removed from the final runtime. linux-libc-dev
  findings describe source-kernel headers inside an image, not the host's active
  kernel; the header package is still brought to its fixed Debian version.
- Both candidates passed HTTP health probes with the production environment,
  internal management network, read-only root, dropped capabilities, and resource
  limits. The last Studio layer adds only the two Debian updates above and is
  probed again by the rollout operator before activation.

Trivy **0.74.0**, vulnerability DB updated **2026-09-07 07:11:47 UTC**, downloaded
**09:08:38 UTC**, was used for final targeted scans. An earlier August 26 cache
was discovered and replaced before the final checks. Scans inspect actual package
metadata/binaries; secrets scanning is disabled. Raw reports are private under
`/srv/beanlog/security-auth-20260907/postdeploy-scan/`. The temporary copied cache
is removed after final scans; the original cache and scan reports are preserved.

## Residual findings: mitigated, not fixed

- **Meta Fastify 4.29.1 — CVE-2026-25223.** A Content-Type header containing a tab
  can bypass Content-Type-discriminated body validation. Fixed at Fastify 5.7.2,
  which requires a major application dependency migration. Meta is inaccessible
  from the public/app networks and reachable only through the management plane.
  Management isolation limits who can reach the vulnerable parser; it does not
  remove the defect. [Upstream advisory](https://github.com/fastify/fastify/security/advisories/GHSA-jx2c-rxcm-jvmq).
- **Meta find-my-way 8.2.2 — CVE-2026-47219.** Requires the router to be used with
  Node's HTTP/2 server and a crafted method. The deployed Meta endpoint is plain
  HTTP behind the private management boundary. Fixed at 9.7.0, another major
  dependency migration. [Upstream advisory](https://github.com/advisories/GHSA-c96f-x56v-gq3h).
- **Studio sharp 0.34.5 / libvips 8.17.3 — GHSA-f88m-g3jw-g9cj.** Actual native
  versions were checked. Processing untrusted GIF/TIFF/VIPS input can reach the
  affected image decoders. Studio is restricted to the Tailscale owner; no public
  Studio route is exposed. This reduces exposure but malicious images presented
  by an authorized operator remain a residual risk. Updating the pre-1.0 native
  dependency to sharp >=0.35.0 (upstream recommends 0.35.3 / libvips 8.18.3)
  requires separate image-processing compatibility validation; this rollout does
  not silently replace the native dependency. [Upstream advisory](https://github.com/advisories/GHSA-f88m-g3jw-g9cj).

Auth p3 is documented separately in `../security-auth-build/README.md`. Its final
fixed Critical/High Trivy count is zero, but production-root govulncheck still
reports the unfixed pgx/v4 and pgproto3/v2 driver traces, plus unused OpenPGP module
metadata. Those findings must not be described as test-only or eliminated.

The application API initially remained on x/crypto 0.54.0 while CI/deployment was
pending; its earlier production scan is not evidence that the patched API source
was deployed. Verify the final live application image after its own rollout.

## DNS dependency

Dropping all traffic to OCI's link-local address also blocks the default OCI DNS
resolver. Build/scanner jobs used host networking temporarily. Production
Auth/web DNS must remain functional for SMTP/OAuth name resolution through a
narrow DNS exception or approved resolver while metadata HTTP access stays
blocked. Verify DNS without sending production email or invoking OAuth actions.
