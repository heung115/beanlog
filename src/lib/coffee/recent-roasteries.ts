const PREFIX = "beanmap:recent-roasteries:v1:";
const LEGACY_KEY = "recent_roasteries";
type RecentStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function recentRoasteriesKey(ownerId: string): string {
  return `${PREFIX}${encodeURIComponent(ownerId)}`;
}

export function parseRecentRoasteries(raw: string | null): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((item): item is string => typeof item === "string")
      .map((item) => item.trim()).filter((item) => item.length > 0 && item.length <= 200))].slice(0, 10);
  } catch {
    return [];
  }
}

export function readRecentRoasteries(storage: RecentStorage, ownerId?: string): string[] {
  if (!ownerId) return [];
  try {
    // The old key has no owner. Importing it could expose another account's history.
    storage.removeItem(LEGACY_KEY);
    return parseRecentRoasteries(storage.getItem(recentRoasteriesKey(ownerId)));
  } catch {
    return [];
  }
}

export function saveRecentRoastery(storage: RecentStorage, ownerId: string | undefined, name: string): string[] | undefined {
  const trimmed = name.trim();
  if (!ownerId || !trimmed || trimmed.length > 200) return undefined;
  try {
    const next = [trimmed, ...readRecentRoasteries(storage, ownerId).filter((item) => item !== trimmed)].slice(0, 10);
    storage.setItem(recentRoasteriesKey(ownerId), JSON.stringify(next));
    return next;
  } catch {
    return undefined;
  }
}
