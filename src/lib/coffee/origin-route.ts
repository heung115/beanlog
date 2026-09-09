import { findGuideCountryBySlug, findRegionGuideByRoute } from "../../data/origin-guides/index.ts";

/** The origin guide and its HTTP status must use the same finite guide catalog. */
export function isMissingOriginPath(pathname: string): boolean {
  const match = /^\/(?:ko|en)\/origins\/([^/]+)(?:\/([^/]+))?\/?$/.exec(pathname);
  if (!match) return false;
  try {
    const country = decodeURIComponent(match[1]);
    if (!findGuideCountryBySlug(country)) return true;
    return match[2] ? !findRegionGuideByRoute(country, decodeURIComponent(match[2])) : false;
  } catch {
    return true;
  }
}
