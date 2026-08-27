import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonClassName } from "@/components/ui/button";
import { brand } from "@/config/brand";

type CheckEmailPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ draft?: string }>;
};

export async function generateMetadata({
  params,
}: Pick<CheckEmailPageProps, "params">): Promise<Metadata> {
  const { locale } = await params;

  return locale === "en"
    ? {
        title: "Check your email | beanmap",
        description: "Confirm your email address to finish creating your beanmap account.",
      }
    : {
        title: "이메일 인증 안내 | beanmap",
        description: "이메일 주소를 인증하고 beanmap 회원가입을 완료하세요.",
      };
}

export default async function CheckEmailPage({
  params,
  searchParams,
}: CheckEmailPageProps) {
  const { locale: rawLocale } = await params;
  const { draft } = await searchParams;
  const locale = rawLocale === "en" ? "en" : "ko";
  const t = await getTranslations({ locale, namespace: "auth" });
  const loginHref = `/${locale}/login${draft === "1" ? "?draft=1" : ""}`;

  return (
    <section className="flex min-h-[80vh] items-center justify-center py-10 text-center">
      <div className="w-full max-w-md">
        <p className="journal-kicker mb-4">{brand.name}</p>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface text-brown">
          <MailIcon className="h-6 w-6" />
        </div>

        <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-brown">
          {t("checkEmailTitle")}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-brown-light">
          {t("checkEmailDescription")}
        </p>

        <ol className="mt-8 border-y border-border py-5 text-left text-sm leading-6 text-brown-light">
          <li className="flex gap-3">
            <span className="font-semibold text-brown">1</span>
            <span>{t("checkEmailStepInbox")}</span>
          </li>
          <li className="mt-3 flex gap-3">
            <span className="font-semibold text-brown">2</span>
            <span>{t("checkEmailStepConfirm")}</span>
          </li>
          <li className="mt-3 flex gap-3">
            <span className="font-semibold text-brown">3</span>
            <span>{t("checkEmailStepLogin")}</span>
          </li>
        </ol>

        <div className="mt-5 text-sm leading-6 text-brown-light">
          <p className="font-semibold text-brown">{t("checkEmailMissingTitle")}</p>
          <p>{t("checkEmailMissingDescription")}</p>
        </div>

        <Link
          href={loginHref}
          className={buttonClassName({ variant: "secondary", className: "mt-7" })}
        >
          {t("checkEmailGoLogin")}
        </Link>
      </div>
    </section>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}
