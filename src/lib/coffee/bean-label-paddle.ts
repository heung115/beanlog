"use client";

import { validateLabelImageBeforeDecode } from "./bean-label-image-header.ts";
import { extractLabelPolygons } from "./bean-label-polygons.ts";
import { mergeLabelExtractions, type LabelExtraction } from "./bean-label.ts";
import type { LabelImageVariant, ReadOptions } from "./bean-label-ocr.ts";
import { PaddleWorkerClient, type PaddleOcrResult } from "./bean-label-paddle-worker.ts";
import { selectLabelSmallPrintRegion, extractLabelSmallPrintWeight } from "./bean-label-small-print.ts";
import { prepareLabelSmallPrintImage } from "./bean-label-small-print-image.ts";
import { labelTitleClassifiers } from "./bean-label-parser.ts";

const ASSETS = "/ocr/paddle-0.4.2-v2/";
type FallbackReader = ReturnType<typeof import("./bean-label-ocr.ts").createBrowserLabelReader>;
const textKey = (text: string) => text.normalize("NFKC").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]/gu, "");
type Observation = ReturnType<typeof extractLabelPolygons>;
type DetailSource = { primary: Observation; detail: Observation };
type SourceRow = Observation["rows"][number];

function needsIdentityRefinement(extraction: LabelExtraction, text: string): boolean {
  const missingName = !extraction.fields.name && Boolean(extraction.fields.origin_country
    || extraction.fields.process_method || extraction.fields.roastery || extraction.fields.blend_components);
  const incompleteBlend = extraction.bean_type === "blend" && !extraction.fields.blend_components
    && [...text.matchAll(/\b\d+(?:\.\d+)?\s*%/gu)].length >= 2;
  return missingName || incompleteBlend;
}

function needsPrintedDetailRefinement(extraction: LabelExtraction, text: string): boolean {
  const fields = extraction.fields;
  if (!fields.name || fields.origin_country || fields.weight_g !== undefined
    || !(fields.process_method || fields.varietal || fields.blend_components)) return false;
  // An unreadable joined weight/composition line can survive a clear title.
  // Require both printed cues on one row and established coffee-specific facts.
  return text.split(/\r?\n/u).some(line => /\d+(?:[.,]\d+)?\s*(?:kg|g|oz|㎏|그램|킬로그램)(?![a-z])/iu.test(line)
    && /\d+(?:\.\d+)?\s*%/u.test(line));
}

export function needsLabelRefinement(extraction: LabelExtraction, text: string): boolean {
  return needsIdentityRefinement(extraction, text) || needsPrintedDetailRefinement(extraction, text);
}

function pairedPrintedNames(observation: Observation, firstName: string, secondName: string): boolean {
  const rows = [...observation.rows].sort((a, b) => (a.bbox.y0 + a.bbox.y1) - (b.bbox.y0 + b.bbox.y1));
  const readable = (row: SourceRow) => row.confidence >= 85 && row.words.every(word => word.confidence >= 80);
  const overlap = (a: SourceRow, b: SourceRow) => Math.min(a.bbox.x1, b.bbox.x1) - Math.max(a.bbox.x0, b.bbox.x0)
    >= Math.min(a.bbox.x1 - a.bbox.x0, b.bbox.x1 - b.bbox.x0) * .5;
  const next = (row: SourceRow) => rows.find(candidate => candidate.bbox.y0 + candidate.bbox.y1 > row.bbox.y0 + row.bbox.y1 && overlap(row, candidate));
  const close = (a: SourceRow, b: SourceRow) => {
    const ah = a.bbox.y1 - a.bbox.y0, bh = b.bbox.y1 - b.bbox.y0, height = Math.max(ah, bh);
    return readable(a) && readable(b) && overlap(a, b) && height <= Math.min(ah, bh) * 2
      && Math.abs((a.bbox.x0 + a.bbox.x1 - b.bbox.x0 - b.bbox.x1) / 2) <= height
      && b.bbox.y0 - a.bbox.y1 <= height * 1.25;
  };
  const matches = (name: string): SourceRow[][] => {
    const target = textKey(name), found: SourceRow[][] = [];
    for (const start of rows) {
      const chain = [start];
      while (chain.length <= 4 && chain.every(readable)) {
        const quote = textKey(chain.map(row => row.text).join(" "));
        if (quote === target) { found.push(chain); break; }
        if (!quote || !target.startsWith(quote)) break;
        const following = next(chain.at(-1)!);
        if (!following || !close(chain.at(-1)!, following)) break;
        chain.push(following);
      }
    }
    return found;
  };
  const first = matches(firstName), second = matches(secondName);
  if (first.length !== 1 || second.length !== 1) return false;
  const [upper, lower] = [first[0], second[0]].sort((a, b) => a[0].bbox.y0 - b[0].bbox.y0);
  return upper.length + lower.length <= 6 && !upper.some(row => lower.includes(row))
    && next(upper.at(-1)!) === lower[0] && close(upper.at(-1)!, lower[0]);
}

