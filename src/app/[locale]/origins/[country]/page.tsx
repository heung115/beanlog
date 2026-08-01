import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  findCountryPresetBySlug,
} from "@/data/origin-presets";

export default async function OriginDetailPage({
  params,
}: {
  params: Promise<{ locale: string; country: string }>;
}) {
  const { locale, country } = await params;
  const preset = findCountryPresetBySlug(country);

  if (!preset) notFound();

  const t = await getTranslations({ locale, namespace: "origins" });
  const isKorean = locale === "ko";
  const countryName = isKorean ? preset.countryKo : preset.country;
  const secondaryCountryName = isKorean ? preset.country : preset.countryKo;
  const signature = isKorean ? preset.signatureKo : preset.signature;
  const flavorNotes = signature.split(",").map((note) => note.trim());

  return (
    <article className="mx-auto max-w-2xl pb-8">
      <Link
        href={`/${locale}/explore`}
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
        {t("backToJournal")}
      </Link>

      <header className="animate-rise pb-8 pt-4 md:pb-10 md:pt-7">
        <p className="journal-kicker">{t("guide")}</p>
        <h1 className="mt-2 font-display text-4xl font-bold leading-tight tracking-tight text-brown md:text-5xl">
          {countryName}
        </h1>
        <p className="mt-1 text-base text-brown-light">{secondaryCountryName}</p>
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-brown-medium md:text-base">
          {t("intro", { country: countryName })}
        </p>
      </header>

      <section
        className="journal-panel-feature animate-rise p-5 md:p-7"
        style={{ animationDelay: "60ms" }}
      >
        <h2 className="journal-section-title">{t("cupProfile")}</h2>
        <p className="mt-2 text-sm text-brown-light">{t("cupProfileHint")}</p>
        <ul className="mt-5 flex flex-wrap gap-2" aria-label={t("cupProfile")}>
          {flavorNotes.map((note) => (
            <li
              key={note}
              className="rounded-sm border border-border bg-cream-dark px-3 py-1.5 text-sm font-medium text-brown"
            >
              {note}
            </li>
          ))}
        </ul>
      </section>

      <section
        className="animate-rise mt-8 border-y border-border py-6"
        style={{ animationDelay: "100ms" }}
      >
        <h2 className="journal-section-title">{t("growingConditions")}</h2>
        <dl className="mt-5 grid gap-6 sm:grid-cols-2 sm:gap-8">
          <div>
            <dt className="text-xs font-medium text-brown-light">
              {t("altitude")}
            </dt>
            <dd className="mt-1.5 text-lg font-semibold tabular-nums text-brown">
              {preset.altitudeRange}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-brown-light">
              {t("keyVarietals")}
            </dt>
            <dd className="mt-1.5 text-sm font-medium leading-relaxed text-brown">
              {preset.keyVarietals.join(" · ")}
            </dd>
          </div>
        </dl>
      </section>

      <section
        className="animate-rise mt-9"
        style={{ animationDelay: "140ms" }}
      >
        <div className="flex items-end justify-between gap-4 border-b border-border pb-3">
          <div>
            <h2 className="journal-section-title">{t("regions")}</h2>
            <p className="mt-1 text-sm text-brown-light">{t("regionsHint")}</p>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-brown-light">
            {t("regionCount", { count: preset.regions.length })}
          </span>
        </div>
        <ol className="divide-y divide-border-light">
          {preset.regions.map((region, index) => {
            const regionName = isKorean ? region.nameKo : region.name;
            const secondaryRegionName = isKorean ? region.name : region.nameKo;

            return (
              <li key={region.name} className="flex items-center gap-4 py-4">
                <span className="w-6 shrink-0 text-xs tabular-nums text-brown-light">
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

      <aside className="journal-panel-quiet mt-9 p-4 text-sm leading-relaxed text-brown-light">
        {t("disclaimer")}
      </aside>
    </article>
  );
}
