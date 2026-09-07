# Browser OCR release evidence — 2026-09-07

Status: pre-rollout validation record complete, with the accuracy, performance and harness failures retained below. Release scope is review-assisted filling. This document does not claim that deployment has happened.

## Selected implementation

The application reads the original photo locally with PaddleOCR.js 0.4.2 and the Korean PP-OCRv5 mobile recognizer. A bounded crop can supplement details; a separate small-print pass may supply a missing weight only. Tesseract 7 remains a selective fallback for unresolved names, blend composition, and a narrowly identified damaged unit/composition row with both country and weight missing. Each accepted value retains its printed evidence. Photo recognition does not call an external OCR API.

The change also handles wrapped titles, separately printed country evidence, interrupted columns, wrapped flavor/varietal lists and complete blend composition. A conflicting English country heading cannot replace the corresponding Korean title merely because its transcription is clearer. Printed package notes remain separate from personal notes and tags. The review UI supports the same-photo retry, cancellation and selective application while preserving manual edits.

## Comparison and independent evaluation

The actual-reader frames below ran on Apple M4 Pro, Darwin arm64 25.6.0, Node 22.23.1, Chromium 151.0.7922.34 and WebKit 26.5, without mobile emulation. Production UI viewport/network tests are documented separately.

Accuracy counts each photograph's **first** read separately in Chromium and WebKit. Repeated reads test stability; they do not increase the number of independent photographs. Complete-field matching is strict: partial lists, duplicated bilingual titles and spelling errors remain failures. The scorer reports correct, missing and wrong nonempty values separately. The four core fields are name, country, weight and roastery; this definition differs from the original comparison's three-field core.

| Cohort and frozen stage | Chromium complete names | WebKit complete names | Chromium / WebKit correct fields | Meaning |
| --- | ---: | ---: | ---: | --- |
| Original Tesseract comparison, 14 | 8/14 | 8/14 | 28/71 / 30/71 | Original browser-reader baseline |
| Improved Tesseract, observed 14, `ac41b587…` | 8/14 | 8/14 | 36/71 / 38/71 | Development changes; not new-photo generalization |
| Paddle with selective fallback, observed 14, `371b2ccd…` | 13/14 | 13/14 | 57/71 / 54/71 | Last 14-photo frame before the first blind run |
| First independent 8, `b5885a1b…` | 3/8 | 3/8 | 20/53 / 20/53 | Failed first blind evaluation; original record retained |
| Observed 22, `e501ce9d…` | 20/22 | 20/22 | 88/124 / 85/124 | Original 14 plus the now-observed first eight |
| Second independent 6, same OCR source | 0/6 | 1/6 | 13/47 / 15/47 | Failed second first evaluation; original record retained |
| Tesseract-only comparison on that observed six, `d169722d…` | 2/6 | 2/6 | 16/47 / 16/47 | Same photos and application source; not another blind evaluation |
| Observed 28, `cbe918ab…` | 27/28 | 27/28 | 114/171 / 110/171 | Completed 120-read regression includes two separate negatives; accuracy conditions still fail |

### First independent eight

The first blind coffee result was Chromium 20 correct / 31 missing / 2 wrong and WebKit 20 / 30 / 3. Its two negatives passed in both browsers. The name result was 3/8 in each browser, and the declared accuracy conditions failed. These images became observed regression data after that result was opened.

### Second independent six

The second six-photo result was Chromium 13 correct / 29 missing / 5 wrong and WebKit 15 / 28 / 4; core fields were 11/23 and 12/23. Its names had four missing in each browser, plus two wrong in Chromium and one wrong in WebKit. Each first evaluation failed the declared accuracy conditions. Both sets became regression data when their results were opened. **All 28 coffee photos and two negatives are now observed; there is no current unread test set.** Later improvements cannot be described as independent generalization.

The second six were four Korean/mixed and two English official product photographs from three roasters. Some package design families were familiar. The first eight and second six were selected and transcribed from pixels without OCR before their respective code freezes. They are studio/product photos, not proof for all handheld, reflective, blurred or rotated labels. Two original development inputs are private. No golden was revised from recognition output.

