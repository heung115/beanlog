import { headers } from "next/headers";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageIntro } from "@/components/layout/page-intro";
import { RegionGuideList } from "@/components/origins/region-guide-list";
import { originSlug } from "@/data/origin-presets";
import { originGuideCountries, originRegionGuides, regionGuidePath } from "@/data/origin-guides";
import { buildOriginIndexMetadata, localizedUrl, SEO_COPY, serializeJsonLd, toSeoLocale } from "@/lib/seo";


const originGroups = [
  { id: "africa", label: { ko: "아프리카", en: "Africa" }, countries: ["Ethiopia", "Kenya", "Rwanda", "Burundi", "Tanzania", "Uganda", "Madagascar"] },
  { id: "americas", label: { ko: "아메리카", en: "The Americas" }, countries: ["Colombia", "Panama", "Guatemala", "Brazil", "Costa Rica", "Peru", "Honduras", "El Salvador", "Nicaragua", "Mexico", "Bolivia", "Ecuador", "Dominican Republic"] },
  { id: "asia-pacific", label: { ko: "아시아·태평양", en: "Asia & Pacific" }, countries: ["Indonesia", "Yemen", "Papua New Guinea", "India", "Vietnam", "China", "Thailand", "Timor-Leste", "Malaysia"] },
];

type SearchParams = Record<string, string | string[] | undefined>;
const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
const normalizeSearch = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim();

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return buildOriginIndexMetadata((await params).locale);
}

