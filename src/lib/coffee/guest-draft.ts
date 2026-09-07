import { z } from "zod";
import { beanFormSchema } from "../validation/beans.ts";
import type { BeanFormData } from "@/types/database";

import { RECORD_DRAFT_PREFIX } from "./record-draft.ts";

export const GUEST_BEAN_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_GUEST_DRAFT_LENGTH = 100_000;

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

export function parseGuestBeanDraft(value: string | null, now = Date.now()): GuestBeanDraft | null {
  if (!value || value.length > MAX_GUEST_DRAFT_LENGTH) return null;

  try {
    const parsed = guestBeanDraftSchema.safeParse(JSON.parse(value));
    if (!parsed.success) return null;
    const savedAt = Date.parse(parsed.data.savedAt);
    if (savedAt > now + 60_000 || now - savedAt > GUEST_BEAN_DRAFT_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function loadGuestBeanDraft(): GuestBeanDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(GUEST_BEAN_DRAFT_KEY);
    const draft = parseGuestBeanDraft(raw);
    if (raw && !draft) window.localStorage.removeItem(GUEST_BEAN_DRAFT_KEY);
    return draft;
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
    const raw = JSON.stringify(draft);
    if (raw.length > MAX_GUEST_DRAFT_LENGTH) return { status: "invalid" };
    window.localStorage.setItem(GUEST_BEAN_DRAFT_KEY, raw);
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
    // Storage may be blocked by browser privacy settings.
  }
}

/** Clear both guest copies without touching an account-scoped draft. */
export function clearGuestBrowserDrafts() {
  clearGuestBeanDraft();
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(RECORD_DRAFT_PREFIX + "guest"); }
  catch { /* Storage may be blocked by browser privacy settings. */ }
}