The second evaluation exposed a harness schema mismatch after six completed OCR reads: `forbiddenValues` used a nested mapping, while the scorer expected dotted-path arrays. The original partial file had six raw phases but only four scored rows. Those six reads were preserved, the nested mapping was flattened without changing any forbidden or expected value, and only the remaining 18 reads were executed. The first six ran `e501ce9d…`; the subsequent 18 ran `d169722d…`. Only the scorer and its preflight validator differed; all 198 application, OCR, browser-entry and asset files were identical. This was one harness interruption, not an OCR runtime failure or a fresh independent attempt. All 24 final extractions, raw outputs and times retain their original execution provenance.

In all six second-set photos, an accepted complete title's characters were present in first Paddle raw output. At least one browser lost the title for each photo; WebKit 01 was correct. Failures came from joining title/notes or bilingual rows, excluding candidates through coffee context, selecting the category `MEDIUM ROAST BLEND`, and mapping the `PROCESS / WASHED` column to `VARIETY`. Correct transcription alone was insufficient for correct final fields.

The controlled Tesseract-only 24-read comparison used identical 200-file source/asset/scorer snapshots and identical photos/goldens; only the selected reader changed. Tesseract recovered the complete Korean names in 03 and 04, but truncated 01 to `Brazil Fazenda`, still chose `MEDIUM ROAST BLEND` in 05, and chose `LATIN AMERICA` in Chromium 06. It also mixed roast/report-number text into 02's varietal and used `/ 가공 방식` as 03's varietal. It lost 01's roastery and 05's weight. Chromium's 16/47 comprised 25 missing and 6 wrong; WebKit's 16/47 comprised 26 missing and 5 wrong. Core fields were 11/23 in both. Both readers therefore failed accuracy acceptance on these photos; switching engines alone did not resolve the field-selection defects. The same six repeated stably and had zero OCR runtime errors in each reader.

The T comparison's complete subsequent waits were Chromium median 2.417 s / p95 3.310 s and WebKit 2.529 s / p95 4.607 s; all six reused the worker. Root could run lightweight unit tests concurrently, so these are diagnostic timings, not a formal isolated performance pass. The earlier Paddle-primary waits, including three fallback/restart paths per browser, were 2.771 / 4.724 s and 2.865 / 5.852 s. This compares complete reader pipelines, not bare neural inference.

## Accuracy acceptance and final regression

The predeclared accuracy conditions require the full readable product title, source-correct country/weight/roastery, complete printed blend/list values, and correct association between a label and its value. A brand, category, report number, unrelated location or neighboring metadata column must not become a product fact. Every additional suggestion needs source review; zero forbidden-value matches is not a complete precision score. A partial legitimate list or bilingual duplicate is distinguished from unsupported content but remains a strict failure. Known title replacements or unsupported/incorrectly associated facts fail acceptance. No post-hoc aggregate percentage threshold replaces these conditions.

The final regression uses the production high-level reader on **28 observed coffee photos + two observed negatives × two browsers × first/repeat = 120 reads**. Its frozen code is `cbe918ab8e4a1e859c9402f214f861d8cd7e92403b6ebbe077c9a71b09d014f2`; manifest SHA-256 is `2000bdd9aefbd1cd998033ecba292658d2ad76e10f99994ab0f19d860f3ddcd7`. Against `d169722d…`, 196 files are identical, four parser/layout files changed and one spatial table helper was added. Reader/runtime/model/assets/harness stayed byte-identical. The six formerly blind fixtures changed cohort metadata only; all 30 image hashes, expected values, alternatives, exclusions and forbidden values are unchanged.

The 120-read run completed with 60 raw run objects, zero OCR/page/network-policy failures and identical first/repeat extraction on all 30 fixtures in each browser. The working source matched all 201 frozen file hashes before and after execution; both SHA maps are `78866be615bf24bc6fe4cedf67cd087718e842383437d326a4f628e040399ae5`. The result-file SHA-256 is `5b5087b62412e1e522b1add2e8654c1cf34e5e51d1fa8379fb0ad6fad4e4ef45`.

| Observed coffee first-read scope | Chromium correct / missing / wrong | WebKit correct / missing / wrong |
| --- | ---: | ---: |
| All 28, full expected fields and note lists | 114/171 / 49 / 8 | 110/171 / 54 / 7 |
| Four core fields | 68/95 / 25 / 2 | 66/95 / 27 / 2 |
| Original 14 | 58/71 / 11 / 2 | 55/71 / 15 / 1 |
| Opened first eight | 31/53 / 20 / 2 | 31/53 / 20 / 2 |
| Opened second six | 25/47 / 18 / 4 | 24/47 / 19 / 4 |

