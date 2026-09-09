# Actual-reader OCR release benchmark

This harness serves a frozen copy of the current working reader and its OCR assets on loopback. It runs the real browser worker, preprocessing, retries, parser and layout extraction. It does not require an application account or send the photo to an external OCR service. It complements the React form tests; it does not replace them.

All images, frozen source copies and OCR output stay below ignored `.staging/`. Do not commit private photos or raw OCR artifacts. The tracked public catalog contains 26 previously observed public coffee images, SHA-256 values, source URLs and visible-image expectations. The two private development coffee photos and two historical negative inputs are intentionally absent from that public catalog.

## Prepare the corpus without recognizing any image

The original 14 comparison photos, the first eight blind coffee photos, and the second six blind coffee photos are now **28 observed development/regression photos**. Both first blind evaluations failed; the first set's two negatives are observed regression inputs too. Preserve the original freezes and outputs described in [the first-blind record](ocr-release-results.md#first-independent-eight) and [the second-blind record](ocr-release-results.md#second-independent-six). Changes informed by those outputs cannot receive a new independent-blind label.

The plan includes those 30 observed fixtures. No unread blind set is currently registered. A future sealed path must not be opened implicitly. The preparation command verifies every original image hash and keeps all predeclared alternatives/exclusions. It fails on missing or altered input instead of silently reducing the dataset.

```sh
node tests/qa/ocr-release-benchmark.mjs prepare \
  --plan tests/qa/fixtures/ocr-release-plan.json \
  --no-generated-negatives \
  --out .staging/ocr-release/regression-corpus.json
```

This yields 30 fixtures (28 development coffee + 2 observed negatives). The second six-photo manifest was acquired without OCR and retains SHA-256 `699fad876d8dd4a4b8bd5081433d236e3ba09e8ea3b7e64d013131f141bfb773`; it is now observed data. For a future independent set, keep its manifest and pixels unopened until source/config/assets/harness are frozen. A failed first run must still be preserved.

Without `--no-generated-negatives`, preparation additionally creates two valid PNG negatives: a blank image and a non-coffee hand-soap package label. Those generated negatives are useful for diagnostics but do not create blind evidence. Multiple `--development` or `--blind` arguments are supported. The source schema matches the earlier comparison: `fixtures[].id`, `path`, `sha256`, `expected.fields`, optional `expected.tasting_notes`, `expectedAlternatives.fields`, `mustRemainUnknown`, `evaluationExclusions`, and field-specific `forbiddenValues`. `negative: true` becomes `kind: "negative"`; source cohorts remain separate, and result groups report `coffeePhotos` and `negativePhotos` separately. Input paths are resolved relative to their source manifest. Source splits are reassigned from the explicit command argument, so opened photos cannot accidentally remain a new test set.

Forbidden constraints support either dotted paths (`{"fields.name":["Example"]}`) or equivalent nested mappings (`{"fields":{"name":["Example"]}}`). Array values are preserved exactly. Invalid scalar leaves fail preparation/freeze validation before OCR. The second first-blind evaluation exposed this schema mismatch after six completed reads; its original partial output is preserved, those six reads were rescored without recognition, and only the remaining 18 reads were executed. The report records both harness hashes and the unchanged OCR source/assets; this is not a new independent evaluation or a change to the golden values.

On another checkout, fetch the exact public development image bytes with:

```sh
node tests/qa/ocr-release-benchmark.mjs download-public \
  --out .staging/ocr-release/public-manifest.json
node tests/qa/ocr-release-benchmark.mjs prepare \
  --development .staging/ocr-release/public-manifest.json \
  --no-generated-negatives \
  --out .staging/ocr-release/public-corpus.json
```

This optional command accesses the `imageUrl` values in [the public catalog](fixtures/ocr-release-public.json), which now contains 26 observed public coffee photos: the original 12 plus the first eight and second six opened package photos. Their original golden values and image hashes are copied unchanged; the latter two sets retain their source-manifest hashes and observed-cohort labels. No photo binaries, private inputs or OCR outputs are tracked. A changed image, unavailable URL or SHA mismatch is a data acquisition failure. Do not update the golden from OCR guesses or silently replace a seasonal product image. This 26-photo public-only run excludes the two private coffee photos and two observed negatives in the local 30-fixture evaluation, so it cannot be reported as the full 120-read regression. Omitting `--no-generated-negatives` adds two generated diagnostic negatives, not the two historical negative fixtures.

