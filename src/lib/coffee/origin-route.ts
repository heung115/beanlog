import { findCountryPresetBySlug } from "../../data/origin-presets.ts";

/** The origin guide and its HTTP status must use the same finite preset catalog. */
export function isMissingOriginPath(pathname: string): boolean {
  const match = /^\/(?:ko|en)\/origins\/([^/]+)\/?$/.exec(pathname);
  if (!match) return false;
  try {
    return !findCountryPresetBySlug(decodeURIComponent(match[1]));
  } catch {
    return true;
  }
}
