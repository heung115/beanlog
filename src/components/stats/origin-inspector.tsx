"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { isOriginPlottable } from "@/data/origin-map";
import type { OriginMapEntry } from "@/types/stats";

export type OriginInspectorView = "list" | "detail";

interface OriginInspectorProps {
  entries: OriginMapEntry[];
  locale: string;
  open: boolean;
  view: OriginInspectorView;
  selectedEntry: OriginMapEntry | null;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  onSelect: (entry: OriginMapEntry) => void;
  onBack: () => void;
  onClose: () => void;
}

function countryName(entry: OriginMapEntry, locale: string, unmappedLabel: string) {
  const localized = locale === "ko" && entry.nameKo ? entry.nameKo : entry.nameEn;
  return localized.trim() || entry.nameKo?.trim() || entry.nameEn.trim() || unmappedLabel;
}

function regionName(
  region: OriginMapEntry["regions"][number],
  locale: string,
  unspecifiedLabel: string
) {
  if (!region.name.trim() && !region.nameKo?.trim()) return unspecifiedLabel;
  return locale === "ko" && region.nameKo ? region.nameKo : region.name;
}

export function OriginInspector({
  entries,
  locale,
  open,
  view,
  selectedEntry,
  returnFocusRef,
  onSelect,
  onBack,
  onClose,
}: OriginInspectorProps) {
  const t = useTranslations("stats");
  const tCommon = useTranslations("common");
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState("");

  const filteredEntries = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(locale);
    if (!normalized) return entries;

    return entries.filter((entry) =>
      [
        entry.nameEn,
        entry.nameKo ?? "",
        !isOriginPlottable(entry) ? t("unmappedOrigin") : "",
      ]
        .some((name) => name.toLocaleLowerCase(locale).includes(normalized))
    );
  }, [entries, locale, query, t]);
  const locatedEntries = filteredEntries.filter(isOriginPlottable);
  const unlocatedEntries = filteredEntries.filter(
    (entry) => !isOriginPlottable(entry)
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;

    if (!dialog.open) dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    const returnFocusElement = returnFocusRef.current;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
      window.requestAnimationFrame(() => returnFocusElement?.focus());
    };
  }, [open, returnFocusRef]);

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      if (view === "list") searchRef.current?.focus();
      else backRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, view]);

  function requestClose() {
    setQuery("");
    onClose();
  }

  function handleBackdropClick(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!inside) requestClose();
  }

  const selectedName = selectedEntry
    ? countryName(selectedEntry, locale, t("unmappedOrigin"))
    : t("findOrigin");

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={handleBackdropClick}
      className={cn(
        "fixed inset-x-0 bottom-0 top-auto m-0 hidden h-[min(70dvh,36rem)] max-h-[70dvh] w-full max-w-none flex-col overflow-hidden",
        "rounded-t-lg bg-surface p-0 text-brown shadow-[0_0_1.5rem_color-mix(in_srgb,var(--color-brown)_8%,transparent)] backdrop:bg-brown/30 open:flex",
        "md:inset-y-0 md:left-auto md:right-0 md:h-dvh md:max-h-dvh md:w-80 md:max-w-80 md:rounded-l-lg md:rounded-r-none"
      )}
    >
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2">
          {view === "detail" && (
            <button
              ref={backRef}
              type="button"
              onClick={onBack}
              className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-brown-light transition-colors duration-150 hover:text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <span aria-hidden="true" className="mr-1">←</span>
              {t("allOrigins")}
            </button>
          )}
          <h3
            id={titleId}
            className="truncate font-display text-base font-semibold tracking-tight text-brown"
          >
            {view === "detail" ? selectedName : t("findOrigin")}
          </h3>
        </div>
        <button
          type="button"
          onClick={requestClose}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-sm font-medium text-brown-light transition-colors duration-150 hover:text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          {tCommon("close")}
        </button>
      </header>

      {view === "list" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 p-3">
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchOrigin")}
              aria-label={t("searchOrigin")}
              autoComplete="off"
              className={cn(
                "min-h-11 w-full rounded-md border border-border-light bg-surface-warm px-3 py-2.5 text-sm text-brown",
                "placeholder:text-brown-light/50 transition-colors duration-150 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
              )}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(1rem+env(safe-area-inset-bottom))] md:pb-4">
            {locatedEntries.length > 0 && (
              <ul
                aria-label={t("originListLabel")}
                className="space-y-0.5 px-2 py-1"
              >
                {locatedEntries.map((entry) => {
                  const name = countryName(entry, locale, t("unmappedOrigin"));
                  const selected = selectedEntry?.nameEn === entry.nameEn;
                  return (
                    <li key={`${entry.countryId ?? "mapped"}:${entry.nameEn}`}>
                      <button
                        type="button"
                        aria-current={selected ? "true" : undefined}
                        onClick={() => onSelect(entry)}
                        className={cn(
                          "grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-2.5 text-left",
                          "text-sm transition-colors duration-150 hover:bg-cream-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50",
                          selected && "bg-cream-dark"
                        )}
                      >
                        <span className="truncate font-medium text-brown">{name}</span>
                        <span className="tabular-nums text-xs text-brown-light">{entry.count}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {unlocatedEntries.length > 0 && (
              <section aria-labelledby={`${titleId}-unmapped`}>
                <h4
                  id={`${titleId}-unmapped`}
                  className="px-4 pb-2 pt-5 text-xs font-medium text-brown-light"
                >
                  {t("unmappedOrigin")}
                </h4>
                <ul className="space-y-0.5 px-2 pb-1">
                  {unlocatedEntries.map((entry) => {
                    const name = countryName(entry, locale, t("unmappedOrigin"));
                    const selected = selectedEntry?.nameEn === entry.nameEn;
                    return (
                      <li key={`${entry.countryId ?? "unmapped"}:${entry.nameEn}`}>
                        <button
                          type="button"
                          aria-current={selected ? "true" : undefined}
                          onClick={() => onSelect(entry)}
                          className={cn(
                            "grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-2.5 text-left",
                            "text-sm transition-colors duration-150 hover:bg-cream-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50",
                            selected && "bg-cream-dark"
                          )}
                        >
                          <span className="truncate font-medium text-brown">{name}</span>
                          <span className="tabular-nums text-xs text-brown-light">{entry.count}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {filteredEntries.length === 0 && (
              <p className="px-4 py-8 text-sm text-brown-light">
                {t("noOriginMatch")}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(1rem+env(safe-area-inset-bottom))] md:pb-4">
          <p className="px-4 pb-2 pt-4 text-xs font-medium text-brown-light">
            {t("subregions")}
          </p>
          {selectedEntry && selectedEntry.regions.length > 0 ? (
            <ul className="space-y-0.5 px-2 py-1">
              {selectedEntry.regions.map((region) => (
                <li
                  key={`${region.regionId ?? "region"}:${region.name}`}
                  className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-2.5"
                >
                  <span className="truncate text-sm font-medium text-brown">
                    {regionName(region, locale, t("regionUnspecified"))}
                  </span>
                  <span className="tabular-nums text-xs text-brown-light">
                    {region.count}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-sm text-brown-light">
              {t("noSubregionData")}
            </p>
          )}
        </div>
      )}
    </dialog>
  );
}