| Field or full list | Chromium correct / missing / wrong | WebKit correct / missing / wrong |
| --- | ---: | ---: |
| Name | 27/28 / 0 / 1 | 27/28 / 0 / 1 |
| Country | 13/16 / 3 / 0 | 12/16 / 4 / 0 |
| Weight | 22/26 / 4 / 0 | 21/26 / 5 / 0 |
| Roastery | 6/25 / 18 / 1 | 6/25 / 18 / 1 |
| Region | 3/7 / 3 / 1 | 2/7 / 4 / 1 |
| Farm/producer | 3/5 / 1 / 1 | 2/5 / 2 / 1 |
| Varietal | 9/12 / 2 / 1 | 9/12 / 2 / 1 |
| Processing method | 11/15 / 4 / 0 | 11/15 / 4 / 0 |
| Processing detail | 1/3 / 2 / 0 | 1/3 / 2 / 0 |
| Roast level | 4/6 / 2 / 0 | 4/6 / 2 / 0 |
| Roast date | 0/1 / 1 / 0 | 0/1 / 1 / 0 |
| Blend composition | 2/3 / 1 / 0 | 2/3 / 1 / 0 |
| English notes | 12/18 / 5 / 1 | 12/18 / 6 / 0 |
| Korean notes | 1/6 / 3 / 2 | 1/6 / 3 / 2 |

All original 14 names and all second-six names now match a complete predeclared alternative. The first-eight set remains 7/8. The original 22 had zero prior-correct field losses; TERAROSA's duplicated title became a correct complete title. Relative to the previous 22-photo frame plus the original second-six evaluation, first-read gains were 15 fields in Chromium and 13 in WebKit, with **two and three prior-correct losses respectively**. All changes repeated identically.

Those five losses are concrete: second-set 02 lost `Kenya` and `200 g` in both browsers; second-set 01 lost `200 g` in WebKit. In 02, the first Paddle polygons were unchanged, but recovering the vertical title stopped the former Tesseract fallback (six raw reads became one); the primary `200g1케나100%` line did not supply the two facts. In WebKit 01, both Paddle raw arrays were unchanged and the supplement read `200 g` correctly. Its newly recovered Korean title conflicted literally with the full-frame English title, so the existing same-product guard rejected the weight. These are reader-control/identity regressions, not evidence that the printed facts disappeared.

Remaining strict wrong values are: first-set 01 `루소 섬머` for `루소 썸머` (OCR spelling); first-set 08 `ARCHETYPE` for `ARCHETYPE COFFEE` (partial brand); MALIC Korean note misspellings and a missing WebKit note; Chromium Hologram's three printed notes retained as one unsplit string; and second-set 02's `Kiambu, Kisi`, `Mukunga Estate AA 0211 I`, `Ruirul1`, and `다크조콜릿`. The latter four reflect OCR spelling plus a residual printed-column separator, not invented locations or notes. They were formerly missing in the primary final output and are now wrong nonempty proposals. Complete note-list and spelling criteria are unchanged.

Additional-field review remains separate from the declared denominators. Square Mile's 50/50 and MALIC's 60/40 aggregate Washed/White Honey details are supported by printed composition. Square Mile's displayed composition lines retain OCR place-name errors such as `Chacayd` and `Tarraza`; their structured country/ratio/process subset can score correctly without making those strings correct. MALIC's `Gedeb` region and `Bursa Main Station` producer assignment use source-present words with role interpretation, while `Chorso` remains in raw/displayed composition but is not a structured producer. MALIC's seven Korean translations and Stumptown's two translations correctly reflect their printed English notes; this does not repair MALIC's separately displayed Korean OCR. The now-complete English list in second-set 06 lost its previously correct two Korean translations in both browsers; this observed removal is outside the 171-field denominator. The translation layer deliberately uses an all-or-nothing dictionary policy: `Candied Orange` has no dictionary entry, so the now-complete three-note English list yields no Korean translation rather than a partial translated list. This preserves that existing policy and is not a source-role bug. No unscored extra-language note list or forbidden-value match appeared. The two negatives returned empty coffee fields/notes/composition and unknown bean type on all eight actual reads.

