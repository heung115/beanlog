import Link from "next/link";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { SiteFooter } from "@/components/layout/site-footer";
import { buttonClassName } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { landingCopy, type LandingLocale } from "@/content/landing";
import { originPresets, originSlug } from "@/data/origin-presets";
import { localizedUrl, serializeJsonLd } from "@/lib/seo";

const featuredOrigins = originPresets.slice(0, 3);

export function LandingPage({ locale }: { locale: LandingLocale }) {
  const copy = landingCopy[locale];
  const isKorean = locale === "ko";
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: brand.name,
    url: localizedUrl(locale),
    description: copy.description,
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Any",
    inLanguage: isKorean ? "ko-KR" : "en",
    featureList: copy.features.items.map(([feature]) => feature),
  };

  return (
    <div className="min-h-screen bg-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <header className="border-b border-border">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 py-2 md:px-6">
          <Link
            href={`/${locale}`}
            className="shrink-0 font-display text-xl font-bold tracking-[-0.03em] text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {brand.name}
          </Link>
          <nav
            aria-label={copy.navigation}
            className="flex min-w-0 items-center justify-end gap-1 sm:gap-2"
          >
            <LocaleSwitcher locale={locale} />
            <Link
              href={`/${locale}/login`}
              className="inline-flex min-h-11 items-center px-1.5 text-sm font-medium text-brown-light transition-colors hover:text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:px-2"
            >
              {copy.login}
            </Link>
            <Link href={`/${locale}/signup`} className={buttonClassName({ size: "sm" })}>
              {copy.signup}
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content">
        <section className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-14 md:grid-cols-[minmax(0,0.95fr)_minmax(24rem,0.78fr)] md:items-center md:gap-20 md:px-6 md:py-24">
          <div>
            <p className="journal-kicker">{copy.eyebrow}</p>
            <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-[1.04] tracking-[-0.045em] text-brown md:text-6xl">
              {copy.title}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-brown-medium md:text-lg md:leading-8">
              {copy.description}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={`/${locale}/try`} className={buttonClassName({ size: "lg" })}>
                {copy.primaryAction}
              </Link>
              <Link
                href={`/${locale}/signup`}
                className={buttonClassName({ variant: "secondary", size: "lg" })}
              >
                {copy.secondaryAction}
              </Link>
            </div>

            <dl className="mt-10 border-t-2 border-brown">
              {copy.quickFacts.map(([term, description]) => (
                <div
                  key={term}
                  className="grid grid-cols-[4.5rem_1fr] border-b border-border py-4 text-sm md:grid-cols-[5.5rem_1fr]"
                >
                  <dt className="text-brown-light">{term}</dt>
                  <dd className="font-medium leading-6 text-brown">{description}</dd>
                </div>
              ))}
            </dl>
          </div>

          <article
            className="journal-panel-feature bg-surface p-5 md:p-7"
            aria-label={copy.example.ariaLabel}
          >
            <div className="flex items-center justify-between border-b border-border pb-4 text-xs text-brown-light">
              <span className="font-semibold text-accent">{copy.example.label}</span>
              <time dateTime="2026-08-12">{copy.example.date}</time>
            </div>

            <div className="border-b border-border py-6">
              <p className="text-xs font-medium text-brown-light">{copy.example.roaster}</p>
              <h2 className="mt-2 font-display text-2xl font-bold leading-tight tracking-[-0.025em] text-brown">
                {copy.example.coffee}
              </h2>
            </div>

            <dl className="grid grid-cols-2 border-b border-border">
              {copy.example.fields.map(([term, value], index) => (
                <div
                  key={term}
                  className={`py-4 ${index % 2 === 0 ? "border-r border-border pr-4" : "pl-4"}`}
                >
                  <dt className="text-xs text-brown-light">{term}</dt>
                  <dd className="mt-1 text-sm font-medium text-brown">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="flex items-end justify-between gap-6 pt-5">
              <div>
                <p className="text-xs text-brown-light">{copy.example.tastingNotesLabel}</p>
                <p className="mt-2 text-sm leading-6 text-brown">
                  {copy.example.tastingNotes}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-brown-light">{copy.example.scoreLabel}</p>
                <p className="mt-1 font-display text-3xl font-bold tabular-nums tracking-tight text-accent">
                  4.6
                </p>
              </div>
            </div>
          </article>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 md:px-6 md:py-20">
            <p className="journal-kicker">{copy.features.eyebrow}</p>
            <div className="mt-2 grid gap-4 md:grid-cols-[minmax(0,0.7fr)_minmax(22rem,0.55fr)] md:items-end md:gap-16">
              <h2 className="font-display text-3xl font-bold tracking-[-0.035em] text-brown md:text-4xl">
                {copy.features.title}
              </h2>
              <p className="text-sm leading-7 text-brown-medium">{copy.features.intro}</p>
            </div>
            <dl className="mt-10 border-t-2 border-brown">
              {copy.features.items.map(([term, description]) => (
                <div
                  key={term}
                  className="grid gap-2 border-b border-border py-5 text-sm md:grid-cols-[15rem_1fr] md:gap-10"
                >
                  <dt className="font-semibold text-brown">{term}</dt>
                  <dd className="leading-6 text-brown-medium">{description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 md:grid-cols-[minmax(18rem,0.55fr)_minmax(0,1fr)] md:gap-20 md:px-6 md:py-20">
          <div>
            <p className="journal-kicker">{copy.origins.eyebrow}</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.035em] text-brown md:text-4xl">
              {copy.origins.title}
            </h2>
            <p className="mt-5 text-sm leading-7 text-brown-medium">{copy.origins.intro}</p>
            <Link
              href={`/${locale}/origins`}
              className="mt-6 inline-flex min-h-11 items-center font-semibold text-accent underline decoration-accent-light underline-offset-4 transition-colors hover:text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              {copy.origins.viewAll}
            </Link>
          </div>

          <ol className="border-t-2 border-brown">
            {featuredOrigins.map((origin, index) => {
              const countryName = isKorean ? origin.countryKo : origin.country;
              const signature = isKorean ? origin.signatureKo : origin.signature;

              return (
                <li key={origin.country} className="border-b border-border">
                  <Link
                    href={`/${locale}/origins/${originSlug(origin.country)}`}
                    className="group grid min-h-28 grid-cols-[2.5rem_1fr_auto] items-center gap-3 py-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    aria-label={`${countryName}: ${copy.origins.viewCountry}`}
                  >
                    <span className="text-xs tabular-nums text-brown-light">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <span className="block font-display text-xl font-bold text-brown transition-colors group-hover:text-accent">
                        {countryName}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-brown-medium">
                        {signature}
                      </span>
                    </span>
                    <svg
                      aria-hidden="true"
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="text-accent transition-transform group-hover:translate-x-1"
                    >
                      <path d="m6 3 5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="border-y border-border bg-surface-warm">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 md:px-6 md:py-20">
            <p className="journal-kicker">{copy.steps.eyebrow}</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.035em] text-brown md:text-4xl">
              {copy.steps.title}
            </h2>
            <ol className="mt-8 grid border-y border-border md:grid-cols-3">
              {copy.steps.items.map(([title, description], index) => (
                <li
                  key={title}
                  className="border-b border-border py-6 last:border-b-0 md:border-b-0 md:border-r md:px-6 md:last:border-r-0"
                >
                  <span className="text-xs font-semibold tabular-nums text-accent">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 font-semibold text-brown">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-brown-medium">{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-brown text-cream">
          <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-12 md:grid-cols-[12rem_1fr] md:gap-12 md:px-6 md:py-16">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cream/65">
              {copy.privacy.eyebrow}
            </p>
            <div>
              <h2 className="font-display text-2xl font-bold tracking-[-0.025em] md:text-3xl">
                {copy.privacy.title}
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-cream/75">
                {copy.privacy.description}
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-4xl px-4 py-14 md:px-6 md:py-20">
          <p className="journal-kicker">{copy.faq.eyebrow}</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.035em] text-brown md:text-4xl">
            {copy.faq.title}
          </h2>
          <div className="mt-8 border-t-2 border-brown">
            {copy.faq.items.map(([question, answer]) => (
              <details key={question} className="group border-b border-border py-1">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-3 font-semibold text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 [&::-webkit-details-marker]:hidden">
                  {question}
                  <span aria-hidden="true" className="text-xl font-normal text-accent group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="max-w-2xl pb-5 pr-8 text-sm leading-7 text-brown-medium">{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} wide />
    </div>
  );
}
