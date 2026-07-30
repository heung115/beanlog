"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { getBeans } from "@/lib/actions/beans";
import { BeanCard } from "@/components/beans/bean-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { originPresets } from "@/data/origin-presets";
import type {
  BeanFilters,
  BeanType,
  BeanWithTags,
  ProcessMethod,
  RoastLevel,
} from "@/types/database";

const PAGE_SIZE = 20;
const subscribeToHydration = () => () => {};

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

const CHEVRON =
  "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%238B7355%22%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')]";
const CHEVRON_ACTIVE =
  "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23FAF7F2%22%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')]";

interface FilterChipProps {
  label: string;
  allLabel: string;
  value?: string;
  options: { value: string; label: string }[];
  onChange: (value: string | undefined) => void;
}

function FilterChip({ label, allLabel, value, options, onChange }: FilterChipProps) {
  const active = Boolean(value);
  const selected = options.find((o) => o.value === value);

  return (
    <select
      aria-label={label}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
      className={cn(
        "min-h-11 shrink-0 cursor-pointer appearance-none rounded-full border py-2 pl-3.5 pr-8 text-xs font-medium transition-colors duration-150",
        "bg-no-repeat bg-[position:right_10px_center] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        active
          ? cn("border-brown bg-brown text-cream", CHEVRON_ACTIVE)
          : cn("border-border bg-surface text-brown-medium hover:border-brown-light", CHEVRON)
      )}
    >
      <option value="">{active && selected ? selected.label : allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="h-5 w-2/3 rounded bg-cream-dark" />
          <div className="mt-2 h-4 w-1/3 rounded bg-cream-dark" />
          <div className="mt-2 h-3 w-1/2 rounded bg-cream-dark" />
        </div>
        <div className="h-7 w-12 rounded bg-cream-dark" />
      </div>
      <div className="mt-4 flex gap-1.5">
        <div className="h-5 w-14 rounded-full bg-cream-dark" />
        <div className="h-5 w-14 rounded-full bg-cream-dark" />
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

  return (
    <div className="flex flex-col items-center py-20 text-center">
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
          href="/beans/new"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-brown px-6 py-3 text-base font-medium text-cream transition-colors duration-150 hover:bg-brown-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
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
  const [filters, setFilters] = useState<BeanFilters>({
    sort_by: "consumed_at",
    sort_order: "desc",
  });
  const [page, setPage] = useState(0);
  const [beans, setBeans] = useState<BeanWithTags[]>(initialBeans);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
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
          if (b.varietal) varietals.add(b.varietal.trim());
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

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Title */}
      <header className="pb-7 pt-4 md:pb-8 md:pt-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-brown md:text-4xl">
          {t("title")}
        </h1>
      </header>

      {/* Search */}
      <div className="relative">
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
            "w-full rounded-md border border-border bg-surface py-2.5 pl-10 pr-3 text-sm text-brown",
            "placeholder:text-brown-light/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
            "transition-colors duration-150 disabled:cursor-wait disabled:opacity-70"
          )}
        />
      </div>

      {/* Filter chips + sort */}
      <div className="mt-2.5 flex items-center gap-2">
        <div className="flex flex-1 gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

        <select
          aria-label={t("sortBy")}
          value={sortValue}
          onChange={(e) => handleSortChange(e.target.value)}
          className={cn(
            "min-h-11 shrink-0 cursor-pointer appearance-none rounded-md border border-border bg-surface py-2 pl-3 pr-8 text-xs font-medium text-brown-medium",
            "bg-no-repeat bg-[position:right_8px_center] transition-colors duration-150 hover:border-brown-light",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
            CHEVRON
          )}
        >
          <option value="newest">{t("sortNewest")}</option>
          <option value="score">{t("sortScore")}</option>
          <option value="name">{t("sortName")}</option>
        </select>
      </div>

      {/* Result count / clear */}
      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs text-brown-light">
          {loading ? t("results", { count: 0 }) : t("results", { count: total })}
        </p>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs font-medium text-accent transition-colors duration-150 hover:text-brown"
          >
            {t("clearFilters")}
          </button>
        )}
      </div>

      {/* Timeline */}
      <div className="mt-4 flex flex-col gap-2.5">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : beans.length === 0 ? (
          <EmptyState hasFilters={hasActiveFilters} onClear={clearFilters} />
        ) : (
          beans.map((bean) => <BeanCard key={bean.id} bean={bean} />)
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
