import type { MetadataRoute } from "next";
import { originSlug } from "@/data/origin-presets";
import { originGuideCountries, originRegionGuides, regionGuidePath } from "@/data/origin-guides";
import {
  localizedUrl,
  type SeoLocale,
} from "@/lib/seo";

const locales: readonly SeoLocale[] = ["ko", "en"];

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "",
    "/origins",
    ...originGuideCountries.map(
      (preset) => `/origins/${originSlug(preset.country)}`
    ),
    ...originRegionGuides.map(regionGuidePath),
  ];

  return paths.flatMap((path) => {
    const languages = {
      ko: localizedUrl("ko", path),
      en: localizedUrl("en", path),
    };

    return locales.map((locale) => ({
      url: languages[locale],
      alternates: { languages },
    }));
  });
}
