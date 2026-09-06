import { ExploreClient } from "./explore-client";
import { getBeanFilterOptions, getBeans } from "@/lib/actions/beans";
import type { BeanWithTags } from "@/types/database";
import { EXPLORE_PAGE_SIZE, parseExploreQuery } from "@/lib/coffee/explore-navigation";

export default async function ExplorePage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const values = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) query.set(key, Array.isArray(value) ? value[0] : value);
  }
  const initialState = parseExploreQuery(query);
  const [result, filterOptions] = await Promise.all([
    getBeans({
      ...initialState.filters,
      page: 0,
      limit: EXPLORE_PAGE_SIZE,
    }),
    getBeanFilterOptions(),
  ]);

  return (
    <ExploreClient
      initialBeans={(result.beans ?? []) as BeanWithTags[]}
      initialTotal={result.count}
      initialFilterOptions={filterOptions}
      initialLoadError={Boolean(result.error)}
      initialState={initialState}
    />
  );
}
