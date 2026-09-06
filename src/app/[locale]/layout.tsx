import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { TopBar } from "@/components/layout/top-bar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { Toast } from "@/components/ui/toast";
import { DocumentLocale } from "@/components/layout/document-locale";
import { getCurrentUserIdentity } from "@/lib/actions/profile";
import { buildLocaleDefaultMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "ko" | "en")) {
    notFound();
  }

  return buildLocaleDefaultMetadata(locale);
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "ko" | "en")) {
    notFound();
  }

  const messages = await getMessages();
  const user = await getCurrentUserIdentity();

  return (
    <NextIntlClientProvider messages={messages}>
      <DocumentLocale locale={locale} />
      <div lang={locale} data-locale={locale} className="flex min-h-dvh flex-col">
        <TopBar user={user} />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 scroll-mt-32 px-4 pb-24 pt-5 focus:outline-none sm:scroll-mt-20 md:px-6 md:pb-10 md:pt-8"
        >
          {children}
        </main>
        <SiteFooter
          locale={locale as "ko" | "en"}
          mobileNavOffset={Boolean(user)}
        />
        <BottomNav authenticated={Boolean(user)} />
        <Toast />
      </div>
    </NextIntlClientProvider>
  );
}
