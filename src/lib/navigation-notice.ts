const STORAGE_KEY = "beanmap:navigation-notice";
const MAX_AGE_MS = 30_000;

type NoticeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** A short-lived, one-use confirmation for actions that finish with a full navigation. */
export function saveNavigationNotice(storage: NoticeStorage, message: string, now = Date.now()) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ message, createdAt: now }));
    return true;
  } catch {
    return false;
  }
}

export function consumeNavigationNotice(storage: NoticeStorage, now = Date.now()): string | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    storage.removeItem(STORAGE_KEY);
    if (!raw) return null;
    const notice: unknown = JSON.parse(raw);
    if (!notice || typeof notice !== "object") return null;
    const { message, createdAt } = notice as Record<string, unknown>;
    if (typeof message !== "string" || !message.trim() || message.length > 500) return null;
    if (typeof createdAt !== "number" || !Number.isFinite(createdAt)) return null;
    const age = now - createdAt;
    return age >= 0 && age <= MAX_AGE_MS ? message : null;
  } catch {
    return null;
  }
}
