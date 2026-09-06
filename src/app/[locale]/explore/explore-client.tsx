"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { getBeans } from "@/lib/actions/beans";
import { BeanCard } from "@/components/beans/bean-card";
import { FilterOptionsRecovery } from "@/components/beans/filter-options-recovery";
import { Button } from "@/components/ui/button";
import { EmptyJournalGuide } from "@/components/beans/empty-journal-guide";
import { PageIntro } from "@/components/layout/page-intro";
import { cn } from "@/lib/utils";
import { splitCanonicalVarietals, trimCoffeeWhitespace, varietalDisplayName } from "@/lib/coffee/canonical-varietals";
import { originPresets } from "@/data/origin-presets";
import { EXPLORE_PAGE_SIZE, exploreHref, exploreQuery, loadExploreWindow, parseExploreQuery, type ExploreNavigationState } from "@/lib/coffee/explore-navigation";
import type {
  BeanFilters,
  BeanType,
  BeanWithTags,
  ProcessMethod,
  RoastLevel,
} from "@/types/database";

const PAGE_SIZE = EXPLORE_PAGE_SIZE;
const VIEW_STORAGE_KEY = "beanmap:explore-view";
const VIEW_CHANGE_EVENT = "beanmap:explore-view-change";
const subscribeToHydration = () => () => {};
type ViewMode = "grid" | "list";
let fallbackViewMode: ViewMode = "grid";

function getStoredViewMode(): ViewMode {
  if (typeof window === "undefined") return fallbackViewMode;
  try {
    const storedView = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (storedView === "grid" || storedView === "list") fallbackViewMode = storedView;
  } catch {
    // Keep the in-memory preference when browser storage is unavailable.
  }
  return fallbackViewMode;
}

function getDefaultViewMode(): ViewMode {
  return "grid";
}

function subscribeToViewMode(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === VIEW_STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(VIEW_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(VIEW_CHANGE_EVENT, onStoreChange);
  };
}

function storeViewMode(nextView: ViewMode) {
  fallbackViewMode = nextView;
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, nextView);
  } catch {
    // The current tab can still switch views when persistence is unavailable.
  }
  window.dispatchEvent(new Event(VIEW_CHANGE_EVENT));
}

const PROCESS_METHODS: ProcessMethod[] = [
  "washed",
  "natural",
  "honey",
  "anaerobic",
  "carbonic",
  "decaf",
  "other",
];
const ROAST_LEVELS: RoastLevel[] = ["light", "medium", "dark"];
const BEAN_TYPES: BeanType[] = ["single_origin", "blend"];

interface FilterChipProps {
  label: string;
  allLabel: string;
  value?: string;
  options: { value: string; label: string }[];
  onChange: (value: string | undefined) => void;
}

function FilterChip({ label, allLabel, value, options, onChange }: FilterChipProps) {
  const active = Boolean(value);

  return (
    <div className="relative min-w-0">
      <select
        aria-label={label}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={cn(
          "min-h-11 w-full cursor-pointer appearance-none rounded-md border py-2 pl-3 pr-9 text-xs font-medium transition-colors duration-150",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          active
            ? "border-transparent bg-brown text-cream"
            : "border-border-light bg-surface text-brown-medium hover:border-border"
        )}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2",
          active ? "text-cream" : "text-brown-light"
        )}
        viewBox="0 0 12 12"
        fill="none"
      >
        <path d="m2.5 4.25 3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="h-5 w-2/3 rounded bg-cream-dark" />
          <div className="mt-2 h-4 w-1/3 rounded bg-cream-dark" />
          <div className="mt-2 h-3 w-1/2 rounded bg-cream-dark" />
        </div>
        <div className="h-7 w-12 rounded bg-cream-dark" />
      </div>
      <div className="mt-4 flex gap-1.5">
        <div className="h-5 w-14 rounded-sm bg-cream-dark" />
        <div className="h-5 w-14 rounded-sm bg-cream-dark" />
      </div>
      <div className="mt-4 h-px bg-border-light" />
      <div className="mt-3 flex justify-between">
        <div className="h-3 w-10 rounded bg-cream-dark" />
        <div className="h-3 w-20 rounded bg-cream-dark" />
      </div>
    </div>
  );
}