A read-only code review also reproduced a separate category-boundary defect using an abstract in-memory layout: `NOTES → BLUEBERRY PIE → COCOA → SINGLE ORIGIN / BLEND / LATIN AMERICA → 200g` could admit the category/geography as a cup note. This is not claimed to be an observed 120-photo-output error; it is a demonstrated general source-role error requiring a follow-up regression. The current 120 outputs and source snapshot remain immutable. **The known name spelling error, incomplete/incorrect proposals and five lost core facts mean this frame does not pass the declared accuracy conditions.**

The subsequent shared metadata-boundary fix changed only the parser in this step (SHA-256 `dd0b38eb1eba8adbf51d5323b74aad6e210508a2c9b302ccd4f72f2deec136da`). The owner reported the seven added abstract boundary cases passing within 160 focused checks. Independent replay of every saved worker response through the original frozen and changed parser/layout found **218/218 identical extractions (164 Paddle, 54 Tesseract), zero prior-correct losses**. All eight negative raw responses remained empty/unknown. This confirms no drift in saved per-pass parsing; it is not a new OCR read or a replay of the high-level reader's fallback scheduling. Evidence: `.staging/ocr-release/paddle-release4-20260907/boundaryfix-raw-replay.json`.

The release is assessed as a **review-assisted filling tool**: users inspect and select the proposed facts before applying them. The strict accuracy failures and omissions remain published; they are not relabeled as complete automatic extraction. Known source-role errors and prior-correct field losses require their own fixes and verification, recorded in the follow-up below. Additional spelling-specific rules or fresh blind sets are not added merely to make the observed score look perfect.

| Isolated Mac loopback, coffee only | Subsequent timed / expected | Median | p95 | Maximum | First full local maximum |
| --- | ---: | ---: | ---: | ---: | ---: |
| Chromium | 28/28 | 1.585 s | 2.621 s | 4.363 s | 4.878 s |
| WebKit | 28/28 | 1.617 s | 5.561 s | 8.579 s | 8.681 s |

No OCR, compilation, production build or unit-test workload ran concurrently with this timed frame; read-only audit/reporting did. Every subsequent wait includes retry, small-print work, fallback and worker reinitialization. Three Chromium and four WebKit repeated reads restarted workers. p95 is nearest rank (27th of 28); zero timings were missing or failed. Negative timings are excluded from this table. First full local time includes page/module setup, source transfer and the complete first reader call. These loopback values meet their predeclared bounds, while physical-mobile, production UI and WAN-profile performance remain separate. They do not turn failed accuracy into acceptance.

The existing scorer counts the two negatives' four expected empty note arrays as missing in the combined field total. The immutable automatic total is therefore Chromium 114/175 with 53 missing and 8 wrong, and WebKit 110/175 with 58 missing and 7 wrong. The tables above separate the 171 coffee expectations from the negatives' actual empty-field/unknown-type checks. This bookkeeping defect is not four failed coffee facts; old scores have not been silently changed.

## Final-source targeted follow-up

The follow-up source is `83ba5deb7f933c98a45d97c51a84204a51a70dd170f6da8918368154ad7b55c3`. It changes the reader and shared parser relative to the preserved `cbe918ab…` frame; the other 199 of 201 files, all image/expected-value metadata and manifest `2000bdd9…` are identical. The worker/model bytes did not change. The reader can recover missing country/weight from a damaged printed unit/percentage row without replacing established identity or other metadata. A supplemental weight is accepted across two language forms only with a unique, adjacent, aligned pair of printed titles in both observations and corroborating country/context; unrelated product names remain conflicting.

Independent frozen-source replay checked all 218 saved worker responses with zero parser/layout extraction-output changes. A second diagnostic reconstructed all 120 original primary partials and six accepted small-print partials exactly, then compared the changed reader decisions: only second-set 02's four phases gained the optional Tesseract step, and second-set 01's two WebKit phases could retain `200 g`. The other 114 decision states and every crop selection were unchanged. This constrained the actual follow-up to the two affected photos, the country-conflict user card, MALIC blend, and two negatives: **six observed fixtures × two browsers × two reads = 24 new actual reads**. This is not a 120-read run on the new source, and the old 120 results are not overwritten or pooled into a new-source accuracy score.

