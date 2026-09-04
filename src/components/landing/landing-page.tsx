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
    <div className="min-h-screen overflow-hidden bg-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />

      <header className="relative z-20 border-b border-border bg-cream/95 backdrop-blur-sm">
        <div className="mx-auto flex min-h-[4.5rem] w-full max-w-6xl items-center justify-between gap-3 px-4 py-2 md:px-6">
          <Link
            href={`/${locale}`}
            className="shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <BeanmapMark />
          </Link>
          <nav aria-label={copy.navigation} className="flex min-w-0 items-center justify-end gap-1 sm:gap-2">
            <LocaleSwitcher locale={locale} />
            <Link
              href={`/${locale}/login`}
              className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-brown-light transition-colors hover:text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
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
        <section className="relative border-b border-border">
          <OriginContours className="pointer-events-none absolute -right-56 -top-28 h-[42rem] w-[52rem] opacity-60 md:-right-24 md:-top-16" />
          <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 pb-16 pt-12 md:grid-cols-[minmax(0,1.04fr)_minmax(22rem,0.72fr)] md:items-center md:gap-20 md:px-6 md:pb-24 md:pt-20">
            <div>
              <div className="flex items-center gap-4">
                <p className="journal-kicker">{copy.eyebrow}</p>
                <span aria-hidden="true" className="h-px flex-1 bg-border" />
                <span className="folio-label">EST. 2026</span>
              </div>
              <h1 className="display-title mt-7 max-w-3xl text-7xl tracking-[-0.065em] text-brown md:text-9xl">
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

            <div className="relative mx-auto w-full max-w-[28rem] md:mx-0 md:justify-self-end">
              <div aria-hidden="true" className="absolute -inset-x-3 -bottom-3 top-4 rotate-[1.8deg] border border-border bg-surface-warm" />
              <article className="paper-sheet relative p-5 md:p-7" aria-label={copy.example.ariaLabel}>
                <div className="flex items-start justify-between gap-6 border-b-2 border-brown pb-4">
                  <div>
                    <p className="journal-kicker">{copy.example.label}</p>
                    <p className="folio-label mt-1">ARCHIVE / 001</p>
                  </div>
                  <time dateTime="2026-08-12" className="folio-label">{copy.example.date}</time>
                </div>

                <div className="border-b border-border py-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-brown-light">{copy.example.roaster}</p>
                  <h2 className="mt-2 font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.035em] text-brown">
                    {copy.example.coffee}
                  </h2>
                </div>

                <dl className="grid grid-cols-2 border-b border-border">
                  {copy.example.fields.map(([term, value], index) => (
                    <div key={term} className={`py-4 ${index % 2 === 0 ? "border-r border-border pr-4" : "pl-4"}`}>
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
                  <div className="border-l border-border pl-5 text-right">
                    <p className="folio-label">{copy.example.scoreLabel}</p>
                    <p className="mt-1 font-display text-5xl font-bold tabular-nums leading-none tracking-[-0.06em] text-accent">4.6</p>
                    <p className="folio-label mt-1">/ 5.0</p>
                  </div>
                </div>
              </article>
            </div>
          </div>

          <dl className="relative mx-auto grid w-full max-w-6xl border-t-2 border-brown px-4 md:grid-cols-3 md:px-6">
            {copy.quickFacts.map(([term, description], index) => (
              <div key={term} className="grid grid-cols-[3rem_1fr] gap-3 border-b border-border py-5 last:border-b-0 md:border-b-0 md:border-r md:px-5 md:first:pl-0 md:last:border-r-0 md:last:pr-0">
                <dt className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-accent">
                  {String(index + 1).padStart(2, "0")}<span className="sr-only"> {term}</span>
                </dt>
                <dd>
                  <span className="block text-sm font-bold text-brown">{term}</span>
                  <span className="mt-1 block text-xs leading-5 text-brown-medium">{description}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="bg-surface">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-24">
            <div className="grid gap-5 md:grid-cols-[minmax(0,0.8fr)_minmax(20rem,0.42fr)] md:items-end md:gap-20">
              <div>
                <p className="journal-kicker">{copy.features.eyebrow}</p>
                <h2 className="display-title mt-4 max-w-3xl text-4xl text-brown md:text-6xl">{copy.features.title}</h2>
              </div>
              <p className="border-l-2 border-accent pl-5 text-sm leading-7 text-brown-medium">{copy.features.intro}</p>
            </div>

            <ol className="mt-12 border-t-2 border-brown">
              {copy.features.items.map(([term, description], index) => (
                <li key={term} className="ledger-row group grid gap-3 py-6 md:grid-cols-[5rem_minmax(15rem,0.55fr)_minmax(0,0.8fr)] md:items-baseline md:gap-8 md:py-7">
                  <span className="font-display text-3xl italic text-accent/80">{String(index + 1).padStart(2, "0")}</span>
                  <h3 className="font-display text-xl font-bold tracking-[-0.02em] text-brown md:text-2xl">{term}</h3>
                  <p className="max-w-2xl text-sm leading-7 text-brown-medium">{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="relative border-y border-border bg-surface-warm">
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

            <ol className="border-t-2 border-brown bg-surface/55 px-4 md:px-6">
              {featuredOrigins.map((origin, index) => {
                const countryName = isKorean ? origin.countryKo : origin.country;
                const signature = isKorean ? origin.signatureKo : origin.signature;
                return (
                  <li key={origin.country} className="ledger-row">
                    <Link
                      href={`/${locale}/origins/${originSlug(origin.country)}`}
                      className="group grid min-h-36 grid-cols-[3.25rem_1fr_auto] items-center gap-3 py-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                      aria-label={`${countryName}: ${copy.origins.viewCountry}`}
                    >
                      <span className="font-display text-3xl italic text-accent">{String(index + 1).padStart(2, "0")}</span>
                      <span>
                        <span className="block font-display text-2xl font-bold tracking-[-0.03em] text-brown transition-colors group-hover:text-accent md:text-3xl">{countryName}</span>
                        <span className="mt-2 block max-w-sm text-xs leading-5 text-brown-medium">{signature}</span>
                      </span>
                      <span aria-hidden="true" className="font-display text-3xl text-accent transition-transform group-hover:translate-x-1">→</span>
                    </Link>
                  </li>
                );
              })}
              <li className="py-4 text-right"><span className="folio-label">FIELD NOTES / 20 ORIGINS</span></li>
            </ol>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <div className="grid gap-8 md:grid-cols-[18rem_1fr] md:gap-20">
            <div>
              <p className="journal-kicker">{copy.steps.eyebrow}</p>
              <h2 className="display-title mt-4 text-4xl text-brown md:text-5xl">{copy.steps.title}</h2>
            </div>
            <ol className="border-t-2 border-brown">
              {copy.steps.items.map(([title, description], index) => (
                <li key={title} className="ledger-row grid gap-3 py-6 md:grid-cols-[4rem_13rem_1fr] md:items-baseline md:gap-6">
                  <span className="folio-label">STEP {String(index + 1).padStart(2, "0")}</span>
                  <h3 className="font-display text-xl font-bold text-brown">{title}</h3>
                  <p className="text-sm leading-6 text-brown-medium">{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-y-2 border-brown bg-accent text-cream">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 md:grid-cols-[9rem_1fr_auto] md:items-center md:gap-12 md:px-6 md:py-16">
            <div className="font-display text-7xl italic leading-none text-cream/35">P</div>
            <div>
              <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-cream">{copy.privacy.eyebrow}</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.03em] md:text-4xl">{copy.privacy.title}</h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-cream/85">{copy.privacy.description}</p>
            </div>
            <span className="hidden border border-cream/45 px-3 py-2 font-mono text-[0.6875rem] uppercase tracking-[0.08em] md:block">private by default</span>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <div className="grid gap-10 md:grid-cols-[18rem_1fr] md:gap-20">
            <div>
              <p className="journal-kicker">{copy.faq.eyebrow}</p>
              <h2 className="display-title mt-4 text-4xl text-brown md:text-5xl">{copy.faq.title}</h2>
            </div>
            <ol className="border-t-2 border-brown">
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
