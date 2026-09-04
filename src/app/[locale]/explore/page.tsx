import { ExploreClient } from "./explore-client";
import { getBeanFilterOptions, getBeans } from "@/lib/actions/beans";
import type { BeanWithTags } from "@/types/database";

const PAGE_SIZE = 20;

export default async function ExplorePage() {
  const [result, filterOptions] = await Promise.all([
    getBeans({
      sort_by: "consumed_at",
      sort_order: "desc",
      page: 0,
      limit: PAGE_SIZE,
    }),
    getBeanFilterOptions(),
  ]);

  return (
    <ExploreClient
      initialBeans={(result.beans ?? []) as BeanWithTags[]}
      initialTotal={result.count}
      initialFilterOptions={filterOptions}
      initialLoadError={Boolean(result.error)}
    />
  );
}
