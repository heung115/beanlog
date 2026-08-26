import Link from "next/link";

export function LegalDocument({
  locale,
  eyebrow,
  title,
  description,
  effectiveDate,
  children,
}: {
  locale: "ko" | "en";
  eyebrow: string;
  title: string;
  description: string;
  effectiveDate: string;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl pb-12 pt-4 md:pb-16 md:pt-8">
      <Link
        href={`/${locale}/login`}
        className="inline-flex min-h-11 items-center text-sm font-medium text-brown-light transition-colors hover:text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        ← {locale === "ko" ? "로그인으로" : "Back to login"}
      </Link>

      <header className="mt-7 border-b border-border pb-8">
        <p className="journal-kicker uppercase tracking-[0.14em]">{eyebrow}</p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-brown md:text-4xl">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-brown-light">{description}</p>
        <p className="mt-4 text-xs text-brown-light">
          {locale === "ko" ? "시행일" : "Effective"}: {effectiveDate}
        </p>
      </header>

      <div className="legal-copy mt-9 space-y-10 text-sm leading-7 text-brown">
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
    <section>
      <h2 className="font-display text-xl font-bold tracking-tight text-brown">{title}</h2>
      <div className="mt-3 space-y-3 text-brown-light">{children}</div>
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
    <dl className="grid gap-3 border-l-2 border-accent-light pl-4 sm:grid-cols-[9rem_1fr]">
      <dt className="font-semibold text-brown">{locale === "ko" ? "담당" : "Contact"}</dt>
      <dd>{operatorName}</dd>
      <dt className="font-semibold text-brown">{locale === "ko" ? "이메일" : "Email"}</dt>
      <dd>
        {contactEmail ? (
          <a className="font-medium text-accent underline underline-offset-4" href={`mailto:${contactEmail}`}>
            {contactEmail}
          </a>
        ) : (
          <span className="font-medium text-red-700">
            {locale === "ko"
              ? "운영 배포 전 LEGAL_CONTACT_EMAIL 설정 필요"
              : "Set LEGAL_CONTACT_EMAIL before production deployment"}
          </span>
        )}
      </dd>
    </dl>
  );
}
