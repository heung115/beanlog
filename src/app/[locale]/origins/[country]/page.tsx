import { findGuideCountryBySlug } from "@/data/origin-guides";
import { headers } from "next/headers";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { NotFoundContent } from "@/components/layout/not-found-content";
import { RegionGuideList } from "@/components/origins/region-guide-list";
import { originSlug } from "@/data/origin-presets";
import { getCountryRegionGuides, regionGuidePath } from "@/data/origin-guides";
import { buildOriginDetailMetadata, localizedUrl, serializeJsonLd, toSeoLocale } from "@/lib/seo";

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string; country: string }>;
}): Promise<Metadata> {
  const { locale, country } = await params;
  const preset = findGuideCountryBySlug(country);
  if (!preset) return {
    title: locale === "en" ? "Page not found" : "페이지를 찾을 수 없습니다.",
    robots: { index: false, follow: false },
  };
  return buildOriginDetailMetadata(locale, { ...preset, regions: getCountryRegionGuides(preset.country) }, originSlug(preset.country));
}

export default async function OriginDetailPage({ params }: {
  params: Promise<{ locale: string; country: string }>;
}) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const { locale, country } = await params;
  const preset = findGuideCountryBySlug(country);
  if (!preset) {
    // The proxy assigns 404 while retaining the server-rendered recovery content.
    return <div className="flex min-h-[65dvh] items-center py-8"><NotFoundContent locale={locale} /></div>;
  }

  const t = await getTranslations({ locale, namespace: "origins" });
  const language = toSeoLocale(locale);
  const isKorean = language === "ko";
  const countryName = isKorean ? preset.countryKo : preset.country;
  const canonicalSlug = originSlug(preset.country);
  const guides = getCountryRegionGuides(preset.country);
  const regions = guides.filter((guide) => !guide.parentId);
  const microregions = guides.filter((guide) => guide.kind === "microregion");
  const pageUrl = localizedUrl(language, `/origins/${canonicalSlug}`);
  const pageName = isKorean ? `${countryName} 커피 산지 가이드` : `${countryName} Coffee Origin Guide`;
  const pageDescription = isKorean
    ? `${countryName}의 산지와 세부 지역을 살펴보세요. 지역마다 다른 재배 환경, 향미 경향과 스페셜티 생산 배경을 출처와 함께 정리했습니다.`
    : `Explore the growing regions and microregions of ${countryName}, with sourced notes on their environment, flavor tendencies, and specialty production.`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage", "@id": `${pageUrl}#webpage`, url: pageUrl,
        name: pageName, description: pageDescription, inLanguage: isKorean ? "ko-KR" : "en",
        breadcrumb: { "@id": `${pageUrl}#breadcrumb` },
        mainEntity: {
          "@type": "ItemList", numberOfItems: guides.length,
          itemListElement: guides.map((guide, index) => ({
            "@type": "ListItem", position: index + 1, name: isKorean ? guide.nameKo : guide.name,
            url: localizedUrl(language, regionGuidePath(guide)),
          })),
        },
      },
      {
        "@type": "BreadcrumbList", "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: isKorean ? "홈" : "Home", item: localizedUrl(language) },
          { "@type": "ListItem", position: 2, name: isKorean ? "커피 산지 가이드" : "Coffee Origin Guide", item: localizedUrl(language, "/origins") },
          { "@type": "ListItem", position: 3, name: countryName, item: pageUrl },
        ],
      },
    ],
  };

  return (
    <article className="mx-auto max-w-4xl pb-8">
      {/* Browsers hide nonce attributes; retain CSP nonce and suppress only this script’s attribute mismatch. */}
      <script suppressHydrationWarning nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <Link
        href={`/${locale}/origins#origin-${canonicalSlug}`}
        className="group inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-brown-light transition-colors hover:text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" className="transition-transform duration-150 group-hover:-translate-x-0.5">
          <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t("indexTitle")}
      </Link>

      <header data-testid="origin-detail-header" className="animate-rise mt-2 py-4 md:py-6">
        <p className="journal-kicker">{t("guide")}</p>
        <h1 className="mt-2 max-w-full break-words text-3xl font-semibold leading-tight tracking-[-0.03em] text-brown md:text-4xl">{countryName}</h1>
        <p className="mt-1 text-xs text-brown-light">{isKorean ? preset.country : preset.countryKo}</p>
        <p className="folio-label mt-3">
          {isKorean ? `주요 산지 ${regions.length}곳 · 세부 지역 ${microregions.length}곳` : `${regions.length} regions · ${microregions.length} microregions`}
        </p>
      </header>

      <section data-testid="origin-profile" className="mt-8" aria-labelledby="country-regions-title">
        <h2 id="country-regions-title" className="mb-2 text-lg font-semibold tracking-[-0.015em] text-brown">{isKorean ? "주요 산지" : "Growing regions"}</h2>
        <RegionGuideList guides={regions} parents={guides} locale={locale} />
      </section>


    </article>
  );
}
