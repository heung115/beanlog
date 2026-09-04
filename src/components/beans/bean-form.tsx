"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ScoreSlider } from "@/components/beans/score-slider";
import { DetailScoreInput } from "@/components/beans/detail-score-input";
import { TagInput, type TagValue } from "@/components/beans/tag-input";
import { BlendComposer } from "@/components/beans/blend-composer";
import {
  SubregionInput,
  nextSubregionSuggestions,
} from "@/components/beans/subregion-input";
import { findCountryPreset, findRegionCoords } from "@/data/origin-presets";
import { varietalOptions } from "@/data/varietal-presets";
import { createBean, createBeanFromForm, updateBean } from "@/lib/actions/beans";
import {
  clearGuestBeanDraft,
  loadGuestBeanDraft,
} from "@/lib/coffee/guest-draft";
import {
  getOriginCountries,
  getOriginEntities,
  getOriginRegions,
  getUserOriginSubregions,
} from "@/lib/actions/origins";
import { cn } from "@/lib/utils";
import type {
  BeanFormData,
  BeanType,
  BeanWithTags,
  BlendComponent,
  OriginCountryOption,
  OriginEntityOption,
  OriginRegionOption,
  PlaceType,
  ProcessMethod,
  PurchaseSource,
  RoastLevel,
} from "@/types/database";

const RECENT_ROASTERIES_KEY = "recent_roasteries";

function findMatchingOption(
  text: string,
  options: ComboboxOption[]
): ComboboxOption | undefined {
  const query = text.trim().toLowerCase();
  if (!query) return undefined;
  return options.find(
    (option) =>
      option.value.toLowerCase() === query ||
      option.label.toLowerCase() === query ||
      option.sublabel?.toLowerCase() === query
  );
}

function todayStr(): string {
  return new Date().toLocaleDateString("sv");
}

function defaultForm(): BeanFormData {
  return {
    name: "",
    roastery: "",
    bean_type: "single_origin",
    origin_country: "",
    process_method: "washed",
    roast_level: "medium",
    consumed_at: todayStr(),
    place_type: "cafe",
    overall_score: 7,
    note: "",
    tags: [],
    blend_components: [],
  };
}

function beanToForm(bean: BeanWithTags): BeanFormData {
  return {
    name: bean.name,
    roastery: bean.roastery,
    bean_type: bean.bean_type,
    origin_country: bean.origin_country ?? "",
    origin_country_id: bean.origin_country_id ?? undefined,
    origin_region: bean.origin_region ?? undefined,
    origin_region_id: bean.origin_region_id ?? undefined,
    origin_subregions: bean.origin_subregions ?? undefined,
    origin_lat: bean.origin_lat ?? undefined,
    origin_lng: bean.origin_lng ?? undefined,
    farm_producer: bean.farm_producer ?? undefined,
    origin_entity_id: bean.origin_entity_id ?? undefined,
    varietal: bean.varietal ?? undefined,
    process_method: bean.process_method,
    process_detail: bean.process_detail ?? undefined,
    altitude_m: bean.altitude_m ?? undefined,
    harvest_year: bean.harvest_year ?? undefined,
    roast_level: bean.roast_level,
    roast_date: bean.roast_date ? bean.roast_date.slice(0, 10) : undefined,
    consumed_at: bean.consumed_at ? bean.consumed_at.slice(0, 10) : todayStr(),
    place_type: bean.place_type,
    cafe_name: bean.cafe_name ?? undefined,
    overall_score: bean.overall_score,
    note: bean.note,
    score_aroma: bean.score_aroma ?? undefined,
    score_acidity: bean.score_acidity ?? undefined,
    score_body: bean.score_body ?? undefined,
    score_sweetness: bean.score_sweetness ?? undefined,
    score_aftertaste: bean.score_aftertaste ?? undefined,
    score_balance: bean.score_balance ?? undefined,
    purchase_source: bean.purchase_source ?? undefined,
    price: bean.price ?? undefined,
    weight_g: bean.weight_g ?? undefined,
    purchased_at: bean.purchased_at ? bean.purchased_at.slice(0, 10) : undefined,
    tags: (bean.tasting_tags ?? []).map((t) => ({
      tag: t.tag,
      category: t.category,
    })),
    blend_components: (bean.blend_components ?? []).map((c) => ({
      origin_country: c.origin_country,
      origin_region: c.origin_region ?? undefined,
      origin_subregions: c.origin_subregions ?? undefined,
      farm_producer: c.farm_producer ?? undefined,
      varietal: c.varietal ?? undefined,
      process_method: c.process_method ?? undefined,
      process_detail: c.process_detail ?? undefined,
      percentage: c.percentage,
      sort_order: c.sort_order,
    })),
  };
}

