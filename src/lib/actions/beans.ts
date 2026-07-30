"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { BeanFormData } from "@/types/database";
import {
  beanFiltersSchema,
  beanFormSchema,
  beanIdSchema,
} from "@/lib/validation/beans";

const originIdSchema = z.number().int().positive();
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

type OriginSelection = {
  origin_country: string | null;
  origin_country_id: number | null;
  origin_region: string | null;
  origin_region_id: number | null;
  origin_subregions: string[];
  origin_entity_id: number | null;
  farm_producer: string | null;
  origin_lat: number | null;
  origin_lng: number | null;
};

function nullableText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

/**
 * Accept direct entry, but never trust an ID supplied by the browser. A selected
 * region/entity must belong to the selected country before it is persisted.
 */
async function resolveOriginSelection(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: BeanFormData
): Promise<{ selection: OriginSelection } | { error: string }> {
  const emptySelection: OriginSelection = {
    origin_country: null,
    origin_country_id: null,
    origin_region: null,
    origin_region_id: null,
    origin_subregions: [],
    origin_entity_id: null,
    farm_producer: null,
    origin_lat: null,
    origin_lng: null,
  };

  if (formData.bean_type === "blend") {
    return { selection: emptySelection };
  }

  const countryId = originIdSchema.safeParse(formData.origin_country_id);
  if (!countryId.success) {
    return {
      selection: {
        ...emptySelection,
        origin_country: nullableText(formData.origin_country),
        origin_region: nullableText(formData.origin_region),
        origin_subregions: formData.origin_subregions ?? [],
        farm_producer: nullableText(formData.farm_producer),
        origin_lat: formData.origin_lat ?? null,
        origin_lng: formData.origin_lng ?? null,
      },
    };
  }

  const { data: country, error: countryError } = await supabase
    .from("origin_countries")
    .select("id, name_en")
    .eq("id", countryId.data)
    .single();
  if (countryError || !country) return { error: "Invalid origin country" };

  const selection: OriginSelection = {
    ...emptySelection,
    origin_country: country.name_en,
    origin_country_id: country.id,
    origin_region: nullableText(formData.origin_region),
    origin_subregions: formData.origin_subregions ?? [],
    farm_producer: nullableText(formData.farm_producer),
    origin_lat: formData.origin_lat ?? null,
    origin_lng: formData.origin_lng ?? null,
  };

  const regionId = originIdSchema.safeParse(formData.origin_region_id);
  if (regionId.success) {
    const { data: region, error: regionError } = await supabase
      .from("origin_regions")
      .select("id, country_id, display_name, canonical_region_id")
      .eq("id", regionId.data)
      .eq("country_id", country.id)
      .single();
    if (
      regionError ||
      !region ||
      region.canonical_region_id !== region.id ||
      !region.display_name
    ) {
      return { error: "Invalid origin region" };
    }

    selection.origin_region_id = region.id;
    selection.origin_region = region.display_name;
  }

  const entityId = originIdSchema.safeParse(formData.origin_entity_id);
  if (!entityId.success) return { selection };
  if (!selection.origin_region_id) return { error: "Select an origin region first" };

  const { data: entity, error: entityError } = await supabase
    .from("origin_entities")
    .select("id, country_id, region_id, name")
    .eq("id", entityId.data)
    .eq("country_id", country.id)
    .single();
  if (entityError || !entity) return { error: "Invalid farm or producer" };

  const { data: entityRegion, error: entityRegionError } = await supabase
    .from("origin_regions")
    .select("canonical_region_id")
    .eq("id", entity.region_id)
    .single();
  if (
    entityRegionError ||
    !entityRegion ||
    entityRegion.canonical_region_id !== selection.origin_region_id
  ) {
    return { error: "Invalid farm or producer" };
  }

  selection.origin_entity_id = entity.id;
  selection.farm_producer = entity.name;
  return { selection };
}

