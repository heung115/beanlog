import { z } from "zod";
import { beanFormSchema } from "@/lib/validation/beans";
import type { BeanFormData } from "@/types/database";

export const GUEST_BEAN_DRAFT_KEY = "beanmap:guest-bean-draft";

const guestBeanDraftSchema = z.object({
  version: z.literal(1),
  savedAt: z.string().datetime(),
  bean: beanFormSchema,
});

export type GuestBeanDraft = {
  version: 1;
  savedAt: string;
  bean: BeanFormData;
};

export type SaveGuestBeanDraftResult =
  | { status: "saved"; draft: GuestBeanDraft }
  | { status: "invalid" }
  | { status: "storage_unavailable" };

export function parseGuestBeanDraft(value: string | null): GuestBeanDraft | null {
  if (!value) return null;

  try {
    const parsed = guestBeanDraftSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function loadGuestBeanDraft(): GuestBeanDraft | null {
  if (typeof window === "undefined") return null;

  try {
    return parseGuestBeanDraft(window.localStorage.getItem(GUEST_BEAN_DRAFT_KEY));
  } catch {
    return null;
  }
}

export function saveGuestBeanDraft(bean: BeanFormData): SaveGuestBeanDraftResult {
  if (typeof window === "undefined") return { status: "storage_unavailable" };

  const parsedBean = beanFormSchema.safeParse(bean);
  if (!parsedBean.success) return { status: "invalid" };

  const draft: GuestBeanDraft = {
    version: 1,
    savedAt: new Date().toISOString(),
    bean: parsedBean.data,
  };

  try {
    window.localStorage.setItem(GUEST_BEAN_DRAFT_KEY, JSON.stringify(draft));
    return { status: "saved", draft };
  } catch {
    return { status: "storage_unavailable" };
  }
}

export function clearGuestBeanDraft() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(GUEST_BEAN_DRAFT_KEY);
  } catch {
    // The account copy is already saved even if browser storage is unavailable.
  }
}
