# Safari OCR name regression — 2026-09-07

This follows the browser OCR release in PR #4. A reported iPhone Safari upload displayed other fields while the coffee name was unidentified. The original file was available locally; the friend's exact uploaded bytes, iOS version and physical device were not captured. No private image or extracted label text is included here.

## Reproduced failures and fixes

- A damaged first row of a multilingual caption could be rejected as a name while its clear continuation survived as a competing title. The layout now associates a directly adjoining continuation with the preceding row's independently legible country prefix. This only helps resolve conflicting titles when explicit local country evidence and a matching title are present. Country-word confidence, column, spacing, height and intervening-row checks remain mandatory. Damaged text is never promoted into a name.
- Concatenated English and Korean aliases of the same country could lose the explicit country value. The country parser now accepts an exact whole-value pairing of that country's two aliases in either order. Mixed countries, arbitrary prefixes/suffixes and partial blend percentages remain rejected.
- The review heading displayed “unidentified” while a secondary recognition was still running. It now displays a reading state until completion; genuine final omissions and retained previous results remain distinguishable.

Public regression tests use synthetic labels and existing country vocabulary, not private product strings, filenames or image hashes.

## Actual reader comparison

One observed photograph was kept unchanged and also normalized/re-encoded at several JPEG qualities and dimensions. These are **12 encoding controls of one photograph**, not 12 independent photos or a claim to reproduce a specific messaging app's transformations. The original expected values were unchanged. Name scoring ignores whitespace and punctuation but requires all printed name characters.

| Run | Scope | Correct complete names | Missing / wrong names |
| --- | --- | ---: | ---: |
| Previous release, Mac WebKit | 12 controls, one read each | 6/12 | 5 / 1 |
| Previous release, Mac Chromium | Original plus five failed WebKit controls | 5/6 | 0 / 1 |
| Fixed source, Mac Chromium | 12 controls, first and repeat | 24/24 | 0 / 0 |
| Fixed source, Mac WebKit | 12 controls, first and repeat | 24/24 | 0 / 0 |

The final 48 actual readings had no OCR/page/network-policy errors. All 24 fixture/browser pairs repeated identically. No Tesseract fallback was required; the previous original WebKit path required six secondary OCR calls after its first Paddle call. Some existing cup-note spelling errors remain in three first-read control/browser results; this is a name regression fix, not a claim of perfect extraction.

Final application/asset freeze: `1f0c1e8630f8969753e0104419d6da9791f9724963afce2b9fec06c2c2a410d8`. All 201 files matched the freeze after actual recognition and the successful build. Result SHA-256: `a7ea2f998b9f0b33532259b68b73e2a1d11f264960cdb4a4640238f0567a338b`.

Separate diagnostic replay of 218 previously saved worker responses added the correct name to two original WebKit primary responses; the other 216 extractions were identical. Previously correct fields had zero losses, and all eight negative responses were unchanged. Replay is not new recognition and does not increase the photograph count.

## UI and quality validation

- Two pre-fix UI assertions reproduced the incorrect unidentified heading during pending recognition.
- Six isolated UI cases passed across Chromium and WebKit: pending-to-complete, cancellation/manual-input preservation, and a genuine final missing-name result while applying other fields.
- Two pre-fix live production WebKit runs reproduced the intermediate unidentified heading and then recovered the expected final name. These were Mac WebKit with iPhone viewport emulation, not a physical iPhone.
- TypeScript, ESLint, 708 Node tests (704 passed, four existing skips), credential/container checks, Go race/vet/format and whitespace checks passed. The existing 16 design warnings remain.
- The production build passed after replacing an out-of-root dependency symlink with a local dependency copy. The original Turbopack symlink failure is retained. An earlier empty-cache preparation was interrupted and repeated using the existing verified asset cache.
- An initial UI rerun against the shared development checkout encountered another ongoing change's missing module and was interrupted. It is retained as two passes, two failures, one interruption and one unrun case; the six passing isolated cases above use the deployed source plus this fix only.

Measurements ran on a Mac and may overlap other work. They are diagnostic recognition/UI evidence, not physical-iPhone performance results. The actual friend's terminal failure remains unobserved; the encoding-dependent final failures and the intermediate UI defect were independently reproduced and corrected.

Private evidence is retained under ignored `.staging/ocr-safari-investigation/` in the primary checkout and isolated release worktree. Deployment and post-rollout checks are recorded in the release PR against the merged commit.
