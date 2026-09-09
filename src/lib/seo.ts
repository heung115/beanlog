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
        "마신 커피의 원두, 로스터리, 산지, 가공 방식, 테이스팅 노트와 점수를 기록하고 세계 커피 산지 가이드를 살펴보세요.",
      keywords: [
        "커피 기록",
        "원두 기록",
        "테이스팅 노트",
        "커피 산지",
        "커피 다이어리",
      ],
    },
    origins: {
      title: "세계 커피 산지·세부 지역 가이드 | beanmap",
      description:
        "세계 커피 산지와 세부 지역을 찾아보세요. 지역별 향미 경향, 재배 환경, 가공 방식과 스페셜티 커피의 특징을 출처와 함께 살펴볼 수 있습니다.",
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
        "Track coffee beans, roasters, origins, processing methods, tasting notes, and ratings, then explore guides to coffee regions and microregions.",
      keywords: [
        "coffee journal",
        "coffee bean tracker",
        "tasting notes",
        "coffee origins",
        "coffee diary",
      ],
    },
    origins: {
      title: "Coffee Origins: Regions & Microregions | beanmap",
      description:
        "Explore regions and microregions across coffee-producing countries, with sourced flavor tendencies, growing conditions, processing methods, and specialty coffee context.",
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

export function buildPublicPageMetadata({
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
  preset: Pick<OriginPresetData, "country" | "countryKo"> & { regions: { name: string; nameKo: string }[] },
  slug: string
): Metadata {
  const locale = toSeoLocale(localeInput);
  const country = locale === "ko" ? preset.countryKo : preset.country;
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
      ? `${country}의 ${regions} 등 커피 산지와 세부 지역을 살펴보세요. 지역마다 다른 향미 경향, 재배 환경, 가공 방식과 스페셜티 커피의 특징을 출처와 함께 소개합니다.`
      : `Explore ${country} coffee regions including ${regions}, with sourced regional flavor tendencies, growing conditions, processing methods, and specialty microregions.`;
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
