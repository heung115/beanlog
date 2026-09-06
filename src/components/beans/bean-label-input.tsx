"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { eligibleLabelFields, LABEL_FIELDS, type LabelExtraction, type LabelField } from "@/lib/coffee/bean-label";
import { createBrowserLabelReader, type LabelReadProgress } from "@/lib/coffee/bean-label-ocr";
import type { BeanFormData } from "@/types/database";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_PHOTO_DIMENSION = 2200;
const READ_TIMEOUT_MS = 180_000;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const FIELD_LABELS = {
  name: "name", roastery: "roastery", origin_country: "originCountry",
  origin_region: "originRegion", farm_producer: "farmProducer", varietal: "varietal",
  process_method: "processMethod", process_detail: "processDetail",
  roast_level: "roastLevel", roast_date: "roastDate", weight_g: "weight",
} as const;
const ERROR_CODES = [
  "browser_unsupported", "loading_failed", "invalid_image", "image_too_large",
  "no_fields", "recognition_failed", "timeout",
] as const;
type LabelError = typeof ERROR_CODES[number];
type Phase = "idle" | "preparing" | LabelReadProgress["phase"];
type LabelSelection = { field: LabelField; valueAtSelection: BeanFormData[LabelField] };

interface BeanLabelInputProps {
  form: BeanFormData;
  onApply: (extraction: LabelExtraction, selected: LabelField[]) => void;
  disabled?: boolean;
}

function isEmpty(value: unknown) {
  return value === undefined || value === null || (typeof value === "string" && !value.trim());
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

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Lossless pixels keep small label text readable without an upload-size target.
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("invalid_image")), "image/png");
  });
}

async function preparePhoto(url: string, signal: AbortSignal): Promise<Blob> {
  signal.throwIfAborted();
  const picture = new window.Image();
  const abort = () => { picture.src = ""; };
  signal.addEventListener("abort", abort, { once: true });
  try {
    picture.src = url;
    try { await picture.decode(); }
    catch { signal.throwIfAborted(); throw new Error("invalid_image"); }
    signal.throwIfAborted();
    if (!picture.naturalWidth || !picture.naturalHeight || picture.naturalWidth * picture.naturalHeight > 100_000_000) {
      throw new Error("invalid_image");
    }
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("invalid_image");
    const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(picture.naturalWidth, picture.naturalHeight));
    canvas.width = Math.max(1, Math.round(picture.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(picture.naturalHeight * scale));
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(picture, 0, 0, canvas.width, canvas.height);
    const blob = await canvasBlob(canvas);
    signal.throwIfAborted();
    return blob;
  } finally {
    signal.removeEventListener("abort", abort);
    picture.src = "";
  }
}

