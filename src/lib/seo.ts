import type { Metadata } from "next";
import type { OriginPresetData } from "@/data/origin-presets";

export const PRODUCTION_SITE_ORIGIN = "https://beanmap.site";
export const SITE_NAME = "beanmap";
export const SOCIAL_IMAGE_PATH = "/opengraph-image";

export type SeoLocale = "ko" | "en";

export const SEO_COPY = {
  ko: {
    landing: {
      title: "beanmap | 커피 원두 기록과 산지 가이드",
      description:
        "마신 커피의 원두, 로스터리, 산지, 가공 방식, 테이스팅 노트와 점수를 기록하고 20개 커피 생산국 가이드를 살펴보세요.",
      keywords: [
        "커피 기록",
        "원두 기록",
        "테이스팅 노트",
        "커피 산지",
        "커피 다이어리",
      ],
    },
    origins: {
      title: "세계 커피 산지 가이드 20개국 | beanmap",
      description:
        "에티오피아, 콜롬비아, 케냐 등 20개 커피 생산국의 대표 향미, 재배 고도, 주요 품종과 생산 지역을 한눈에 살펴보세요.",
      keywords: [
        "커피 산지",
        "커피 생산국",
        "원두 산지",
        "커피 품종",
        "커피 향미",
      ],
    },
    imageAlt: "beanmap 커피 기록과 세계 커피 산지 가이드",
  },
  en: {
    landing: {
      title: "beanmap | Coffee Journal & Origin Guide",
      description:
        "Track coffee beans, roasters, origins, processing methods, tasting notes, and ratings, then explore guides to 20 coffee-producing countries.",
      keywords: [
        "coffee journal",
        "coffee bean tracker",
        "tasting notes",
        "coffee origins",
        "coffee diary",
      ],
    },
    origins: {
      title: "Coffee Origin Guide: 20 Producing Countries | beanmap",
      description:
        "Explore flavor profiles, growing elevations, varieties, and key regions across 20 coffee-producing countries, including Ethiopia, Colombia, and Kenya.",
      keywords: [
        "coffee origin guide",
        "coffee producing countries",
        "coffee regions",
        "coffee varieties",
        "coffee flavor profiles",
      ],
    },
    imageAlt: "beanmap coffee journal and world coffee origin guide",
  },
} as const;

/**
 * Reduces a configured site URL to a trustworthy HTTP(S) origin. Paths,
 * queries, hashes, and credentials never become part of canonical URLs.
 */
export function normalizeSiteOrigin(
  candidate: string | null | undefined
): string {
  const raw = candidate?.trim();

  if (!raw) return PRODUCTION_SITE_ORIGIN;

  try {
    const url = new URL(raw);

    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password ||
      url.origin === "null"
    ) {
      return PRODUCTION_SITE_ORIGIN;
    }

    return url.origin;
  } catch {
    return PRODUCTION_SITE_ORIGIN;
  }
}

export const SITE_ORIGIN = normalizeSiteOrigin(
  process.env.NEXT_PUBLIC_APP_URL
);

/** Build a same-origin absolute URL from an application path. */
export function absoluteUrl(
  pathname = "/",
  origin = SITE_ORIGIN
): string {
  const safeOrigin = normalizeSiteOrigin(origin);
  const rawPath = pathname.trim();

  if (!rawPath || rawPath === "/") return `${safeOrigin}/`;

  // Treat even absolute or protocol-relative input as a path. This prevents a
  // future caller from accidentally emitting an off-site canonical URL.
  const sameOriginPath = `/${rawPath.replace(/^[\\/]+/, "")}`;
  const url = new URL(sameOriginPath, `${safeOrigin}/`);

  return url.origin === safeOrigin ? url.toString() : `${safeOrigin}/`;
}

export function toSeoLocale(locale: string): SeoLocale {
  return locale === "en" ? "en" : "ko";
}

export function localizedUrl(locale: SeoLocale, path = ""): string {
  const suffix = path.trim().replace(/^[\\/]+|[\\/]+$/g, "");
  return absoluteUrl(`/${locale}${suffix ? `/${suffix}` : ""}`);
}

