"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api/client";

export async function getAdminAccess(): Promise<boolean> {
  try {
    const result = await apiFetch<{ is_admin: boolean }>("/api/admin/access");
    return result.is_admin === true;
  } catch {
    return false;
  }
}

const labelUpdate = z.object({
  kind: z.enum(["country", "region", "entity"]),
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  name_ko: z.string().trim().max(120),
  expected_name_ko: z.string().max(300).nullable(),
  reason: z.string().trim().min(3).max(300),
});

export async function updateCatalogLabel(input: unknown): Promise<
  { ok: true } | { ok: false; error: "invalid" | "conflict" | "forbidden" | "missing" | "saveError" }
> {
  const parsed = labelUpdate.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { kind, id, ...body } = parsed.data;
  try {
    // The API and the mutation function both check current database membership.
    await apiFetch(`/api/admin/catalog/${kind}/${id}`, { method: "PUT", body });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401 || error.status === 403) return { ok: false, error: "forbidden" };
      if (error.status === 409) return { ok: false, error: "conflict" };
      if (error.status === 404) return { ok: false, error: "missing" };
      if (error.status === 400) return { ok: false, error: "invalid" };
    }
    return { ok: false, error: "saveError" };
  }
  revalidatePath("/[locale]/admin", "page");
  return { ok: true };
}
