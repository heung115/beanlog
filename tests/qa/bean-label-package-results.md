# Package OCR verification — 2026-09-06

Compared the previous `720c3a7` implementation with the current local browser OCR on five official product photographs. Images are private test assets under ignored `.staging/ocr-v3/corpus`; neither photographs nor user images are committed or sent to an OCR service.

## Results

Each photograph was read from its original pixels in Chromium and WebKit, using the same image bytes and strict expected values before and after. Product-page facts not visible in the image are excluded from the expected values.

| Measure | Before | After |
| --- | ---: | ---: |
| Product names | 0/10 | 10/10 |
| Printed package weights | 2/10 | 7/10 |
| All expected facts combined | 2/40 | 27/40 |
| Unprinted information left unknown | 38/38 | 38/38 |
| Photographs with every expected fact correct | 0/10 | 0/10 |

The last row matters: this is an improvement in useful autofill, not complete package understanding. Logo-style roastery names remain unrecognized. Square Mile's small weight and composition table remain incomplete; Momos's weight remains unreadable in Chromium. Missing fields are not replaced with facts from the website.

| Official photograph | Recognized product | Remaining limitations |
| --- | --- | --- |
| [ONA](https://onacoffee.com.au/products/raspberry-candy) | Raspberry Candy | Roastery wordmark missing; 200 g and printed flavor phrases read |
| [Square Mile](https://shop.squaremilecoffee.com/products/red-brick) | RED BRICK | Weight and complete composition missing; cup notes read; brand name is not printed on this face |
| [Momos](https://momos.co.kr/shop_view/3067) | Signature Blend Busan | Roastery missing; weight missing in Chromium |
| [Fritz](https://fritz.co.kr/product/detail.html?product_no=982&cate_no=24&display_group=1) | DECAFFEINATED COFFEE | Korean brand spelling not guessed; 200 g and decaf read |
| [Terarosa](https://renew.terarosa.com/market/product/detail/15-15) | CLASSIC ESPRESSO | Roastery missing; 1 kg read; incomplete origin shares not normalized |

## Regression and UI checks

- Saved earlier MALIC photograph: 14/14 reads across Chromium/WebKit and resolution variants preserve the full name, MALIC, 200 g, both 60/40 components, varieties, processing and printed notes. The saved file is not verified byte-identical to the unavailable `IMG_2242.jpeg` attachment.
- Actual in-app upload/rescan: five new photos, ten operations. The final column-processing and decaf-detail changes were then checked with six more operations on Square Mile, Fritz and the earlier MALIC photo.
- Additional real-pixel experiments selected contrast and crop handling; they were diagnostic trials, not counted as accuracy passes.
- Node tests cover conflicting names, damaged brackets, native-size titles surviving enlarged reads, failed/cancelled refinements, excluded addresses/farms, partial blend columns, wrapped flavor lists, image bounds and resource cleanup.
- App browser regression: 35 initial passes; the empty-rescan fixture was extended to answer the new optional rereads and its focused rerun passed, completing all 36 scenarios. Node verification: 398 passed, one intentional skip; type checks, lint, Go race tests and production build passed.

Run evidence is retained locally in `.staging/ocr-v3/results/release`, `.staging/ocr-v3/repeat-accuracy`, and `.staging/ocr-v3/check-final.log`. The corpus records source-image hashes, source-code snapshots, worker responses, coordinates, partial results and timings. Typical observed new-photo reads were around two seconds on this Mac; this is not a mobile-device performance guarantee.

## Implementation boundaries

The reader reuses its local worker. Weak initial results get sparse native-size and bounded color/contrast/crop reads. Layout supplies only supported titles; subsequent detail reads fill absent fields without erasing an earlier successful title. FROM-wordmark refinement crops observed coordinates and selects an actual second reading, without a brand dictionary or string repair. Packaging notes remain separate from the user's own impressions and tags.