## Freeze, then run sequentially

Finish reader/config edits before freezing. If needed, prepare the app's existing assets with `node scripts/prepare-ocr-assets.mjs` first. A freeze captures current source, assets, dependency lock, harness/scorer code and the exact image manifest; it records Git HEAD for context without substituting HEAD for uncommitted working files. The command refuses to overwrite a completed freeze. Run only one live OCR benchmark at a time to avoid CPU contention.

```sh
node tests/qa/ocr-release-benchmark.mjs freeze \
  --manifest .staging/ocr-release/regression-corpus.json \
  --reader paddle \
  --out .staging/ocr-release/frozen-before-new-blind
node tests/qa/ocr-release-benchmark.mjs verify \
  --frozen .staging/ocr-release/frozen-before-new-blind
node tests/qa/ocr-release-benchmark.mjs run \
  --frozen .staging/ocr-release/frozen-before-new-blind \
  --split all --browsers chromium,webkit --repeat 2 \
  --out .staging/ocr-release/results-regression
```

After the reader is frozen and the regression outcome is acceptable, explicitly open a newly selected sealed manifest for evaluation. The following is a template: replace `NEW_SEALED_MANIFEST` with that manifest's recorded path after verifying its hash. Do not use either already opened heldout set as a new blind argument, and do not edit code after opening the new data.

```sh
node tests/qa/ocr-release-benchmark.mjs prepare \
  --plan tests/qa/fixtures/ocr-release-plan.json \
  --blind NEW_SEALED_MANIFEST \
  --no-generated-negatives \
  --out .staging/ocr-release/corpus.json
node tests/qa/ocr-release-benchmark.mjs freeze \
  --manifest .staging/ocr-release/corpus.json \
  --reader paddle \
  --out .staging/ocr-release/frozen-final
```

Before executing the blind run, verify that `freeze.json` has the same `reader`, `codeSha256` and per-file hashes as `frozen-before-new-blind`. The changed manifest is expected; changed reader/source/runtime/scorer bytes are not. Preserve both freezes. Then run `--split blind --browsers chromium,webkit --repeat 2 --out .staging/ocr-release/results-new-blind` against `frozen-final`. The current observed corpus requires 120 reads; a future blind set requires four reads per photo. Repeats measure stability and are not extra independent photos. Keep the two result directories and denominators separate.

The default split is development, not blind. Freeze with `--reader tesseract` or `--reader paddle`: these select the real `createBrowserLabelReader` or `createBrowserPaddleLabelReader` entry point, respectively. Run inherits that frozen choice and rejects a conflicting `--reader`. Paddle assets/config must exist below `public/ocr/paddle-0.4.2-v2/` before freezing. Both worker protocols are observed without changing the messages; Paddle responses retain their original polygon results. `--ids` selects comma-separated fixture IDs. `--mobile` uses the browser's Pixel 7/iPhone 13 emulation. These measurements are still from the host computer; do not call them Android/iPhone device performance. Every source and asset is served from the snapshot allowlist, while fixture bytes are hash-checked before running. Non-loopback traffic and non-read HTTP methods are blocked and recorded.

A browser error, timeout or missing phase remains in the accuracy denominator as missing expected fields and also counts as a runtime failure. A nonzero runtime exit is a failure. **Exit zero means the harness completed, not that OCR accuracy passed.** Inspect `groups`, every wrong/missing value, unsupported suggestions, unscored note output and the acceptance checklist. No passing threshold is weakened automatically.

Results retain each raw worker text/line/word box, final extraction/evidence, partial result, worker job, input hash, source hash, browser version and request record. First-read accuracy is reported separately for development, blind and negatives. Repeated reads measure stability only. Core fields are `name`, `origin_country`, `weight_g` and `roastery`; this four-field definition deliberately differs from the old comparison's three-field core, so do not compare their aggregate percentages directly.

