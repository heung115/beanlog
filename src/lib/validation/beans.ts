import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalText = (max: number) => z.string().trim().max(max).optional();

export const beanIdSchema = z.string().uuid();

const processMethodSchema = z.enum([
  "washed",
  "natural",
  "honey",
  "anaerobic",
  "carbonic",
  "decaf",
  "other",
]);

const tastingTagSchema = z.object({
  tag: z.string().trim().min(1).max(50),
  category: z.enum([
    "fruity",
    "floral",
    "sweet",
    "nutty",
    "cocoa",
    "spice",
    "roasted",
    "sour",
    "green",
    "other",
  ]),
});

const blendComponentSchema = z.object({
  origin_country: z.string().trim().min(1).max(100),
  origin_region: optionalText(100),
  origin_subregions: z.array(z.string().trim().min(1).max(100)).max(10).optional(),
  farm_producer: optionalText(200),
  varietal: optionalText(100),
  process_method: processMethodSchema.optional(),
  process_detail: optionalText(200),
  percentage: z.number().finite().positive().max(100),
  sort_order: z.number().int().min(0).max(100).optional(),
});

export const beanFormSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    roastery: z.string().trim().min(1).max(200),
    bean_type: z.enum(["single_origin", "blend"]),
    origin_country: optionalText(100),
    origin_country_id: z.number().int().positive().optional(),
    origin_region: optionalText(100),
    origin_region_id: z.number().int().positive().optional(),
    origin_subregions: z.array(z.string().trim().min(1).max(100)).max(10).optional(),
    origin_lat: z.number().finite().min(-90).max(90).optional(),
    origin_lng: z.number().finite().min(-180).max(180).optional(),
    farm_producer: optionalText(200),
    origin_entity_id: z.number().int().positive().optional(),
    varietal: optionalText(100),
    process_method: processMethodSchema,
    process_detail: optionalText(200),
    altitude_m: z.number().int().min(0).max(5000).optional(),
    harvest_year: z.number().int().min(1900).max(2100).optional(),
    roast_level: z.enum(["light", "medium", "dark"]),
    roast_date: dateString.optional(),
    consumed_at: dateString,
    place_type: z.enum(["cafe", "home"]),
    cafe_name: optionalText(200),
    cafe_location: optionalText(200),
    menu_name: optionalText(200),
    overall_score: z.number().finite().min(1).max(10),
    note: z.string().trim().min(1).max(2000),
    score_aroma: z.number().int().min(1).max(5).optional(),
    score_acidity: z.number().int().min(1).max(5).optional(),
    score_body: z.number().int().min(1).max(5).optional(),
    score_sweetness: z.number().int().min(1).max(5).optional(),
    score_aftertaste: z.number().int().min(1).max(5).optional(),
    score_balance: z.number().int().min(1).max(5).optional(),
    purchase_source: z.enum(["online", "roastery", "cafe", "other"]).optional(),
    price: z.number().int().min(0).max(10_000_000).optional(),
    weight_g: z.number().int().positive().max(100_000).optional(),
    purchased_at: dateString.optional(),
    tags: z.array(tastingTagSchema).max(30).default([]),
    blend_components: z.array(blendComponentSchema).max(20).default([]),
  })
  .superRefine((bean, ctx) => {
    if (bean.bean_type === "single_origin") {
      if (!bean.origin_country?.trim()) {
        ctx.addIssue({ code: "custom", path: ["origin_country"], message: "Origin is required" });
      }
      if (bean.blend_components.length > 0) {
        ctx.addIssue({ code: "custom", path: ["blend_components"], message: "Single origins cannot contain blend components" });
      }
      return;
    }

    if (bean.blend_components.length === 0) {
      ctx.addIssue({ code: "custom", path: ["blend_components"], message: "Blend components are required" });
      return;
    }

    const total = bean.blend_components.reduce((sum, component) => sum + component.percentage, 0);
    if (Math.abs(total - 100) > 0.01) {
      ctx.addIssue({ code: "custom", path: ["blend_components"], message: "Blend percentages must total 100" });
    }
  });

export const beanFiltersSchema = z
  .object({
    origin_country: optionalText(100),
    process_method: processMethodSchema.optional(),
    varietal: optionalText(100),
    roastery: optionalText(200),
    bean_type: z.enum(["single_origin", "blend"]).optional(),
    roast_level: z.enum(["light", "medium", "dark"]).optional(),
    score_min: z.number().finite().min(1).max(10).optional(),
    score_max: z.number().finite().min(1).max(10).optional(),
    tag: optionalText(50),
    date_from: dateString.optional(),
    date_to: dateString.optional(),
    search: optionalText(100),
    sort_by: z.enum(["consumed_at", "overall_score", "name"]).default("consumed_at"),
    sort_order: z.enum(["asc", "desc"]).default("desc"),
    page: z.number().int().min(0).max(10_000).default(0),
    limit: z.number().int().min(1).max(100).default(20),
  })
  .refine(
    (filters) =>
      filters.score_min === undefined ||
      filters.score_max === undefined ||
      filters.score_min <= filters.score_max,
    { message: "Invalid score range" }
  );
