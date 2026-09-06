export type CatalogKind = "country" | "region" | "entity";

export interface AdminOverview {
  users: number;
  beans: number;
  new_users_30d: number;
  new_beans_30d: number;
  active_users_30d: number;
  countries: number;
  regions: number;
  entities: number;
}

export interface CatalogItem {
  id: number;
  kind: CatalogKind;
  name: string;
  name_ko: string | null;
  country: string | null;
}

export interface CatalogPage {
  items: CatalogItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminAuditItem {
  id: number;
  kind: CatalogKind;
  item_id: number;
  item_name: string;
  old_name_ko: string | null;
  new_name_ko: string | null;
  reason: string;
  created_at: string;
}
