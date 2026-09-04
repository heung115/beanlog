import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
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
    <article className="mx-auto max-w-4xl pb-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <Link
        href={`/${locale}/origins`}
        className="group inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-brown-light transition-colors hover:text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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

      <header data-testid="origin-detail-header" className="animate-rise mt-2 py-4 md:py-6">
        <p className="journal-kicker">{t("guide")}</p>
        <h1 className="mt-2 max-w-full break-words text-3xl font-semibold leading-tight tracking-[-0.03em] text-brown md:text-4xl">
          {countryName}
        </h1>
        <p className="mt-1 text-xs text-brown-light">{secondaryCountryName}</p>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-brown-medium md:text-base md:leading-7">
          {t("intro", { country: countryName })}
        </p>
      </header>

      <section
        data-testid="origin-profile"
        className="animate-rise mt-8"
        style={{ animationDelay: "60ms" }}
      >
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-[-0.015em] text-brown">{t("cupProfile")}</h2>
          <p className="hidden text-xs text-brown-light sm:block">{t("cupProfileHint")}</p>
        </div>
        <ul className="mt-5 flex flex-wrap gap-x-8 gap-y-3" aria-label={t("cupProfile")}>
          {flavorNotes.map((note, index) => (
            <li
              key={note}
              className="inline-flex min-h-8 items-center gap-2 text-sm font-semibold text-brown"
            >
              <span className="font-mono text-xs font-normal text-accent">{String(index + 1).padStart(2, "0")}</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-brown-light sm:hidden">{t("cupProfileHint")}</p>
      </section>

      <section
        data-testid="origin-growing-info"
        className="animate-rise mt-10"
        style={{ animationDelay: "100ms" }}
      >
        <h2 className="text-lg font-semibold tracking-[-0.015em] text-brown">{t("growingConditions")}</h2>
        <dl className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-10">
          <div>
            <dt className="folio-label">
              {t("altitude")}
            </dt>
            <dd className="mt-2 text-xl font-semibold tabular-nums text-brown md:text-2xl">
              {preset.altitudeRange}
            </dd>
          </div>
          <div>
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
        <div className="flex items-end justify-between gap-4 pb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.015em] text-brown">{t("regions")}</h2>
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
              <li key={region.name} className="ledger-row flex min-h-20 items-center gap-4 py-4 md:px-5 md:nth-[odd]:pl-0">
                <span className="w-8 shrink-0 font-mono text-xs tabular-nums text-accent">
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

      <aside className="mt-10 max-w-2xl text-xs leading-6 text-brown-light">
        {t("disclaimer")}
      </aside>
    </article>
  );
}
