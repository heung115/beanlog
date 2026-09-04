"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  flavorCategories,
  flavorPresets,
  normalizeTag,
  type FlavorTag,
} from "@/data/flavor-wheel";
import { cn } from "@/lib/utils";

export interface TagValue {
  tag: string;
  category: string;
}

interface TagInputProps {
  value: TagValue[];
  onChange: (tags: TagValue[]) => void;
}

/** Locale-aware display name for a stored tag (falls back to the raw tag). */
export function tagDisplayName(tag: string, locale: string): string {
  const preset = flavorPresets.find((p) => p.tag === tag);
  if (!preset) return tag;
  return locale === "ko" ? preset.tagKo : preset.tag;
}

function presetLabel(preset: FlavorTag, locale: string): string {
  return locale === "ko" ? preset.tagKo : preset.tag;
}

export function TagInput({ value, onChange }: TagInputProps) {
  const t = useTranslations("beans");
  const locale = useLocale();
  const [draft, setDraft] = useState("");

  const selectedTags = new Set(value.map((v) => v.tag));

  function togglePreset(preset: FlavorTag) {
    if (selectedTags.has(preset.tag)) {
      onChange(value.filter((v) => v.tag !== preset.tag));
    } else {
      onChange([...value, { tag: preset.tag, category: preset.category }]);
    }
  }

  function addCustom() {
    const tag = normalizeTag(draft);
    if (!tag) return;
    setDraft("");
    if (selectedTags.has(tag)) return;

    const preset = flavorPresets.find((p) => p.tag === tag);
    onChange([
      ...value,
      preset
        ? { tag: preset.tag, category: preset.category }
        : { tag, category: "other" },
    ]);
  }

  function removeTag(tag: string) {
    onChange(value.filter((v) => v.tag !== tag));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Selected tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-cream-dark/60 p-3">
          {value.map((v) => (
            <span
              key={v.tag}
              className="animate-rise inline-flex items-center gap-1.5 rounded-sm bg-brown py-1 pl-2.5 pr-1.5 text-xs font-medium text-cream"
            >
              {tagDisplayName(v.tag, locale)}
              <button
                type="button"
                onClick={() => removeTag(v.tag)}
                aria-label={t("removeTag", {
                  tag: tagDisplayName(v.tag, locale),
                })}
                className="flex h-4 w-4 items-center justify-center rounded-full text-cream/70 transition-colors hover:bg-cream/20 hover:text-cream"
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path
                    d="M1 1l6 6M7 1L1 7"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </span>
          ))}
          <span className="ml-auto text-[11px] tabular-nums text-brown-light/60">
            {value.length} {t("tagsAdded")}
          </span>
        </div>
      )}

      {/* Custom tag input */}
      <input
        type="text"
        aria-label={t("tastingNotesPlaceholder")}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            addCustom();
          }
        }}
        placeholder={t("tastingNotesPlaceholder")}
        className={cn(
          "min-h-12 w-full rounded-md border border-border-light bg-surface px-3.5 py-2.5 text-sm text-brown placeholder:text-brown-light/60",
          "transition-colors duration-150 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
        )}
      />

      {/* Flavor wheel presets */}
      <div className="flex flex-col gap-3.5">
        {flavorCategories.map((category) => {
          const presets = flavorPresets.filter(
            (p) => p.category === category.id
          );
          if (presets.length === 0) return null;
          return (
            <div key={category.id} className="flex flex-col gap-1.5">
              <span className="folio-label">
                {locale === "ko" ? category.labelKo : category.label}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((preset) => {
                  const selected = selectedTags.has(preset.tag);
                  return (
                    <button
                      key={preset.tag}
                      type="button"
                      onClick={() => togglePreset(preset)}
                      aria-pressed={selected}
                      className={cn(
                        "rounded-sm border px-2.5 py-1 text-xs transition-all duration-150",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                        selected
                          ? "border-transparent bg-brown text-cream"
                          : "border-border-light bg-surface text-brown-medium hover:border-border hover:text-brown"
                      )}
                    >
                      {presetLabel(preset, locale)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
