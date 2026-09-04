"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { getBeans } from "@/lib/actions/beans";
import { BeanCard } from "@/components/beans/bean-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { splitVarietals } from "@/lib/coffee/varietals";
import { originPresets } from "@/data/origin-presets";
import type {
  BeanFilters,
  BeanType,
  BeanWithTags,
  ProcessMethod,
  RoastLevel,
} from "@/types/database";

const PAGE_SIZE = 20;
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
          "min-h-11 w-full cursor-pointer appearance-none rounded-sm border py-2 pl-3 pr-9 text-xs font-medium transition-colors duration-150",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
          active
            ? "border-brown bg-brown text-cream"
            : "border-border bg-surface text-brown-medium hover:border-brown-light"
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
    <div className="animate-pulse rounded-sm border border-border bg-surface p-5">
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

  return (
    <div className="col-span-full flex flex-col items-center py-20 text-center">
      <svg
        className="mb-6 h-14 w-14 text-brown-light/40"
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 20h26v10a10 10 0 01-10 10H18a10 10 0 01-10-10V20z" />
        <path d="M34 22h3a5 5 0 010 10h-3" />
        <path d="M16 14c0-2 2-2 2-4M22 14c0-2 2-2 2-4M28 14c0-2 2-2 2-4" />
      </svg>
      <h2 className="font-display text-xl font-bold text-brown">{t("empty")}</h2>
      <p className="mt-1.5 text-sm text-brown-light">{t("emptySub")}</p>
      {hasFilters ? (
        <Button variant="secondary" size="md" className="mt-6" onClick={onClear}>
          {t("clearFilters")}
        </Button>
      ) : (
        <Link
          href={`/${locale}/beans/new`}
          className="mt-6 inline-flex items-center justify-center rounded-sm bg-brown px-6 py-3 text-base font-medium text-cream transition-colors duration-150 hover:bg-brown-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          {t("addFirst")}
        </Link>
      )}
    </div>
  );
}

