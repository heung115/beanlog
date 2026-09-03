import type { MetadataRoute } from "next";
import { originPresets, originSlug } from "@/data/origin-presets";
import {
  localizedUrl,
  type SeoLocale,
} from "@/lib/seo";

const locales: readonly SeoLocale[] = ["ko", "en"];

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "",
    "/origins",
    ...originPresets.map(
      (preset) => `/origins/${originSlug(preset.country)}`
    ),
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