function samePrintedBilingualName(primary: LabelExtraction, detail: LabelExtraction, source?: DetailSource): boolean {
  const first = primary.fields.name, second = detail.fields.name, country = primary.fields.origin_country;
  if (!source || !first || !second || !country) return false;
  const firstFacts = labelTitleClassifiers(first), secondFacts = labelTitleClassifiers(second);
  // Matching table countries cannot excuse contradictory printed titles. Both
  // title languages must name that country; any known process conflict vetoes.
  if (firstFacts.countries.length !== 1 || secondFacts.countries.length !== 1
    || firstFacts.countries[0] !== country || secondFacts.countries[0] !== country) return false;
  const methods = new Set([...firstFacts.processes, ...secondFacts.processes,
    primary.fields.process_method, detail.fields.process_method,
    source.primary.extraction.fields.process_method, source.detail.extraction.fields.process_method].filter(Boolean));
  if (methods.size > 1) return false;
  const conflicts = Object.entries(detail.fields).some(([field, value]) => field !== "name"
    && primary.fields[field as keyof typeof primary.fields] !== undefined
    && JSON.stringify(primary.fields[field as keyof typeof primary.fields]) !== JSON.stringify(value));
  return Boolean(Math.min(textKey(first).length, textKey(second).length) >= 3
    && !conflicts
    && /[가-힣]/u.test(first) !== /[가-힣]/u.test(second)
    && source.primary.extraction.fields.origin_country === country && source.detail.extraction.fields.origin_country === country
    && pairedPrintedNames(source.primary, first, second) && pairedPrintedNames(source.detail, first, second));
}

/** A crop may contribute missing details; its truncated title cannot replace
 * a title already established using the full photograph's context. Other
 * conflicting fields still follow the shared conservative merge policy. */
export function mergeLabelDetail(primary: LabelExtraction, detail: LabelExtraction, source?: DetailSource): LabelExtraction {
  if (!primary.fields.name && !primary.evidence.name) return mergeLabelExtractions([primary, detail]);
  if (primary.fields.name && detail.fields.name) {
    const full = textKey(primary.fields.name), crop = textKey(detail.fields.name);
    // A different complete product in the crop may be a second package or
    // card in the photograph. Its country/producer must not attach to this name.
    if (full !== crop && (Math.min(full.length, crop.length) < 3 || !full.includes(crop) && !crop.includes(full))
      && !samePrintedBilingualName(primary, detail, source)) return primary;
  }
  const fields = { ...detail.fields };
  const evidence = { ...detail.evidence };
  delete fields.name;
  delete evidence.name;
  return mergeLabelExtractions([primary, { ...detail, fields, evidence }]);
}

/** Browser-only primary detector: full context, then at most one text crop.
 * A missing weight may use one bounded source-anchored small-print crop.
 * Unresolved identity or composition may use the independent block reader.
 * Model workers run sequentially and no image/text is sent to a server. */
