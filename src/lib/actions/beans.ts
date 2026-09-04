"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { BeanFormData, BeanWithTags } from "@/types/database";
import type { OriginMapEntry } from "@/types/stats";
import {
  beanFiltersSchema,
  beanFormSchema,
  beanIdSchema,
} from "@/lib/validation/beans";
import { apiFetch } from "@/lib/api/client";

const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(50),
  locale: z.enum(["ko", "en"]),
});

const nativeBeanSchema = z.object({
  name: z.string().trim().min(1).max(200),
  roastery: z.string().trim().min(1).max(200),
  bean_type: z.enum(["single_origin", "blend"]),
  origin_country: z.string().trim().min(1).max(100),
  origin_region: z.string().trim().max(100).optional(),
  farm_producer: z.string().trim().max(200).optional(),
  varietal: z.string().trim().max(100).optional(),
  process_method: z.enum(["washed", "natural", "honey", "anaerobic", "carbonic", "decaf", "other"]),
  process_detail: z.string().trim().max(200).optional(),
  roast_level: z.enum(["light", "medium", "dark"]),
  consumed_at: z.string().date(),
  place_type: z.enum(["cafe", "home"]),
  cafe_name: z.string().trim().max(200).optional(),
  overall_score: z.coerce.number().min(1).max(10),
  note: z.string().trim().min(1).max(2000),
  locale: z.enum(["ko", "en"]).default("ko"),
});

// Go API response shapes (snake_case, matching server/models).
type GoCountEntry = { key: string; count: number };
type GoOriginMapRegion = {
  region_id: number | null;
  name: string;
  name_ko: string | null;
  count: number;
};
type GoOriginMapEntry = {
  country_id: number | null;
  name_en: string;
  name_ko: string | null;
  mapped: boolean;
  count: number;
  regions: GoOriginMapRegion[] | null;
};
type GoStats = {
  total: number;
  avg_score: number;
  best: { name: string; roastery: string; score: number } | null;
  top_origin: GoCountEntry | null;
  top_process: GoCountEntry | null;
  by_origin: GoCountEntry[] | null;
  by_process: GoCountEntry[] | null;
  by_varietal: GoCountEntry[] | null;
  by_month: GoCountEntry[] | null;
  score_dist: GoCountEntry[] | null;
  origin_map?: GoOriginMapEntry[] | null;
};

const toTuples = (entries: GoCountEntry[] | null): [string, number][] =>
  (entries ?? []).map((e) => [e.key, e.count]);

const toOriginMapEntries = (entries: GoOriginMapEntry[] | null | undefined): OriginMapEntry[] =>
  (entries ?? []).map((entry) => ({
    countryId: entry.country_id,
    nameEn: entry.name_en,
    nameKo: entry.name_ko,
    mapped: entry.mapped,
    count: entry.count,
    regions: (entry.regions ?? []).map((region) => ({
      regionId: region.region_id,
      name: region.name,
      nameKo: region.name_ko,
      count: region.count,
    })),
  }));

export async function createBean(formData: BeanFormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const parsed = beanFormSchema.safeParse(formData);
  if (!parsed.success) return { error: "Invalid bean data" };

  try {
    const result = await apiFetch<{ success: boolean; id: string }>("/api/beans", {
      method: "POST",
      body: parsed.data,
    });
    revalidatePath("/explore");
    revalidatePath("/stats");
    return { success: true, id: result.id };
  } catch {
    return { error: "Unable to save bean" };
  }
}

/**
 * Progressive-enhancement path for the record form. The client normally uses
 * createBean directly, but this POST action still saves safely if JavaScript
 * has not attached yet or fails to load.
 */
export async function createBeanFromForm(formData: FormData) {
  const parsed = nativeBeanSchema.safeParse({
    name: formData.get("name"),
    roastery: formData.get("roastery"),
    bean_type: formData.get("bean_type"),
    origin_country: formData.get("origin_country"),
    origin_region: formData.get("origin_region") || undefined,
    farm_producer: formData.get("farm_producer") || undefined,
    varietal: formData.get("varietal") || undefined,
    process_method: formData.get("process_method"),
    process_detail: formData.get("process_detail") || undefined,
    roast_level: formData.get("roast_level"),
    consumed_at: formData.get("consumed_at"),
    place_type: formData.get("place_type"),
    cafe_name: formData.get("cafe_name") || undefined,
    overall_score: formData.get("overall_score"),
    note: formData.get("note"),
    locale: formData.get("locale") || "ko",
  });

  if (!parsed.success) {
    redirect(`/${formData.get("locale") === "en" ? "en" : "ko"}/beans/new?error=invalid`);
  }

  const { locale, ...bean } = parsed.data;
  const result = await createBean({
    ...bean,
    origin_region: bean.origin_region || undefined,
    farm_producer: bean.farm_producer || undefined,
    varietal: bean.varietal || undefined,
    process_detail: bean.process_detail || undefined,
    cafe_name: bean.cafe_name || undefined,
    tags: [],
    blend_components: [],
  });

  if (result?.error) {
    redirect(`/${locale}/beans/new?error=save`);
  }

  const continueAdding = formData.get("continue") === "1";
  const roastery = encodeURIComponent(parsed.data.roastery.slice(0, 200));
  redirect(
    continueAdding
      ? `/${locale}/beans/new?saved=1&roastery=${roastery}`
      : `/${locale}/explore`
  );
}

