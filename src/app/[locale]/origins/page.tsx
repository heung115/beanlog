import { headers } from "next/headers";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageIntro } from "@/components/layout/page-intro";
import { originPresets, originSlug } from "@/data/origin-presets";
import {
  buildOriginIndexMetadata,
  localizedUrl,
  SEO_COPY,
  serializeJsonLd,
  toSeoLocale,
} from "@/lib/seo";

const originGroups = [
  {
    id: "africa",
    label: { ko: "아프리카", en: "Africa" },
    countries: ["Ethiopia", "Kenya", "Rwanda", "Burundi", "Tanzania"],
  },
  {
    id: "americas",
    label: { ko: "아메리카", en: "The Americas" },
    countries: [
      "Colombia", "Panama", "Guatemala", "Brazil", "Costa Rica", "Peru",
      "Honduras", "El Salvador", "Nicaragua", "Mexico",
    ],
  },
  {
    id: "asia-pacific",
    label: { ko: "아시아·태평양", en: "Asia & Pacific" },
    countries: ["Indonesia", "Yemen", "Papua New Guinea", "India", "Vietnam"],
  },
] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildOriginIndexMetadata(locale);
}

export default async function OriginsPage({ params }: { params: Promise<{ locale: string }> }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "origins" });
  const seoLocale = toSeoLocale(locale);
  const isKorean = seoLocale === "ko";
  const copy = SEO_COPY[seoLocale].origins;
  const collectionUrl = localizedUrl(seoLocale, "/origins");
  const presetByCountry = new Map(originPresets.map((preset) => [preset.country, preset]));
  const orderedPresets = originGroups.flatMap((group) =>
    group.countries.map((country) => presetByCountry.get(country)).filter((preset) => preset !== undefined)
  );
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${collectionUrl}#collection`,
    url: collectionUrl,
    name: copy.title,
    description: copy.description,
    inLanguage: seoLocale === "ko" ? "ko-KR" : "en",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: orderedPresets.length,
      itemListElement: orderedPresets.map((preset, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: isKorean ? preset.countryKo : preset.country,
        url: localizedUrl(seoLocale, `/origins/${originSlug(preset.country)}`),
      })),
    },
  };

  return (
    <div className="mx-auto max-w-5xl pb-10 md:pb-16">
      <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

      <PageIntro
        testId="origin-index-header"
        eyebrow={t("guide")}
        title={t("indexTitle")}
        meta={(
          <p className="folio-label">
            {t("indexCount", { count: originPresets.length })}
          </p>
        )}
      />

      <nav aria-label={isKorean ? "산지 권역 바로가기" : "Jump to an origin region"} className="-mx-4 mt-5 bg-cream/95 px-4 backdrop-blur-sm md:sticky md:top-[4.45rem] md:z-30 md:-mx-6 md:px-6">
        <ol className="mx-auto flex max-w-5xl flex-wrap gap-x-3 py-1 md:gap-x-6">
          {originGroups.map((group, index) => (
            <li key={group.id} className="shrink-0">
              <a href={`#${group.id}`} className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-brown-light transition-colors hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <span className="font-mono text-[10px] font-normal text-accent">{String(index + 1).padStart(2, "0")}</span>
                {isKorean ? group.label.ko : group.label.en}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-8 space-y-10 md:mt-10 md:space-y-14">
        {originGroups.map((group, groupIndex) => {
          const presets = group.countries.map((country) => presetByCountry.get(country)).filter((preset) => preset !== undefined);

          return (
            <section id={group.id} key={group.id} aria-labelledby={`${group.id}-title`} className="scroll-mt-44 lg:grid lg:grid-cols-[8rem_minmax(0,1fr)] lg:gap-8">
              <header className="mb-2 flex items-end justify-between pb-4 lg:mb-0 lg:block lg:pb-0 lg:pt-5">
                <div>
                  <p className="font-mono text-xs leading-none text-accent">{String(groupIndex + 1).padStart(2, "0")}</p>
                  <h2 id={`${group.id}-title`} className="mt-2 text-xl font-semibold tracking-[-0.02em] text-brown">{isKorean ? group.label.ko : group.label.en}</h2>
                </div>
                <p className="folio-label lg:mt-3">{isKorean ? `${presets.length}개 산지` : `${presets.length} origins`}</p>
              </header>

              <ol className="min-w-0">
                {presets.map((preset, itemIndex) => {
                  const countryName = isKorean ? preset.countryKo : preset.country;
                  const secondaryName = isKorean ? preset.country : preset.countryKo;
                  const signature = isKorean ? preset.signatureKo : preset.signature;
                  const regions = preset.regions.slice(0, 3).map((region) => (isKorean ? region.nameKo : region.name)).join(" · ");

                  return (
                    <li key={preset.country} className="ledger-row">
                      <Link
                        id={`origin-${originSlug(preset.country)}`}
                        href={`/${locale}/origins/${originSlug(preset.country)}`}
                        prefetch={false}
                        aria-label={t("viewCountry", { country: countryName })}
                        data-origin-row
                        className="group -mx-2 grid min-h-24 scroll-mt-32 grid-cols-[1.5rem_minmax(0,1fr)_1rem] gap-x-3 rounded-md px-2 py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent md:scroll-mt-44 md:grid-cols-[2rem_minmax(8rem,0.7fr)_minmax(0,1.3fr)_6.5rem_1rem] md:items-center md:gap-x-4 md:py-5"
                      >
                        <span className="folio-label pt-1 md:pt-0">{String(itemIndex + 1).padStart(2, "0")}</span>
                        <span data-origin-name className="min-w-0">
                          <span className="block text-lg font-semibold tracking-[-0.02em] text-brown transition-colors group-hover:text-accent md:text-xl">{countryName}</span>
                          <span className="mt-0.5 block text-[11px] text-brown-light">{secondaryName}</span>
                        </span>
                        <span data-origin-flavor className="col-start-2 row-start-2 mt-2 min-w-0 text-sm leading-6 text-brown-medium md:col-start-3 md:row-start-1 md:mt-0">
                          {signature}
                          <span className="mt-1 hidden text-xs font-normal text-brown-light md:block">{regions}</span>
                        </span>
                        <span data-origin-altitude className="col-start-2 row-start-3 mt-2 whitespace-nowrap text-xs tabular-nums text-brown-light md:col-start-4 md:row-start-1 md:mt-0 md:text-right">{preset.altitudeRange}</span>
                        <span aria-hidden="true" className="col-start-3 row-start-1 self-center text-xl text-accent transition-transform group-hover:translate-x-1 md:col-start-5">→</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>

      <p className="mt-14 pt-5 text-xs leading-relaxed text-brown-light md:mt-20">{t("disclaimer")}</p>
    </div>
  );
}