export function createBrowserPaddleLabelReader() {
  let client: PaddleWorkerClient | null = null;
  let fallback: FallbackReader | null = null;
  let generation = 0;
  let busy = false;
  let activeController: AbortController | null = null;
  const stop = () => {
    generation++;
    const controller = activeController;
    activeController = null;
    controller?.abort();
    const previous = client;
    client = null;
    busy = false;
    void previous?.dispose();
    fallback?.dispose();
    fallback = null;
  };
  return {
    dispose: stop,
    async recognize(input: Blob | LabelImageVariant[], options: ReadOptions): Promise<{ text: string; extraction: LabelExtraction }> {
      const { signal: callerSignal, onProgress, onPartial } = options;
      callerSignal.throwIfAborted();
      if (typeof Worker === "undefined" || typeof WebAssembly === "undefined" || typeof createImageBitmap === "undefined") {
        throw new Error("browser_unsupported");
      }
      if (busy) throw new Error("recognition_failed");
      const variants: LabelImageVariant[] = Array.isArray(input) ? input : [{ image: input, psm: "6", kind: "full" }];
      if (!variants.length || variants.length > 3) throw new Error("recognition_failed");
      const full = variants.find(image => image.kind === "full") ?? variants[0];
      const crop = variants.find(image => image !== full && image.kind === "text");
      const images = [full, ...(crop ? [crop] : [])];
      busy = true;
      const controller = new AbortController();
      activeController = controller;
      const signal = controller.signal;
      const current = generation;
      const assertCurrent = () => {
        signal.throwIfAborted();
        if (generation !== current) throw new DOMException("Reading cancelled", "AbortError");
      };
      const abort = () => { if (generation === current) stop(); };
      callerSignal.addEventListener("abort", abort, { once: true });
      try {
        // Check every encoded image before fetching a model or decoding pixels.
        for (const image of images) {
          await validateLabelImageBeforeDecode(image.image, signal);
          assertCurrent();
        }
        onProgress({ phase: "loading", progress: 0 });
        if (!client) {
          let config: unknown;
          try {
            const response = await fetch(`${ASSETS}config.json`, { signal, credentials: "omit", cache: "force-cache" });
            if (!response.ok) throw new Error("loading_failed");
            config = await response.json();
          } catch {
            assertCurrent();
            throw new Error("loading_failed");
          }
          assertCurrent();
          client = new PaddleWorkerClient({ baseUrl: ASSETS, options: config });
        }
        const reader = client;
        await reader.initialize({ signal });
        assertCurrent();
        let extraction: LabelExtraction = { bean_type: "unknown", fields: {}, evidence: {} };
        let fullResult: PaddleOcrResult | undefined;
        let fullObservation: Observation | undefined;
        const texts: string[] = [];
        for (let index = 0; index < images.length; index++) {
          onProgress({ phase: "reading", progress: .8 * index / images.length });
          const results = await reader.predict(images[index].image, { signal });
          assertCurrent();
          if (!Array.isArray(results) || results.length !== 1 || !results[0]
            || typeof results[0] !== "object" || !("items" in results[0]) || !Array.isArray(results[0].items)) {
            throw new Error("recognition_failed");
          }
          const result = extractLabelPolygons(results[0]);
          if (index === 0) { fullResult = results[0]; fullObservation = result; }
          extraction = index === 0 ? result.extraction : mergeLabelDetail(extraction, result.extraction,
            fullObservation ? { primary: fullObservation, detail: result } : undefined);
          texts.push(result.text);
          onPartial?.({ text: texts.join("\n\n").slice(0, 30_000), extraction });
          assertCurrent();
        }
        const primaryText = texts.join("\n\n");
        // The independent-engine gate continues to use the original primary
        // observations. Supplemental weight text cannot manufacture a recipe.
        const refine = needsLabelRefinement(extraction, primaryText);
        const optionalDetails = refine && !needsIdentityRefinement(extraction, primaryText);
        const smallPrint = fullResult && selectLabelSmallPrintRegion(fullResult, extraction);
        if (smallPrint) {
          let supplemental: { text: string; extraction: LabelExtraction } | undefined;
          try {
            onProgress({ phase: "reading", progress: .8 });
            assertCurrent();
            const image = await prepareLabelSmallPrintImage(full.image, smallPrint, signal);
            assertCurrent();
            const results = await reader.predict(image, { signal });
            assertCurrent();
            if (Array.isArray(results) && results.length === 1) {
              const weight = extractLabelSmallPrintWeight(results[0], smallPrint, fullResult);
              if (weight) {
                const detailObservation = extractLabelPolygons(results[0]);
                const detail = detailObservation.extraction;
                // Use the existing different-product guard, but pass no other
                // detail fields, notes, composition or inferred identity.
                const identity = extraction.fields.name && detail.fields.name
                  ? { name: detail.fields.name } : {};
                const merged = mergeLabelDetail(extraction, { bean_type: "unknown",
                  fields: { ...identity, weight_g: weight.weight_g },
                  evidence: { ...(identity.name ? { name: detail.evidence.name } : {}), weight_g: weight.evidence },
                }, fullObservation ? { primary: fullObservation, detail: detailObservation } : undefined);
                if (merged.fields.weight_g !== undefined) supplemental = { text: weight.evidence, extraction: merged };
              }
            }
          } catch (error) {
            assertCurrent();
            if (error instanceof Error && error.name === "AbortError") throw error;
            // A best-effort extra read cannot discard a successful primary.
          }
          if (supplemental) {
            extraction = supplemental.extraction;
            texts.push(supplemental.text);
            onPartial?.({ text: texts.join("\n\n").slice(0, 30_000), extraction });
            assertCurrent();
          }
        }
        if (refine) {
          try {
            // Reclaim the detector's model memory before loading the alternative.
            // Difficult identity/recipe or damaged combined detail rows alone
            // incur a second engine download.
            await reader.dispose();
            assertCurrent();
            if (client === reader) client = null;
            const { createBrowserLabelReader } = await import("./bean-label-ocr.ts");
            assertCurrent();
            const fallbackImages = options.prepareFallbackImages ? await options.prepareFallbackImages() : variants;
            assertCurrent();
            const refinementReader = createBrowserLabelReader();
            fallback = refinementReader;
            try {
              const refined = await refinementReader.recognize(fallbackImages, { ...options, signal,
                onPartial: undefined,
                onProgress: value => {
                  assertCurrent();
                  onProgress({ phase: "reading", progress: .8 + .19 * (value.phase === "reading" ? value.progress : 0) });
                },
              });
              assertCurrent();
              // A recovered name must agree with letters also seen by the detector.
              // Do not turn a different engine's unrelated logo into a new identity.
              const supportedName = !refined.extraction.fields.name || extraction.fields.name
                || textKey(primaryText).includes(textKey(refined.extraction.fields.name));
              if (supportedName) {
                const accepted = optionalDetails ? { bean_type: "unknown" as const,
                  fields: Object.fromEntries(Object.entries(refined.extraction.fields).filter(([field]) => field === "name"
                    || (field === "origin_country" || field === "weight_g") && extraction.fields[field] === undefined)),
                  evidence: Object.fromEntries(Object.entries(refined.extraction.evidence).filter(([field]) => field === "name"
                    || (field === "origin_country" || field === "weight_g") && extraction.fields[field] === undefined)),
                } : refined.extraction;
                extraction = mergeLabelDetail(extraction, accepted);
              }
              texts.push(refined.text);
              onPartial?.({ text: texts.join("\n\n").slice(0, 30_000), extraction });
              assertCurrent();
            } finally {
              refinementReader.dispose();
              if (fallback === refinementReader) fallback = null;
            }
          } catch (error) {
            assertCurrent();
            if (!optionalDetails || error instanceof Error && error.name === "AbortError") throw error;
            // This optional detail recovery cannot discard an established name.
          }
        }
        onProgress({ phase: "reading", progress: 1 });
        assertCurrent();
        return { text: texts.join("\n\n").slice(0, 30_000), extraction };
      } catch (error) {
        if (generation === current) stop();
        throw error;
      } finally {
        callerSignal.removeEventListener("abort", abort);
        if (generation === current) {
          activeController = null;
          busy = false;
        }
      }
    },
  };
}