export function BeanLabelInput({ form, onApply, disabled = false }: BeanLabelInputProps) {
  const t = useTranslations("beans.labelImport");
  const tb = useTranslations("beans");
  const tp = useTranslations("process");
  const tr = useTranslations("roast");
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const currentForm = useRef(form);
  const request = useRef<{ sequence: number; controller: AbortController | null }>({ sequence: 0, controller: null });
  const [reader] = useState(createBrowserLabelReader);
  const [photo, setPhoto] = useState<{ url: string; name: string } | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<LabelError | null>(null);
  const [notice, setNotice] = useState<"applied" | "cancelled" | null>(null);
  const [extraction, setExtraction] = useState<LabelExtraction | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);
  const [selections, setSelections] = useState<LabelSelection[]>([]);
  const busy = phase !== "idle";

  useEffect(() => { currentForm.current = form; }, [form]);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);
  useEffect(() => () => {
    request.current.sequence += 1;
    request.current.controller?.abort();
    reader.dispose();
  }, [reader]);

  function clearResults() {
    setExtraction(null);
    setRawText(null);
    setSelections([]);
  }

  function cancelRequest() {
    request.current.sequence += 1;
    request.current.controller?.abort();
    request.current.controller = null;
    reader.dispose();
    setPhase("idle");
    setProgress(0);
    clearResults();
  }

  function choosePhoto(file?: File) {
    if (!file || disabled) return;
    cancelRequest();
    setPhoto(null);
    setNotice(null);
    if (!IMAGE_TYPES.has(file.type)) { setError("invalid_image"); return; }
    if (file.size > MAX_FILE_BYTES) { setError("image_too_large"); return; }
    setError(null);
    setPhoto({ url: URL.createObjectURL(file), name: file.name });
  }

  async function readPhoto() {
    if (!photo || disabled || busy || request.current.controller) return;
    const sequence = ++request.current.sequence;
    const controller = new AbortController();
    request.current.controller = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, READ_TIMEOUT_MS);
    setPhase("preparing");
    setProgress(0);
    setError(null);
    setNotice(null);
    clearResults();
    try {
      const image = await preparePhoto(photo.url, controller.signal);
      if (sequence !== request.current.sequence) return;
      setPhase("loading");
      const { text, extraction: result } = await reader.recognize(image, {
        signal: controller.signal,
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
      setRawText(text.trim());
      const candidates = candidatesFor(result);
      if (!candidates.length) {
        setError("no_fields");
        return;
      }
      const latestForm = currentForm.current;
      const emptyFields = candidates.filter((field) => isEmpty(latestForm[field]));
      setSelections(eligibleLabelFields(latestForm, result, emptyFields).map((field) => ({
        field, valueAtSelection: latestForm[field],
      })));
      setExtraction(result);
    } catch (failure) {
      if (sequence !== request.current.sequence) return;
      reader.dispose();
      const code = failure instanceof Error ? failure.message : "recognition_failed";
      setError(timedOut ? "timeout" : ERROR_CODES.includes(code as LabelError) ? code as LabelError : "recognition_failed");
    } finally {
      window.clearTimeout(timeout);
      if (sequence === request.current.sequence) {
        request.current.controller = null;
        setPhase("idle");
      }
    }
  }

  // An earlier checkbox selection never grants permission to replace a later edit.
  // Selecting that field again explicitly allows replacing its current value.
  const selected = selections
    .filter(({ field, valueAtSelection }) => Object.is(form[field], valueAtSelection))
    .map(({ field }) => field);
  const candidates = extraction ? candidatesFor(extraction) : [];
  const applicable = extraction ? eligibleLabelFields(form, extraction, selected) : [];
  const replacesExisting = applicable.some((field) => !isEmpty(form[field]));

  function displayValue(field: LabelField) {
    const value = extraction?.fields[field];
    if (field === "process_method") return tp(value as Parameters<typeof tp>[0]);
    if (field === "roast_level") return tr(value as Parameters<typeof tr>[0]);
    if (field === "weight_g") return `${value} g`;
    return String(value ?? "");
  }

  return (
    <div className="flex flex-col gap-3" aria-busy={busy}>
      <input
        ref={fileInput} id={`${id}-file`} type="file" accept="image/jpeg,image/png,image/webp"
        aria-label={t("choose")} hidden tabIndex={-1} disabled={disabled}
        onChange={(event) => { choosePhoto(event.target.files?.[0]); event.target.value = ""; }}
      />
      <div>
        <Button type="button" variant="secondary" disabled={disabled} onClick={() => fileInput.current?.click()}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="mr-2 shrink-0">
            <path d="M8 5 6.5 8H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2.5L16 5H8Z" />
            <circle cx="12" cy="14" r="4" />
          </svg>
          {photo ? t("replace") : t("choose")}
        </Button>
        {!photo && (
          <div className="mt-2 text-xs leading-5 text-brown-medium">
            <p>{t("intro")}</p>
            <p className="mt-1">{t("privacy")}</p>
          </div>
        )}
      </div>
      {photo && (
        <div className="flex flex-col gap-4 rounded-lg bg-surface-warm p-4">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:gap-4">
            <Image src={photo.url} alt={t("preview")} width={88} height={112} unoptimized className="h-28 w-[88px] shrink-0 rounded-sm bg-surface object-contain" />
            <div className="w-full min-w-0 flex-1 sm:w-auto">
              <p className="break-words text-sm font-medium text-brown">{photo.name}</p>
              <a href={photo.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-11 items-center text-xs font-medium text-accent underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">{t("enlarge")}</a>
              <p id={`${id}-privacy`} className="mt-1 text-xs leading-5 text-brown-medium">{t("privacy")}</p>
              <Button type="button" variant="ghost" size="sm" className="mt-1 -ml-3" disabled={disabled} onClick={() => {
                cancelRequest(); setPhoto(null); setError(null); setNotice(null);
              }}>{t("remove")}</Button>
            </div>
          </div>
          <p className="text-xs leading-5 text-brown-medium">{t("readyHint")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" aria-describedby={`${id}-privacy`} disabled={disabled || busy} loading={busy} onClick={readPhoto}>
              {busy ? t(phase) : error ? t("retry") : t("read")}
            </Button>
            {busy && <Button type="button" variant="ghost" disabled={disabled} onClick={() => { cancelRequest(); setNotice("cancelled"); }}>{t("cancel")}</Button>}
          </div>
          {(phase === "loading" || phase === "reading") && (
            <div>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs leading-5 text-brown-medium" aria-hidden="true">
                <span>{t(phase)}</span>
                <span className="shrink-0 tabular-nums">{Math.round(progress * 100)}%</span>
              </div>
              <progress max={1} value={progress} aria-label={t(phase)} className="block h-2 w-full accent-accent" />
            </div>
          )}
          {rawText !== null && (
            <details className="min-w-0 text-xs text-brown-medium" open={candidates.length === 0}>
              <summary className="min-h-11 cursor-pointer py-3 font-medium text-brown focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">{t("rawText")}</summary>
              <p className="mb-2 leading-5">{t("rawTextHint")}</p>
              <pre tabIndex={0} aria-label={t("rawText")} className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-sm border border-border-light bg-surface p-3 font-sans text-sm leading-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">{rawText || t("noText")}</pre>
            </details>
          )}
          {extraction && candidates.length > 0 && (
            <fieldset className="min-w-0" disabled={disabled}>
              <legend className="mb-1 text-sm font-semibold text-brown">{t("review")}</legend>
              <p className="mb-3 text-xs leading-5 text-brown-medium">{t("reviewHint")}</p>
              {(form.bean_type === "blend" || extraction.bean_type === "blend") && <p className="mb-3 text-xs leading-5 text-brown-medium">{t("blendOriginHint")}</p>}
              <div className="divide-y divide-border-light">
                {candidates.map((field) => {
                  const blocked = blockedReason(form, extraction, field, selected);
                  return (
                    <label key={field} className="flex min-h-11 items-start gap-3 py-3">
                      <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        aria-label={tb(FIELD_LABELS[field])} checked={applicable.includes(field)} disabled={disabled || Boolean(blocked)}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setSelections((previous) => [
                            ...previous.filter((selection) => selection.field !== field
                              && Object.is(form[selection.field], selection.valueAtSelection)),
                            ...(checked ? [{ field, valueAtSelection: form[field] }] : []),
                          ]);
                        }} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-brown-light">{tb(FIELD_LABELS[field])}</span>
                        <span className="block break-words text-sm font-medium text-brown">{displayValue(field)}</span>
                        <span className="mt-1 block break-words text-xs leading-5 text-brown-medium">{t("evidence", { text: extraction.evidence[field] ?? "" })}</span>
                        {blocked && <span className="mt-1 block text-xs leading-5 text-brown-medium">{t(blocked)}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
              {replacesExisting && <p className="mt-2 text-xs leading-5 text-brown-medium">{t("replaceWarning")}</p>}
              <Button type="button" className="mt-4" disabled={disabled || !applicable.length} onClick={() => {
                onApply(extraction, applicable); setExtraction(null); setSelections([]); setNotice("applied");
              }}>{t("apply")}</Button>
            </fieldset>
          )}
        </div>
      )}
      <div role="status" aria-live="polite" aria-atomic="true" className="text-sm leading-6 text-brown-medium">
        {error ? t(`errors.${error}`) : notice ? t(notice) : busy ? t(phase) : extraction ? t("found", { count: candidates.length }) : ""}
      </div>
    </div>
  );
}
