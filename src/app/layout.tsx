import type { Metadata, Viewport } from "next";
import { getLocale } from "next-intl/server";
import {
  getBeanmapThemeColor,
  resolveBeanmapTheme,
} from "@/config/theme";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "beanmap",
  description: "마신 커피의 원두 정보와 테이스팅 노트를 기록하고 취향을 확인하는 개인 커피 기록장",
  manifest: "/manifest.json",
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
    <html lang={locale} data-beanmap-theme={theme}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-screen bg-cream">{children}</body>
    </html>
  );
}
