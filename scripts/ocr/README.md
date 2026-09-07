# Browser OCR asset build

`node scripts/prepare-ocr-assets.mjs` prepares the existing Tesseract assets and the
same-origin Paddle bundle at `public/ocr/paddle-0.4.2-v1/`. `npm run build` runs this
step automatically. Generated binaries are ignored by Git; the production build
never reads `.staging`, a developer's Downloads folder, or an external OCR API.

## Pinned inputs

`sources.lock.json` contains the exact package versions, source-map and recovered
source hashes, model archives, OpenCV source, Emscripten host archives, and copied
license notices. `package-lock.json` pins npm tarball integrity. Downloads require
HTTPS and their declared size and SHA-256; cached files are rehashed before use.

The SDK's official npm source maps contain its original TypeScript sources. The
build restores those files unchanged, checks the complete source inventory, and
adds two missing re-export barrels. Module aliases select ONNX Runtime's WASM
backend, the SDK's original js-yaml source, and the strict OpenCV wrapper. The SDK
normalizer generates `config.json` from `config-input.json`; runtime configuration
is validated again by the application worker client.

OpenCV 4.10.0 is compiled from its official archive with Emscripten 3.1.64. Only
`core`, `imgproc`, and the required JavaScript bindings are built. The important
settings are `DYNAMIC_EXECUTION=0`, ES modules, separate WASM, and
`ENVIRONMENT=web,worker`. The build does not patch generated JavaScript or enable
`unsafe-eval`. `paddle-whitelist.py` and all CMake/JS flags are checksum-controlled.
The Emscripten SDK's bundled sysroot cache is reused. Archive extraction allows
regular files, directories and contained relative symlinks; it rejects escaping
paths, symlink parents, devices and hard links, and does not restore ownership or
privileged file modes.

The shipped files are the worker, normalized configuration, two model archives,
OpenCV WASM, the matching ONNX Runtime WASM/ES module pair, 16 original license
notices, `NOTICE.txt`, and a manifest. Source maps, compiler binaries, JSEP/WebGPU,
stock OpenCV, and QA fixtures are not shipped.

## Building

Node 22.18–22.x is required. A native build also needs Python 3.9+, CMake, Make and
network access for the first verified downloads. Linux ARM64, Linux x64, and macOS
ARM64 have pinned native compiler archives. Other hosts can use Docker.

```sh
npm ci
node scripts/prepare-ocr-assets.mjs
```

The Dockerfile uses a digest-pinned Debian compiler stage for the glibc-based
Emscripten tools. It copies only the generated OpenCV module, WASM and manifest to
the Alpine application builder. The production runner gets the completed public
assets and standalone application; it contains no compiler stage or build cache.

```sh
docker build --target ocr-compiler -t beanmap-ocr-compiler .
```

The default local cache is `node_modules/.cache/beanmap-ocr`. Docker keeps separate
BuildKit caches for the native compiler and assembled browser assets. Cache keys
include source hashes and build flags; worker bundle keys also include the actual
OpenCV factory/WASM hashes, so different host builds cannot reuse the wrong bundle.
The source/configuration is reproducible and recorded, but byte-identical output
across different host/CMake versions is not assumed. Each generated artifact is
hashed, and release QA must use the artifact produced for that release.

Optional build variables:

| Variable | Purpose |
| --- | --- |
| `BEANMAP_OCR_CACHE` | Dedicated download/build cache directory. |
| `BEANMAP_OCR_BUILD_JOBS` | Native compile concurrency, 1–8; defaults to 2. |
| `BEANMAP_OCR_PYTHON` | Native Python executable. |
| `BEANMAP_OPENCV_OUTPUT` | Compiler-stage export directory. |
| `BEANMAP_OPENCV_BUNDLE` | Verified compiler-stage output to use in the application builder. |
| `BEANMAP_OCR_OUTPUT` | Test output override; must remain inside the project and end with the exact asset version. |

A previously validated artifact can seed a local cache only when both files match
an explicitly pinned `opencvBuild.artifactVariants` entry:

```sh
node scripts/ocr/prepare-opencv.mjs --import-opencv /path/to/verified/build/bin
```

This is optional. Clean builds download and compile the pinned official inputs.
A damaged cache fails verification; it is not silently accepted. Delete only the
identified OCR cache entry when intentionally rebuilding it, rather than pruning
unrelated Docker data.

## Verification

```sh
node --test tests/ocr-assets.test.mjs
python3 tests/ocr-archive.test.py
```

The tests cover download pins, output boundaries, cache corruption, missing or
replaced model/runtime/license files, production source/license completeness, and
archive traversal, link and device rejection. Real browser OCR, worker lifecycle,
and strict-CSP checks use the release harness under `tests/qa/`; unit tests alone do
not establish recognition quality.

## Release build evidence (2026-09-07)

A clean native Linux ARM64 Docker build used Python 3.11.2, CMake 3.25.1, Make
4.3, Node 22.23.2, and the pinned Emscripten 3.1.64 compiler. Source/SDK extraction,
configuration and compilation took 149.5 seconds with two jobs (132.75 seconds
for configure/compile). Its first verified input downloads totalled 382,708,137
bytes. A repeated compiler-stage run verified its cache in 0.2 seconds. A clean
Alpine `npm ci` and actual asset assembly then succeeded; asset assembly took 3.4
seconds including the model downloads, and a warm rebuild took 0.7 seconds.

The measured compiler cache occupied 1,950,957,568 bytes: 382,713,856 bytes for
verified downloads, 1,566,801,920 for extracted sources, SDK and build tree, and
1,441,792 for final OpenCV files. Docker reported the compiler image as
129,142,227 bytes separately from the cache. These figures exclude the existing
application dependency layers, older Docker images, and ordinary application
build output; retain additional space for those. The compiler cache stays out of
the runtime image, and repeated deployments reuse it without another download or
compile. No Docker image, volume or unrelated cache was pruned during validation.

The final 24 browser asset files total 32,766,826 bytes before transport
compression, plus the manifest. Building those files on macOS and Linux around
the same Linux-produced OpenCV artifact gave identical SHA-256 values for every
file. The original native macOS OpenCV WASM itself differs from the Linux build;
this does not establish universal compiler byte reproducibility across hosts.
Release QA therefore uses the native Linux artifact.

For an existing local checkout, the default cache can be reused without any
special environment variables:

```sh
node scripts/prepare-ocr-assets.mjs
```

The documented `--import-opencv` path is only an optional checksum-verified seed;
the source build and production Docker image do not require it. Python extraction
regressions are also invoked by `tests/ocr-assets.test.mjs`, so the ordinary
`npm run test:node` and project check runner execute them in CI.
