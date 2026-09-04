import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { getLocale } from "next-intl/server";
import {
  getBeanmapThemeColor,
  resolveBeanmapTheme,
} from "@/config/theme";
import {
  absoluteUrl,
  SEO_COPY,
  SITE_NAME,
  SITE_ORIGIN,
  SOCIAL_IMAGE_PATH,
} from "@/lib/seo";
import "./globals.css";

const suit = localFont({
  src: "../../node_modules/@sun-typeface/suit/fonts/variable/woff2/SUIT-Variable.woff2",
  variable: "--font-suit",
  display: "swap",
  weight: "100 900",
  style: "normal",
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: "beanmap — Coffee Journal & Origin Guide",
  description: SEO_COPY.en.landing.description,
  applicationName: SITE_NAME,
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "IaVBdTqfqd7YNbvHygd08rET0JQyOWA2Yol-7gtkdFs",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "beanmap — Coffee Journal & Origin Guide",
    description: SEO_COPY.en.landing.description,
    url: absoluteUrl("/"),
    images: [
      {
        url: absoluteUrl(SOCIAL_IMAGE_PATH),
        width: 1200,
        height: 630,
        alt: SEO_COPY.en.imageAlt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "beanmap — Coffee Journal & Origin Guide",
    description: SEO_COPY.en.landing.description,
    images: [
      {
        url: absoluteUrl(SOCIAL_IMAGE_PATH),
        alt: SEO_COPY.en.imageAlt,
      },
    ],
  },
};

export function generateViewport(): Viewport {
  const theme = resolveBeanmapTheme();

  return {
    themeColor: getBeanmapThemeColor(theme),
    width: "device-width",
    initialScale: 1,
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const theme = resolveBeanmapTheme();

  return (
    <html
      lang={locale}
      className={suit.variable}
      data-beanmap-theme={theme}
      data-scroll-behavior="smooth"
    >
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-screen bg-cream">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-sm focus:bg-brown focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-cream focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Skip to main content / 본문으로 바로가기
        </a>
        {children}
      </body>
    </html>
  );
}