export function ExploreClient({
  initialBeans,
  initialTotal,
  initialFilterOptions,
}: {
  initialBeans: BeanWithTags[];
  initialTotal: number;
  initialFilterOptions: {
    origins: string[];
    roasteries: string[];
    varietals: string[];
  };
}) {
  const t = useTranslations("explore");
  const tBeans = useTranslations("beans");
  const tProcess = useTranslations("process");
  const tRoast = useTranslations("roast");
  const locale = useLocale();

  const [searchInput, setSearchInput] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<BeanFilters>({
    sort_by: "consumed_at",
    sort_order: "desc",
  });
  const [page, setPage] = useState(0);
  const [beans, setBeans] = useState<BeanWithTags[]>(initialBeans);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
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
  const initialFetch = useRef(true);
  const appliedSearch = useRef<string | undefined>(undefined);

  const changeView = (nextView: ViewMode) => storeViewMode(nextView);

  // Debounce search input -> filters (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      const term = searchInput.trim() || undefined;
      if (appliedSearch.current === term) return;
      appliedSearch.current = term;
      setFilters((prev) => ({ ...prev, search: term }));
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch whenever filters or page change
  useEffect(() => {
    // The server component already supplied page zero. Re-fetching it on mount
    // can race with an immediate search or "load more" interaction.
    const isServerSeededRequest =
      page === 0 &&
      filters.sort_by === "consumed_at" &&
      filters.sort_order === "desc" &&
      !filters.origin_country &&
      !filters.process_method &&
      !filters.varietal &&
      !filters.roastery &&
      !filters.bean_type &&
      !filters.roast_level &&
      !filters.search;
    if (initialFetch.current && isServerSeededRequest) {
      initialFetch.current = false;
      return;
    }
    initialFetch.current = false;
    let cancelled = false;

    async function load() {
      if (page === 0) setLoading(true);
      else setLoadingMore(true);

      const res = await getBeans({ ...filters, page, limit: PAGE_SIZE });
      if (cancelled) return;

      const fetched = (res.beans ?? []) as BeanWithTags[];
      setBeans((prev) => (page === 0 ? fetched : [...prev, ...fetched]));
      setTotal(res.count);

      // Grow filter option pool from everything we've seen
      setOptionPool((prev) => {
        const origins = new Set(prev.origins);
        const roasteries = new Set(prev.roasteries);
        const varietals = new Set(prev.varietals);
        fetched.forEach((b) => {
          if (b.origin_country) origins.add(b.origin_country);
          if (b.roastery) roasteries.add(b.roastery.trim());
          for (const varietal of splitVarietals(b.varietal)) {
            varietals.add(varietal);
          }
        });
        return {
          origins: [...origins].sort(),
          roasteries: [...roasteries].sort(),
          varietals: [...varietals].sort(),
        };
      });

      setLoading(false);
      setLoadingMore(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [filters, page]);

  const updateFilter = <K extends keyof BeanFilters>(key: K, value: BeanFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
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
    setFilters((prev) => ({
      sort_by: prev.sort_by,
      sort_order: prev.sort_order,
    }));
    setPage(0);
  };

  const sortValue =
    filters.sort_by === "overall_score" ? "score" : filters.sort_by === "name" ? "name" : "newest";

  const handleSortChange = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      ...(value === "score"
        ? { sort_by: "overall_score", sort_order: "desc" }
        : value === "name"
          ? { sort_by: "name", sort_order: "asc" }
          : { sort_by: "consumed_at", sort_order: "desc" }),
    }));
    setPage(0);
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
    () => optionPool.varietals.map((v) => ({ value: v, label: v })),
    [optionPool.varietals]
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

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-7 grid border-y-2 border-brown md:grid-cols-[1fr_13rem]">
        <div className="py-9 md:py-12">
          <p className="journal-kicker">PRIVATE ARCHIVE / INDEX</p>
          <h1 className="display-title mt-3 text-5xl text-brown md:text-7xl">
            {t("title")}
          </h1>
        </div>
        <div className="flex items-end justify-between border-t border-border bg-surface-warm p-5 md:block md:border-l md:border-t-0 md:p-7">
          <p className="folio-label">RECORD COUNT</p>
          <p className="font-display text-5xl font-bold italic tabular-nums tracking-[-0.05em] text-accent md:mt-5 md:text-6xl">{total}</p>
        </div>
      </header>

      <div className="paper-sheet grid grid-cols-2 gap-2 p-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:p-4">
        <div className="relative col-span-2 md:col-span-1">
          <svg
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
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("search")}
            className={cn(
              "min-h-12 w-full rounded-sm border border-border bg-cream py-2.5 pl-10 pr-3 text-sm text-brown",
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
            "inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border px-3 text-xs font-semibold transition-colors duration-150",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
            filtersOpen
              ? "border-brown bg-brown text-cream"
              : "border-border bg-cream text-brown-medium hover:border-brown-light"
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
              "min-h-12 w-full cursor-pointer appearance-none rounded-sm border border-border bg-cream py-2 pl-3 pr-9 text-xs font-semibold text-brown-medium",
              "transition-colors duration-150 hover:border-brown-light focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
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

      {filtersOpen && (
        <div id="explore-filter-panel" className="mt-4 border-y-2 border-brown bg-surface-warm py-4">
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
                className="inline-flex min-h-8 items-center gap-1.5 border-b border-border-light text-xs text-brown-medium transition-colors duration-150 hover:border-brown hover:text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
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
            className="shrink-0 py-1.5 text-xs font-medium text-accent transition-colors duration-150 hover:text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {t("clearFilters")}
          </button>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between border-b-2 border-brown pb-3">
        <p className="folio-label">
          {loading ? t("results", { count: 0 }) : t("results", { count: total })}
        </p>
        <div
          className="hidden items-center border border-border bg-surface md:flex"
          role="group"
          aria-label={t("viewMode")}
        >
          <button
            type="button"
            aria-label={t("listView")}
            aria-pressed={viewMode === "list"}
            onClick={() => changeView("list")}
            className={cn(
              "flex min-h-11 min-w-11 items-center justify-center text-brown-light transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50",
              viewMode === "list" && "bg-cream-dark text-brown"
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
              "flex min-h-11 min-w-11 items-center justify-center border-l border-border text-brown-light transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50",
              viewMode === "grid" && "bg-cream-dark text-brown"
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

      <div
        data-testid="bean-grid"
        data-view={viewMode}
        className={cn(
          "mt-4 grid grid-cols-1 gap-4",
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
          beans.map((bean) => <BeanCard key={bean.id} bean={bean} view={viewMode} />)
        )}
      </div>

      {/* Load more */}
      {!loading && beans.length > 0 && beans.length < total && (
        <div className="mt-6 flex justify-center pb-4">
          <Button
            variant="secondary"
            onClick={() => setPage((p) => p + 1)}
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
