"use client";

import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
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
  draft: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  onDraftChange: (draft: string) => void;
}

export function tagsWithDraft(value: TagValue[], draft: string): TagValue[] {
  const text = draft.trim();
  const normalized = normalizeTag(text);
  const preset = flavorPresets.find((item) => item.tag === normalized || item.tagKo === text);
  const tag = preset?.tag ?? text.toLowerCase().replace(/\s+/g, "-");
  if (!tag || value.some((item) => item.tag === tag)) return value;
  return [...value, { tag, category: preset?.category ?? "other" }];
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

export function TagInput({ value, onChange, draft, onDraftChange, "aria-invalid": ariaInvalid, "aria-describedby": ariaDescribedBy }: TagInputProps) {
  const t = useTranslations("beans");
  const locale = useLocale();

  const selectedTags = new Set(value.map((v) => v.tag));

  function togglePreset(preset: FlavorTag) {
    if (selectedTags.has(preset.tag)) {
      onChange(value.filter((v) => v.tag !== preset.tag));
    } else if (value.length < 30) {
      onChange([...value, { tag: preset.tag, category: preset.category }]);
    }
  }

  function addCustom() {
    const tags = tagsWithDraft(value, draft);
    if (tags.length > 30) return;
    onChange(tags);
    onDraftChange("");
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
      <div className="flex items-start gap-2">
        <input
          type="text"
          name="tasting_tags_draft"
          aria-label={t("tastingNotesPlaceholder")}
          aria-describedby={ariaDescribedBy ? `tasting-tag-hint ${ariaDescribedBy}` : "tasting-tag-hint"}
          aria-invalid={ariaInvalid}
          maxLength={50}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder={t("tastingNotesPlaceholder")}
          className={cn(
            "min-h-12 min-w-0 flex-1 rounded-md border border-border-light bg-surface px-3.5 py-2.5 text-sm text-brown placeholder:text-brown-light/60",
            "transition-colors duration-150 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
          )}
        />
        <Button type="button" variant="secondary" className="shrink-0" onClick={addCustom} disabled={!draft.trim() || value.length >= 30}>
          {t("addTag")}
        </Button>
      </div>
      <p id="tasting-tag-hint" className="text-xs text-brown-medium">
        {value.length >= 30 ? t("tagLimit") : t("tagInputHint")}
      </p>

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
                      disabled={!selected && value.length >= 30}
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