function EmptyState({
  hasFilters,
  onClear,
}: {
  hasFilters: boolean;
  onClear: () => void;
}) {
  const t = useTranslations("explore");
  const locale = useLocale();

  if (!hasFilters) {
    return (
      <EmptyJournalGuide
        testId="explore-empty-state"
        title={t("emptyTitle")}
        actionLabel={t("addFirst")}
        href={`/${locale}/beans/new`}
      />
    );
  }

  return (
    <div
      data-testid="explore-empty-state"
      className="col-span-full flex flex-col items-center px-6 py-10 text-center md:py-12"
    >
      <h2 className="text-lg font-semibold tracking-[-0.015em] text-brown">{t("noMatches")}</h2>
      <Button variant="secondary" size="md" className="mt-6" onClick={onClear}>
        {t("clearFilters")}
      </Button>
    </div>
  );
}

function LoadErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("explore");

  return (
    <div
      role="alert"
      data-testid="explore-load-error"
      className="col-span-full flex flex-col items-center px-6 py-12 text-center md:py-14"
    >
      <p className="text-base font-semibold text-brown">{t("loadError")}</p>
      <p className="mt-1.5 text-sm text-brown-light">{t("loadErrorSub")}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 min-h-11 rounded-md bg-brown px-5 py-2.5 text-sm font-semibold text-cream transition-colors duration-150 hover:bg-brown-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {t("retry")}
      </button>
    </div>
  );
}

