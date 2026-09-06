import { getTranslations } from "next-intl/server";
import { BeanmapMark } from "@/components/brand/beanmap-mark";
import { DocumentLocale } from "@/components/layout/document-locale";
import { buttonClassName } from "@/components/ui/button";
import { resolvePostAuthPath } from "@/lib/security/redirect";

export async function SessionUnavailablePage({
  locale,
  next,
}: {
  locale: "ko" | "en";
  next: string | string[] | undefined;
}) {
  const t = await getTranslations({ locale, namespace: "auth" });
  const resolved = resolvePostAuthPath(next);
  const retryPath = resolved === "/explore" ? `/${locale}/explore` : resolved;

  return (
    <div lang={locale} data-locale={locale} className="flex min-h-dvh flex-col bg-cream">
      <DocumentLocale locale={locale} />
      <header className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
        <a href={`/${locale}`} className="inline-block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <BeanmapMark />
        </a>
      </header>
      <main id="main-content" className="mx-auto w-full max-w-xl px-4 py-12 sm:px-6 sm:py-20">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-brown sm:text-3xl">{t("sessionUnavailableTitle")}</h1>
        <p className="mt-5 text-base leading-7 text-brown-medium">{t("sessionUnavailableDescription")}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {/* A full request rechecks the session instead of reusing this route's cached error. */}
          <a href={retryPath} className={buttonClassName()}>{t("sessionRetry")}</a>
          <a href={`/${locale}`} className={buttonClassName({ variant: "secondary" })}>{t("sessionHome")}</a>
        </div>
      </main>
    </div>
  );
}
