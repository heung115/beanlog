"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { eligibleLabelFields, LABEL_FIELDS, type LabelExtraction, type LabelField } from "@/lib/coffee/bean-label";
import type { LabelReadProgress } from "@/lib/coffee/bean-label-ocr";
import { createBrowserPaddleLabelReader } from "@/lib/coffee/bean-label-paddle";
import { prepareLabelImages, prepareLabelWeightRetry } from "@/lib/coffee/bean-label-image";
import { prepareLabelDetailRetries } from "@/lib/coffee/bean-label-detail-image";
import { prepareLabelDeskew } from "@/lib/coffee/bean-label-deskew";
import type { BeanFormData } from "@/types/database";

import { MAX_LABEL_FILE_BYTES, validateLabelImageBeforeDecode } from "@/lib/coffee/bean-label-image-header";
const READ_TIMEOUT_MS = 180_000;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const FIELD_LABELS = {
  name: "name", roastery: "roastery", origin_country: "originCountry",
  origin_region: "originRegion", farm_producer: "farmProducer", varietal: "varietal",
  process_method: "processMethod", process_detail: "processDetail",
  roast_level: "roastLevel", roast_date: "roastDate", weight_g: "weight",
  blend_components: "blendComposition",
} as const;
const ERROR_CODES = [
  "browser_unsupported", "loading_failed", "invalid_image", "image_too_large",
  "no_fields", "recognition_failed", "timeout",
] as const;
type LabelError = typeof ERROR_CODES[number];
type Phase = "idle" | "preparing" | LabelReadProgress["phase"];
type LabelPhoto = { url: string; name: string; file: File };
type LabelSelection = { field: LabelField; valueAtSelection: BeanFormData[LabelField]; defaultProcess?: boolean; automaticBlend?: boolean };
const SELECTION_DEPENDENCIES: Partial<Record<LabelField, readonly (keyof BeanFormData)[]>> = {
  process_method: ["process_detail"],
  farm_producer: ["origin_entity_id"],
  origin_country: [
    "origin_country_id", "origin_region", "origin_region_id", "origin_subregions",
    "origin_lat", "origin_lng", "farm_producer", "origin_entity_id",
  ],
  origin_region: [
    "origin_region_id", "origin_subregions", "origin_lat", "origin_lng",
    "farm_producer", "origin_entity_id",
  ],
};
const BLEND_CONTEXT_FIELDS = [
  "bean_type", "blend_components", "origin_country", "origin_country_id",
  "origin_region", "origin_region_id", "origin_subregions", "origin_lat", "origin_lng",
  "farm_producer", "origin_entity_id", "varietal", "process_method", "process_detail",
  "altitude_m", "harvest_year",
] as const satisfies readonly (keyof BeanFormData)[];

interface BeanLabelInputProps {
  form: BeanFormData;
  onApply: (extraction: LabelExtraction, selected: LabelField[]) => void;
  disabled?: boolean;
  allowDefaultProcessFill?: boolean;
}

function isEmpty(value: unknown) {
  return value === undefined || value === null || (typeof value === "string" && !value.trim())
    || (Array.isArray(value) && value.length === 0);
}

function selectionKey(form: BeanFormData, field: LabelField) {
  if (field === "blend_components") {
    return JSON.stringify(BLEND_CONTEXT_FIELDS.map((key) => form[key]));
  }
  const dependencies = SELECTION_DEPENDENCIES[field];
  // Replacing a parent can clear its descendants, so later edits revoke that selection too.
  return dependencies
    ? JSON.stringify([form[field], ...dependencies.map((key) => form[key])])
    : form[field];
}

function canSelectNewBlend(form: BeanFormData) {
  // A printed recipe can be offered by default only before any bean identity or origin is entered.
  return form.bean_type === "single_origin" && form.process_method === "washed"
    && ["name", "roastery", ...BLEND_CONTEXT_FIELDS.filter((field) => !["bean_type", "process_method"].includes(field))]
      .every((field) => isEmpty(form[field as keyof BeanFormData]));
}

function selectField(form: BeanFormData, field: LabelField): LabelSelection {
  return { field, valueAtSelection: selectionKey(form, field) };
}

function selectionIsCurrent(form: BeanFormData, selection: LabelSelection) {
  return Object.is(selectionKey(form, selection.field), selection.valueAtSelection);
}