export async function createBean(formData: BeanFormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const parsed = beanFormSchema.safeParse(formData);
  if (!parsed.success) return { error: "Invalid bean data" };

  const { tags, blend_components, ...beanData } = parsed.data;
  const origin = await resolveOriginSelection(supabase, parsed.data);
  if ("error" in origin) return { error: origin.error };

  const components = blend_components.map((component, index) => ({
    ...component,
    sort_order: index,
  }));
  const { data: beanId, error } = await supabase.rpc("create_bean_record", {
    p_bean: { ...beanData, ...origin.selection },
    p_tags: tags,
    p_components: components,
  });

  if (error) return { error: "Unable to save bean" };

  revalidatePath("/explore");
  revalidatePath("/stats");
  return { success: true, id: beanId };
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

  const { tags, blend_components, ...beanData } = parsed.data;
  const origin = await resolveOriginSelection(supabase, parsed.data);
  if ("error" in origin) return { error: origin.error };

  const components = blend_components.map((component, index) => ({
    ...component,
    sort_order: index,
  }));
  const { error } = await supabase.rpc("update_bean_record", {
    p_id: parsedId.data,
    p_bean: { ...beanData, ...origin.selection },
    p_tags: tags,
    p_components: components,
  });

  if (error) return { error: "Unable to update bean" };

  revalidatePath("/explore");
  revalidatePath(`/beans/${id}`);
  revalidatePath("/stats");
  return { success: true };
}

export async function deleteBean(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const parsedId = beanIdSchema.safeParse(id);
  if (!parsedId.success) return { error: "Invalid bean id" };

  await supabase.from("tasting_tags").delete().eq("bean_id", parsedId.data).eq("user_id", user.id);
  await supabase.from("blend_components").delete().eq("bean_id", parsedId.data).eq("user_id", user.id);

  const { error } = await supabase
    .from("beans")
    .delete()
    .eq("id", parsedId.data)
    .eq("user_id", user.id);

  if (error) return { error: "Unable to delete bean" };

  revalidatePath("/explore");
  revalidatePath("/stats");
  return { success: true };
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
  const safeFilters = parsed.data;
  const { limit, page } = safeFilters;
  const from = page * limit;
  const to = from + limit - 1;

  const relation = safeFilters.tag
    ? "*, tasting_tags!inner(*), blend_components(*)"
    : "*, tasting_tags(*), blend_components(*)";
  let query = supabase
    .from("beans")
    .select(relation, { count: "exact" })
    .eq("user_id", user.id);

  if (safeFilters.origin_country) {
    query = query.eq("origin_country", safeFilters.origin_country);
  }
  if (safeFilters.process_method) {
    query = query.eq("process_method", safeFilters.process_method);
  }
  if (safeFilters.varietal) {
    query = query.ilike("varietal", `%${safeFilters.varietal}%`);
  }
  if (safeFilters.roastery) {
    query = query.ilike("roastery", `%${safeFilters.roastery}%`);
  }
  if (safeFilters.bean_type) {
    query = query.eq("bean_type", safeFilters.bean_type);
  }
  if (safeFilters.roast_level) {
    query = query.eq("roast_level", safeFilters.roast_level);
  }
  if (safeFilters.score_min !== undefined) {
    query = query.gte("overall_score", safeFilters.score_min);
  }
  if (safeFilters.score_max !== undefined) {
    query = query.lte("overall_score", safeFilters.score_max);
  }
  if (safeFilters.date_from) {
    query = query.gte("consumed_at", safeFilters.date_from);
  }
  if (safeFilters.date_to) {
    query = query.lte("consumed_at", safeFilters.date_to);
  }
  if (safeFilters.search) {
    const value = safeFilters.search.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    query = query.or(
      `name.ilike."*${value}*",roastery.ilike."*${value}*",note.ilike."*${value}*"`
    );
  }
  if (safeFilters.tag) query = query.eq("tasting_tags.tag", safeFilters.tag);

  const sortBy = safeFilters.sort_by;
  const sortOrder = safeFilters.sort_order === "asc";
  query = query.order(sortBy, { ascending: sortOrder });

  const { data, count, error } = await query.range(from, to);

  if (error) return { beans: [], count: 0 };

  return { beans: data || [], count: count || 0 };
}

