"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Select } from "@/components/ui/select";
import { SubregionInput, nextSubregionSuggestions } from "@/components/beans/subregion-input";
import { findCountryPreset } from "@/data/origin-presets";
import { varietalOptions } from "@/data/varietal-presets";
import {
  getOriginCountries,
  getOriginEntities,
  getOriginRegions,
  getUserOriginSubregions,
} from "@/lib/actions/origins";
import { cn } from "@/lib/utils";
import type {
  BlendComponent,
  OriginCountryOption,
  OriginEntityOption,
  OriginRegionOption,
  ProcessMethod,
} from "@/types/database";

interface BlendComposerProps {
  value: BlendComponent[];
  onChange: (components: BlendComponent[]) => void;
}

export function BlendComposer({ value, onChange }: BlendComposerProps) {
  const locale = useLocale();
  const t = useTranslations("beans");
  const tp = useTranslations("process");
  const [expandedEntityRows, setExpandedEntityRows] = useState<Record<number, boolean>>({});
  const [originCountries, setOriginCountries] = useState<OriginCountryOption[]>([]);
  const [regionsByCountry, setRegionsByCountry] = useState<
    Record<number, OriginRegionOption[]>
  >({});
  const [entitiesByRegion, setEntitiesByRegion] = useState<
    Record<string, OriginEntityOption[]>
  >({});
  const [subregionsByOrigin, setSubregionsByOrigin] = useState<Record<string, string[][]>>({});

  const countryOptions = useMemo(() => {
    const ko = locale === "ko";
    return originCountries.map((country) => ({
      value: country.name_en,
      label: ko ? country.name_ko ?? country.name_en : country.name_en,
      sublabel: ko ? country.name_en : country.name_ko ?? undefined,
    }));
  }, [locale, originCountries]);

  const findMatchingOption = useCallback((
    text: string,
    options: ComboboxOption[]
  ): ComboboxOption | undefined => {
    const query = text.trim().toLowerCase();
    if (!query) return undefined;
    return options.find(
      (option) =>
        option.value.toLowerCase() === query ||
        option.label.toLowerCase() === query ||
        option.sublabel?.toLowerCase() === query
    );
  }, []);

  const countryIdFor = useCallback((comp: BlendComponent): number | undefined => {
    if (comp.origin_country_id) return comp.origin_country_id;
    const matched = findMatchingOption(comp.origin_country, countryOptions);
    return originCountries.find((country) => country.name_en === matched?.value)?.id;
  }, [countryOptions, findMatchingOption, originCountries]);

  const regionOptionsFor = useCallback((comp: BlendComponent): ComboboxOption[] => {
    const countryId = countryIdFor(comp);
    if (!countryId) return [];
    const ko = locale === "ko";
    return (regionsByCountry[countryId] ?? []).map((region) => ({
      value: region.name,
      label: ko ? region.name_ko ?? region.name : region.name,
      sublabel: ko ? region.name : region.name_ko ?? undefined,
    }));
  }, [countryIdFor, locale, regionsByCountry]);

  const regionIdFor = useCallback((comp: BlendComponent): number | undefined => {
    if (comp.origin_region_id) return comp.origin_region_id;
    const countryId = countryIdFor(comp);
    if (!countryId || !comp.origin_region) return undefined;
    const options = regionOptionsFor(comp);
    const matched = findMatchingOption(comp.origin_region, options);
    return regionsByCountry[countryId]?.find((region) => region.name === matched?.value)?.id;
  }, [countryIdFor, findMatchingOption, regionOptionsFor, regionsByCountry]);

  function entityOptionsFor(comp: BlendComponent): ComboboxOption[] {
    const countryId = countryIdFor(comp);
    const regionId = regionIdFor(comp);
    if (!countryId || !regionId) return [];
    const ko = locale === "ko";
    return (entitiesByRegion[`${countryId}:${regionId}`] ?? []).map((entity) => ({
      value: entity.name,
      label: ko ? entity.name_ko ?? entity.name : entity.name,
      sublabel: ko
        ? [entity.name, entity.entity_type].filter(Boolean).join(" · ")
        : entity.entity_type ?? entity.name_ko ?? undefined,
      }));
  }

  useEffect(() => {
    let active = true;
    startTransition(() => {
      void getOriginCountries().then((countries) => {
        if (active) setOriginCountries(countries);
      });
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const countryIds = Array.from(
      new Set(value.map((comp) => countryIdFor(comp)).filter((id): id is number => Boolean(id)))
    ).filter((id) => !regionsByCountry[id]);

    if (countryIds.length === 0) return;

    let active = true;
    startTransition(() => {
      countryIds.forEach((countryId) => {
        void getOriginRegions(countryId).then((regions) => {
          if (!active) return;
          setRegionsByCountry((prev) => ({ ...prev, [countryId]: regions }));
        });
      });
    });
    return () => {
      active = false;
    };
  }, [countryIdFor, regionsByCountry, value]);

  useEffect(() => {
    const regionKeys = Array.from(
      new Set(
        value
          .map((comp) => {
            const countryId = countryIdFor(comp);
            const regionId = regionIdFor(comp);
            return countryId && regionId ? `${countryId}:${regionId}` : null;
          })
          .filter((key): key is string => Boolean(key))
      )
    ).filter((key) => !entitiesByRegion[key]);

    if (regionKeys.length === 0) return;

    let active = true;
    startTransition(() => {
      regionKeys.forEach((key) => {
        const [countryId, regionId] = key.split(":").map(Number);
        void getOriginEntities(countryId, regionId).then((entities) => {
          if (!active) return;
          setEntitiesByRegion((prev) => ({ ...prev, [key]: entities }));
        });
      });
    });
    return () => {
      active = false;
    };
  }, [countryIdFor, entitiesByRegion, regionIdFor, value]);

  useEffect(() => {
    const keys = Array.from(
      new Set(
        value
          .map((comp) => {
            const country = comp.origin_country.trim();
            if (!country) return null;
            return `${country}\u001f${comp.origin_region?.trim() ?? ""}`;
          })
          .filter((key): key is string => Boolean(key))
      )
    ).filter((key) => !subregionsByOrigin[key]);

    if (keys.length === 0) return;

    let active = true;
    startTransition(() => {
      keys.forEach((key) => {
        const [country, region] = key.split("\u001f");
        void getUserOriginSubregions({ country, region: region || undefined }).then((chains) => {
          if (!active) return;
          setSubregionsByOrigin((prev) => ({ ...prev, [key]: chains }));
        });
      });
    });

    return () => {
      active = false;
    };
  }, [subregionsByOrigin, value]);

  const total = value.reduce((sum, c) => sum + (c.percentage || 0), 0);
  const isComplete = Math.abs(total - 100) < 0.01;

  function subregionSuggestionsFor(comp: BlendComponent): string[] {
    const country = comp.origin_country.trim();
    if (!country) return [];
    const key = `${country}\u001f${comp.origin_region?.trim() ?? ""}`;
    return nextSubregionSuggestions(
      subregionsByOrigin[key] ?? [],
      comp.origin_subregions ?? []
    );
  }

  function addComponent() {
    onChange([
      ...value,
      { origin_country: "", percentage: 0, sort_order: value.length },
    ]);
  }

  function updateComponent(index: number, patch: Partial<BlendComponent>) {
    onChange(value.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function handleCountryText(index: number, text: string) {
    updateComponent(index, {
      origin_country: text,
      origin_country_id: undefined,
      origin_region: undefined,
      origin_region_id: undefined,
      origin_subregions: [],
      farm_producer: undefined,
      origin_entity_id: undefined,
    });
  }

  function handleCountryPick(index: number, option: ComboboxOption) {
    const country = originCountries.find((item) => item.name_en === option.value);
    updateComponent(index, {
      origin_country: option.value,
      origin_country_id: country?.id,
      origin_region: undefined,
      origin_region_id: undefined,
      origin_subregions: [],
      farm_producer: undefined,
      origin_entity_id: undefined,
    });
  }

  function handleRegionText(index: number, text: string) {
    updateComponent(index, {
      origin_region: text || undefined,
      origin_region_id: undefined,
      origin_subregions: [],
      farm_producer: undefined,
      origin_entity_id: undefined,
    });
  }

  function handleRegionPick(index: number, comp: BlendComponent, option: ComboboxOption) {
    const countryId = countryIdFor(comp);
    const region = countryId
      ? regionsByCountry[countryId]?.find((item) => item.name === option.value)
      : undefined;
    updateComponent(index, {
      origin_region: option.value,
      origin_region_id: region?.id,
      origin_subregions: [],
      farm_producer: undefined,
      origin_entity_id: undefined,
    });
  }

  function handleEntityPick(index: number, comp: BlendComponent, option: ComboboxOption) {
    const countryId = countryIdFor(comp);
    const regionId = regionIdFor(comp);
    const entity =
      countryId && regionId
        ? entitiesByRegion[`${countryId}:${regionId}`]?.find(
            (item) => item.name === option.value
          )
        : undefined;
    updateComponent(index, {
      farm_producer: option.value,
      origin_entity_id: entity?.id,
    });
  }

  function removeComponent(index: number) {
    onChange(value.filter((_, i) => i !== index).map((c, i) => ({ ...c, sort_order: i })));
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-[1fr_auto] items-center gap-3 text-xs">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-cream-dark">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              isComplete ? "bg-green-500" : total > 100 ? "bg-red-400" : "bg-accent"
            )}
            style={{ width: `${Math.min(total, 100)}%` }}
          />
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 font-semibold tabular-nums transition-colors",
            isComplete
              ? "bg-green-100 text-green-700"
              : total > 100
                ? "bg-red-100 text-red-700"
                : "bg-cream-dark text-brown-light"
          )}
        >
          {t("percentageTotal")} {total}%
        </span>
      </div>

      {/* Component rows */}
      <div className="flex flex-col gap-2">
        {value.map((comp, i) => {
          const showEntityInput = expandedEntityRows[i] || Boolean(comp.farm_producer);
          return (
            <div
              key={i}
              className="animate-rise relative flex items-start gap-2 rounded-md border border-border bg-cream-dark/40 p-2.5 focus-within:z-10"
              style={{ animationDelay: `${i * 40}ms` }}
            >
            <span className="mt-2.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brown/10 text-[11px] font-bold text-brown">
              {i + 1}
            </span>

            <div className="flex flex-1 flex-col gap-2.5">
              <div className="grid grid-cols-[1fr_84px] gap-2">
                <Combobox
                  ariaLabel={t("componentOrigin")}
                  name={`blend_origin_${i}`}
                  value={comp.origin_country}
                  options={countryOptions}
                  showAllOptions
                  onTextChange={(text) => handleCountryText(i, text)}
                  onPick={(o) => handleCountryPick(i, o)}
                  onCommit={(text) => {
                    const matched = findMatchingOption(text, countryOptions);
                    if (matched) handleCountryPick(i, matched);
                  }}
                  placeholder={t("componentOrigin")}
                  inputClassName="py-2 text-xs"
                />
                <div className="relative">
                  <Input
                    aria-label={t("componentPercentage")}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    value={comp.percentage || ""}
                    onChange={(e) =>
                      updateComponent(i, {
                        percentage: e.target.value === "" ? 0 : Number(e.target.value),
                      })
                    }
                    placeholder="50"
                    className="pr-7 text-right tabular-nums"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-brown-light/60">
                    %
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Combobox
                  ariaLabel={t("originRegion")}
                  name={`blend_region_${i}`}
                  value={comp.origin_region ?? ""}
                  options={regionOptionsFor(comp)}
                  onTextChange={(text) => handleRegionText(i, text)}
                  onPick={(o) => handleRegionPick(i, comp, o)}
                  onCommit={(text) => {
                    const matched = findMatchingOption(text, regionOptionsFor(comp));
                    if (matched) handleRegionPick(i, comp, matched);
                  }}
                  placeholder={t("originRegionPlaceholder")}
                  inputClassName="py-2 text-xs"
                />
                <SubregionInput
                  label={t("originSubregion")}
                  placeholder={t("originSubregionPlaceholder")}
                  value={comp.origin_subregions ?? []}
                  suggestions={subregionSuggestionsFor(comp)}
                  onChange={(origin_subregions) =>
                    updateComponent(i, { origin_subregions })
                  }
                />
              </div>

              {showEntityInput ? (
                <Combobox
                  ariaLabel={t("farmProducer")}
                  name={`blend_farm_producer_${i}`}
                  value={comp.farm_producer ?? ""}
                  options={entityOptionsFor(comp)}
                  onTextChange={(text) =>
                    updateComponent(i, {
                      farm_producer: text || undefined,
                      origin_entity_id: undefined,
                    })
                  }
                  onPick={(o) => handleEntityPick(i, comp, o)}
                  onCommit={(text) => {
                    const matched = findMatchingOption(text, entityOptionsFor(comp));
                    if (matched) handleEntityPick(i, comp, matched);
                  }}
                  placeholder={t("farmProducerPlaceholder")}
                  inputClassName="py-2 text-xs"
                />
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setExpandedEntityRows((rows) => ({ ...rows, [i]: true }))
                  }
                  className="self-start rounded px-1.5 py-0.5 text-[11px] font-medium text-brown-light/70 transition-colors hover:bg-brown/5 hover:text-brown"
                >
                  + {t("addFarmProducer")}
                </button>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Combobox
                  ariaLabel={t("varietal")}
                  name={`blend_varietal_${i}`}
                  value={comp.varietal ?? ""}
                  options={varietalOptions(locale, findCountryPreset(comp.origin_country))}
                  onTextChange={(text) =>
                    updateComponent(i, { varietal: text || undefined })
                  }
                  onPick={(o) => updateComponent(i, { varietal: o.label })}
                  placeholder={t("varietalPlaceholder")}
                  inputClassName="py-2 text-xs"
                />
                <Select
                  aria-label={t("processMethod")}
                  value={comp.process_method ?? ""}
                  onChange={(e) =>
                    updateComponent(i, {
                      process_method: (e.target.value || undefined) as ProcessMethod | undefined,
                    })
                  }
                  className="py-2 text-xs"
                >
                  <option value="">{t("processMethod")} —</option>
                  {(["washed", "natural", "honey", "anaerobic", "carbonic", "decaf", "other"] as ProcessMethod[]).map(
                    (m) => (
                      <option key={m} value={m}>
                        {tp(m)}
                      </option>
                    )
                  )}
                </Select>
              </div>

              <Input
                aria-label={t("processDetail")}
                name={`blend_process_detail_${i}`}
                value={comp.process_detail ?? ""}
                onChange={(e) =>
                  updateComponent(i, { process_detail: e.target.value || undefined })
                }
                placeholder={t("processDetailPlaceholder")}
                className="py-2 text-xs"
              />
            </div>

            <button
              type="button"
              onClick={() => removeComponent(i)}
              aria-label="remove"
              className="mt-1.5 shrink-0 rounded p-1 text-brown-light/50 transition-colors hover:bg-red-50 hover:text-red-500"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M3.5 3.5l7 7M10.5 3.5l-7 7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        );
        })}
      </div>

      <button
        type="button"
        onClick={addComponent}
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2.5",
          "text-sm font-medium text-brown-light transition-all hover:border-accent hover:bg-surface hover:text-brown"
        )}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        {t("addComponent")}
      </button>

      {!isComplete && value.length > 0 && (
        <p className="text-center text-xs text-brown-light/70">{t("percentageHint")}</p>
      )}
    </div>
  );
}
