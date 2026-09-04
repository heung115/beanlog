import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { OriginContours } from "@/components/brand/origin-contours";
import {
  findCountryPresetBySlug,
  originSlug,
} from "@/data/origin-presets";
import {
  buildOriginDetailMetadata,
  localizedUrl,
  serializeJsonLd,
  toSeoLocale,
} from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; country: string }>;
}): Promise<Metadata> {
  const { locale, country } = await params;
  const preset = findCountryPresetBySlug(country);

  if (!preset) notFound();

  return buildOriginDetailMetadata(locale, preset, originSlug(preset.country));
}

export default async function OriginDetailPage({
  params,
}: {
  params: Promise<{ locale: string; country: string }>;
}) {
  const { locale, country } = await params;
  const preset = findCountryPresetBySlug(country);

  if (!preset) notFound();

  const t = await getTranslations({ locale, namespace: "origins" });
  const seoLocale = toSeoLocale(locale);
  const isKorean = seoLocale === "ko";
  const countryName = isKorean ? preset.countryKo : preset.country;
  const secondaryCountryName = isKorean ? preset.country : preset.countryKo;
  const signature = isKorean ? preset.signatureKo : preset.signature;
  const flavorNotes = signature.split(",").map((note) => note.trim());
  const canonicalSlug = originSlug(preset.country);
  const pageUrl = localizedUrl(seoLocale, `/origins/${canonicalSlug}`);
  const originsUrl = localizedUrl(seoLocale, "/origins");
  const homeUrl = localizedUrl(seoLocale);
  const pageName = isKorean
    ? `${countryName} 커피 산지 가이드`
    : `${countryName} Coffee Origin Guide`;
  const pageDescription = isKorean
    ? `${countryName} 커피의 대표 향미, 재배 고도, 주요 품종과 생산 지역을 살펴보세요.`
    : `Explore ${countryName} coffee flavor profiles, growing elevations, key varieties, and producing regions.`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        url: pageUrl,
        name: pageName,
        description: pageDescription,
        inLanguage: seoLocale === "ko" ? "ko-KR" : "en",
        breadcrumb: { "@id": `${pageUrl}#breadcrumb` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: isKorean ? "홈" : "Home",
            item: homeUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: isKorean ? "커피 산지 가이드" : "Coffee Origin Guide",
            item: originsUrl,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: countryName,
            item: pageUrl,
          },
        ],
      },
    ],
  };

  return (
    <article className="mx-auto max-w-5xl pb-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <Link
        href={`/${locale}/origins`}
        className="group inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-brown-light transition-colors hover:text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className="transition-transform duration-150 group-hover:-translate-x-0.5"
        >
          <path
            d="M9 2L4 7l5 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {t("indexTitle")}
      </Link>

      <header className="animate-rise relative mt-2 overflow-hidden border-y-2 border-brown px-5 py-10 md:grid md:min-h-80 md:grid-cols-[1fr_18rem] md:items-end md:px-8 md:py-12">
        <OriginContours className="pointer-events-none absolute -right-36 -top-36 h-[34rem] w-[42rem] opacity-55" />
        <div className="relative">
          <p className="journal-kicker">{t("guide")}</p>
          <h1 className="display-title mt-4 text-6xl text-brown md:text-8xl">{countryName}</h1>
          <p className="folio-label mt-2">{secondaryCountryName}</p>
        </div>
        <p className="relative mt-8 border-l-2 border-accent pl-5 text-sm leading-7 text-brown-medium md:mt-0 md:text-base">
          {t("intro", { country: countryName })}
        </p>
      </header>

      <section
        className="paper-sheet animate-rise mt-10 p-5 md:p-8"
        style={{ animationDelay: "60ms" }}
      >
        <div className="flex items-end justify-between gap-4 border-b-2 border-brown pb-4">
          <div>
            <p className="journal-kicker">01 / profile</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-brown">{t("cupProfile")}</h2>
          </div>
          <p className="hidden text-xs text-brown-light sm:block">{t("cupProfileHint")}</p>
        </div>
        <ul className="grid sm:grid-cols-2 md:grid-cols-3" aria-label={t("cupProfile")}>
          {flavorNotes.map((note, index) => (
            <li
              key={note}
              className="grid min-h-24 grid-cols-[2rem_1fr] items-center border-b border-border py-4 text-sm font-semibold text-brown sm:border-r sm:px-4 sm:first:pl-0 sm:nth-[2n]:border-r-0 md:nth-[2n]:border-r md:nth-[3n]:border-r-0"
            >
              <span className="font-display text-xl italic text-accent">{String(index + 1).padStart(2, "0")}</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-brown-light sm:hidden">{t("cupProfileHint")}</p>
      </section>

      <section
        className="animate-rise mt-10 grid border-y-2 border-brown md:grid-cols-[14rem_1fr]"
        style={{ animationDelay: "100ms" }}
      >
        <div className="bg-surface-warm p-5 md:p-7">
          <p className="journal-kicker">02 / terrain</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-brown">{t("growingConditions")}</h2>
        </div>
        <dl className="grid grid-cols-2 border-t border-border md:border-l md:border-t-0">
          <div className="p-5 md:p-7">
            <dt className="folio-label">
              {t("altitude")}
            </dt>
            <dd className="mt-3 font-display text-2xl font-bold tabular-nums text-brown md:text-3xl">
              {preset.altitudeRange}
            </dd>
          </div>
          <div className="border-l border-border p-5 md:p-7">
            <dt className="folio-label">
              {t("keyVarietals")}
            </dt>
            <dd className="mt-3 text-sm font-semibold leading-7 text-brown">
              {preset.keyVarietals.join(" · ")}
            </dd>
          </div>
        </dl>
      </section>

      <section
        className="animate-rise mt-9"
        style={{ animationDelay: "140ms" }}
      >
        <div className="flex items-end justify-between gap-4 border-b-2 border-brown pb-4">
          <div>
            <p className="journal-kicker">03 / regions</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-brown">{t("regions")}</h2>
            <p className="mt-1 text-sm text-brown-light">{t("regionsHint")}</p>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-brown-light">
            {t("regionCount", { count: preset.regions.length })}
          </span>
        </div>
        <ol className="grid md:grid-cols-2">
          {preset.regions.map((region, index) => {
            const regionName = isKorean ? region.nameKo : region.name;
            const secondaryRegionName = isKorean ? region.name : region.nameKo;

            return (
              <li key={region.name} className="ledger-row flex min-h-24 items-center gap-4 py-4 md:px-5 md:nth-[odd]:border-r md:nth-[odd]:pl-0">
                <span className="w-8 shrink-0 font-display text-xl italic tabular-nums text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="text-sm font-semibold text-brown">{regionName}</p>
                  {secondaryRegionName !== regionName && (
                    <p className="mt-0.5 text-xs text-brown-light">
                      {secondaryRegionName}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <aside className="mt-10 border-l-2 border-accent bg-surface-warm p-5 text-sm leading-7 text-brown-light">
        {t("disclaimer")}
      </aside>
    </article>
  );
}