export async function updateBean(id: string, formData: BeanFormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const parsedId = beanIdSchema.safeParse(id);
  const parsed = beanFormSchema.safeParse(formData);
  if (!parsedId.success || !parsed.success) return { error: "Invalid bean data" };

  try {
    await apiFetch<{ success: boolean }>(`/api/beans/${parsedId.data}`, {
      method: "PUT",
      body: parsed.data,
    });
    revalidatePath("/explore");
    revalidatePath(`/beans/${id}`);
    revalidatePath("/stats");
    return { success: true };
  } catch {
    return { error: "Unable to update bean" };
  }
}

export async function deleteBean(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const parsedId = beanIdSchema.safeParse(id);
  if (!parsedId.success) return { error: "Invalid bean id" };

  try {
    await apiFetch<{ success: boolean }>(`/api/beans/${parsedId.data}`, {
      method: "DELETE",
    });
    revalidatePath("/explore");
    revalidatePath("/stats");
    return { success: true };
  } catch {
    return { error: "Unable to delete bean" };
  }
}

export async function getBeans(filters?: {
  origin_country?: string;
  process_method?: string;
  varietal?: string;
  roastery?: string;
  bean_type?: string;
  roast_level?: string;
  score_min?: number;
  score_max?: number;
  tag?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  sort_by?: string;
  sort_order?: string;
  page?: number;
  limit?: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { beans: [], count: 0 };

  const parsed = beanFiltersSchema.safeParse(filters ?? {});
  if (!parsed.success) return { beans: [], count: 0, error: "Invalid filters" };
  const f = parsed.data;

  try {
    const result = await apiFetch<{ beans: BeanWithTags[]; count: number }>("/api/beans", {
      query: {
        origin_country: f.origin_country,
        process_method: f.process_method,
        varietal: f.varietal,
        roastery: f.roastery,
        bean_type: f.bean_type,
        roast_level: f.roast_level,
        score_min: f.score_min,
        score_max: f.score_max,
        tag: f.tag,
        date_from: f.date_from,
        date_to: f.date_to,
        search: f.search,
        sort_by: f.sort_by,
        sort_order: f.sort_order,
        page: f.page,
        limit: f.limit,
      },
    });
    return { beans: result.beans, count: result.count };
  } catch {
    return { beans: [], count: 0, error: "Unable to load beans" };
  }
}

export async function getBeanFilterOptions() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { origins: [], roasteries: [], varietals: [] };

  try {
    return await apiFetch<{ origins: string[]; roasteries: string[]; varietals: string[] }>(
      "/api/beans/filter-options"
    );
  } catch {
    return { origins: [], roasteries: [], varietals: [] };
  }
}

export async function getBeanById(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const parsedId = beanIdSchema.safeParse(id);
  if (!parsedId.success) return null;

  try {
    return await apiFetch<BeanWithTags>(`/api/beans/${parsedId.data}`);
  } catch {
    return null;
  }
}

export async function getBeanStats() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  let stats: GoStats | null;
  try {
    stats = await apiFetch<GoStats | null>("/api/stats");
  } catch {
    return null;
  }
  if (!stats || stats.total === 0) return null;

  return {
    total: stats.total,
    avgScore: stats.avg_score,
    best: stats.best
      ? { name: stats.best.name, roastery: stats.best.roastery, score: stats.best.score }
      : { name: "", roastery: "", score: 0 },
    byOrigin: toTuples(stats.by_origin),
    byProcess: toTuples(stats.by_process),
    byVarietal: toTuples(stats.by_varietal),
    byMonth: toTuples(stats.by_month),
    scoreDist: toTuples(stats.score_dist),
    topOrigin: stats.top_origin
      ? ([stats.top_origin.key, stats.top_origin.count] as [string, number])
      : undefined,
    topProcess: stats.top_process
      ? ([stats.top_process.key, stats.top_process.count] as [string, number])
      : undefined,
    originMap: toOriginMapEntries(stats.origin_map),
  };
}

export async function exportData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  try {
    return await apiFetch<{
      exported_at: string;
      profile: unknown;
      beans: BeanWithTags[];
    }>("/api/export");
  } catch {
    return null;
  }
}

export async function updateProfile(displayName: string, locale: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const parsed = profileUpdateSchema.safeParse({ displayName, locale });
  if (!parsed.success) return { error: "Invalid profile data" };

  try {
    await apiFetch<{ success: boolean }>("/api/profile", {
      method: "PUT",
      body: { display_name: parsed.data.displayName, locale: parsed.data.locale },
    });
    return { success: true };
  } catch {
    return { error: "Unable to update profile" };
  }
}

export async function deleteAccount() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase.rpc("delete_current_account");
  if (error) return { error: "Unable to delete account" };
  await supabase.auth.signOut();

  redirect("/login");
}