| Final-source actual subset, first reads | Chromium | WebKit |
| --- | ---: | ---: |
| Coffee photos | 4 | 4 |
| Correct / missing / wrong coffee expectations | 20/28 / 3 / 5 | 20/28 / 3 / 5 |
| Four core fields | 12/13, one missing, zero wrong | 12/13, one missing, zero wrong |
| Complete names | 4/4 | 4/4 |
| Negative fixtures, first and repeat | 2/2 pass | 2/2 pass |
| Identical first/repeat extractions | 6/6 | 6/6 |
| OCR/page/network-policy failures | 0 | 0 |

The five previously lost first-read core values all recovered, and the same ten values recovered when repeats are included. The actual changed extraction set was exactly the predicted six phases; the remaining 18 extractions were unchanged. Prior-correct losses, new wrong values and new unsupported proposals were zero. Existing OCR spellings in second-set 02 and MALIC's Korean notes remain wrong under the original scorer. The label's English notes, translations, existing country-conflict handling and complete blend structures in the control photos were preserved. The expected empty-note bookkeeping issue remains outside the coffee denominator: the unmodified combined automatic score is 20/32, seven missing and five wrong in each browser.

All 201 working-source and asset hashes matched the final freeze before and after actual recognition. Both hash-map digests are `128ce7a06c8297b8aa6463a82af8bcc38dc5d7a19523953d85727664f9092398`. The targeted result-file SHA-256 is `7af08c9f20688aa0c700041a342c8f11b6f0a44f94bdabf06e98b98f254c388c`.

| Isolated final-source stress subset, coffee only | Subsequent timed / expected | Median | p95 = maximum | First full local maximum |
| --- | ---: | ---: | ---: | ---: |
| Chromium | 4/4 | 2.716 s | 4.345 s | 4.884 s |
| WebKit | 4/4 | 4.613 s | 8.521 s | 8.804 s |

**WebKit's selected four-photo subset exceeds the 8-second p95 budget.** Its maximum remains under 15 seconds and cold local maximum under 20 seconds, but those do not erase the p95 failure. The slowest repeat is the user card. These four deliberate stress/affected photos are a different distribution from the previous full 28-photo frame, whose WebKit p95 was 5.561 seconds; do not combine the two statistics into a blanket pass or infer a new full-cohort percentile. All times include actual fallback and restart work. No concurrent OCR, build, compilation or unit-test workload ran during this follow-up; read-only reporting/audit did. Negative inputs are excluded from the timing table. Production UI and WAN-profile measurements are separate evidence.

The documented general cup-note role boundary and prior-correct core losses are fixed and verified at this stage. Remaining spelling, partial-brand and recall limitations stay visible. The release judgment is still a review-assisted filling decision, not a claim that strict complete extraction or every performance slice passed.

## Runtime, packaging and security

- All OCR model/runtime assets are self-hosted at versioned paths with pinned downloads, SHA-256 validation and upstream license notices.
- The minimal OpenCV runtime is built with dynamic execution disabled. The application page permits no eval; the dedicated worker uses only its scoped WebAssembly allowance.
- A clean Linux ARM64 build and runtime smoke check were performed. Public assets are readable by the non-root, read-only production user. Compiler/cache/private QA artifacts are excluded from the runtime image.
- The separately declared performance budget is subsequent-read p95 ≤8 s and maximum ≤15 s, cold loopback total ≤20 s, and cold total ≤30 s at 20 Mbps / 100 ms RTT. Worker restarts and selective fallback count in the user's wait. Coffee and negative timing are separate.
- Browser results come from a Mac. Mobile-width WebKit emulation does not establish physical iPhone speed or memory usage.

## Final validation record

Completed: final-source freeze, independent saved-output/decision replay and affected/control 24-read actual regression. The isolated full `npm run check` completed with exit 0 before the final 24-read test: TypeScript, ESLint, 704 Node tests (700 pass, zero fail, four skipped), credential hygiene, container boundary, Go race/vet/format, audit syntax, whitespace and production build passed. The design policy reported 16 existing warnings in one warning group; this was not a warning-free result. A final staged whitespace check also passed; `.gitattributes` preserves whitespace in checksum-pinned upstream license notices without changing their bytes. The preserved log is `.staging/ocr-release/paddle-release5-20260907/final-check.log` with summary/provenance in `quality-audit.json`.