function candidatesFor(extraction: LabelExtraction) {
  return LABEL_FIELDS.filter((field) => !isEmpty(extraction.fields[field]) && Boolean(extraction.evidence[field]?.trim()));
}

function blockedReason(form: BeanFormData, extraction: LabelExtraction, field: LabelField, selected: LabelField[]) {
  if (eligibleLabelFields(form, extraction, [...selected, field]).includes(field)) return null;
  if (field === "process_detail") return "processSelectionHint";
  if (form.bean_type === "blend" || extraction.bean_type === "blend") return "blendOriginHint";
  return "originSelectionHint";
}

export function BeanLabelInput({ form, onApply, disabled = false, allowDefaultProcessFill = false }: BeanLabelInputProps) {
  const t = useTranslations("beans.labelImport");
  const tb = useTranslations("beans");
  const tp = useTranslations("process");
  const tr = useTranslations("roast");
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const currentForm = useRef(form);
  const currentDefaultProcessPermission = useRef(allowDefaultProcessFill);
  const request = useRef<{ sequence: number; controller: AbortController | null }>({ sequence: 0, controller: null });
  const photoSelection = useRef(0);
  const [reader] = useState(createBrowserPaddleLabelReader);
  const [photo, setPhoto] = useState<LabelPhoto | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const startedAt = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<LabelError | null>(null);
  const [notice, setNotice] = useState<"applied" | "cancelled" | null>(null);
  const [extraction, setExtraction] = useState<LabelExtraction | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);
  const [selections, setSelections] = useState<LabelSelection[]>([]);
  const [hasCompletedResult, setHasCompletedResult] = useState(false);
  const [retainingResult, setRetainingResult] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const busy = phase !== "idle";

  useEffect(() => { currentForm.current = form; }, [form]);
  useEffect(() => { currentDefaultProcessPermission.current = allowDefaultProcessFill; }, [allowDefaultProcessFill]);
  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);
  useEffect(() => () => {
    photoSelection.current += 1;
    request.current.sequence += 1;
    request.current.controller?.abort();
    reader.dispose();
  }, [reader]);

  function clearResults() {
    setExtraction(null);
    setRawText(null);
    setSelections([]);
    setHasCompletedResult(false);
  }

  function cancelRequest(keepResult = false) {
    photoSelection.current += 1;
    request.current.sequence += 1;
    request.current.controller?.abort();
    request.current.controller = null;
    reader.dispose();
    setPhase("idle");
    setProgress(0);
    setRetrying(false);
    setRetainingResult(keepResult);
    if (!keepResult) clearResults();
  }

  async function choosePhoto(file?: File) {
    if (!file || disabled) return;
    const selection = ++photoSelection.current;
    if (!IMAGE_TYPES.has(file.type)) { setError("invalid_image"); return; }
    if (file.size > MAX_LABEL_FILE_BYTES) { setError("image_too_large"); return; }
    try {
      // A preview can decode too, so validate before creating its object URL.
      await validateLabelImageBeforeDecode(file);
    } catch (failure) {
      if (selection !== photoSelection.current) return;
      setError(failure instanceof Error && failure.message === "image_too_large" ? "image_too_large" : "invalid_image");
      return;
    }
    if (selection !== photoSelection.current) return;
    // A rejected replacement must not discard the current review or interrupt
    // its worker. A separate selection sequence also rejects stale validation.
    cancelRequest();
    setNotice(null);
    setError(null);
    const nextPhoto = { url: URL.createObjectURL(file), name: file.name, file };
    setPhoto(nextPhoto);
    void readPhoto(nextPhoto);
  }

  async function readPhoto(selectedPhoto: LabelPhoto, retry = false) {
    if (disabled || request.current.controller) return;
    photoSelection.current += 1;
    const keepResult = retry && selectedPhoto === photo && hasCompletedResult;
    const sequence = ++request.current.sequence;
    const controller = new AbortController();
    request.current.controller = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, READ_TIMEOUT_MS);
    startedAt.current = Date.now();
    setElapsed(0);
    setPhase("preparing");
    setProgress(0);
    setError(null);
    setRetrying(retry);
    setRetainingResult(keepResult);
    if (!keepResult) {
      setNotice(null);
      clearResults();
    }
    try {
      const image = await prepareLabelImages(selectedPhoto.file, controller.signal, "detector");
      if (sequence !== request.current.sequence) return;
      setPhase("loading");
      const { text, extraction: result } = await reader.recognize(image, {
        signal: controller.signal,
        prepareFallbackImages: () => prepareLabelImages(selectedPhoto.file, controller.signal, "block"),
        prepareWeightRetry: () => prepareLabelWeightRetry(selectedPhoto.file, controller.signal),
        prepareDetailRetries: options => prepareLabelDetailRetries(selectedPhoto.file, controller.signal, options),
        prepareDeskewRetry: angle => prepareLabelDeskew(selectedPhoto.file, angle, controller.signal),
        onPartial: ({ text: partialText, extraction: partialExtraction }) => {
          if (sequence !== request.current.sequence || controller.signal.aborted) return;
          // A retry only replaces a completed review after it succeeds. Its
          // partials cannot discard the original text or replacement choices.
          if (keepResult) return;
          setRawText(partialText.trim());
          setExtraction(partialExtraction);
        },
        onProgress: ({ phase: nextPhase, progress: nextProgress }) => {
          if (sequence !== request.current.sequence || controller.signal.aborted) return;
          setPhase(nextPhase);
          setProgress(Number.isFinite(nextProgress) ? Math.min(1, Math.max(0, nextProgress)) : 0);
        },
      });
      if (sequence !== request.current.sequence) return;
      controller.signal.throwIfAborted();
      if (!result || !result.fields || !result.evidence || !["single_origin", "blend", "unknown"].includes(result.bean_type)) {
        throw new Error("recognition_failed");
      }
      const candidates = candidatesFor(result);
      if (!candidates.length) {
        if (!keepResult) {
          setRawText(text.trim());
          setExtraction(result);
        }
        setError("no_fields");
        return;
      }
      setRawText(text.trim());
      setExtraction(result);
      setError(null);
      setHasCompletedResult(true);
      setRetainingResult(false);
      setNotice(null);
      const latestForm = currentForm.current;
      const newBlend = candidates.includes("blend_components") && canSelectNewBlend(latestForm);
      const fillDefaultProcess = newBlend && currentDefaultProcessPermission.current;
      const emptyFields = candidates.filter((field) => field === "blend_components" ? newBlend
        : (fillDefaultProcess && (field === "process_method" || field === "process_detail")) || isEmpty(latestForm[field]));
      setSelections(eligibleLabelFields(latestForm, result, emptyFields).map((field) => ({
        ...selectField(latestForm, field),
        defaultProcess: fillDefaultProcess && (field === "process_method" || field === "process_detail"),
        automaticBlend: newBlend && field === "blend_components",
      })));
    } catch (failure) {
      if (sequence !== request.current.sequence) return;
      reader.dispose();
      const code = failure instanceof Error ? failure.message : "recognition_failed";
      setError(timedOut ? "timeout" : ERROR_CODES.includes(code as LabelError) ? code as LabelError : "recognition_failed");
    } finally {
      window.clearTimeout(timeout);
      if (sequence === request.current.sequence) {
        request.current.controller = null;
        setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
        setPhase("idle");
        setRetrying(false);
      }
    }
  }

  // An earlier checkbox selection never grants permission to replace a later edit.
  // Selecting that field again explicitly allows replacing its current value.
  const currentSelections = selections.filter((selection) => selectionIsCurrent(form, selection));
  // Automatic mixed-process values belong to the original automatic blend selection.
  // Removing that recipe or entering another origin revokes the linked defaults too.
  const keepDefaultProcess = allowDefaultProcessFill && canSelectNewBlend(form)
    && currentSelections.some((selection) => selection.field === "blend_components" && selection.automaticBlend)
    && Boolean(extraction && eligibleLabelFields(form, extraction, ["blend_components"]).includes("blend_components"));
  const selected = currentSelections
    .filter((selection) => !selection.defaultProcess || keepDefaultProcess)
    .map(({ field }) => field);
  const candidates = extraction ? candidatesFor(extraction) : [];
  const applicable = extraction ? eligibleLabelFields(form, extraction, selected) : [];
  const replacesExisting = applicable.some((field) => !isEmpty(form[field])
    && !selections.some((selection) => selection.field === field && selection.defaultProcess));

  function displayValue(field: LabelField) {
    if (field === "blend_components") {
      return (
        <span role="list" className="mt-2 block space-y-3">
          {extraction?.fields.blend_components?.map((component, index) => (
            <span key={index} role="listitem" className="block min-w-0">
              <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="min-w-0 break-words">{t("blendComponent", { index: index + 1 })} · {component.origin_country}</span>
                <span className="shrink-0 tabular-nums">{component.percentage}%</span>
              </span>
              {component.origin_region && <span className="mt-1 block break-words text-xs font-normal leading-5 text-brown-medium">{tb("originRegion")}: {component.origin_region}</span>}
              {component.farm_producer && <span className="mt-1 block break-words text-xs font-normal leading-5 text-brown-medium">{tb("farmProducer")}: {component.farm_producer}</span>}
              {component.varietal && <span className="mt-1 block break-words text-xs font-normal leading-5 text-brown-medium">{tb("varietal")}: {component.varietal}</span>}
              {component.process_method && <span className="mt-1 block break-words text-xs font-normal leading-5 text-brown-medium">{tb("processMethod")}: {tp(component.process_method)}</span>}
              {component.process_detail && <span className="mt-1 block break-words text-xs font-normal leading-5 text-brown-medium">{tb("processDetail")}: {component.process_detail}</span>}
            </span>
          ))}
        </span>
      );
    }
    const value = extraction?.fields[field];
    if (field === "process_method") return tp(value as Parameters<typeof tp>[0]);
    if (field === "roast_level") return tr(value as Parameters<typeof tr>[0]);
    if (field === "weight_g") return `${value} g`;
    return String(value ?? "");
  }

  const notes = extraction?.tasting_notes;
  const composition = extraction?.fields.blend_components;
  const compositionLines = extraction?.composition_lines ?? [];
  const resultVisible = Boolean(extraction && (candidates.length || compositionLines.length || notes?.en.length || notes?.ko.length || extraction?.tasting_notes_translation_ko?.length));
  const compactFields = candidates.filter((field) => !["name", "roastery", "weight_g", "blend_components"].includes(field));

  return (
    <section aria-label={t("sectionTitle")} className="min-w-0" aria-busy={busy}>
      <input
        ref={fileInput} id={`${id}-file`} type="file" accept="image/jpeg,image/png,image/webp"
        aria-label={t("choose")} hidden tabIndex={-1} disabled={disabled}
        onChange={(event) => { choosePhoto(event.target.files?.[0]); event.target.value = ""; }}
      />
      <div
        className={`min-w-0 rounded-lg border transition-colors ${dragging ? "border-accent bg-accent/5" : "border-border-light bg-surface-warm"}`}
        onDragEnter={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          dragDepth.current += 1;
          if (!disabled) setDragging(true);
        }}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = disabled ? "none" : "copy";
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          choosePhoto(event.dataTransfer.files[0]);
        }}
      >
        {!photo ? (
          <div className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="min-w-0">
              <p className="text-base font-semibold tracking-tight text-brown">{dragging ? t("dropNow") : t("sectionTitle")}</p>
              <p className="mt-1 text-xs leading-5 text-brown-light">{t("formats")}</p>
            </div>
            <Button type="button" variant="secondary" className="shrink-0" disabled={disabled} onClick={() => fileInput.current?.click()}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="mr-2 shrink-0">
                <path d="M8 5 6.5 8H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2.5L16 5H8Z" />
                <circle cx="12" cy="14" r="4" />
              </svg>
              {t("choose")}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-4 p-4 sm:p-5">
              <a href={photo.url} target="_blank" rel="noreferrer" aria-label={t("enlarge")} className="shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                <Image src={photo.url} alt={t("preview")} width={72} height={92} unoptimized className="h-23 w-18 rounded-sm bg-surface object-contain" />
              </a>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-brown-medium" title={photo.name}>{photo.name}</p>
                <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-sm font-semibold text-brown">{busy ? t(retrying ? "rereading" : phase) : error ? t("needsReview") : notice === "applied" ? t("filledTitle") : extraction ? t("review") : t("cancelledTitle")}</p>
                  <span className="text-xs tabular-nums text-brown-medium">{t("elapsed", { seconds: elapsed })}</span>
                </div>
                {busy && (
                  <div className="mt-3">
                    <progress max={1} value={phase === "preparing" ? undefined : progress} aria-label={t(phase === "preparing" ? "preparing" : phase)} className="block h-1.5 w-full accent-accent" />
                    <div className="mt-1 text-right text-xs leading-5 text-brown-medium">
                      {phase !== "preparing" && <span aria-hidden="true" className="shrink-0 tabular-nums">{Math.round(progress * 100)}%</span>}
                    </div>
                  </div>
                )}
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0">
                  {busy && <Button type="button" variant="ghost" size="sm" className="-ml-3" disabled={disabled} onClick={() => { cancelRequest(retainingResult); setNotice("cancelled"); }}>{t("cancel")}</Button>}
                  {!busy && !hasCompletedResult && <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => void readPhoto(photo, true)}>{t("retry")}</Button>}
                  <Button type="button" variant="ghost" size="sm" className="" disabled={disabled} onClick={() => fileInput.current?.click()}>{t("replace")}</Button>
                  {!busy && <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => { cancelRequest(); setPhoto(null); setError(null); setNotice(null); }}>{t("remove")}</Button>}
                </div>
              </div>
            </div>
            {resultVisible && extraction && (
              <div role="group" aria-label={t("review")} data-testid="label-result" className="min-w-0 border-t border-border-light bg-surface px-4 py-5 sm:px-5">
                {(busy || retainingResult) && <p className="mb-3 text-xs font-medium text-brown-medium">{t(retainingResult ? "previousResult" : "partialResult")}</p>}
                <div data-testid="label-result-summary" className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-brown-medium">{extraction.fields.roastery || t("missingRoastery")}</p>
                    <h3 className="mt-1 break-words text-xl font-semibold leading-7 tracking-tight text-brown">{extraction.fields.name || t(busy && !retainingResult ? "readingName" : "missingName")}</h3>
                  </div>
                  <p className="shrink-0 pt-1 text-lg font-medium tabular-nums text-brown" aria-label={`${tb("weight")}: ${extraction.fields.weight_g ? `${extraction.fields.weight_g} g` : t("missingValue")}`}>
                    {extraction.fields.weight_g ? <>{extraction.fields.weight_g}<span className="ml-1 text-xs font-normal text-brown-medium">g</span></> : <span className="text-sm text-brown-light">{t("missingWeight")}</span>}
                  </p>
                </div>
                {Boolean(composition?.length || compositionLines.length) && (
                  <div className="mt-5">
                    <h4 className="text-xs font-medium text-brown-medium">{tb("blendComposition")}</h4>
                    {composition?.length ? (
                      <ol aria-label={tb("blendComposition")} data-testid="label-composition" className="mt-2 divide-y divide-border-light">
                        {composition.map((component, index) => (
                          <li key={index} className="grid grid-cols-[3rem_minmax(0,1fr)] items-baseline gap-3 py-3 first:pt-1">
                            <span className="text-xl font-semibold tabular-nums tracking-tight text-brown">{component.percentage}<span className="ml-0.5 text-xs font-normal">%</span></span>
                            <div className="min-w-0">
                              <p className="break-words text-sm font-medium leading-6 text-brown">{compositionLines[index]?.replace(/\s*\d+(?:[.,]\d+)?\s*%\s*$/u, "").trim() || [component.origin_country, component.origin_region, component.farm_producer].filter(Boolean).join(" · ")}</p>
                              {!compositionLines[index] && <p className="mt-0.5 break-words text-xs leading-5 text-brown-medium">{[component.varietal, component.process_detail || (component.process_method ? tp(component.process_method) : undefined)].filter(Boolean).join(" · ")}</p>}
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : <ul className="mt-2 space-y-2">{compositionLines.map((line, index) => <li key={index} className="break-words text-sm leading-6 text-brown">{line}</li>)}</ul>}
                  </div>
                )}
                {Boolean(notes?.en.length || notes?.ko.length || extraction?.tasting_notes_translation_ko?.length) && (
                  <div data-testid="label-tasting-notes" className="mt-4 border-t border-border-light pt-4">
                    <h4 className="text-xs font-medium text-brown-medium">{t("tastingNotes")}</h4>
                    {Boolean(notes?.en.length) && <p lang="en" className="mt-2 break-words text-sm leading-6 text-brown">{notes?.en.join(", ")}</p>}
                    {Boolean(notes?.ko.length && !extraction.tasting_notes_translation_ko?.length) && <p lang="ko" className="mt-1 break-words text-sm leading-6 text-brown">{notes?.ko.join(", ")}</p>}
                    {Boolean(extraction.tasting_notes_translation_ko?.length) && <p lang="ko" className="mt-2 break-words text-sm leading-6 text-brown"><span className="mr-2 text-xs text-brown-medium">{t("translatedNotes")}</span>{extraction.tasting_notes_translation_ko?.join(", ")}</p>}
                  </div>
                )}
                {compactFields.length > 0 && !composition?.length && (
                  <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 border-t border-border-light pt-4 text-sm leading-6">
                    {compactFields.map((field) => <div key={field} className="contents"><dt className="text-xs text-brown-medium">{tb(FIELD_LABELS[field])}</dt><dd className="min-w-0 break-words text-brown">{displayValue(field)}</dd></div>)}
                  </dl>
                )}
                {(!busy || retainingResult) && candidates.length > 0 && (
                  <>
                    <div className="mt-5 border-t border-border-light pt-4">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button type="button" className="w-full sm:w-auto" disabled={disabled || busy || !applicable.length} onClick={() => {
                          onApply(extraction, applicable); setSelections([]); setError(null); setNotice("applied");
                        }}>{t("apply")}</Button>
                        {hasCompletedResult && <Button type="button" variant="secondary" className="w-full sm:w-auto" disabled={disabled || busy} onClick={() => void readPhoto(photo, true)}>
                          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="mr-2 shrink-0">
                            <path d="M20 7v5h-5M4 17v-5h5" />
                            <path d="M6.1 7a7 7 0 0 1 11.8-1L20 9M4 15l2.1 3A7 7 0 0 0 17.9 17" />
                          </svg>
                          {t("retry")}
                        </Button>}
                      </div>
                      {!applicable.length && notice !== "applied" && <p className="mt-2 text-xs leading-5 text-brown-medium">{t("noSelectionHint")}</p>}
                      {replacesExisting && <p className="mt-1 text-xs leading-5 text-brown-medium">{t("replaceWarning")}</p>}
                    </div>
                    <details data-testid="label-field-choices" className="mt-2 min-w-0">
                      <summary className="min-h-11 cursor-pointer py-3 text-xs font-medium text-brown focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">{t("selectionDetails")}</summary>
                      <fieldset disabled={disabled || busy}>
                        <legend className="sr-only">{t("selectionDetails")}</legend>
                        <div className="divide-y divide-border-light">
                          {candidates.map((field) => {
                            const blocked = blockedReason(form, extraction, field, selected);
                            return (
                              <label key={field} className="flex min-h-11 items-start gap-3 py-3">
                                <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                  aria-label={tb(FIELD_LABELS[field])} checked={applicable.includes(field)} disabled={disabled || busy || Boolean(blocked)}
                                  onChange={(event) => {
                                    const checked = event.target.checked;
                                    setNotice(null);
                                    setSelections((previous) => [
                                      ...previous.filter((selection) => selection.field !== field && selectionIsCurrent(form, selection)),
                                      ...(checked ? [selectField(form, field)] : []),
                                    ]);
                                  }} />
                                <span className="min-w-0 flex-1">
                                  <span className="block text-xs text-brown-light">{tb(FIELD_LABELS[field])}</span>
                                  <span className="block break-words text-sm font-medium text-brown">{displayValue(field)}</span>
                                  <span className="mt-1 block whitespace-pre-wrap break-words text-xs leading-5 text-brown-medium">{t("evidence", { text: extraction.evidence[field] ?? "" })}</span>
                                  {blocked && <span className="mt-1 block text-xs leading-5 text-brown-medium">{t(blocked)}</span>}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    </details>
                  </>
                )}
              </div>
            )}
            {rawText !== null && (
              <details className="min-w-0 border-t border-border-light px-4 text-xs text-brown-medium sm:px-5" open={!busy && candidates.length === 0}>
                <summary className="min-h-11 cursor-pointer py-3 font-medium text-brown focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">{t("rawText")}</summary>
                <pre tabIndex={0} aria-label={t("rawText")} className="mb-4 max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-sm border border-border-light bg-surface p-3 font-sans text-sm leading-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">{rawText || t("noText")}</pre>
              </details>
            )}
          </>
        )}
      </div>
      <div role="status" aria-live="polite" aria-atomic="true" className={error || notice === "cancelled" ? "mt-1 text-sm leading-6 text-brown-medium" : "sr-only"}>
        {error ? t(`errors.${error}`) : busy ? t(retrying ? "rereading" : phase) : notice ? t(notice) : extraction ? t("found", { count: candidates.length }) : ""}
      </div>
    </section>
  );
}