export async function getBeanFilterOptions() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { origins: [], roasteries: [], varietals: [] };

  const { data, error } = await supabase
    .from("beans")
    .select("origin_country, roastery, varietal")
    .eq("user_id", user.id)
    .limit(5000);
  if (error) return { origins: [], roasteries: [], varietals: [] };

  const origins = new Set<string>();
  const roasteries = new Set<string>();
  const varietals = new Set<string>();
  for (const bean of data ?? []) {
    if (bean.origin_country) origins.add(bean.origin_country);
    if (bean.roastery?.trim()) roasteries.add(bean.roastery.trim());
    if (bean.varietal?.trim()) varietals.add(bean.varietal.trim());
  }
  return {
    origins: [...origins].sort(),
    roasteries: [...roasteries].sort(),
    varietals: [...varietals].sort(),
  };
}

export async function getBeanById(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const parsedId = beanIdSchema.safeParse(id);
  if (!parsedId.success) return null;

  const { data } = await supabase
    .from("beans")
    .select("*, tasting_tags(*), blend_components(*)")
    .eq("id", parsedId.data)
    .eq("user_id", user.id)
    .single();

  return data;
}

export async function getBeanStats() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: beans } = await supabase
    .from("beans")
    .select("origin_country, process_method, varietal, overall_score, consumed_at, name, roastery")
    .eq("user_id", user.id);

  if (!beans || beans.length === 0) return null;

  const total = beans.length;
  const avgScore = beans.reduce((sum, b) => sum + b.overall_score, 0) / total;
  const best = beans.reduce((max, b) => (b.overall_score > max.overall_score ? b : max), beans[0]);

  const byOrigin: Record<string, number> = {};
  const byProcess: Record<string, number> = {};
  const byVarietal: Record<string, number> = {};
  const byMonth: Record<string, number> = {};
  const scoreDist: Record<string, number> = {};

  beans.forEach((b) => {
    if (b.origin_country) {
      byOrigin[b.origin_country] = (byOrigin[b.origin_country] || 0) + 1;
    }
    byProcess[b.process_method] = (byProcess[b.process_method] || 0) + 1;
    if (b.varietal) byVarietal[b.varietal] = (byVarietal[b.varietal] || 0) + 1;

    const month = new Date(b.consumed_at).toISOString().slice(0, 7);
    byMonth[month] = (byMonth[month] || 0) + 1;

    const bucket = Math.floor(b.overall_score);
    const key = `${bucket}`;
    scoreDist[key] = (scoreDist[key] || 0) + 1;
  });

  const topOrigin = Object.entries(byOrigin).sort((a, b) => b[1] - a[1])[0];
  const topProcess = Object.entries(byProcess).sort((a, b) => b[1] - a[1])[0];

  return {
    total,
    avgScore: Math.round(avgScore * 10) / 10,
    best: { name: best.name, roastery: best.roastery, score: best.overall_score },
    byOrigin: Object.entries(byOrigin).sort((a, b) => b[1] - a[1]),
    byProcess: Object.entries(byProcess).sort((a, b) => b[1] - a[1]),
    byVarietal: Object.entries(byVarietal).sort((a, b) => b[1] - a[1]),
    byMonth: Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])),
    scoreDist: Object.entries(scoreDist).sort((a, b) => Number(a[0]) - Number(b[0])),
    topOrigin,
    topProcess,
  };
}

export async function exportData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: beans } = await supabase
    .from("beans")
    .select("*, tasting_tags(*), blend_components(*)")
    .eq("user_id", user.id)
    .order("consumed_at", { ascending: false });

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return {
    exported_at: new Date().toISOString(),
    profile,
    beans: beans || [],
  };
}

export async function updateProfile(displayName: string, locale: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const parsed = profileUpdateSchema.safeParse({ displayName, locale });
  if (!parsed.success) return { error: "Invalid profile data" };

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName, locale: parsed.data.locale })
    .eq("id", user.id);

  if (error) return { error: "Unable to update profile" };
  return { success: true };
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
