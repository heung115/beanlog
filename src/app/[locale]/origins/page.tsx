import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { originPresets, originSlug } from "@/data/origin-presets";
import {
  buildOriginIndexMetadata,
  localizedUrl,
  SEO_COPY,
  serializeJsonLd,
  toSeoLocale,
} from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  return buildOriginIndexMetadata(locale);
}

export default async function OriginsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "origins" });
  const seoLocale = toSeoLocale(locale);
  const isKorean = seoLocale === "ko";
  const copy = SEO_COPY[seoLocale].origins;
  const collectionUrl = localizedUrl(seoLocale, "/origins");
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
      numberOfItems: originPresets.length,
      itemListElement: originPresets.map((preset, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: isKorean ? preset.countryKo : preset.country,
        url: localizedUrl(
          seoLocale,
          `/origins/${originSlug(preset.country)}`
        ),
      })),
    },
  };

  return (
    <div className="pb-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <header className="animate-rise border-b border-border pb-7 pt-3 md:pb-9 md:pt-7">
        <p className="journal-kicker">{t("guide")}</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-brown md:text-4xl">
              {t("indexTitle")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brown-medium md:text-base">
              {t("indexIntro")}
            </p>
          </div>
          <p className="shrink-0 text-xs tabular-nums text-brown-light">
            {t("indexCount", { count: originPresets.length })}
          </p>
        </div>
      </header>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 md:mt-8 md:gap-5">
        {originPresets.map((preset, index) => {
          const countryName = isKorean ? preset.countryKo : preset.country;
          const secondaryName = isKorean ? preset.country : preset.countryKo;
          const signature = isKorean ? preset.signatureKo : preset.signature;
          const regions = preset.regions
            .slice(0, 3)
            .map((region) => (isKorean ? region.nameKo : region.name))
            .join(" · ");

          return (
            <li key={preset.country}>
              <Link
                href={`/${locale}/origins/${originSlug(preset.country)}`}
                aria-label={t("viewCountry", { country: countryName })}
                className="group flex h-full min-h-64 flex-col rounded-sm border border-border bg-surface px-5 py-5 transition-colors hover:border-accent hover:bg-surface-warm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 md:px-6 md:py-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] tabular-nums text-brown-light">
                      {String(index + 1).padStart(2, "0")}
                    </p>
                    <h2 className="mt-2 font-display text-xl font-bold text-brown transition-colors group-hover:text-accent">
                      {countryName}
                    </h2>
                    <p className="mt-0.5 text-xs text-brown-light">{secondaryName}</p>
                  </div>
                  <span className="text-xs tabular-nums text-brown-light">
                    {preset.altitudeRange}
                  </span>
                </div>

                <p className="mt-6 text-sm font-medium leading-6 text-brown">
                  {signature}
                </p>
                <div className="mt-6">
                  <p className="text-[11px] font-medium text-brown-light">
                    {t("regions")}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-brown-medium">
                    {regions}
                  </p>
                </div>

                <span className="mt-auto flex items-center justify-between pt-7 text-xs font-semibold text-accent">
                  {t("viewCountry", { country: countryName })}
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5 2.5L9.5 7 5 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 text-xs leading-relaxed text-brown-light">
        {t("disclaimer")}
      </p>
    </div>
  );
}
