# Tilted bilingual coffee-card OCR verification

Verified 2026-09-07 with the user's original JPEG, SHA-256
`4671156a6326373ff0652de44642500e607201d9cc308d5dbb2457b4b3d53ef6`.
The private photo is not checked into the repository.

The card prints `에티오피아 알로 타미루 / 몰케 네추럴`, but its English
heading says `Colombia La Esperanza / Java Natural`. Its explicit country row
is `Ethiopia 에티오피아`. Expected name: `에티오피아 알로 타미루 몰케 네추럴`.
The image has no printed package weight or roast date.

## Reproduction and correction

- Initial actual-pixel baseline: no name in 4/4 reads; WebKit also returned Colombia.
- Adjacent country-prefixed titles are now kept separate. Readable nearby country
  metadata excludes a contradictory heading without preferring one language.
- Missing names can trigger one bounded rotation estimated from observed word
  coordinates. A software canvas prevents WebKit from producing different rotated
  pixels on repeated reads. No angle, crop coordinates, or product spelling is preset.
- A small country heading can be reread from its observed row. Country evidence is
  checked independently and projected back to the original image coordinates.
  Repeated separators remain in the evidence; printed letters are never corrected.
- An existing name and explicitly conflicting country/name facts remain protected.
  A damaged later reading cannot remove a name already recovered from an earlier view.
- Table boundaries and one bounded OCR blank before a known varietal value retain
  readable region/varietal facts without assigning arbitrary numbers to a field.

## Final verification

| Verification | Result |
| --- | --- |
| Actual UI: original upload + five same-photo rereads, Chromium | 6/6 correct name and country, 4.6–5.2 seconds |
| Actual UI: original upload + five same-photo rereads, WebKit | 6/6 correct name and country, 6.8–8.2 seconds |
| Independent pixel harness: original upload + reread, both engines | 4/4 correct name and country |
| Previous five official package photos, both engines and rereads | 20/20 correct names |
| Previous MALIC blend photo, both engines and rereads | 4/4 name, roastery, 200g, 60/40 composition and English notes |
| Name disappearing after first being shown | 0 in the 12 UI and 28 pixel-harness reads |
| Clean release Node tests | 454 passed, 1 existing skip |
| Clean release ESLint and production build | Passed |

The UI tests use the actual file input and the same-photo button. They assert the
latest completion status as well as the result, apply the extracted name/country,
preserve a typed personal memo, leave weight/date empty, and detect external image
requests. No OCR response is mocked or supplied with the expected answer. Source
hashes were unchanged during the final repeated UI run.

The five official photos retain their previous overall field score, 54/80 across
first reads and rereads (the previous 27/40 rate). This is not a claim of complete
package recognition. On this card, Chromium still misses varietal `74158`; WebKit
reads it. The stylized roastery logo remains unresolved, and altitude is not a
supported saved field. Weight and roast date remain unknown as intended.

Local, ignored evidence: `.staging/ocr-v4/ui/final-summary.json`,
`.staging/ocr-v4/final-qa-summary.json`, and the corresponding raw readings,
source snapshots, and screenshots in `ui/final`, `final-user-card`, and
`final-regression`. The `.jpg`-named Fritz corpus asset was served using its actual
PNG MIME type for the final test; its original bytes were unchanged.
