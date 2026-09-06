import type { BeanFilters } from "../../types/database";
import { canonicalVarietal, trimCoffeeWhitespace } from "./canonical-varietals.ts";

export const EXPLORE_PAGE_SIZE = 20;

/** Re-read the visible prefix so inserts/deletes cannot shift an old cached page. */
export async function loadExploreWindow<T extends { id: string }>(
  page: number,
  read: (page: number, limit: number) => Promise<{ beans: T[]; count: number; error?: string }>,
  cancelled: () => boolean = () => false
): Promise<{ beans: T[]; total: number }> {
  const wanted = (page + 1) * EXPLORE_PAGE_SIZE;
  const limit = Math.min(100, wanted);
  const found = new Map<string, T>();
  let total = 0;
  for (let nextPage = 0; ; nextPage += 1) {
    const result = await read(nextPage, limit);
    if (cancelled()) return { beans: [], total: 0 };
    if (result.error) throw new Error("Unable to load records");
    total = result.count;
    for (const bean of result.beans) found.set(bean.id, bean);
    if (result.beans.length === 0 || found.size >= Math.min(wanted, total)) break;
    // A continually changing collection must not lead to an unbounded request loop.
    if ((nextPage + 1) * limit >= total) break;
  }
  return { beans: [...found.values()].slice(0, wanted), total };
}

export interface ExploreNavigationState {
  filters: BeanFilters;
  page: number;
}

const textFilters = ["origin_country", "varietal", "roastery", "search"] as const;
const choices = {
  process_method: ["washed", "natural", "honey", "anaerobic", "carbonic", "decaf", "other"],
  roast_level: ["light", "medium", "dark"],
  bean_type: ["single_origin", "blend"],
} as const;

/** Only supported list controls survive a shared or restored URL. */
export function parseExploreQuery(query: Pick<URLSearchParams, "get">): ExploreNavigationState {
  const filters: BeanFilters = { sort_by: "consumed_at", sort_order: "desc" };
  for (const key of textFilters) {
    const value = trimCoffeeWhitespace(query.get(key) ?? "").slice(0, key === "roastery" ? 200 : 100);
    if (value) filters[key] = key === "varietal" ? canonicalVarietal(value) : value;
  }
  for (const key of Object.keys(choices) as (keyof typeof choices)[]) {
    const value = query.get(key);
    if (value && (choices[key] as readonly string[]).includes(value)) {
      Object.assign(filters, { [key]: value });
    }
  }
  if (query.get("sort") === "score") filters.sort_by = "overall_score";
  if (query.get("sort") === "name") {
    filters.sort_by = "name";
    filters.sort_order = "asc";
  }
  const requestedPage = Number(query.get("page") ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage - 1, 10_000)
    : 0;
  return { filters, page };
}

export function exploreQuery({ filters, page }: ExploreNavigationState): string {
  const query = new URLSearchParams();
  for (const key of [...textFilters, ...Object.keys(choices) as (keyof typeof choices)[]]) {
    const value = filters[key];
    if (value) query.set(key, String(value));
  }
  if (filters.sort_by === "overall_score") query.set("sort", "score");
  if (filters.sort_by === "name") query.set("sort", "name");
  if (page > 0) query.set("page", String(page + 1));
  return query.toString();
}

export function exploreHref(locale: string, state: ExploreNavigationState): string {
  const query = exploreQuery(state);
  return `/${locale === "en" ? "en" : "ko"}/explore${query ? `?${query}` : ""}`;
}

/** A return destination can only be this locale's journal, never another site. */
export function resolveExploreReturnPath(value: unknown, locale: string): string {
  const fallback = `/${locale === "en" ? "en" : "ko"}/explore`;
  if (typeof value !== "string" || !value.startsWith(`${fallback}?`) && value !== fallback && !value.startsWith(`${fallback}#`)) return fallback;
  if (value.includes("\\")) return fallback;
  const url = new URL(value, "http://localhost");
  if (url.pathname !== fallback) return fallback;
  const hash = /^#bean-[0-9a-f-]{36}$/i.test(url.hash) ? url.hash : "";
  return `${exploreHref(locale, parseExploreQuery(url.searchParams))}${hash}`;
}

export function beanDetailHref(id: string, locale: string, returnTo: string, edit = false): string {
  const target = `/${locale === "en" ? "en" : "ko"}/beans/${encodeURIComponent(id)}${edit ? "/edit" : ""}`;
  const safeReturn = resolveExploreReturnPath(returnTo, locale);
  return safeReturn === `/${locale}/explore`
    ? target
    : `${target}?${new URLSearchParams({ returnTo: safeReturn })}`;
}
