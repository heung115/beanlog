"use client";

import { startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ZodIssue } from "zod";
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
import { TagInput, tagsWithDraft, type TagValue } from "@/components/beans/tag-input";
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
import { beanFormSchema } from "@/lib/validation/beans";
import { parseRecordDraft, RECORD_DRAFT_PREFIX, recordDraftScope } from "@/lib/coffee/record-draft";
import { isBeanDraftValue, type BeanDraftValue } from "@/lib/coffee/record-draft-value";
import { beanDetailHref, resolveExploreReturnPath } from "@/lib/coffee/explore-navigation";
import { useRecordDraft } from "@/components/beans/use-record-draft";
import { RecordDraftNotice } from "@/components/beans/record-draft-notice";
import { BeanLabelInput } from "@/components/beans/bean-label-input";
import { applyLabelFields, type LabelExtraction, type LabelField } from "@/lib/coffee/bean-label";
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
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-md bg-cream-dark/60 p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          tabIndex={value === option.value ? 0 : -1}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => {
            const index = options.findIndex((item) => item.value === option.value);
            const next = event.key === "Home" ? 0
              : event.key === "End" ? options.length - 1
                : ["ArrowRight", "ArrowDown"].includes(event.key) ? (index + 1) % options.length
                  : ["ArrowLeft", "ArrowUp"].includes(event.key) ? (index - 1 + options.length) % options.length
                    : undefined;
            if (next === undefined) return;
            event.preventDefault();
            onChange(options[next].value);
            event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
          }}
          className={cn(
            "min-h-11 rounded-sm border border-transparent px-3 py-2 text-sm font-semibold transition-all duration-150",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            value === option.value
              ? "bg-brown text-cream"
              : "text-brown-light hover:bg-surface hover:text-brown"
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
  draftOwnerId,
  labelImportEnabled = false,
}: {
  mode: "create" | "edit";
  initial?: BeanWithTags;
  draftOwnerId?: string;
  labelImportEnabled?: boolean;
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
  const td = useTranslations("draft");
  const returnTo = resolveExploreReturnPath(searchParams.get("returnTo"), locale);
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
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [focusRequest, setFocusRequest] = useState<{ name: string } | null>(null);
  const focusedRequest = useRef<{ name: string } | null>(null);
  const [formErrors, setFormErrors] = useState<{ name: string; message: string }[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [guestDraftLoaded, setGuestDraftLoaded] = useState(false);
  const [draftBaseline, setDraftBaseline] = useState<BeanDraftValue>(() => ({ form, tagDraft: "", showDetails }));
  const ownerId = draftOwnerId ?? initial?.user_id;
  const draftScope = recordDraftScope(ownerId ?? "unavailable", mode === "edit" ? initial?.id : undefined);
  const draftValue = useMemo(() => ({ form, tagDraft, showDetails }), [form, tagDraft, showDetails]);
  const draftRecovery = useRecordDraft({
    scope: draftScope,
    value: draftValue,
    baselineValue: draftBaseline,
    sourceVersion: initial?.updated_at ?? null,
    enabled: Boolean(ownerId),
    validate: isBeanDraftValue,
    onRestore: (restored) => {
      setForm(restored.form);
      setTagDraft(restored.tagDraft);
      setShowDetails(restored.showDetails);
      setFormErrors([]);
    },
  });

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

  function handleLabelApply(extraction: LabelExtraction, selected: LabelField[]) {
    const next = applyLabelFields(form, extraction, selected);
    if (selected.includes("origin_country") && next.bean_type === "single_origin") {
      const text = next.origin_country?.trim().toLowerCase();
      const country = originCountries.find((item) => item.name_en.toLowerCase() === text || item.name_ko?.toLowerCase() === text);
      if (country) {
        next.origin_country = country.name_en;
        next.origin_country_id = country.id;
      }
    }
    const countryChanged = next.origin_country !== form.origin_country || next.origin_country_id !== form.origin_country_id;
    const regionChanged = next.origin_region !== form.origin_region || next.origin_region_id !== form.origin_region_id;
    if (countryChanged) setOriginRegions([]);
    if (countryChanged || regionChanged) {
      setOriginEntities([]);
      setSingleSubregionChains([]);
    }
    setForm(next);
    if (selected.some((field) => ["process_detail", "roast_date", "weight_g"].includes(field))) setShowDetails(true);
    setFormErrors([]);
  }

  useEffect(() => {
    if (!importingGuestDraft) return;

    try {
      if (parseRecordDraft(sessionStorage.getItem(RECORD_DRAFT_PREFIX + draftScope), isBeanDraftValue)) return;
    } catch { /* The recovery notice explains browser storage failures. */ }

    const draft = loadGuestBeanDraft();
    if (!draft) return;

    startTransition(() => {
      setForm(draft.bean);
      setShowDetails(hasDetails(draft.bean));
      setGuestDraftLoaded(true);
    });
  }, [draftScope, importingGuestDraft]);

  useEffect(() => {
    let active = true;
    startTransition(() => {
      void getOriginCountries().then((countries) => {
        if (active) setOriginCountries(countries);
      }).catch(() => undefined);
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
      }).catch(() => undefined);
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
      ).catch(() => undefined);
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
      }).catch(() => undefined);
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
      // Keep both sets of inputs while the user compares or corrects the type.
      // Only the active type's fields are included when saving.
      ...(v === "blend" && !f.blend_components?.length
        ? {
            blend_components: [{ origin_country: "", percentage: 0 }],
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

  function focusField(name: string) {
    if (name === "tasting_tags_draft" || ["process_detail", "roast_date", "price", "weight_g", "purchased_at"].includes(name)) {
      setShowDetails(true);
    }
    setFocusRequest({ name });
  }

  useLayoutEffect(() => {
    if (!focusRequest || focusedRequest.current === focusRequest || submitting) return;
    // An async save failure can schedule a frame before its error panel has
    // committed. Focus only after React mounts the target and unlocks the form.
    const field = formRef.current?.querySelector<HTMLElement>(`[name="${CSS.escape(focusRequest.name)}"]`);
    const target = field ?? errorRef.current;
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    focusedRequest.current = focusRequest;
  }, [focusRequest, showDetails, submitting]);

  function validationError(issue: ZodIssue) {
    const key = String(issue.path[0]);
    const labels: Record<string, string> = {
      name: t("name"), roastery: t("roastery"), origin_country: t("originCountry"),
      origin_region: t("originRegion"), origin_subregions: t("originSubregion"),
      farm_producer: t("farmProducer"), varietal: t("varietal"), process_detail: t("processDetail"),
      altitude_m: t("altitude"), harvest_year: t("harvestYear"), roast_date: t("roastDate"),
      consumed_at: t("consumedAt"), cafe_name: t("cafeName"), overall_score: t("overallScore"),
      note: t("note"), price: t("price"), weight_g: t("weight"), purchased_at: t("purchasedAt"),
      tags: t("tastingNotes"), blend_components: t("blendComposition"),
    };
    const label = labels[key] ?? t("basicInfo");
    const name = key === "tags" ? "tasting_tags_draft"
      : key === "blend_components"
        ? `blend_${issue.path[2] === "origin_country" ? "origin" : issue.path[2] === "origin_region" ? "region" : String(issue.path[2] ?? "origin")}_${String(issue.path[1] ?? 0)}`
        : key;
    let message = t("invalidField", { field: label });
    if (issue.code === "too_small") {
      message = issue.origin === "string" ? t("requiredField", { field: label })
        : t("minimumField", { field: label, min: Number(issue.minimum) + (key === "weight_g" && !issue.inclusive ? 1 : 0) });
      if (key === "blend_components" && issue.path[2] === "percentage") message = t("invalidBlend");
    } else if (issue.code === "too_big") {
      message = issue.origin === "string" ? t("textLimitField", { field: label, max: Number(issue.maximum) })
        : issue.origin === "array" ? t("itemLimitField", { field: label, max: Number(issue.maximum) })
          : t("maximumField", { field: label, max: Number(issue.maximum) });
    } else if (issue.code === "custom") {
      message = key === "blend_components" ? t("invalidBlend") : t("requiredField", { field: label });
    } else if (issue.code === "invalid_type" && issue.expected === "int") {
      message = t("integerField", { field: label });
    } else if (issue.code === "not_multiple_of" && key === "blend_components") {
      message = t("percentagePrecision");
    } else if (issue.code === "invalid_format" && ["consumed_at", "roast_date", "purchased_at"].includes(key)) {
      message = t("dateField", { field: label });
    }
    return { name, message };
  }

  function showFormErrors(errors: { name: string; message: string }[]) {
    setFormErrors(errors);
    focusField(errors[0]?.name ?? "");
  }

  function errorProps(name: string) {
    return formErrors.some((error) => error.name === name)
      ? { "aria-invalid": true as const, "aria-describedby": "bean-form-errors" }
      : {};
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || draftRecovery.status === "conflict") return;

    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const continueAdding =
      mode === "create" &&
      submitter?.getAttribute("name") === "continue";

    const submission: BeanFormData = isBlend
        ? {
            ...form,
            origin_country: "",
            origin_country_id: undefined,
            origin_region: undefined,
            origin_region_id: undefined,
            origin_subregions: undefined,
            origin_lat: undefined,
            origin_lng: undefined,
            farm_producer: undefined,
            origin_entity_id: undefined,
            varietal: undefined,
            altitude_m: undefined,
            harvest_year: undefined,
          }
        : { ...form, blend_components: [] };
    submission.roast_date ||= undefined;
    submission.purchased_at ||= undefined;
    submission.cafe_name = form.place_type === "cafe" ? form.cafe_name : undefined;
    submission.tags = tagsWithDraft(form.tags ?? [], tagDraft);

    const invalidInput = Array.from(formRef.current?.querySelectorAll<HTMLInputElement>('input') ?? [])
      .find((input) => input.validity.badInput);
    if (invalidInput) {
      showFormErrors([{ name: invalidInput.name, message: t("invalidField", { field: invalidInput.labels?.[0]?.textContent ?? invalidInput.getAttribute("aria-label") ?? t("basicInfo") }) }]);
      return;
    }
    const parsed = beanFormSchema.safeParse(submission);
    if (!parsed.success) {
      showFormErrors(parsed.error.issues.map(validationError));
      return;
    }

    setFormErrors([]);
    setSubmitting(true);
    try {
      const result =
        mode === "edit" && initial
          ? await updateBean(initial.id, parsed.data)
          : await createBean(parsed.data);

      if (result?.error) {
        showFormErrors([{ name: "", message: t("saveFailed") }]);
        return;
      }

      const nextRecents = saveRecentRoastery(form.roastery);
      if (nextRecents) setRecentRoasteries(nextRecents);
      if (importingGuestDraft) clearGuestBeanDraft();
      if (continueAdding) {
        toast.show(t("saved"));
        const nextForm = { ...defaultForm(), roastery: form.roastery };
        setDraftBaseline({ form: nextForm, tagDraft: "", showDetails: false });
        draftRecovery.reset({ form: nextForm, tagDraft: "", showDetails: false });
        setForm(nextForm);
        setTagDraft("");
        setGuestDraftLoaded(false);
        setShowDetails(false);
        focusField("name");
      } else {
        draftRecovery.reset(draftValue);
        toast.showAfterNavigation(t("saved"));
        // A fresh document abandons queued origin Server Actions, whose late
        // router-state updates can otherwise restore the saved edit screen.
        window.location.assign(returnTo);
      }
    } catch {
      showFormErrors([{ name: "", message: t("saveFailed") }]);
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
      e.nativeEvent.keyCode !== 229 &&
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
      ref={(node) => {
        formRef.current = node;
        // Keep native checks available until the client validation is attached.
        if (node) node.noValidate = true;
      }}
      action={mode === "create" ? createBeanFromForm : undefined}
      onSubmit={handleSubmit}
      onKeyDown={handleFormKeyDown}
      className="flex flex-col gap-6"
    >
      <RecordDraftNotice
        status={draftRecovery.status}
        onDiscard={() => { draftRecovery.discard(draftBaseline); focusField("name"); }}
        onRestore={draftRecovery.restoreConflict}
        disabled={submitting}
      />
      {guestDraftLoaded && (
        <p className="journal-panel-quiet px-4 py-3 text-sm leading-6 text-brown-medium">
          {tg("draftLoaded")}
        </p>
      )}
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="bean_type" value={form.bean_type} />
      <input type="hidden" name="place_type" value={form.place_type} />
      <input type="hidden" name="overall_score" value={form.overall_score} />
      {formErrors.length > 0 && (
        <div id="bean-form-errors" ref={errorRef} role="alert" tabIndex={-1} className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">{t("checkFields")}</p>
          <ul className="mt-2 space-y-1">
            {formErrors.map((error, index) => (
              <li key={`${error.name}-${index}`}>
                {error.name ? <button type="button" onClick={() => focusField(error.name)} className="text-left underline underline-offset-2">{error.message}</button> : error.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <fieldset disabled={submitting || draftRecovery.status === "conflict"} aria-busy={submitting} className="contents">
      {/* ── Quick section ─────────────────────────────── */}
      <section className="paper-sheet animate-rise p-5 md:p-8">
        <div className="mb-7 flex items-center justify-between">
          <p className="journal-kicker">{t("basicInfo")}</p>
          <span className="font-display text-3xl text-accent">01</span>
        </div>
        <div className="flex flex-col gap-5">
          {mode === "create" && labelImportEnabled && (
            <BeanLabelInput form={form} onApply={handleLabelApply} disabled={submitting || draftRecovery.status === "conflict"} />
          )}
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
            maxLength={200}
            {...errorProps("name")}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={t("namePlaceholder")}
            required
          />

          {/* Roastery with recent autocomplete */}
          <div className="relative" onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setRoasteryOpen(false);
          }}>
            <Input
              label={req(t("roastery"))}
              name="roastery"
              maxLength={200}
              {...errorProps("roastery")}
              value={form.roastery}
              onChange={(e) => set("roastery", e.target.value)}
              onFocus={() => setRoasteryOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setRoasteryOpen(false);
                if (event.key === "ArrowDown" && roasterySuggestions.length > 0) {
                  event.preventDefault();
                  formRef.current?.querySelector<HTMLButtonElement>('[data-roastery-option]')?.focus();
                }
              }}
              placeholder={t("roasteryPlaceholder")}
              required
              autoComplete="off"
            />
            {roasteryOpen && roasterySuggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border-light bg-surface shadow-lg">
                {roasterySuggestions.map((r) => (
                  <li key={r}>
                    <button
                      type="button"
                      data-roastery-option
                      onMouseDown={(e) => {
                        e.preventDefault();
                      }}
                      onClick={() => {
                        set("roastery", r);
                        formRef.current?.querySelector<HTMLInputElement>('[name="roastery"]')?.focus();
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
                errorProps={errorProps}
              />
              {processSelect}
            </div>
          )}
        </div>

        {/* Origin — 산지 → 생산자 → 품종 → 가공 정보 순 */}
        {!isBlend && (
          <div className="mt-8 flex flex-col gap-4">
            <h2 className="font-display text-2xl font-bold tracking-[-0.025em] text-brown">
              {t("originInfo")}
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              <Combobox
                label={req(t("originCountry"))}
                name="origin_country"
                maxLength={100}
                {...errorProps("origin_country")}
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
                maxLength={100}
                {...errorProps("origin_region")}
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
              name="origin_subregions"
              {...errorProps("origin_subregions")}
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
              maxLength={200}
              {...errorProps("farm_producer")}
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
                maxLength={100}
                {...errorProps("varietal")}
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
                min={0}
                max={5000}
                step={1}
                {...errorProps("altitude_m")}
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
                min={1900}
                max={2100}
                step={1}
                {...errorProps("harvest_year")}
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
        <div className="mt-9 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <p className="journal-kicker">{t("roastAndPlace")}</p>
            <span className="font-display text-2xl text-accent">02</span>
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
              {...errorProps("consumed_at")}
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
                maxLength={200}
                {...errorProps("cafe_name")}
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
        <div className="mt-9 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <p className="journal-kicker">{t("evaluation")}</p>
            <span className="font-display text-2xl text-accent">03</span>
          </div>
          <ScoreSlider
            label={req(t("overallScore"))}
            value={form.overall_score}
            onChange={(v) => set("overall_score", v)}
          />
          <Textarea
            label={req(t("note"))}
            name="note"
            maxLength={2000}
            {...errorProps("note")}
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
          "animate-rise flex min-h-14 items-center justify-between gap-2 rounded-lg bg-surface-warm px-4 py-3.5",
          "text-sm font-semibold text-brown transition-all duration-200",
          "hover:bg-cream-dark/70",
          showDetails && "bg-cream-dark/70"
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
          className="paper-sheet animate-rise p-5 md:p-8"
        >
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Input
                label={t("processDetail")}
                name="process_detail"
                maxLength={200}
                {...errorProps("process_detail")}
                value={form.process_detail ?? ""}
                onChange={(e) => set("process_detail", e.target.value)}
                placeholder={t("processDetailPlaceholder")}
                optional
                optionalLabel={tc("optional")}
              />
              <Input
                label={t("roastDate")}
                name="roast_date"
                {...errorProps("roast_date")}
                type="date"
                value={form.roast_date ?? ""}
                onChange={(e) => set("roast_date", e.target.value || undefined)}
                optional
                optionalLabel={tc("optional")}
              />
            </div>

            {/* Tasting tags */}
            <div className="mt-8 flex flex-col gap-3">
              <SectionLabel>{t("tastingNotes")}</SectionLabel>
              <TagInput value={form.tags ?? []} onChange={handleTagsChange} draft={tagDraft} onDraftChange={setTagDraft} {...errorProps("tasting_tags_draft")} />
            </div>

            {/* Detail scores */}
            <div className="mt-8 flex flex-col gap-3">
              <SectionLabel>{t("detailedScores")}</SectionLabel>
              <DetailScoreInput scores={detailScores} onChange={setDetailScore} />
            </div>

            {/* Purchase info */}
            <div className="mt-8 flex flex-col gap-5">
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
                  {...errorProps("price")}
                  min={0}
                  max={10000000}
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
                  min={1}
                  max={100000}
                  step={1}
                  {...errorProps("weight_g")}
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
                  {...errorProps("purchased_at")}
                  type="date"
                  value={form.purchased_at ?? ""}
                  onChange={(e) => set("purchased_at", e.target.value || undefined)}
                  optional
                  optionalLabel={tc("optional")}
                />
              </div>
            </div>
        </section>
      )}

      {/* ── Submit ────────────────────────────────────── */}
      <div
        className="animate-rise flex flex-col-reverse gap-3 bg-cream py-5 sm:flex-row sm:justify-end"
        style={{ animationDelay: "120ms" }}
      >
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (!draftRecovery.confirmLeave(td("leaveConfirm"))) return;
            router.push(mode === "edit" && initial ? beanDetailHref(initial.id, locale, returnTo) : returnTo);
          }}
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
      </fieldset>
    </form>
  );
}
