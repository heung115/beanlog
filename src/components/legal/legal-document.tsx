import Link from "next/link";

export function LegalDocument({
  locale,
  title,
  description,
  effectiveDate,
  children,
}: {
  locale: "ko" | "en";
  title: string;
  description: string;
  effectiveDate: string;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-5xl pb-12 pt-4 md:pb-16 md:pt-8">
      <Link
        href={`/${locale}`}
        className="inline-flex min-h-11 items-center text-sm font-medium text-brown-light transition-colors hover:text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        ← {locale === "ko" ? "홈으로" : "Back to home"}
      </Link>

      <header className="mt-4 py-6 md:grid md:grid-cols-[1fr_15rem] md:items-end md:py-8">
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.03em] text-brown md:text-4xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-brown-light">{description}</p>
        </div>
        <p className="folio-label mt-5 md:mt-0 md:text-right">
          {locale === "ko" ? "시행일" : "Effective"}: {effectiveDate}
        </p>
      </header>

      <div className="legal-copy mt-6 text-sm leading-7 text-brown md:mt-8">
        {children}
      </div>
    </article>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid py-8 md:grid-cols-[15rem_1fr] md:gap-10 md:py-10">
      <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-brown md:text-2xl">{title}</h2>
      <div className="min-w-0 mt-4 space-y-3 text-brown-light md:mt-0">{children}</div>
    </section>
  );
}

export function LegalContact({
  locale,
  operatorName,
  contactEmail,
}: {
  locale: "ko" | "en";
  operatorName: string;
  contactEmail: string;
}) {
  return (
    <dl className="grid gap-3 sm:grid-cols-[9rem_1fr]">
      <dt className="font-semibold text-brown">{locale === "ko" ? "담당" : "Contact"}</dt>
      <dd>{operatorName}</dd>
      {contactEmail ? (
        <>
          <dt className="font-semibold text-brown">{locale === "ko" ? "이메일" : "Email"}</dt>
          <dd>
          <a className="font-medium text-accent underline underline-offset-4" href={`mailto:${contactEmail}`}>
            {contactEmail}
          </a>
          </dd>
        </>
      ) : null}
    </dl>
  );
}
