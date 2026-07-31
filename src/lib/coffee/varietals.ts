/**
 * A bean can contain multiple varietals in one persisted text value. Filters,
 * however, operate on one varietal at a time, so expose each comma-delimited
 * value as its own option.
 */
export function splitVarietals(value: string | null | undefined): string[] {
  if (!value) return [];

  return value
    .split(/[,，]/)
    .map((varietal) => varietal.trim())
    .filter(Boolean);
}
