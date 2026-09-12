import { SpecialtyLots } from "@/components/origins/specialty-lots";
import { getPublishedLots } from "@/data/origin-guides/lot-publication";
import { VarietyProfiles } from "@/components/origins/variety-profiles";
import { getVarietyGuides } from "@/data/coffee-varieties";
import { varietyDisplayNames } from "@/data/coffee-varieties/display";
import { findGuideCountryBySlug } from "@/data/origin-guides";
import { headers } from "next/headers";
import type { Metadata } from "next";
import Link from "next/link";
import { NotFoundContent } from "@/components/layout/not-found-content";
import { RegionGuideList } from "@/components/origins/region-guide-list";
import { originSlug } from "@/data/origin-presets";
import { findRegionGuideByRoute, getCountryRegionGuides, getRegionChildren, regionGuidePath } from "@/data/origin-guides";
import type { OriginRegionGuide } from "@/data/origin-guides/types";
import { buildPublicPageMetadata, localizedUrl, serializeJsonLd, toSeoLocale } from "@/lib/seo";

type RegionPageParams = { locale: string; country: string; region: string };

export async function generateMetadata({ params }: { params: Promise<RegionPageParams> }): Promise<Metadata> {
  const { locale, country, region } = await params;
  const guide = findRegionGuideByRoute(country, region);
  const preset = findGuideCountryBySlug(country);
  if (!guide || !preset) return {
    title: locale === "en" ? "Page not found" : "페이지를 찾을 수 없습니다.",
    robots: { index: false, follow: false },
  };
  const language = toSeoLocale(locale);
  const name = language === "ko" ? guide.nameKo : guide.name;
  const countryName = language === "ko" ? preset.countryKo : preset.country;
  return buildPublicPageMetadata({
    locale: language,
    path: regionGuidePath(guide),
    title: language === "ko" ? `${name} 커피 산지 가이드 · ${countryName} | beanmap` : `${name} Coffee Guide · ${countryName} | beanmap`,
    description: guide.summary[language],
    keywords: [name, countryName, ...guide.aliases, ...guide.flavorNotes[language], language === "ko" ? "스페셜티 커피 산지" : "specialty coffee region"],
  });
}