export function ExploreClient({
  initialBeans,
  initialTotal,
  initialFilterOptions,
  initialLoadError,
  initialState,
}: {
  initialBeans: BeanWithTags[];
  initialTotal: number;
  initialFilterOptions: {
    origins: string[];
    roasteries: string[];
    varietals: string[];
    error?: string;
  };
  initialLoadError: boolean;
  initialState: ExploreNavigationState;
}) {
  const t = useTranslations("explore");
  const tBeans = useTranslations("beans");
  const tCommon = useTranslations("common");
  const tProcess = useTranslations("process");
  const tRoast = useTranslations("roast");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const queryKey = searchParams.toString();
  const navigationState = useMemo(() => parseExploreQuery(new URLSearchParams(queryKey)), [queryKey]);
  const { filters, page } = navigationState;
  const filterKey = exploreQuery({ filters, page: 0 });
  const [searchDraft, setSearchDraft] = useState({ queryKey, value: filters.search ?? "" });
  // Browser back/forward restores the input together with the URL controls.
  if (searchDraft.queryKey !== queryKey) {
    setSearchDraft({ queryKey, value: filters.search ?? "" });
  }
  const searchInput = searchDraft.queryKey === queryKey ? searchDraft.value : filters.search ?? "";
  const setSearchInput = (value: string) => setSearchDraft({ queryKey, value });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [beans, setBeans] = useState<BeanWithTags[]>(initialBeans);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(initialLoadError);
  const [retryKey, setRetryKey] = useState(0);
  const [hasJournalEntries, setHasJournalEntries] = useState(
    initialTotal > 0 || initialBeans.length > 0 || initialFilterOptions.roasteries.length > 0 ||
    Object.keys(initialState.filters).some((key) => !key.startsWith("sort_"))
  );
  const viewMode = useSyncExternalStore(
    subscribeToViewMode,
    getStoredViewMode,
    getDefaultViewMode
  );
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  );
  const [optionPool, setOptionPool] = useState<{
    origins: string[];
    roasteries: string[];
    varietals: string[];
  }>(initialFilterOptions);
  const cachedResults = useRef({
    filterKey: exploreQuery({ filters: initialState.filters, page: 0 }),
    beans: initialBeans,
    total: initialTotal,
    nextPage: initialLoadError ? 0 : 1,
  });

  function updateNavigation(next: ExploreNavigationState, replace = false) {
    const href = exploreHref(locale, next);
    if (href === `${window.location.pathname}${window.location.search}`) return;
    window.history[replace ? "replaceState" : "pushState"](null, "", href);
  }

  const changeView = (nextView: ViewMode) => storeViewMode(nextView);

  // Debounce search input -> filters (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      const term = searchInput.trim() || undefined;
      if (filters.search === term) return;
      updateNavigation({ filters: { ...filters, search: term }, page: 0 }, true);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filterKey, queryKey, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  // A restored URL includes all pages previously revealed by “Load more”.
  // Refresh the visible prefix when adding a page: older offsets can shift after
  // a record is added or deleted in another tab. Up to 100 rows use one request.
  useEffect(() => {
    let cancelled = false;
    const requestedFilters = parseExploreQuery(new URLSearchParams(filterKey)).filters;

    async function load() {
      let cache = cachedResults.current;
      if (cache.filterKey !== filterKey) {
        cache = { filterKey, beans: [], total: 0, nextPage: 0 };
      }
      const needsFetch = cache.nextPage === 0 ||
        (cache.nextPage <= page && cache.beans.length < cache.total);
      if (needsFetch) {
        if (cache.nextPage === 0) setLoading(true);
        else setLoadingMore(true);
      }

      if (needsFetch) {
        const result = await loadExploreWindow<BeanWithTags>(page,
          (nextPage, limit) => getBeans({ ...requestedFilters, page: nextPage, limit }),
          () => cancelled);
        if (cancelled) return;
        cache = {
          filterKey,
          beans: result.beans,
          total: result.total,
          nextPage: page + 1,
        };
        cachedResults.current = cache;
      }
      if (cancelled) return;
      setLoadError(false);
      setBeans(cache.beans.slice(0, (page + 1) * PAGE_SIZE));
      setTotal(cache.total);
      if (cache.total > 0) setHasJournalEntries(true);
      setOptionPool((previous) => {
        const origins = new Set(previous.origins);
        const roasteries = new Set(previous.roasteries);
        const varietals = new Set(previous.varietals);
        cache.beans.forEach((bean) => {
          if (bean.bean_type === "single_origin" && bean.origin_country) origins.add(bean.origin_country);
          if (bean.roastery) roasteries.add(trimCoffeeWhitespace(bean.roastery));
          if (bean.bean_type === "single_origin") {
            for (const varietal of splitCanonicalVarietals(bean.varietal)) varietals.add(varietal);
          }
          for (const component of bean.bean_type === "blend" ? bean.blend_components ?? [] : []) {
            if (component.origin_country) origins.add(component.origin_country);
            for (const varietal of splitCanonicalVarietals(component.varietal)) varietals.add(varietal);
          }
        });
        return { origins: [...origins].sort(), roasteries: [...roasteries].sort(), varietals: [...varietals].sort() };
      });
      setLoading(false);
      setLoadingMore(false);
    }

    load().catch(() => {
      if (cancelled) return;
      setLoadError(true);
      setLoading(false);
      setLoadingMore(false);
    });
    return () => { cancelled = true; };
  }, [filterKey, page, retryKey]);

  useEffect(() => {
    if (loading || loadingMore || !/^#bean-[0-9a-f-]{36}$/i.test(window.location.hash)) return;
    const frame = window.requestAnimationFrame(() => {
      const card = document.getElementById(window.location.hash.slice(1));
      if (!card) return;
      card.scrollIntoView({ block: "start" });
      card.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [beans, loading, loadingMore]);

  const updateFilter = <K extends keyof BeanFilters>(key: K, value: BeanFilters[K]) => {
    updateNavigation({ filters: { ...filters, search: searchInput.trim() || undefined, [key]: value }, page: 0 });
  };

  const hasActiveFilters = Boolean(
    filters.origin_country ||
      filters.process_method ||
      filters.varietal ||
      filters.roastery ||
      filters.bean_type ||
      filters.roast_level ||
      filters.search
  );
  const clearFilters = () => {
    setSearchInput("");
    updateNavigation({ filters: { sort_by: filters.sort_by, sort_order: filters.sort_order }, page: 0 });
  };

  const sortValue =
    filters.sort_by === "overall_score" ? "score" : filters.sort_by === "name" ? "name" : "newest";

  const handleSortChange = (value: string) => {
    updateNavigation({ filters: {
      ...filters,
      search: searchInput.trim() || undefined,
      ...(value === "score"
        ? { sort_by: "overall_score", sort_order: "desc" }
        : value === "name"
          ? { sort_by: "name", sort_order: "asc" }
          : { sort_by: "consumed_at", sort_order: "desc" }),
    }, page: 0 });
  };

  // Origin options: presets (localized) + anything extra seen in the data
  const originOptions = useMemo(() => {
    const presetMap = new Map(
      originPresets.map((p) => [p.country, locale === "ko" ? p.countryKo : p.country])
    );
    const seen = new Set<string>();
    const options: { value: string; label: string }[] = [];

    originPresets.forEach((p) => {
      if (optionPool.origins.includes(p.country)) {
        options.push({ value: p.country, label: presetMap.get(p.country) ?? p.country });
        seen.add(p.country);
      }
    });
    optionPool.origins.forEach((country) => {
      if (!seen.has(country)) {
        options.push({ value: country, label: country });
      }
    });
    return options;
  }, [optionPool.origins, locale]);

  const roasteryOptions = useMemo(
    () => optionPool.roasteries.map((r) => ({ value: r, label: r })),
    [optionPool.roasteries]
  );

  const varietalOptions = useMemo(
    () => optionPool.varietals.map((v) => ({ value: v, label: varietalDisplayName(v, locale) })),
    [optionPool.varietals, locale]
  );

  const processOptions = PROCESS_METHODS.map((p) => ({ value: p, label: tProcess(p) }));
  const roastOptions = ROAST_LEVELS.map((r) => ({ value: r, label: tRoast(r) }));
  const typeOptions = BEAN_TYPES.map((b) => ({
    value: b,
    label: b === "blend" ? tBeans("blend") : tBeans("singleOrigin"),
  }));

  const activeFilterItems = [
    {
      key: "origin_country",
      label: t("allOrigins"),
      value: filters.origin_country,
      valueLabel: originOptions.find((option) => option.value === filters.origin_country)?.label,
    },
    {
      key: "process_method",
      label: t("allProcess"),
      value: filters.process_method,
      valueLabel: processOptions.find((option) => option.value === filters.process_method)?.label,
    },
    {
      key: "varietal",
      label: t("allVarietal"),
      value: filters.varietal,
      valueLabel: varietalOptions.find((option) => option.value === filters.varietal)?.label,
    },
    {
      key: "roastery",
      label: t("allRoastery"),
      value: filters.roastery,
      valueLabel: roasteryOptions.find((option) => option.value === filters.roastery)?.label,
    },
    {
      key: "bean_type",
      label: t("allType"),
      value: filters.bean_type,
      valueLabel: typeOptions.find((option) => option.value === filters.bean_type)?.label,
    },
    {
      key: "roast_level",
      label: t("allRoast"),
      value: filters.roast_level,
      valueLabel: roastOptions.find((option) => option.value === filters.roast_level)?.label,
    },
  ].filter(
    (item): item is typeof item & { value: string; valueLabel: string } =>
      Boolean(item.value && item.valueLabel)
  );

  const removeFilter = (key: string) => {
    switch (key) {
      case "origin_country":
        updateFilter("origin_country", undefined);
        break;
      case "process_method":
        updateFilter("process_method", undefined);
        break;
      case "varietal":
        updateFilter("varietal", undefined);
        break;
      case "roastery":
        updateFilter("roastery", undefined);
        break;
      case "bean_type":
        updateFilter("bean_type", undefined);
        break;
      case "roast_level":
        updateFilter("roast_level", undefined);
        break;
    }
  };

  const pageHeader = (
    <PageIntro
      eyebrow={t("eyebrow")}
      title={t("title")}
      testId="explore-header"
      meta={!loadError && (
        <p role="status" aria-live="polite" className="folio-label">
          {loading ? tCommon("loading") : t("results", { count: total })}
        </p>
      )}
    />
  );

  if (!hasJournalEntries && !loadError && !loading) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        {pageHeader}
        <div data-testid="bean-grid" data-view={viewMode} className="grid grid-cols-1">
          <EmptyState hasFilters={false} onClear={clearFilters} />
        </div>
      </div>
    );
  }

  if (!hasJournalEntries && loadError) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        {pageHeader}
        <div className="grid grid-cols-1">
          <LoadErrorState onRetry={() => setRetryKey((key) => key + 1)} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      {pageHeader}
      <div
        data-testid="explore-toolbar"
        className="mt-8 grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]"
      >
        <div className="relative col-span-2 md:col-span-1">
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brown-light/50"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            disabled={!hydrated}
            value={searchInput}
            maxLength={100}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("search")}
            className={cn(
              "min-h-11 w-full rounded-md border border-border-light bg-surface py-2.5 pl-10 pr-3 text-sm text-brown",
              "placeholder:text-brown-light/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15",
              "transition-colors duration-150 disabled:cursor-wait disabled:opacity-70"
            )}
          />
        </div>

        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="explore-filter-panel"
          onClick={() => setFiltersOpen((open) => !open)}
          className={cn(
            "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold transition-colors duration-150",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            filtersOpen
              ? "border-transparent bg-brown text-cream"
              : "border-border-light bg-surface text-brown-medium hover:bg-surface-warm"
          )}
        >
          <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M4.5 8h7M6.5 12h3" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span>{t("filters")}</span>
          {activeFilterItems.length > 0 && (
            <span className="border-l border-current/30 pl-2 tabular-nums">
              {activeFilterItems.length}
            </span>
          )}
        </button>

        <div className="relative min-w-0 md:w-36">
          <select
            aria-label={t("sortBy")}
            value={sortValue}
            onChange={(e) => handleSortChange(e.target.value)}
            className={cn(
              "min-h-11 w-full cursor-pointer appearance-none rounded-md border border-border-light bg-surface py-2 pl-3 pr-9 text-xs font-semibold text-brown-medium",
              "transition-colors duration-150 hover:bg-surface-warm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            )}
          >
            <option value="newest">{t("sortNewest")}</option>
            <option value="score">{t("sortScore")}</option>
            <option value="name">{t("sortName")}</option>
          </select>
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-brown-light"
            viewBox="0 0 12 12"
            fill="none"
          >
            <path d="m2.5 4.25 3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
      </div>

      <FilterOptionsRecovery initialError={initialFilterOptions.error} onRecovered={setOptionPool} />

      {filtersOpen && (
        <div id="explore-filter-panel" className="mt-4 rounded-lg bg-surface-warm p-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <FilterChip
              label={t("allOrigins")}
              allLabel={t("allOrigins")}
              value={filters.origin_country}
              options={originOptions}
              onChange={(v) => updateFilter("origin_country", v)}
            />
            <FilterChip
              label={t("allProcess")}
              allLabel={t("allProcess")}
              value={filters.process_method}
              options={processOptions}
              onChange={(v) => updateFilter("process_method", v as ProcessMethod | undefined)}
            />
            <FilterChip
              label={t("allVarietal")}
              allLabel={t("allVarietal")}
              value={filters.varietal}
              options={varietalOptions}
              onChange={(v) => updateFilter("varietal", v)}
            />
            <FilterChip
              label={t("allRoastery")}
              allLabel={t("allRoastery")}
              value={filters.roastery}
              options={roasteryOptions}
              onChange={(v) => updateFilter("roastery", v)}
            />
            <FilterChip
              label={t("allType")}
              allLabel={t("allType")}
              value={filters.bean_type}
              options={typeOptions}
              onChange={(v) => updateFilter("bean_type", v as BeanType | undefined)}
            />
            <FilterChip
              label={t("allRoast")}
              allLabel={t("allRoast")}
              value={filters.roast_level}
              options={roastOptions}
              onChange={(v) => updateFilter("roast_level", v as RoastLevel | undefined)}
            />
          </div>
        </div>
      )}

      {activeFilterItems.length > 0 && (
        <div className="mt-3 flex items-start justify-between gap-4">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {activeFilterItems.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-label={t("removeFilter", { label: item.label, value: item.valueLabel })}
                onClick={() => removeFilter(item.key)}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-surface-warm px-2.5 text-xs text-brown-medium transition-colors duration-150 hover:bg-cream-dark hover:text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="text-brown-light">{item.label}</span>
                <span>{item.valueLabel}</span>
                <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={clearFilters}
            className="shrink-0 py-1.5 text-xs font-medium text-accent transition-colors duration-150 hover:text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t("clearFilters")}
          </button>
        </div>
      )}

      {loadError && (
        <div
          role="alert"
          className="mt-4 flex min-h-11 items-center justify-between gap-4 rounded-md bg-surface-warm px-3 py-2 text-sm text-brown-medium"
        >
          <span>{t("loadError")}</span>
          <button
            type="button"
            onClick={() => setRetryKey((key) => key + 1)}
            className="min-h-11 shrink-0 rounded-md px-3 font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t("retry")}
          </button>
        </div>
      )}

      {beans.length > 0 && (
        <div data-testid="explore-results" className="mt-6 flex items-center justify-end">
          <div className="hidden items-center gap-1 md:flex" role="group" aria-label={t("viewMode")}>
            <button
              type="button"
              aria-label={t("listView")}
              aria-pressed={viewMode === "list"}
              onClick={() => changeView("list")}
              className={cn(
                "flex min-h-11 min-w-11 items-center justify-center rounded-md text-brown-light transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
                viewMode === "list" && "bg-surface-warm text-brown"
              )}
            >
              <svg aria-hidden="true" width="17" height="17" viewBox="0 0 17 17" fill="none">
                <path d="M2 4h13M2 8.5h13M2 13h13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
            <button
              type="button"
              aria-label={t("gridView")}
              aria-pressed={viewMode === "grid"}
              onClick={() => changeView("grid")}
              className={cn(
                "flex min-h-11 min-w-11 items-center justify-center rounded-md text-brown-light transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
                viewMode === "grid" && "bg-surface-warm text-brown"
              )}
            >
              <svg aria-hidden="true" width="17" height="17" viewBox="0 0 17 17" fill="none">
                <rect x="2" y="2" width="5" height="5" stroke="currentColor" strokeWidth="1.3" />
                <rect x="10" y="2" width="5" height="5" stroke="currentColor" strokeWidth="1.3" />
                <rect x="2" y="10" width="5" height="5" stroke="currentColor" strokeWidth="1.3" />
                <rect x="10" y="10" width="5" height="5" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div
        data-testid="bean-grid"
        data-view={viewMode}
        aria-busy={loading}
        className={cn(
          "mt-3 grid grid-cols-1 gap-4",
          viewMode === "grid" && "md:grid-cols-2 md:gap-5"
        )}
      >
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : beans.length === 0 ? (
          <EmptyState hasFilters={hasActiveFilters} onClear={clearFilters} />
        ) : (
          beans.map((bean) => <BeanCard key={bean.id} bean={bean} view={viewMode} returnTo={`${exploreHref(locale, navigationState)}#bean-${bean.id}`} />)
        )}
      </div>

      {/* Load more */}
      {!loading && beans.length > 0 && beans.length < total && (
        <div className="mt-6 flex justify-center pb-4">
          <Button
            variant="secondary"
            onClick={() => {
              if (loadError) setRetryKey((key) => key + 1);
              else updateNavigation({ filters: { ...filters, search: searchInput.trim() || undefined }, page: (searchInput.trim() || undefined) === filters.search ? page + 1 : 0 });
            }}
            loading={loadingMore}
            disabled={!hydrated}
            className="min-w-40"
          >
            {t("loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
