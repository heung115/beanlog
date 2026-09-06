/** In-progress records belong to one browser tab and expire after a day. */
export const RECORD_DRAFT_PREFIX = "beanmap:record-draft:v1:";
export const RECORD_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_DRAFT_LENGTH = 100_000;

export interface RecordDraft<T> {
  version: 1;
  savedAt: number;
  sourceVersion: string | null;
  value: T;
}

export function recordDraftScope(ownerId: string, recordId?: string) {
  return `user:${encodeURIComponent(ownerId)}:${recordId ? `edit:${encodeURIComponent(recordId)}` : "new"}`;
}

export function parseRecordDraft<T>(
  raw: string | null,
  validate: (value: unknown) => value is T,
  now = Date.now(),
): RecordDraft<T> | null {
  if (!raw || raw.length > MAX_DRAFT_LENGTH) return null;
  try {
    const draft = JSON.parse(raw);
    if (
      draft?.version !== 1 ||
      typeof draft.savedAt !== "number" ||
      !Number.isFinite(draft.savedAt) ||
      draft.savedAt > now + 60_000 ||
      now - draft.savedAt > RECORD_DRAFT_TTL_MS ||
      !(draft.sourceVersion === null || typeof draft.sourceVersion === "string") ||
      !validate(draft.value)
    ) return null;
    return draft;
  } catch {
    return null;
  }
}

export function serializeRecordDraft<T>(value: T, sourceVersion: string | null, now = Date.now()) {
  const raw = JSON.stringify({ version: 1, savedAt: now, sourceVersion, value });
  if (raw.length > MAX_DRAFT_LENGTH) throw new Error("Draft exceeds browser storage limit");
  return raw;
}
