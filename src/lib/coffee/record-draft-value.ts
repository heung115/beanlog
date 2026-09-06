import { z } from "zod";
import type { BeanFormData } from "@/types/database";

// Drafts deliberately accept unfinished fields and out-of-range numbers. Save
// validation belongs to beanFormSchema; reusing it here would lose those inputs.
const text = z.string();
const number = z.number().finite();
const processMethod = z.enum(["washed", "natural", "honey", "anaerobic", "carbonic", "decaf", "other"]);
const formDraftSchema = z.object({
  name: text, roastery: text, bean_type: z.enum(["single_origin", "blend"]),
  process_method: processMethod, roast_level: z.enum(["light", "medium", "dark"]),
  consumed_at: text, place_type: z.enum(["home", "cafe"]), overall_score: number, note: text,
  origin_country: text.optional(), origin_country_id: number.optional(),
  origin_region: text.optional(), origin_region_id: number.optional(),
  origin_subregions: z.array(text).optional(), origin_lat: number.optional(), origin_lng: number.optional(),
  farm_producer: text.optional(), origin_entity_id: number.optional(), varietal: text.optional(),
  process_detail: text.optional(), altitude_m: number.optional(), harvest_year: number.optional(),
  roast_date: text.optional(), cafe_name: text.optional(), cafe_location: text.optional(), menu_name: text.optional(),
  score_aroma: number.optional(), score_acidity: number.optional(), score_body: number.optional(),
  score_sweetness: number.optional(), score_aftertaste: number.optional(), score_balance: number.optional(),
  purchase_source: z.enum(["online", "roastery", "cafe", "other"]).optional(),
  price: number.optional(), weight_g: number.optional(), purchased_at: text.optional(),
  tags: z.array(z.object({ tag: text, category: text })).optional(),
  blend_components: z.array(z.object({
    origin_country: text, origin_country_id: number.optional(),
    origin_region: text.optional(), origin_region_id: number.optional(), origin_subregions: z.array(text).optional(),
    farm_producer: text.optional(), origin_entity_id: number.optional(), varietal: text.optional(),
    process_method: processMethod.optional(), process_detail: text.optional(), percentage: number,
    sort_order: number.optional(),
  })).optional(),
});

export type BeanDraftValue = { form: BeanFormData; tagDraft: string; showDetails: boolean };
const beanDraftValueSchema = z.object({ form: formDraftSchema, tagDraft: text, showDetails: z.boolean() });

export function isGuestFormDraft(value: unknown): value is BeanFormData {
  return formDraftSchema.safeParse(value).success;
}

export function isBeanDraftValue(value: unknown): value is BeanDraftValue {
  return beanDraftValueSchema.safeParse(value).success;
}