The first production UI attempt used BUILD_ID `build-TfctsWXpff2fKS`: seven UI tests and two CSP tests passed; one WebKit HTTP-blocked repeat test failed, and both dependent performance tests were skipped. Its 201 release files and complete 211-file QA/source map matched before and after, and no QA accounts remained. The failed test expected another successful recognition while HTTP requests were blocked. WebKit's request routing also disabled HTTP cache, so a fresh reader's `config.json` request was blocked after the previous worker had been disposed. The UI reported a loading failure, retained the previous name and produced no page error. This failed assertion is preserved in `.staging/ocr-ui-production-20260907/results/`; it is not an offline success or a measured performance pass.

The second attempt keeps the same application source `83ba5deb…` and changes only four staging harness files for assertions, execution and evidence storage. All eight UI tests and both CSP tests passed. UI coverage includes cold cancellation and retry from the same photo, asset failure followed by recovery, repeat cancellation and stale-result protection, unavailable-network handling, and MALIC selection/apply/save/reopen with manual fields preserved. Chromium's whole-browser offline repeat succeeded. WebKit's HTTP-blocked repeat instead preserved the prior result and recovered after HTTP was restored. Neither the WebKit request-block control nor mobile-width emulation establishes actual offline behavior on a physical iPhone. The separate attempt again observed BUILD_ID `build-TfctsWXpff2fKS`; the first attempt's failure is not erased by the changed control.

The second attempt performed a clean production lifecycle with a new build invocation and its own server, although the observed BUILD_ID was identical. It completed **12 user-card recognitions + two MALIC recognitions**, plus the separate four performance reads below. Cancelled attempts and deliberate loading failures are not counted as completed recognitions. The final 201 release files and complete 211-file source/harness map matched their freezes; the latter map SHA-256 is `6c15cabadebf635c13e262438df6b51aefd9e20ccd06708d0c84c87e46a31a76`. Page errors were zero in all eight UI observations, and teardown found zero remaining QA accounts or owned UI/performance processes. These 14 UI reads are distinct from both the original 120 and final-source targeted 24.

**The production lifecycle exited 1: ten tests passed and two performance harness tests failed.** The user-card test required a recorded HTTP cache hit, but its repeat reused the existing worker and made no OCR HTTP requests; its two completed measurements were saved before that assertion. The MALIC test completed both recognitions, then stalled while collecting a worker response's `finished()` promise. A read-only browser inspection preserved the original timestamps and resource observations before the owned browser was closed; the closure then rejected that pending collection promise. Its final partial evidence matches the recovered original observations. No additional OCR was run to replace either failed test, and neither is relabeled as a passing automated test.

| Separate production network measurement, Mac Chromium | Cold file selection to final review | Repeat to final review | Actual inference calls per read |
| --- | ---: | ---: | --- |
| User card | 9.760 s | 1.960 s | One Paddle call |
| MALIC | 14.936 s | 7.859 s | Two Paddle + four Tesseract calls |

These four actual readings used CDP 20 Mbps (2,500,000 bytes/s) and 100 ms request-to-header latency, applied to the page and every dedicated worker, without CPU slowdown or HTTP-routing interception. The measurement starts at file selection or retry and ends at the final rendered review; preprocessing, OCR downloads, initialization, fallback and worker restart are included. Login and the already loaded form's initial navigation are outside that interval. Both observed cold waits meet 30 seconds and both repeats remain below eight seconds, but two chosen photos are not a population p95 or physical-mobile benchmark. MALIC's first partial appeared at 9.155 seconds; it was not the final result. The final-source WebKit stress p95 failure above remains unchanged.

Independent review found no page/CSP/network-emulation errors or photo/data upload in the performance recordings. CDP recorded about 16.435 MB of cold OCR transfers for the card and 22.431 MB for MALIC; worker bootstrap bytes are additional observations from Resource Timing. MALIC's compressed Paddle/Tesseract bootstrap bodies were 102,087/33,676 bytes, versus decoded sizes 326,442/111,307 bytes. On repeat those scripts and several assets came from cache, but the Korean recognizer was fetched again: **8,339,563 transferred bytes, included in the 7.859-second repeat**. Thus cache reuse is demonstrated without a claim that every repeat transfers zero bytes or that models download only once. The recorded four-read waits can be assessed against the timing budget independently of the two retained collection/assertion failures. Physical WebKit offline operation remains unverified.