Cold `elapsedMs` includes original decode, preprocessing, lazy worker/model initialization, retries and final extraction. Warm requires observed worker reuse; a restart after failure is counted separately. Stability checks every requested repeat. Failed negative reads have unmeasured absence checks and do not inflate successful blank-field counts. Page/module setup and local fixture transfer are separate. The first result's full local wait is `pageSetupMs + setupMs + phases[0].elapsedMs`. Request `bytes` are served response-body sizes, not compressed WAN transfer sizes. This loopback harness does not establish internet first-download latency or physical mobile memory affordability. Set `--timing-note` to record concurrent host work or other limitations; the output also records the actual timeout.

The default is two reads per fixture. `--repeat 1` is an explicit first-read accuracy-only run: repeat stability and all warm/repeated timing remain unmeasured and cannot establish those acceptance conditions.

Paddle inputs use the application's `detector` preparation profile. Its optional Tesseract refinement receives a fresh `block` preparation from the same original photo; both engines' worker payloads remain in the audit. An intentional worker disposal for refinement is a restart too. `repeated*Ms` includes every timed subsequent end-to-end attempt, including restarts, fallback and errors, while `warm*Ms` describes only observed worker reuse. Always report the complete repeated-read distribution, `repeatedTimedReads / repeatedExpectedReads` and `repeatedFailedReads` beside any warm subset. The 8-second p95 / 15-second individual budget also applies to these subsequent user waits; excluding slow fallback photos cannot establish acceptance. Any missing/failed measurement prevents a passing timing verdict. When a split contains coffee and negative fixtures, evaluate coffee timing independently so fast negatives cannot improve its percentile.

The release budget fixed on 2026-09-07 is warm p95 ≤ 8 seconds, no warm photo over 15 seconds, cold loopback total ≤ 20 seconds, and a **separate** 20 Mbps / 100 ms RTT WAN-profile cold total ≤ 30 seconds. p95 uses nearest rank (`ceil(0.95*n)`). These budgets are stored in freeze metadata. Concurrent compilation runs provide accuracy evidence and provisional times only; budget acceptance requires an isolated rerun. This harness records loopback results and does not claim it imposed the WAN profile.

## Rapid replay during development

```sh
node tests/qa/ocr-release-benchmark.mjs replay \
  --manifest .staging/ocr-release/corpus.json \
  --input .staging/ocr-compare-20260907/baseline/results/user-card-chromium.json \
  --out .staging/ocr-release/card-parser-replay.json
```

Replay reparses stored OCR text/boxes through the **current** parser/layout and a simple merge, without running OCR or consuming live OCR CPU. It accepts a single earlier baseline fixture JSON or this harness's `results.json`. It rejects blind fixtures. It does not reproduce image preparation, retry scheduling, view priority or the complete reader's selection logic. Its `diagnosticOnly` output must never be presented as actual-reader release accuracy or timing.

For an independent score recalculation, preserving first-read denominators:

```sh
node tests/qa/ocr-release-benchmark.mjs score \
  --manifest .staging/ocr-release/corpus.json \
  --input .staging/ocr-release/results-new-blind/results.json \
  --out .staging/ocr-release/score-audit.json
node --test tests/qa/ocr-release-score.test.mjs tests/qa/ocr-release-benchmark.test.mjs
```

The score audit requires the original or frozen manifest hash and every selected image/browser/repeat row, rejecting changed truth or missing observations. The scorer distinguishes strict complete matches, missing values and wrong nonempty values. It surfaces unscored extra-language cup notes instead of claiming complete precision. Partial legitimate lists and bilingual duplicate titles remain strict failures but should be described as incomplete/duplicated extraction, not fabrication. Every negative image must leave all coffee fields, notes, composition and bean type empty/unknown. The final release record must additionally cover actual React photo selection, editing preservation, cancellation, offline recovery, selective application and save/reopen, strict CSP, asset identity, network transfer, and the production release identity. See [the release evidence](ocr-release-results.md); an incomplete or pending entry is not a pass.