function getAncestors(guide: OriginRegionGuide, guides: OriginRegionGuide[]) {
  const byId = new Map(guides.map((entry) => [entry.id, entry]));
  const ancestors: OriginRegionGuide[] = [];
  const seen = new Set([guide.id]);
  let parent = guide.parentId ? byId.get(guide.parentId) : undefined;
  while (parent && !seen.has(parent.id)) {
    ancestors.unshift(parent);
    seen.add(parent.id);
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return ancestors;
}

export default async function OriginRegionPage({ params }: { params: Promise<RegionPageParams> }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const { locale, country, region } = await params;
  const guide = findRegionGuideByRoute(country, region);
  const preset = findGuideCountryBySlug(country);
  if (!guide || !preset) {
    // The proxy assigns 404 while retaining the server-rendered recovery content.
    return <div className="flex min-h-[65dvh] items-center py-8"><NotFoundContent locale={locale} /></div>;
  }

  const language = toSeoLocale(locale);
  const isKorean = language === "ko";
  const name = isKorean ? guide.nameKo : guide.name;
  const secondaryName = isKorean ? guide.name : guide.nameKo;
  const countryName = isKorean ? preset.countryKo : preset.country;
  const countryGuides = getCountryRegionGuides(guide.country);
  const children = getRegionChildren(guide.id);
  const ancestors = getAncestors(guide, countryGuides);
  const pagePath = regionGuidePath(guide);
  const pageUrl = localizedUrl(language, pagePath);
  const breadcrumbs = [
    { name: isKorean ? "산지 가이드" : "Origin guide", path: "/origins" },
    { name: countryName, path: `/origins/${originSlug(preset.country)}` },
    ...ancestors.map((parent) => ({ name: isKorean ? parent.nameKo : parent.name, path: regionGuidePath(parent) })),
    { name, path: pagePath },
  ];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage", "@id": `${pageUrl}#webpage`, url: pageUrl,
        name: isKorean ? `${name} 커피 산지 가이드` : `${name} Coffee Origin Guide`,
        description: guide.summary[language], inLanguage: isKorean ? "ko-KR" : "en",
        breadcrumb: { "@id": `${pageUrl}#breadcrumb` },
        citation: guide.sources.map((source) => ({ "@type": "CreativeWork", name: source.title, url: source.url })),
      },
      {
        "@type": "BreadcrumbList", "@id": `${pageUrl}#breadcrumb`,
        itemListElement: breadcrumbs.map((item, index) => ({
          "@type": "ListItem", position: index + 1, name: item.name,
          item: localizedUrl(language, item.path),
        })),
      },
    ],
  };

  return (
    <article className="mx-auto max-w-4xl pb-10 md:pb-16">
      {/* Browsers hide nonce attributes; retain CSP nonce and suppress only this script’s attribute mismatch. */}
      <script suppressHydrationWarning nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <nav aria-label={isKorean ? "현재 위치" : "Breadcrumb"}>
        <ol className="flex flex-wrap items-center gap-x-2 text-xs text-brown-light">
          {breadcrumbs.map((item, index) => (
            <li key={item.path} className="flex min-w-0 items-center gap-2">
              {index > 0 && <span aria-hidden="true">/</span>}
              {index === breadcrumbs.length - 1
                ? <span aria-current="page" className="inline-flex min-h-11 items-center break-words font-medium text-brown">{item.name}</span>
                : <Link href={`/${locale}${item.path}`} className="inline-flex min-h-11 items-center break-words transition-colors hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">{item.name}</Link>}
            </li>
          ))}
        </ol>
      </nav>

      <header data-testid="origin-region-header" className="animate-rise mt-2 py-4 md:py-6">
        <p className="journal-kicker">{guide.kind === "microregion" ? (isKorean ? "세부 산지 가이드" : "Microregion guide") : (isKorean ? "커피 산지 가이드" : "Coffee region guide")}</p>
        <h1 className="mt-2 break-words text-3xl font-semibold leading-tight tracking-[-0.03em] text-brown md:text-4xl">{name}</h1>
        {secondaryName !== name && <p className="mt-1 text-xs text-brown-light">{secondaryName}</p>}
        <p className="mt-5 max-w-3xl text-base leading-8 text-brown-medium">{guide.summary[language]}</p>
        {guide.aliases.length > 0 && <p className="mt-3 text-xs leading-6 text-brown-light">{isKorean ? "다른 표기" : "Also known as"}: {guide.aliases.join(" · ")}</p>}
      </header>

      {children.length > 0 && <section className="mt-10" aria-labelledby="region-children-title" data-testid="region-children">
        <h2 id="region-children-title" className="mb-2 text-lg font-semibold tracking-[-0.015em] text-brown">{isKorean ? "연결된 세부 지역" : "Explore connected microregions"}</h2>
        <RegionGuideList guides={children} parents={countryGuides} locale={locale} />
      </section>}

      <div className="mt-7 grid gap-10 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:gap-12">
        <section aria-labelledby="region-environment-title" data-testid="region-environment">
          <h2 id="region-environment-title" className="text-lg font-semibold tracking-[-0.015em] text-brown">{isKorean ? "재배 환경과 지역 특징" : "Place and growing environment"}</h2>
          <p className="mt-4 text-sm leading-7 text-brown-medium">{guide.environment[language]}</p>
          {guide.altitude && <dl className="mt-5">
            <dt className="folio-label">{isKorean ? "재배 고도" : "Growing elevation"}</dt>
            <dd className="mt-2 text-xl font-semibold tabular-nums text-brown">{guide.altitude.min.toLocaleString("en-US")}–{guide.altitude.max.toLocaleString("en-US")} m</dd>
          </dl>}
        </section>
        <section aria-labelledby="region-flavors-title" data-testid="region-flavors">
          <h2 id="region-flavors-title" className="text-lg font-semibold tracking-[-0.015em] text-brown">{guide.verification.flavorBasis === "regional" ? (isKorean ? "향미 경향" : "Regional flavors") : (isKorean ? "향미 기록" : "Recorded flavors")}</h2>
          <ul className="mt-4 space-y-2.5">
            {guide.flavorNotes[language].map((note, index) => <li key={note} className="flex items-baseline gap-3 text-sm leading-6 text-brown">
              <span className="font-mono text-[11px] text-accent">{String(index + 1).padStart(2, "0")}</span><span>{note}</span>
            </li>)}
          </ul>
        </section>
      </div>


      <section className="mt-10" aria-labelledby="region-processing-title" data-testid="region-processing">
        <h2 id="region-processing-title" className="text-lg font-semibold tracking-[-0.015em] text-brown">{isKorean ? "가공" : "Processing"}</h2>
        <p className="mt-4 text-sm leading-7 text-brown-medium">{guide.processes[language].join(" · ")}</p>
      </section>

      <VarietyProfiles names={varietyDisplayNames(guide.varieties)} guides={getVarietyGuides(guide.varieties)} locale={locale} />

      <SpecialtyLots lots={getPublishedLots(guide.id)} locale={locale} />

      <details className="mt-10" data-testid="region-sources">
        <summary className="cursor-pointer py-3 text-sm font-medium text-brown">{isKorean ? "출처" : "Sources"}</summary>
        <ul className="mt-3 divide-y divide-border-light">
          {guide.sources.map((source) => <li key={source.url} className="py-3">
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 break-words text-sm font-medium leading-6 text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              {source.title}<span aria-hidden="true" className="shrink-0">↗</span><span className="sr-only">{isKorean ? "(새 창)" : "(opens in a new tab)"}</span>
            </a>
            <p className="text-xs leading-6 text-brown-light">{source.publisher} · {isKorean ? "확인" : "Accessed"} <time dateTime={source.accessedAt}>{source.accessedAt}</time></p>
          </li>)}
        </ul>
      </details>

    </article>
  );
}