This closes the pre-rollout validation record for review-assisted filling, with strict complete-extraction failures, the selected WebKit p95 miss, partial cache reuse, and both production harness failures visible. The original 120-read frame, distinct targeted 24, production UI 14, performance four, and two failed first-blind evaluations remain separate evidence sets.

Deployment has not been established by this document. **The release PR records deployment verification against the deployed commit after rollout**, with the operational smoke evidence in a separate ignored final artifact. Deployment-specific commit IDs and post-rollout outcomes are not inserted here as if they had already occurred.

Private inputs and raw OCR are intentionally excluded from Git. The reproducible harness and public development catalog are described in [ocr-release-benchmark.md](ocr-release-benchmark.md); build pins and licenses are described in [scripts/ocr/README.md](../../scripts/ocr/README.md).

## Immutable local evidence index

Paths below are repository-relative ignored QA artifacts. The substantive counts and limitations are included above so this tracked document remains readable without private files.

| Evidence | Location | SHA-256 |
| --- | --- | --- |
| First eight, original 40 reads including negatives | `.staging/ocr-release/paddle-final-20260907/blind-results/results.json` | `3f1ee69024f3d5eb4929a22705d49bb415a2e2710e9a4b0c4d6950a442bfce03` |
| Second six, original 24 reads with preserved continuation provenance | `.staging/ocr-release/paddle-release3-20260907/blind-complete/results.json` | `397400fbed4e9d1962d80214f22d3642278954fdd45934a652783d854970aa70` |
| Controlled Tesseract-only same-six comparison | `.staging/ocr-release/paddle-release3-20260907/tesseract-second6-results/results.json` | `60b006cb8eb23cb9898230d43f534eb99ae0db4389c7bf0d6d50b3f824098234` |
| Current observed 120 reads | `.staging/ocr-release/paddle-release4-20260907/results/results.json` | `5b5087b62412e1e522b1add2e8654c1cf34e5e51d1fa8379fb0ad6fad4e4ef45` |
| Current per-file code/image freeze | `.staging/ocr-release/paddle-release4-20260907/frozen/freeze.json` | Aggregate code `cbe918ab8e4a1e859c9402f214f861d8cd7e92403b6ebbe077c9a71b09d014f2` |
| Final-source targeted 24 reads | `.staging/ocr-release/paddle-release5-20260907/targeted-results/results.json` | `7af08c9f20688aa0c700041a342c8f11b6f0a44f94bdabf06e98b98f254c388c` |
| Final per-file code/image freeze | `.staging/ocr-release/paddle-release5-20260907/frozen/freeze.json` | Aggregate code `83ba5deb7f933c98a45d97c51a84204a51a70dd170f6da8918368154ad7b55c3` |
| First production UI attempt, original failed run | `.staging/ocr-ui-production-20260907/.staging/ocr-ui-production-20260907/results/playwright-results.json` | `4133bda28833b9ff09941008c0e2239a00f2770e218b8a0458456d0106465972` |
| First production UI source/build/cleanup audit | `.staging/ocr-ui-production-20260907/results/final-audit.json` | `a267980252f909ae50d2335e46c892a0612bc7936dfd8f1640a92919ef636da5` |
| Second production UI/performance attempt, ten pass and two harness failures | `.staging/ocr-ui-production-20260907/attempt2/playwright-results.json` | `493dcbbf4752e01afe2b592a883b539f34f878fd57d7e125e3c3271951d9cf04` |
| Second production source/build/cleanup audit | `.staging/ocr-ui-production-20260907/attempt2/final-audit.json` | `af79336cfc202583b69c8a835536ce08260c96e6ab46dfe60e0d0fdaf9d80d04` |
| Original MALIC measurement recovered without new OCR | `.staging/ocr-ui-production-20260907/attempt2/independent-audit/malic-live-cdp.json` | `496140c71ab3742fe369c65dca88df836f10b43b6f6a80fb78ba6b8cead8b8da` |

The [public fixture catalog](fixtures/ocr-release-public.json) includes the exact public URLs, image hashes and unchanged pixel goldens for 26 observed coffee images. Its download procedure rejects changed bytes. It excludes two private coffee photos and the two historical negative inputs, so a public-only rerun is a separately labeled subset. No photo binary or private OCR transcript is tracked.
