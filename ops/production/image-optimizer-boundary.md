# Disable the unused public Next image optimizer

The application uses unoptimized browser blob previews and has no server-side
Next image optimizer callers. Keep `/_next/image` and its child paths unavailable
at public Caddy ingress even after dependency updates. This removes an unused
entry to native image decoding; it does not replace patching Next, Sharp and
native decoder libraries or auditing other image-processing paths.

The snippet returns HTTP 404 and `Cache-Control: no-store`. Normal static image
files, JavaScript chunks, login, OAuth, REST and the existing private/provenance
rules remain untouched. All methods reaching this matched handle are denied.
An earlier TRACE/CONNECT rejection rule can still return HTTP 405.

## Prepare and test

`prepare-image-optimizer-caddy.py SOURCE --output CANDIDATE` only inserts the
snippet definition and one use inside the standalone `beanmap.site` block. It
preserves the rest of the source byte for byte and refuses unexpected upstreams,
rewritten public URLs, duplicate sites/imports, and overwriting source/candidates.
It never prints configuration contents or reloads Caddy.

Run `python3 -B ops/production/test_image_optimizer_boundary.py` for generator
checks. Run `bash ops/production/test-image-optimizer-caddy.sh` for the disposable
pinned Docker Caddy integration fixture. It verifies thirty method/path cases,
including percent encoding, duplicate slashes and dot-segment normalization,
and checks that normal login/OAuth/static paths still reach the dummy upstream.

## Approved host application

Stage the snippet, generator and `apply-image-optimizer-caddy.sh` in a new
root-owned 0700 directory under
`/srv/beanlog/security-rollout-20260908/image-optimizer-*`. Run the apply script
as root only after reviewing those artifacts. It refuses reuse of a rollout
directory. The script preserves current Caddy ownership/mode and creates a
private pre-change backup. It installs the snippet, validates the candidate
using `/etc/beanmap-private-console/caddy.env`, checks for concurrent changes,
atomically replaces the main configuration and reloads Caddy. Validation/reload
logs remain in the private rollout directory; never print the environment file
or adapted configuration. A failed application restores the prior files and,
when necessary, reloads the previous configuration.

Do not replace the live Caddyfile with the repository example or remove existing
Auth/private/client-provenance/error-handling rules. Keep the new snippet import
through future Caddy edits. Next's `images.unoptimized` setting provides additional
application defense but is not a reason to remove the ingress guard.

## Patched application runtime

The application pins Next 16.3.3 and Sharp 0.35.4, whose bundled libheif must be
at least 1.23.2. `scripts/verify-image-runtime.mjs` resolves Sharp from the actual
Next installation and checks its loaded native versions. Both prebuild and the
final non-root standalone Docker image run this guard; a vulnerable or absent
native library fails the build. `next.config.ts` also sets `images.unoptimized`
so the optimizer stays unavailable when requests bypass Caddy.

Run `node --test tests/image-runtime-security.test.mjs` for version-rejection,
PNG/JPEG/WebP conversion, benign AVIF decoding and upstream AVIF passthrough
regressions. Run `scripts/verify-image-optimizer.mjs` against a built loopback
server, or use its explicit public authorization setting after deployment, to
verify optimizer denial while original PNG files and browser Blob decoding work.
After rollout, execute `node scripts/verify-image-runtime.mjs` in the running web
container and verify its deployment label matches the released commit.

Upstream patch references:

- https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4
- https://github.com/strukturag/libheif/security/advisories/GHSA-g89c-p67h-r497
