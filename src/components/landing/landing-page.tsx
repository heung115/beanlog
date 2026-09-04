import Link from "next/link";
import { BeanmapMark } from "@/components/brand/beanmap-mark";
import { OriginContours } from "@/components/brand/origin-contours";
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
    <div
      lang={locale}
      data-locale={locale}
      className="min-h-screen overflow-x-clip bg-cream"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />

      <header className="relative z-20 bg-cream/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:min-h-[4.5rem] sm:flex-nowrap sm:px-6 sm:py-2">
          <Link
            href={`/${locale}`}
            className="w-fit shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <BeanmapMark />
          </Link>
          <nav
            aria-label={copy.navigation}
            className="order-2 flex w-full items-center justify-between gap-1 pt-2 sm:order-none sm:w-auto sm:justify-end sm:pt-0"
          >
            <LocaleSwitcher locale={locale} />
            <Link
              href={`/${locale}/login`}
              className="inline-flex min-h-11 items-center whitespace-nowrap rounded-sm px-2 text-sm font-semibold text-brown-light transition-colors hover:bg-surface hover:text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {copy.login}
            </Link>
            <Link
              href={`/${locale}/signup`}
              className={buttonClassName({ size: "sm", className: "whitespace-nowrap" })}
            >
              {copy.signup}
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content">
        <section data-landing-section="hero" className="relative">
          <OriginContours className="pointer-events-none absolute -right-56 -top-28 h-[42rem] w-[52rem] opacity-35 md:-right-24 md:-top-16 md:opacity-60" />
          <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 pb-16 pt-12 md:px-6 md:pb-24 md:pt-20 lg:grid-cols-[minmax(0,1.04fr)_minmax(22rem,0.72fr)] lg:items-center lg:gap-20">
            <div>
              <h1 className="display-title max-w-3xl text-5xl tracking-[-0.05em] text-brown md:text-7xl">
                {copy.title}
              </h1>
              <p className="mt-7 max-w-[39rem] text-base leading-7 text-brown-medium md:text-lg md:leading-8">
                {copy.description}
              </p>

              <div className="mt-9 flex flex-wrap gap-3">
                <Link href={`/${locale}/try`} className={buttonClassName({ size: "lg" })}>
                  {copy.primaryAction}
                </Link>
                <Link href={`/${locale}/signup`} className={buttonClassName({ variant: "secondary", size: "lg" })}>
                  {copy.secondaryAction}
                </Link>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[28rem] lg:mx-0 lg:justify-self-end">
              <div aria-hidden="true" className="absolute -inset-x-3 -bottom-3 top-4 rotate-[1.8deg] rounded-lg bg-surface-warm" />
              <article className="paper-sheet relative p-5 md:p-7" aria-label={copy.example.ariaLabel}>
                <div className="flex items-start justify-between gap-6 border-b border-border-light pb-4">
                  <div>
                    <p className="journal-kicker">{copy.example.label}</p>
                  </div>
                  <time dateTime="2026-08-12" className="folio-label">{copy.example.date}</time>
                </div>

                <div className="border-b border-border-light py-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-brown-light">{copy.example.roaster}</p>
                  <h2 className="mt-2 font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.035em] text-brown">
                    {copy.example.coffee}
                  </h2>
                </div>

                <dl className="grid grid-cols-2 border-b border-border-light">
                  {copy.example.fields.map(([term, value], index) => (
                    <div key={term} className={`py-4 ${index % 2 === 0 ? "border-r border-border-light pr-4" : "pl-4"}`}>
                      <dt className="folio-label">{term}</dt>
                      <dd className="mt-1 text-sm font-semibold text-brown">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="grid grid-cols-[1fr_auto] items-end gap-6 pt-5">
                  <div>
                    <p className="folio-label">{copy.example.tastingNotesLabel}</p>
                    <p className="mt-2 text-sm leading-6 text-brown">{copy.example.tastingNotes}</p>
                  </div>
                  <div className="border-l border-border-light pl-5 text-right">
                    <p className="folio-label">{copy.example.scoreLabel}</p>
                    <p className="data-value mt-1 text-5xl font-bold leading-none tracking-[-0.045em] text-accent">4.6</p>
                    <p className="folio-label mt-1">/ 5.0</p>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section data-landing-section="features" className="bg-surface">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-24">
            <div className="grid gap-5 md:grid-cols-[minmax(0,0.8fr)_minmax(20rem,0.42fr)] md:items-end md:gap-20">
              <div>
                <p className="journal-kicker">{copy.features.eyebrow}</p>
                <h2 className="display-title mt-4 max-w-3xl text-4xl text-brown md:text-6xl">{copy.features.title}</h2>
              </div>
              <p className="border-l border-accent-light pl-5 text-sm leading-7 text-brown-medium">{copy.features.intro}</p>
            </div>

            <ol className="mt-12">
              {copy.features.items.map(([term, description], index) => (
                <li key={term} className="ledger-row group grid gap-3 py-6 md:grid-cols-[5rem_minmax(15rem,0.55fr)_minmax(0,0.8fr)] md:items-baseline md:gap-8 md:py-7">
                  <span className="font-display text-3xl text-accent/80">{String(index + 1).padStart(2, "0")}</span>
                  <h3 className="font-display text-xl font-bold tracking-[-0.02em] text-brown md:text-2xl">{term}</h3>
                  <p className="max-w-2xl text-sm leading-7 text-brown-medium">{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section data-landing-section="origins" className="relative bg-surface-warm">
          <OriginContours className="pointer-events-none absolute -left-52 bottom-[-10rem] h-[40rem] w-[50rem] rotate-180 opacity-35" />
          <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 md:grid-cols-[minmax(19rem,0.6fr)_minmax(0,1fr)] md:gap-20 md:px-6 md:py-24">
            <div className="md:sticky md:top-28 md:self-start">
              <p className="journal-kicker">{copy.origins.eyebrow}</p>
              <h2 className="display-title mt-4 text-4xl text-brown md:text-6xl">{copy.origins.title}</h2>
              <p className="mt-6 max-w-md text-sm leading-7 text-brown-medium">{copy.origins.intro}</p>
              <Link href={`/${locale}/origins`} className={buttonClassName({ variant: "secondary", size: "md", className: "mt-7" })}>
                {copy.origins.viewAll}
              </Link>
            </div>

            <ol className="rounded-lg bg-surface/55 px-4 md:px-6">
              {featuredOrigins.map((origin, index) => {
                const countryName = isKorean ? origin.countryKo : origin.country;
                const signature = isKorean ? origin.signatureKo : origin.signature;
                return (
                  <li key={origin.country} className="ledger-row">
                    <Link
                      href={`/${locale}/origins/${originSlug(origin.country)}`}
                      className="group grid min-h-36 grid-cols-[3.25rem_1fr_auto] items-center gap-3 py-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      aria-label={`${countryName}: ${copy.origins.viewCountry}`}
                    >
                      <span className="font-display text-3xl text-accent">{String(index + 1).padStart(2, "0")}</span>
                      <span>
                        <span className="block font-display text-2xl font-bold tracking-[-0.03em] text-brown transition-colors group-hover:text-accent md:text-3xl">{countryName}</span>
                        <span className="mt-2 block max-w-sm text-xs leading-5 text-brown-medium">{signature}</span>
                      </span>
                      <span aria-hidden="true" className="font-display text-3xl text-accent transition-transform group-hover:translate-x-1">→</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section data-landing-section="steps" className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <div className="grid gap-8 md:grid-cols-[18rem_1fr] md:gap-20">
            <div>
              <p className="journal-kicker">{copy.steps.eyebrow}</p>
              <h2 className="display-title mt-4 text-4xl text-brown md:text-5xl">{copy.steps.title}</h2>
            </div>
            <ol>
              {copy.steps.items.map(([title, description], index) => (
                <li key={title} className="ledger-row grid gap-3 py-6 md:grid-cols-[4rem_13rem_1fr] md:items-baseline md:gap-6">
                  <span className="folio-label">
                    {isKorean ? "단계" : "STEP"} {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-display text-xl font-bold text-brown">{title}</h3>
                  <p className="text-sm leading-6 text-brown-medium">{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section data-landing-section="faq" className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <div className="grid gap-10 md:grid-cols-[18rem_1fr] md:gap-20">
            <div>
              <p className="journal-kicker">{copy.faq.eyebrow}</p>
              <h2 className="display-title mt-4 text-4xl text-brown md:text-5xl">{copy.faq.title}</h2>
            </div>
            <ol>
              {copy.faq.items.map(([question, answer], index) => (
                <li key={question} className="ledger-row grid gap-3 py-6 md:grid-cols-[3rem_minmax(12rem,0.7fr)_minmax(0,1fr)] md:gap-6">
                  <span className="folio-label">Q{String(index + 1).padStart(2, "0")}</span>
                  <h3 className="font-display text-lg font-bold leading-7 text-brown">{question}</h3>
                  <p className="text-sm leading-7 text-brown-medium">{answer}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} wide />
    </div>
  );
}
