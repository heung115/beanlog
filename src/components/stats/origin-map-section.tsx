"use client";

import { useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { OriginMapEntry } from "@/types/stats";
import { OriginMap } from "./origin-map";
import {
  OriginInspector,
  type OriginInspectorView,
} from "./origin-inspector";

interface OriginMapSectionProps {
  entries: OriginMapEntry[];
}

export function OriginMapSection({ entries }: OriginMapSectionProps) {
  const t = useTranslations("stats");
  const locale = useLocale();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorView, setInspectorView] = useState<OriginInspectorView>("list");

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.nameEn === selectedCountry) ?? null,
    [entries, selectedCountry]
  );

  function showOriginList() {
    setInspectorView("list");
    setInspectorOpen(true);
  }

  function selectOrigin(entry: OriginMapEntry) {
    setSelectedCountry(entry.nameEn);
    setInspectorView("detail");
    setInspectorOpen(true);
  }

  return (
    <section className="stats-rise" style={{ animationDelay: "300ms" }}>
      <div className="mb-4 flex items-center gap-3">
        <span className="font-display text-sm font-semibold text-accent-light">02</span>
        <h2 className="font-display text-lg font-bold tracking-tight text-brown">
          {t("originMapTitle")}
        </h2>
        <div className="h-px min-w-3 flex-1 bg-border-light" />
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={inspectorOpen}
          onClick={showOriginList}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center border-b border-transparent text-sm font-medium text-brown-light",
            "transition-colors duration-150 hover:border-accent hover:text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          )}
        >
          {t("findOrigin")}
        </button>
      </div>

      <div className="journal-panel relative h-80 overflow-hidden bg-surface-warm md:h-96">
        <OriginMap
          entries={entries}
          selectedCountry={selectedCountry}
          onSelect={selectOrigin}
          labels={{
            zoomIn: t("zoomIn"),
            zoomOut: t("zoomOut"),
            reset: t("resetMap"),
            modifierHint: t("mapModifierHint"),
            description: t("mapDescription"),
          }}
        />
      </div>

      <OriginInspector
        entries={entries}
        locale={locale}
        open={inspectorOpen}
        view={inspectorView}
        selectedEntry={selectedEntry}
        returnFocusRef={triggerRef}
        onSelect={selectOrigin}
        onBack={() => setInspectorView("list")}
        onClose={() => setInspectorOpen(false)}
      />
    </section>
  );
}
