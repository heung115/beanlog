import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { OriginContours } from "@/components/brand/origin-contours";
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
    <div className="pb-10 md:pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

      <header className="animate-rise relative overflow-hidden border-y-2 border-brown md:grid md:min-h-[24rem] md:grid-cols-[minmax(0,1fr)_18rem]">
        <OriginContours className="pointer-events-none absolute -right-36 -top-28 h-[36rem] w-[44rem] opacity-55" />
        <div className="relative py-12 md:flex md:flex-col md:justify-between md:py-14 md:pr-14">
          <div>
            <p className="journal-kicker">{t("guide")}</p>
            <h1 className="display-title mt-4 max-w-3xl text-5xl text-brown md:text-7xl">{t("indexTitle")}</h1>
          </div>
          <p className="mt-8 max-w-xl text-sm leading-7 text-brown-medium md:text-base">{t("indexIntro")}</p>
        </div>

        <aside className="relative grid grid-cols-2 border-t border-brown bg-surface/65 md:block md:border-l md:border-t-0">
          <div className="p-6 md:p-8">
            <p className="folio-label">{t("indexCount", { count: originPresets.length })}</p>
            <p className="mt-4 font-display text-6xl font-bold tabular-nums tracking-[-0.06em] text-brown">{originPresets.length}</p>
          </div>
          <div className="border-l border-border p-6 md:border-l-0 md:border-t md:p-8">
            <p className="folio-label">{isKorean ? "탐색 권역" : "Regions"}</p>
            <p className="mt-4 font-display text-6xl font-bold tabular-nums tracking-[-0.06em] text-accent">{originGroups.length}</p>
          </div>
        </aside>
      </header>

      <nav aria-label={isKorean ? "산지 권역 바로가기" : "Jump to an origin region"} className="-mx-4 border-b border-border bg-cream/95 px-4 backdrop-blur-sm md:sticky md:top-[4.45rem] md:z-30 md:-mx-6 md:px-6">
        <ol className="mx-auto flex max-w-6xl overflow-x-auto py-1">
          {originGroups.map((group, index) => (
            <li key={group.id} className="shrink-0">
              <a href={`#${group.id}`} className="inline-flex min-h-11 items-center gap-2 px-3 text-xs font-semibold text-brown-light transition-colors first:pl-0 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 md:px-5">
                <span className="font-mono text-[10px] font-normal text-accent">{String(index + 1).padStart(2, "0")}</span>
                {isKorean ? group.label.ko : group.label.en}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-12 space-y-16 md:mt-20 md:space-y-24">
        {originGroups.map((group, groupIndex) => {
          const presets = group.countries.map((country) => presetByCountry.get(country)).filter((preset) => preset !== undefined);

          return (
            <section id={group.id} key={group.id} aria-labelledby={`${group.id}-title`} className="scroll-mt-44 md:grid md:grid-cols-[12rem_minmax(0,1fr)] md:gap-12">
              <header className="mb-5 flex items-end justify-between border-b border-border pb-4 md:mb-0 md:block md:border-b-0 md:pb-0">
                <div>
                  <p className="font-display text-4xl italic leading-none text-accent/75">{String(groupIndex + 1).padStart(2, "0")}</p>
                  <h2 id={`${group.id}-title`} className="mt-3 font-display text-2xl font-bold tracking-[-0.03em] text-brown">{isKorean ? group.label.ko : group.label.en}</h2>
                </div>
                <p className="folio-label md:mt-4">{isKorean ? `${presets.length}개 산지` : `${presets.length} origins`}</p>
              </header>

              <ol className="border-t-2 border-brown">
                {presets.map((preset, itemIndex) => {
                  const countryName = isKorean ? preset.countryKo : preset.country;
                  const secondaryName = isKorean ? preset.country : preset.countryKo;
                  const signature = isKorean ? preset.signatureKo : preset.signature;
                  const regions = preset.regions.slice(0, 3).map((region) => (isKorean ? region.nameKo : region.name)).join(" · ");

                  return (
                    <li key={preset.country} className="ledger-row">
                      <Link
                        href={`/${locale}/origins/${originSlug(preset.country)}`}
                        aria-label={t("viewCountry", { country: countryName })}
                        className="group -mx-2 grid min-h-28 grid-cols-[2.25rem_minmax(0,1fr)_auto] gap-x-3 px-2 py-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 md:min-h-32 md:grid-cols-[2.5rem_minmax(9rem,0.56fr)_minmax(13rem,1fr)_7rem_2rem] md:items-center md:gap-x-6 md:py-6"
                      >
                        <span className="folio-label pt-1 md:pt-0">{String(itemIndex + 1).padStart(2, "0")}</span>
                        <span>
                          <span className="block font-display text-2xl font-bold tracking-[-0.03em] text-brown transition-colors group-hover:text-accent">{countryName}</span>
                          <span className="mt-0.5 block text-[11px] text-brown-light">{secondaryName}</span>
                        </span>
                        <span className="whitespace-nowrap pt-1 font-mono text-[10px] text-brown-light md:order-none md:pt-0 md:text-right">{preset.altitudeRange}</span>
                        <span className="col-start-2 col-end-4 mt-3 text-[13px] font-semibold leading-5 text-brown md:col-auto md:mt-0 md:text-sm md:leading-6">
                          {signature}
                          <span className="mt-1 hidden font-normal text-brown-light md:block">{regions}</span>
                        </span>
                        <span aria-hidden="true" className="hidden font-display text-2xl text-accent transition-transform group-hover:translate-x-1 md:block">→</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>

      <p className="mt-14 border-t border-border pt-5 text-xs leading-relaxed text-brown-light md:mt-20">{t("disclaimer")}</p>
    </div>
  );
}
