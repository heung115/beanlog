export type BeanType = "single_origin" | "blend";
export type ProcessMethod = "washed" | "natural" | "honey" | "anaerobic" | "carbonic" | "decaf" | "other";
export type RoastLevel = "light" | "medium" | "dark";
export type PlaceType = "cafe" | "home";
export type PurchaseSource = "online" | "roastery" | "cafe" | "other";

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  locale: string;
  created_at: string;
}

export interface BlendComponent {
  id?: string;
  bean_id?: string;
  user_id?: string;
  origin_country: string;
  origin_country_id?: number;
  origin_region?: string;
  origin_region_id?: number;
  origin_subregions?: string[];
  farm_producer?: string;
  origin_entity_id?: number;
  varietal?: string;
  process_method?: ProcessMethod;
  process_detail?: string;
  percentage: number;
  sort_order?: number;
}

export interface Bean {
  id: string;
  user_id: string;
  name: string;
  roastery: string;
  bean_type: BeanType;
  origin_country: string | null;
  origin_country_id: number | null;
  origin_region: string | null;
  origin_region_id: number | null;
  origin_subregions: string[];
  origin_lat: number | null;
  origin_lng: number | null;
  farm_producer: string | null;
  origin_entity_id: number | null;
  varietal: string | null;
  process_method: ProcessMethod;
  process_detail: string | null;
  altitude_m: number | null;
  harvest_year: number | null;
  roast_level: RoastLevel;
  roast_date: string | null;
  consumed_at: string;
  place_type: PlaceType;
  cafe_name: string | null;
  cafe_location: string | null;
  menu_name: string | null;
  overall_score: number;
  note: string;
  score_aroma: number | null;
  score_acidity: number | null;
  score_body: number | null;
  score_sweetness: number | null;
  score_aftertaste: number | null;
  score_balance: number | null;
  purchase_source: PurchaseSource | null;
  price: number | null;
  weight_g: number | null;
  purchased_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TastingTag {
  id: string;
  bean_id: string;
  user_id: string;
  tag: string;
  category: string;
}

export interface OriginPreset {
  id: number;
  country: string;
  region: string;
  lat: number;
  lng: number;
  altitude_range: string;
  signature: string;
  key_varietals: string[];
  name_ko: string;
  name_en: string;
}

export interface OriginCountryOption {
  id: number;
  name_en: string;
  name_ko: string | null;
}

export interface OriginRegionOption {
  id: number;
  name: string;
  name_ko: string | null;
}

export interface OriginEntityOption {
  id: number;
  name: string;
  name_ko: string | null;
  entity_type: string | null;
  farm_name?: string | null;
  producer_name?: string | null;
  mill_name?: string | null;
}

export interface BeanWithTags extends Bean {
  tasting_tags: TastingTag[];
  blend_components: BlendComponent[];
}

export interface BeanFormData {
  name: string;
  roastery: string;
  bean_type: BeanType;
  origin_country?: string;
  origin_country_id?: number;
  origin_region?: string;
  origin_region_id?: number;
  origin_subregions?: string[];
  origin_lat?: number;
  origin_lng?: number;
  farm_producer?: string;
  origin_entity_id?: number;
  varietal?: string;
  process_method: ProcessMethod;
  process_detail?: string;
  altitude_m?: number;
  harvest_year?: number;
  roast_level: RoastLevel;
  roast_date?: string;
  consumed_at: string;
  place_type: PlaceType;
  cafe_name?: string;
  cafe_location?: string;
  menu_name?: string;
  overall_score: number;
  note: string;
  score_aroma?: number;
  score_acidity?: number;
  score_body?: number;
  score_sweetness?: number;
  score_aftertaste?: number;
  score_balance?: number;
  purchase_source?: PurchaseSource;
  price?: number;
  weight_g?: number;
  purchased_at?: string;
  tags?: { tag: string; category: string }[];
  blend_components?: BlendComponent[];
}

export interface BeanFilters {
  origin_country?: string;
  process_method?: ProcessMethod;
  varietal?: string;
  roastery?: string;
  bean_type?: BeanType;
  roast_level?: RoastLevel;
  score_min?: number;
  score_max?: number;
  tag?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  sort_by?: "consumed_at" | "overall_score" | "name";
  sort_order?: "asc" | "desc";
}