export default async function OriginsPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const { locale } = await params;
  const search = await searchParams;
  const t = await getTranslations({ locale, namespace: "origins" });
  const language = toSeoLocale(locale);
  const isKorean = language === "ko";
  const query = firstValue(search.q).slice(0, 200).trim();
  const selectedKind = firstValue(search.kind) === "microregion" ? "microregion" : "all";
  const countryQuery = firstValue(search.country);
  const selectedCountry = originGuideCountries.some((preset) => preset.country === countryQuery) ? countryQuery : "";
  const presetByCountry = new Map(originGuideCountries.map((preset) => [preset.country, preset]));
  const queryTerms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  const guides = originRegionGuides.filter((guide) => {
    if (selectedCountry && guide.country !== selectedCountry) return false;
    if (selectedKind === "microregion" && guide.kind !== "microregion") return false;
    const haystack = normalizeSearch([
      guide.name, guide.nameKo, guide.country, presetByCountry.get(guide.country)?.countryKo ?? "",
      ...guide.aliases,
    ].join(" "));
    return queryTerms.every((term) => haystack.includes(term));
  });
  const activeGroups = originGroups.filter((group) => group.countries.some((country) => guides.some((guide) => guide.country === country)));
  const microregionCount = originRegionGuides.filter((guide) => guide.kind === "microregion").length;
  const isFiltered = Boolean(query || selectedCountry || selectedKind !== "all");
  const collectionItems = isFiltered
    ? guides.map((guide) => ({ name: isKorean ? guide.nameKo : guide.name, path: regionGuidePath(guide) }))
    : originGuideCountries.map((country) => ({ name: isKorean ? country.countryKo : country.country, path: `/origins/${originSlug(country.country)}` }));
  const collectionUrl = localizedUrl(language, "/origins");
  const jsonLd = {
    "@context": "https://schema.org", "@type": "CollectionPage",
    "@id": `${collectionUrl}#collection`, url: collectionUrl,
    name: SEO_COPY[language].origins.title, description: SEO_COPY[language].origins.description,
    inLanguage: isKorean ? "ko-KR" : "en",
    mainEntity: {
      "@type": "ItemList", numberOfItems: collectionItems.length,
      itemListElement: collectionItems.map((item, index) => ({
        "@type": "ListItem", position: index + 1, name: item.name,
        url: localizedUrl(language, item.path),
      })),
    },
  };
  const controlClass = "h-11 min-h-11 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-sm text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div className="mx-auto max-w-5xl pb-10 md:pb-16">
      {/* Browsers hide nonce attributes; retain CSP nonce and suppress only this script’s attribute mismatch. */}
      <script suppressHydrationWarning nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <PageIntro
        testId="origin-index-header" eyebrow={t("guide")} title={t("indexTitle")}
        meta={<p className="folio-label leading-6">
          {isKorean ? `${originRegionGuides.length}개 산지 · ${originGuideCountries.length}개 국가` : `${originRegionGuides.length} origins · ${originGuideCountries.length} countries`}
          <span className="block">{isKorean ? `세부 지역 ${microregionCount}곳 포함` : `Including ${microregionCount} microregions`}</span>
        </p>}
      />

      <nav aria-label={isKorean ? "산지 권역 바로가기" : "Jump to an origin region"} className="-mx-4 mt-5 bg-cream/95 px-4 md:sticky md:top-[4.45rem] md:z-30 md:-mx-6 md:px-6">
        <ol className="mx-auto flex max-w-5xl flex-wrap gap-x-3 py-1 md:gap-x-6">
          {activeGroups.map((group) => <li key={group.id} className="shrink-0">
            <a href={`#${group.id}`} className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-brown-light transition-colors hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <span className="font-mono text-[10px] font-normal text-accent">{String(originGroups.indexOf(group) + 1).padStart(2, "0")}</span>
              {group.label[language]}
            </a>
          </li>)}
        </ol>
      </nav>

      <section className="mt-6" aria-label={isKorean ? "산지 검색" : "Search origins"}>
        <details open={isFiltered} data-origin-search>
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-brown underline decoration-border underline-offset-4">{isKorean ? "산지 검색" : "Search origins"}</summary>
        <form action={`/${locale}/origins`} method="get" role="search" className="grid gap-3 rounded-lg bg-surface-warm p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_13rem_10rem_auto] lg:items-end md:p-5">
          <div className="min-w-0 sm:col-span-2 lg:col-span-1">
            <label htmlFor="origin-search" className="mb-2 block text-xs font-medium text-brown">{isKorean ? "산지·품종·생산자" : "Region, variety or producer"}</label>
            <input id="origin-search" name="q" type="search" defaultValue={query} maxLength={200} placeholder={isKorean ? "예가체프, 게뎁, 이디도…" : "Yirgacheffe, Gedeb, Idido…"} className={`${controlClass} placeholder:text-brown-light`} />
          </div>
          <div className="min-w-0">
            <label htmlFor="origin-country-filter" className="mb-2 block text-xs font-medium text-brown">{isKorean ? "국가" : "Country"}</label>
            <div className="relative">
            <select id="origin-country-filter" name="country" defaultValue={selectedCountry} className={`${controlClass} appearance-none pr-9`}>
              <option value="">{isKorean ? "모든 국가" : "All countries"}</option>
              {originGroups.flatMap((group) => group.countries).map((country) => {
                const preset = presetByCountry.get(country);
                return preset ? <option key={country} value={country}>{isKorean ? preset.countryKo : country}</option> : null;
              })}
            </select>
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brown-light"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </div>
          <div className="min-w-0">
            <label htmlFor="origin-kind-filter" className="mb-2 block text-xs font-medium text-brown">{isKorean ? "지역 범위" : "Region type"}</label>
            <div className="relative">
            <select id="origin-kind-filter" name="kind" defaultValue={selectedKind} className={`${controlClass} appearance-none pr-9`}>
              <option value="all">{isKorean ? "모든 산지" : "All regions"}</option>
              <option value="microregion">{isKorean ? "세부 지역만" : "Microregions"}</option>
            </select>
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brown-light"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </div>
          <button type="submit" className="min-h-11 rounded-md bg-brown px-5 text-sm font-semibold text-white transition-colors hover:bg-brown-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 sm:col-span-2 lg:col-span-1">{isKorean ? "찾기" : "Search"}</button>
        </form>
        </details>
        {isFiltered && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs leading-6 text-brown-light" aria-live="polite">
          <p>{isKorean ? `검색 결과 ${guides.length}개 산지` : `${guides.length} matching origins`}</p>
          {isFiltered && <Link href={`/${locale}/origins`} className="inline-flex min-h-11 items-center text-accent underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">{isKorean ? "전체 산지 보기" : "Clear filters"}</Link>}
        </div>}
      </section>

      {guides.length === 0 && <p className="py-12 text-sm leading-7 text-brown-medium">{isKorean ? "조건에 맞는 산지가 없습니다." : "No origins match these filters."}</p>}

      <div className="mt-8 space-y-12 md:mt-10 md:space-y-16">
        {activeGroups.map((group) => {
          const presets = group.countries.map((country) => presetByCountry.get(country))
            .filter((preset) => preset !== undefined)
            .filter((preset) => guides.some((guide) => guide.country === preset.country));
          return (
            <section id={group.id} key={group.id} aria-labelledby={`${group.id}-title`} className="scroll-mt-44">
              <header className="mb-5 flex items-baseline gap-3">
                <p className="font-mono text-xs text-accent">{String(originGroups.indexOf(group) + 1).padStart(2, "0")}</p>
                <h2 id={`${group.id}-title`} className="text-xl font-semibold tracking-[-0.02em] text-brown">{group.label[language]}</h2>
              </header>
              <div className={isFiltered ? "space-y-9 md:space-y-12" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"}>
                {presets.map((preset) => {
                  const countryName = isKorean ? preset.countryKo : preset.country;
                  const countryGuides = guides.filter((guide) => guide.country === preset.country);
                  return (
                    <section key={preset.country} aria-labelledby={`country-title-${originSlug(preset.country)}`}>
                      <Link
                        id={`origin-${originSlug(preset.country)}`} href={`/${locale}/origins/${originSlug(preset.country)}`}
                        prefetch={false} aria-label={t("viewCountry", { country: countryName })} data-origin-row
                        className="group grid min-h-24 scroll-mt-32 grid-cols-[minmax(0,1fr)_1rem] gap-x-3 rounded-md border border-transparent bg-surface-warm px-4 py-4 transition-colors hover:border-accent/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <div data-origin-name className="min-w-0">
                          <h3 id={`country-title-${originSlug(preset.country)}`} className="text-lg font-semibold tracking-[-0.02em] text-brown transition-colors group-hover:text-accent md:text-xl">{countryName}</h3>
                          <span className="mt-0.5 block text-[11px] text-brown-light">{isKorean ? preset.country : preset.countryKo}</span>
                        </div>
                        <span className="col-start-1 mt-3 text-xs text-brown-light">{isKorean ? `주요 산지 ${countryGuides.filter((guide) => !guide.parentId).length}곳 · 전체 ${countryGuides.length}곳` : `${countryGuides.filter((guide) => !guide.parentId).length} growing regions · ${countryGuides.length} total`}</span>
                        <span aria-hidden="true" className="col-start-2 row-start-1 self-center text-xl text-accent transition-transform group-hover:translate-x-1">→</span>
                      </Link>
                      {isFiltered && <div className="mt-2 md:pl-4"><RegionGuideList guides={countryGuides} parents={originRegionGuides} locale={locale} /></div>}
                    </section>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