function hasDetails(form: BeanFormData): boolean {
  return Boolean(
    form.process_detail ||
      form.roast_date ||
      form.score_aroma ||
      form.score_acidity ||
      form.score_body ||
      form.score_sweetness ||
      form.score_aftertaste ||
      form.score_balance ||
      form.purchase_source ||
      form.price ||
      form.weight_g ||
      form.purchased_at ||
      (form.tags && form.tags.length > 0)
  );
}

function saveRecentRoastery(name: string): string[] | undefined {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  try {
    const raw = localStorage.getItem(RECENT_ROASTERIES_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const next = [trimmed, ...list.filter((r) => r !== trimmed)].slice(0, 10);
    localStorage.setItem(RECENT_ROASTERIES_KEY, JSON.stringify(next));
    return next;
  } catch {
    return undefined;
  }
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-sm border border-border bg-cream-dark/60 p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "min-h-11 rounded-sm border px-3 py-2 text-sm font-semibold transition-all duration-150",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            value === option.value
              ? "border-brown bg-brown text-cream shadow-[2px_2px_0_var(--color-accent-light)]"
              : "border-transparent text-brown-light hover:border-border hover:text-brown"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="journal-section-title">
      {children}
    </h3>
  );
}

export function BeanForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: BeanWithTags;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const toast = useToast();
  const t = useTranslations("beans");
  const tp = useTranslations("process");
  const tr = useTranslations("roast");
  const tc = useTranslations("common");
  const tg = useTranslations("guest");
  const importingGuestDraft = mode === "create" && searchParams.get("draft") === "1";

  const [form, setForm] = useState<BeanFormData>(() =>
    initial
      ? beanToForm(initial)
      : {
          ...defaultForm(),
          roastery: searchParams.get("roastery")?.slice(0, 200) ?? "",
        }
  );
  const [showDetails, setShowDetails] = useState(() =>
    initial ? hasDetails(beanToForm(initial)) : false
  );
  const [submitting, setSubmitting] = useState(false);
  const [guestDraftLoaded, setGuestDraftLoaded] = useState(false);

  const isBlend = form.bean_type === "blend";

  const [recentRoasteries, setRecentRoasteries] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(RECENT_ROASTERIES_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [roasteryOpen, setRoasteryOpen] = useState(false);
  const [originCountries, setOriginCountries] = useState<OriginCountryOption[]>([]);
  const [originRegions, setOriginRegions] = useState<OriginRegionOption[]>([]);
  const [originEntities, setOriginEntities] = useState<OriginEntityOption[]>([]);
  const [singleSubregionChains, setSingleSubregionChains] = useState<string[][]>([]);

  const countryPreset = form.origin_country
    ? findCountryPreset(form.origin_country)
    : undefined;

  useEffect(() => {
    if (!importingGuestDraft) return;

    const draft = loadGuestBeanDraft();
    if (!draft) return;

    startTransition(() => {
      setForm(draft.bean);
      setShowDetails(hasDetails(draft.bean));
      setGuestDraftLoaded(true);
    });
  }, [importingGuestDraft]);

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
    let active = true;
    const countryId = form.origin_country_id;

    if (!countryId) {
      return () => {
        active = false;
      };
    }

    startTransition(() => {
      void getOriginRegions(countryId).then((regions) => {
        if (active) setOriginRegions(regions);
      });
    });
    return () => {
      active = false;
    };
  }, [form.origin_country_id]);

  useEffect(() => {
    let active = true;
    const countryId = form.origin_country_id;
    const regionId = form.origin_region_id;

    if (!countryId || !regionId) {
      return () => {
        active = false;
      };
    }

    startTransition(() => {
      void getOriginEntities(countryId, regionId).then(
        (entities) => {
          if (active) setOriginEntities(entities);
        }
      );
    });
    return () => {
      active = false;
    };
  }, [form.origin_country_id, form.origin_region_id]);

  useEffect(() => {
    let active = true;
    const country = form.origin_country?.trim();
    if (!country || isBlend) {
      return () => {
        active = false;
      };
    }

    startTransition(() => {
      void getUserOriginSubregions({
        country,
        region: form.origin_region?.trim() || undefined,
      }).then((chains) => {
        if (active) setSingleSubregionChains(chains);
      });
    });

    return () => {
      active = false;
    };
  }, [form.origin_country, form.origin_region, isBlend]);

  const roasterySuggestions = useMemo(() => {
    const q = form.roastery.trim().toLowerCase();
    if (!q) return recentRoasteries.slice(0, 5);
    return recentRoasteries
      .filter((r) => r.toLowerCase().includes(q) && r.toLowerCase() !== q)
      .slice(0, 5);
  }, [recentRoasteries, form.roastery]);

  function set<K extends keyof BeanFormData>(key: K, value: BeanFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setDetailScore(key: string, value: number) {
    setForm(
      (f) =>
        ({ ...f, [`score_${key}`]: value === 0 ? undefined : value }) as BeanFormData
    );
  }

  function handleBeanTypeChange(v: BeanType) {
    setForm((f) => ({
      ...f,
      bean_type: v,
      // 블렌드로 전환 시 단일 산지 필드 초기화
      ...(v === "blend"
        ? {
            origin_country: "",
            origin_country_id: undefined,
            origin_region: undefined,
            origin_region_id: undefined,
            origin_subregions: undefined,
            origin_lat: undefined,
            origin_lng: undefined,
            farm_producer: undefined,
            origin_entity_id: undefined,
            blend_components:
              f.blend_components && f.blend_components.length > 0
                ? f.blend_components
                : [{ origin_country: "", percentage: 0 }],
          }
        : {}),
    }));
  }

  const countryOptions = useMemo(() => {
    const ko = locale === "ko";
    return originCountries.map((country) => ({
      value: country.name_en,
      label: ko ? country.name_ko ?? country.name_en : country.name_en,
      sublabel: ko ? country.name_en : country.name_ko ?? undefined,
    }));
  }, [locale, originCountries]);

  const regionOptions = useMemo(() => {
    const ko = locale === "ko";
    return originRegions.map((region) => ({
      value: region.name,
      label: ko ? region.name_ko ?? region.name : region.name,
      sublabel: ko ? region.name : region.name_ko ?? undefined,
    }));
  }, [locale, originRegions]);

  const entityOptions = useMemo(() => {
    const ko = locale === "ko";
    return originEntities.map((entity) => ({
      value: entity.name,
      label: ko ? entity.name_ko ?? entity.name : entity.name,
      sublabel: ko
        ? [entity.name, entity.entity_type].filter(Boolean).join(" · ")
        : entity.entity_type ?? entity.name_ko ?? undefined,
    }));
  }, [locale, originEntities]);

  const varietalOpts = useMemo(
    () => varietalOptions(locale, countryPreset),
    [locale, countryPreset]
  );

  function handleCountryText(text: string) {
    setOriginRegions([]);
    setOriginEntities([]);
    setForm((f) => ({
      ...f,
      origin_country: text,
      origin_country_id: undefined,
      origin_region: undefined,
      origin_region_id: undefined,
      origin_subregions: undefined,
      origin_lat: undefined,
      origin_lng: undefined,
      farm_producer: undefined,
      origin_entity_id: undefined,
    }));
  }

  function handleCountryPick(option: ComboboxOption) {
    const country = originCountries.find((item) => item.name_en === option.value);
    if (!country) return;
    if (form.origin_country_id === country.id) return;
    setOriginRegions([]);
    setOriginEntities([]);
    setForm((f) => ({
      ...f,
      origin_country: country.name_en,
      origin_country_id: country.id,
      origin_region: undefined,
      origin_region_id: undefined,
      origin_subregions: undefined,
      origin_lat: undefined,
      origin_lng: undefined,
      farm_producer: undefined,
      origin_entity_id: undefined,
    }));
  }

  function handleCountryCommit(text: string) {
    const matched = findMatchingOption(text, countryOptions);
    if (matched) handleCountryPick(matched);
  }

  function handleRegionPick(option: ComboboxOption) {
    const region = originRegions.find((item) => item.name === option.value);
    if (!region) return;
    if (form.origin_region_id === region.id) return;
    setOriginEntities([]);
    const coords = form.origin_country
      ? findRegionCoords(form.origin_country, option.value)
      : undefined;
    setForm((f) => ({
      ...f,
      origin_region: region.name,
      origin_region_id: region.id,
      origin_subregions: undefined,
      origin_lat: coords?.lat,
      origin_lng: coords?.lng,
      farm_producer: undefined,
      origin_entity_id: undefined,
    }));
  }

  function handleRegionCommit(text: string) {
    const matched = findMatchingOption(text, regionOptions);
    if (matched) handleRegionPick(matched);
  }

  function handleRegionChange(value: string) {
    const coords = form.origin_country
      ? findRegionCoords(form.origin_country, value)
      : undefined;
    setOriginEntities([]);
    setForm((f) => ({
      ...f,
      origin_region: value,
      origin_region_id: undefined,
      origin_subregions: undefined,
      origin_lat: coords?.lat,
      origin_lng: coords?.lng,
      farm_producer: undefined,
      origin_entity_id: undefined,
    }));
  }

  function handleEntityPick(option: ComboboxOption) {
    const entity = originEntities.find((item) => item.name === option.value);
    if (!entity) return;
    setForm((f) => ({
      ...f,
      farm_producer: entity.name,
      origin_entity_id: entity.id,
    }));
  }

  function handleEntityCommit(text: string) {
    const matched = findMatchingOption(text, entityOptions);
    if (matched) handleEntityPick(matched);
  }

  function handleEntityText(value: string) {
    setForm((f) => ({
      ...f,
      farm_producer: value,
      origin_entity_id: undefined,
    }));
  }

  function handleTagsChange(tags: TagValue[]) {
    set("tags", tags);
  }

  function singleSubregionSuggestions(): string[] {
    if (!form.origin_country?.trim() || isBlend) return [];
    return nextSubregionSuggestions(singleSubregionChains, form.origin_subregions ?? []);
  }

  function handleBlendChange(components: BlendComponent[]) {
    set("blend_components", components);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const continueAdding =
      mode === "create" &&
      submitter?.getAttribute("name") === "continue";

    const blendTotal = (form.blend_components ?? []).reduce(
      (s, c) => s + (c.percentage || 0),
      0
    );

    if (!form.name.trim() || !form.roastery.trim() || !form.note.trim()) {
      toast.show(t("fillRequired"));
      return;
    }
    if (isBlend) {
      const comps = form.blend_components ?? [];
      if (
        comps.length === 0 ||
        comps.some((c) => !c.origin_country.trim()) ||
        Math.abs(blendTotal - 100) > 0.01
      ) {
        toast.show(t("fillRequired"));
        return;
      }
    } else if (!form.origin_country?.trim()) {
      toast.show(t("fillRequired"));
      return;
    }

    setSubmitting(true);
    try {
      const result =
        mode === "edit" && initial
          ? await updateBean(initial.id, form)
          : await createBean(form);

      if (result?.error) {
        toast.show(tc("error"));
        return;
      }

      const nextRecents = saveRecentRoastery(form.roastery);
      if (nextRecents) setRecentRoasteries(nextRecents);
      if (importingGuestDraft) clearGuestBeanDraft();
      toast.show(t("saved"));
      if (continueAdding) {
        setForm({ ...defaultForm(), roastery: form.roastery });
        setShowDetails(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        router.push(`/${locale}/explore`);
      }
    } catch {
      toast.show(tc("error"));
    } finally {
      setSubmitting(false);
    }
  }

  function handleFormKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    // Save only through the explicit save button. Comboboxes and the tag field
    // handle Enter themselves; plain inputs should not submit a long record.
    if (
      e.key === "Enter" &&
      !e.defaultPrevented &&
      !e.nativeEvent.isComposing &&
      e.target instanceof HTMLInputElement
    ) {
      e.preventDefault();
    }
  }

  const req = (label: string) => `${label} *`;
  const detailScores: Record<string, number | undefined> = {
    aroma: form.score_aroma,
    acidity: form.score_acidity,
    body: form.score_body,
    sweetness: form.score_sweetness,
    aftertaste: form.score_aftertaste,
    balance: form.score_balance,
  };

  const processSelect = (
    <Select
      label={req(t("processMethod"))}
      name="process_method"
      value={form.process_method}
      onChange={(e) => set("process_method", e.target.value as ProcessMethod)}
      required
    >
      {(
        [
          "washed",
          "natural",
          "honey",
          "anaerobic",
          "carbonic",
          "decaf",
          "other",
        ] as ProcessMethod[]
      ).map((m) => (
        <option key={m} value={m}>
          {tp(m)}
        </option>
      ))}
    </Select>
  );

  return (
    <form
      action={mode === "create" ? createBeanFromForm : undefined}
      onSubmit={handleSubmit}
      onKeyDown={handleFormKeyDown}
      className="flex flex-col gap-6"
    >
      {guestDraftLoaded && (
        <p className="journal-panel-quiet px-4 py-3 text-sm leading-6 text-brown-medium">
          {tg("draftLoaded")}
        </p>
      )}
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="bean_type" value={form.bean_type} />
      <input type="hidden" name="place_type" value={form.place_type} />
      <input type="hidden" name="overall_score" value={form.overall_score} />
      {/* ── Quick section ─────────────────────────────── */}
      <section className="paper-sheet paper-sheet-feature animate-rise p-5 md:p-8">
        <div className="mb-7 flex items-center justify-between border-b-2 border-brown pb-4">
          <p className="journal-kicker">{t("basicInfo")}</p>
          <span className="font-display text-3xl italic text-accent">01</span>
        </div>
        <div className="flex flex-col gap-5">
          {/* 종류 토글 — 맨 위 */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-brown-medium">
              {req(t("beanType"))}
            </span>
            <Segmented<BeanType>
              ariaLabel={t("beanType")}
              value={form.bean_type}
              onChange={handleBeanTypeChange}
              options={[
                { value: "single_origin", label: t("singleOrigin") },
                { value: "blend", label: t("blend") },
              ]}
            />
          </div>

          <Input
            label={req(t("name"))}
            name="name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={t("namePlaceholder")}
            required
          />

          {/* Roastery with recent autocomplete */}
          <div className="relative">
            <Input
              label={req(t("roastery"))}
              name="roastery"
              value={form.roastery}
              onChange={(e) => set("roastery", e.target.value)}
              onFocus={() => setRoasteryOpen(true)}
              onBlur={() => setTimeout(() => setRoasteryOpen(false), 120)}
              placeholder={t("roasteryPlaceholder")}
              required
              autoComplete="off"
            />
            {roasteryOpen && roasterySuggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface shadow-lg">
                {roasterySuggestions.map((r) => (
                  <li key={r}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        set("roastery", r);
                        setRoasteryOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-brown transition-colors hover:bg-cream-dark"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        className="shrink-0 text-brown-light/50"
                      >
                        <circle cx="6" cy="6" r="5" stroke="currentColor" />
                        <path d="M6 3v3l2 1.5" stroke="currentColor" strokeLinecap="round" />
                      </svg>
                      {r}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 블렌드 구성 */}
          {isBlend && (
            <div className="journal-panel-quiet flex flex-col gap-3 p-4">
              <SectionLabel>{t("blendComposition")}</SectionLabel>
              <BlendComposer
                value={form.blend_components ?? []}
                onChange={handleBlendChange}
              />
              {processSelect}
            </div>
          )}
        </div>

        {/* Origin — 산지 → 생산자 → 품종 → 가공 정보 순 */}
        {!isBlend && (
          <div className="mt-6 flex flex-col gap-4 border-t border-border-light pt-6">
            <h2 className="font-display text-2xl font-bold tracking-[-0.025em] text-brown">
              {t("originInfo")}
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              <Combobox
                label={req(t("originCountry"))}
                name="origin_country"
                value={form.origin_country ?? ""}
                options={countryOptions}
                showAllOptions
                onTextChange={handleCountryText}
                onPick={handleCountryPick}
                onCommit={handleCountryCommit}
                placeholder={t("originCountryPlaceholder")}
                required
              />

              <Combobox
                label={t("originRegion")}
                name="origin_region"
                value={form.origin_region ?? ""}
                options={regionOptions}
                onTextChange={handleRegionChange}
                onPick={handleRegionPick}
                onCommit={handleRegionCommit}
                placeholder={t("originRegionPlaceholder")}
                optional
                optionalLabel={tc("optional")}
              />
            </div>

            <SubregionInput
              label={t("originSubregion")}
              placeholder={t("originSubregionPlaceholder")}
              value={form.origin_subregions ?? []}
              suggestions={singleSubregionSuggestions()}
              onChange={(origin_subregions) =>
                set("origin_subregions", origin_subregions)
              }
              inputClassName="py-2.5 text-sm"
              showLabel
              optional
              optionalLabel={tc("optional")}
            />

            <Combobox
              label={t("farmProducer")}
              name="farm_producer"
              value={form.farm_producer ?? ""}
              options={entityOptions}
              onTextChange={handleEntityText}
              onPick={handleEntityPick}
              onCommit={handleEntityCommit}
              placeholder={t("farmProducerPlaceholder")}
              optional
              optionalLabel={tc("optional")}
            />

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Combobox
                label={t("varietal")}
                name="varietal"
                value={form.varietal ?? ""}
                options={varietalOpts}
                onTextChange={(text) => set("varietal", text)}
                onPick={(option) => set("varietal", option.label)}
                placeholder={t("varietalPlaceholder")}
                optional
                optionalLabel={tc("optional")}
              />
              {processSelect}
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Input
                label={t("altitude")}
                name="altitude_m"
                type="number"
                inputMode="numeric"
                value={form.altitude_m ?? ""}
                onChange={(e) =>
                  set(
                    "altitude_m",
                    e.target.value === "" ? undefined : Number(e.target.value)
                  )
                }
                placeholder="1,950"
                optional
                optionalLabel={tc("optional")}
              />
              <Input
                label={t("harvestYear")}
                name="harvest_year"
                type="number"
                inputMode="numeric"
                value={form.harvest_year ?? ""}
                onChange={(e) =>
                  set(
                    "harvest_year",
                    e.target.value === "" ? undefined : Number(e.target.value)
                  )
                }
                placeholder="2025"
                optional
                optionalLabel={tc("optional")}
              />
            </div>

            {/* Origin info card */}
            {countryPreset && (
              <div className="journal-panel-quiet animate-rise p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="folio-label">
                      {t("altitudeRange")}
                    </span>
                    <span className="text-sm font-medium text-brown">
                      {countryPreset.altitudeRange}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="folio-label">
                      {t("signature")}
                    </span>
                    <span className="text-sm text-brown-medium">
                      {locale === "ko"
                        ? countryPreset.signatureKo
                        : countryPreset.signature}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="folio-label">
                      {t("keyVarietals")}
                    </span>
                    <span className="text-sm text-brown-medium">
                      {countryPreset.keyVarietals.join(", ")}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Roast / place */}
        <div className="mt-8 flex flex-col gap-5 border-t-2 border-brown pt-6">
          <div className="flex items-center justify-between">
            <p className="journal-kicker">{t("roastAndPlace")}</p>
            <span className="font-display text-2xl italic text-accent">02</span>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Select
              label={req(t("roastLevel"))}
              name="roast_level"
              value={form.roast_level}
              onChange={(e) => set("roast_level", e.target.value as RoastLevel)}
              required
            >
              {(["light", "medium", "dark"] as RoastLevel[]).map((l) => (
                <option key={l} value={l}>
                  {tr(l)}
                </option>
              ))}
            </Select>

            <Input
              label={req(t("consumedAt"))}
              name="consumed_at"
              type="date"
              value={form.consumed_at}
              onChange={(e) => set("consumed_at", e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-brown-medium">
              {req(t("placeType"))}
            </span>
            <Segmented<PlaceType>
              ariaLabel={t("placeType")}
              value={form.place_type}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  place_type: v,
                  cafe_name: v === "home" ? undefined : f.cafe_name,
                }))
              }
              options={[
                { value: "cafe", label: t("cafe") },
                { value: "home", label: t("home") },
              ]}
            />
          </div>

          {form.place_type === "cafe" && (
            <div className="animate-rise">
              <Input
                label={t("cafeName")}
                name="cafe_name"
                value={form.cafe_name ?? ""}
                onChange={(e) => set("cafe_name", e.target.value)}
                placeholder={t("cafeNamePlaceholder")}
                optional
                optionalLabel={tc("optional")}
              />
            </div>
          )}

        </div>

        {/* Score + note */}
        <div className="mt-8 flex flex-col gap-6 border-t-2 border-brown pt-6">
          <div className="flex items-center justify-between">
            <p className="journal-kicker">{t("evaluation")}</p>
            <span className="font-display text-2xl italic text-accent">03</span>
          </div>
          <ScoreSlider
            label={req(t("overallScore"))}
            value={form.overall_score}
            onChange={(v) => set("overall_score", v)}
          />
          <Textarea
            label={req(t("note"))}
            name="note"
            rows={3}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder={t("notePlaceholder")}
            required
          />
        </div>
      </section>

      {/* ── Detail toggle ─────────────────────────────── */}
      <button
        type="button"
        onClick={() => setShowDetails((s) => !s)}
        aria-expanded={showDetails}
        aria-controls="bean-detail-fields"
        className={cn(
          "animate-rise flex min-h-14 items-center justify-between gap-2 rounded-sm border-y-2 border-brown px-4 py-3.5",
          "text-sm font-semibold text-brown transition-all duration-200",
          "hover:bg-surface-warm",
          showDetails && "bg-surface-warm"
        )}
        style={{ animationDelay: "60ms" }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={cn(
            "transition-transform duration-300",
            showDetails && "rotate-180"
          )}
        >
          <path
            d="M2 4l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {showDetails ? t("lessDetails") : t("moreDetails")}
      </button>

      {/* Keep collapsed controls out of the accessibility tree and tab order. */}
      {showDetails && (
        <section
          id="bean-detail-fields"
          className="paper-sheet animate-rise border-t-[3px] border-t-accent p-5 md:p-8"
        >
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Input
                label={t("processDetail")}
                name="process_detail"
                value={form.process_detail ?? ""}
                onChange={(e) => set("process_detail", e.target.value)}
                placeholder={t("processDetailPlaceholder")}
                optional
                optionalLabel={tc("optional")}
              />
              <Input
                label={t("roastDate")}
                name="roast_date"
                type="date"
                value={form.roast_date ?? ""}
                onChange={(e) => set("roast_date", e.target.value)}
                optional
                optionalLabel={tc("optional")}
              />
            </div>

            {/* Tasting tags */}
            <div className="mt-7 flex flex-col gap-3 border-t border-border-light pt-6">
              <SectionLabel>{t("tastingNotes")}</SectionLabel>
              <TagInput value={form.tags ?? []} onChange={handleTagsChange} />
            </div>

            {/* Detail scores */}
            <div className="mt-7 flex flex-col gap-3 border-t border-border-light pt-6">
              <SectionLabel>{t("detailedScores")}</SectionLabel>
              <DetailScoreInput scores={detailScores} onChange={setDetailScore} />
            </div>

            {/* Purchase info */}
            <div className="mt-7 flex flex-col gap-5 border-t border-border-light pt-6">
              <SectionLabel>{t("purchaseInfo")}</SectionLabel>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Select
                  label={t("purchaseSource")}
                  name="purchase_source"
                  value={form.purchase_source ?? ""}
                  onChange={(e) =>
                    set(
                      "purchase_source",
                      e.target.value === ""
                        ? undefined
                        : (e.target.value as PurchaseSource)
                    )
                  }
                  optional
                  optionalLabel={tc("optional")}
                >
                  <option value="">—</option>
                  {(
                    ["online", "roastery", "cafe", "other"] as PurchaseSource[]
                  ).map((s) => (
                    <option key={s} value={s}>
                      {t(
                        s === "online"
                          ? "purchaseOnline"
                          : s === "roastery"
                            ? "purchaseRoastery"
                            : s === "cafe"
                              ? "purchaseCafe"
                              : "purchaseOther"
                      )}
                    </option>
                  ))}
                </Select>
                <Input
                  label={t("price")}
                  name="price"
                  type="number"
                  inputMode="numeric"
                  value={form.price ?? ""}
                  onChange={(e) => set("price", e.target.value === "" ? undefined : Number(e.target.value))
                  }
                  placeholder="22,000"
                  optional
                  optionalLabel={tc("optional")}
                />
                <Input
                  label={t("weight")}
                  name="weight_g"
                  type="number"
                  inputMode="numeric"
                  value={form.weight_g ?? ""}
                  onChange={(e) => set("weight_g", e.target.value === "" ? undefined : Number(e.target.value))
                  }
                  placeholder="200"
                  optional
                  optionalLabel={tc("optional")}
                />
                <Input
                  label={t("purchasedAt")}
                  name="purchased_at"
                  type="date"
                  value={form.purchased_at ?? ""}
                  onChange={(e) => set("purchased_at", e.target.value)}
                  optional
                  optionalLabel={tc("optional")}
                />
              </div>
            </div>
        </section>
      )}

      {/* ── Submit ────────────────────────────────────── */}
      <div
        className="animate-rise flex flex-col-reverse gap-3 border-t-2 border-brown bg-cream py-5 sm:flex-row sm:justify-end"
        style={{ animationDelay: "120ms" }}
      >
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={submitting}
        >
          {tc("cancel")}
        </Button>
        {mode === "create" && (
          <Button
            type="submit"
            name="continue"
            value="1"
            variant="secondary"
            size="lg"
            disabled={submitting}
            className="sm:min-w-44"
          >
            {t("saveAndAddAnother")}
          </Button>
        )}
        <Button type="submit" size="lg" loading={submitting} className="sm:min-w-44">
          {submitting ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
