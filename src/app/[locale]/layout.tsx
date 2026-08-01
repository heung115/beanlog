import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { TopBar } from "@/components/layout/top-bar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Toast } from "@/components/ui/toast";
import { getCurrentUserIdentity } from "@/lib/actions/profile";
import designTokens from "@/config/design-tokens.json";
import "../globals.css";

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
    <html lang={locale}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content={designTokens.colors.cream} />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-screen bg-cream">
        <NextIntlClientProvider messages={messages}>
          <TopBar user={user} />
          <main className="mx-auto max-w-4xl px-4 pb-24 pt-4 md:px-6 md:pb-8">
            {children}
          </main>
          <BottomNav />
          <Toast />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