export function localizedAlternates(
  locale: SeoLocale,
  path = ""
): NonNullable<Metadata["alternates"]> {
  const languages = {
    ko: localizedUrl("ko", path),
    en: localizedUrl("en", path),
  };

  return {
    canonical: languages[locale],
    languages,
  };
}

export function localizedManifest(localeInput: string): string {
  const locale = toSeoLocale(localeInput);

  return `/manifest.json?lang=${locale}`;
}

export function buildLocaleDefaultMetadata(localeInput: string): Metadata {
  const locale = toSeoLocale(localeInput);
  const copy = SEO_COPY[locale].landing;

  return {
    title: copy.title,
    description: copy.description,
    manifest: localizedManifest(locale),
    robots: {
      index: false,
      follow: true,
    },
  };
}

type PageMetadataInput = {
  locale: SeoLocale;
  path?: string;
  title: string;
  description: string;
  keywords: readonly string[];
};

function buildPublicPageMetadata({
  locale,
  path = "",
  title,
  description,
  keywords,
}: PageMetadataInput): Metadata {
  const canonical = localizedUrl(locale, path);
  const socialImage = absoluteUrl(SOCIAL_IMAGE_PATH);
  const imageAlt = SEO_COPY[locale].imageAlt;

  return {
    title,
    description,
    keywords: [...keywords],
    manifest: localizedManifest(locale),
    alternates: localizedAlternates(locale, path),
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: locale === "ko" ? "ko_KR" : "en_US",
      alternateLocale: locale === "ko" ? ["en_US"] : ["ko_KR"],
      url: canonical,
      title,
      description,
      images: [
        {
          url: socialImage,
          width: 1200,
          height: 630,
          alt: imageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        {
          url: socialImage,
          alt: imageAlt,
        },
      ],
    },
  };
}

export function buildLandingMetadata(localeInput: string): Metadata {
  const locale = toSeoLocale(localeInput);
  const copy = SEO_COPY[locale].landing;

  return buildPublicPageMetadata({
    locale,
    title: copy.title,
    description: copy.description,
    keywords: copy.keywords,
  });
}

export function buildOriginIndexMetadata(localeInput: string): Metadata {
  const locale = toSeoLocale(localeInput);
  const copy = SEO_COPY[locale].origins;

  return buildPublicPageMetadata({
    locale,
    path: "/origins",
    title: copy.title,
    description: copy.description,
    keywords: copy.keywords,
  });
}

/**
 * `slug` should be the canonical value returned by originSlug(preset.country).
 */
export function buildOriginDetailMetadata(
  localeInput: string,
  preset: OriginPresetData,
  slug: string
): Metadata {
  const locale = toSeoLocale(localeInput);
  const country = locale === "ko" ? preset.countryKo : preset.country;
  const signature =
    locale === "ko" ? preset.signatureKo : preset.signature;
  const regions = preset.regions
    .slice(0, 3)
    .map((region) => (locale === "ko" ? region.nameKo : region.name))
    .join(locale === "ko" ? "·" : ", ");
  const title =
    locale === "ko"
      ? `${country} 커피 산지 가이드 | ${SITE_NAME}`
      : `${country} Coffee Origin Guide | ${SITE_NAME}`;
  const description =
    locale === "ko"
      ? `${country} 커피의 대표 향미(${signature}), 재배 고도 ${preset.altitudeRange}, 주요 품종과 ${regions} 등 생산 지역을 살펴보세요.`
      : `${country} coffee: ${signature}. See ${preset.altitudeRange} elevations and regions: ${regions}.`;
  const keywords =
    locale === "ko"
      ? [
          `${country} 커피`,
          `${country} 원두`,
          `${country} 커피 산지`,
          "커피 품종",
          "커피 향미",
        ]
      : [
          `${country} coffee`,
          `${country} coffee beans`,
          `${country} coffee regions`,
          "coffee varieties",
          "coffee flavor profile",
        ];

  return buildPublicPageMetadata({
    locale,
    path: `/origins/${slug}`,
    title,
    description,
    keywords,
  });
}

/** Serialize schema.org data without allowing a closing script tag injection. */
export function serializeJsonLd(value: unknown): string {
  const json = JSON.stringify(value);

  if (json === undefined) return "null";

  return json
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
