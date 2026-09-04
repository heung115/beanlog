import {
  getBeanmapThemeColor,
  resolveBeanmapTheme,
} from "@/config/theme";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const themeColor = getBeanmapThemeColor(resolveBeanmapTheme());
  const locale = new URL(request.url).searchParams.get("lang") === "en" ? "en" : "ko";
  const description =
    locale === "en"
      ? "A coffee bean journal with tasting notes and origin guides"
      : "커피 원두와 테이스팅 노트, 산지 정보를 기록하는 서비스";

  return Response.json(
    {
      name: "beanmap",
      short_name: "beanmap",
      description,
      lang: locale,
      start_url: `/${locale}/explore`,
      display: "standalone",
      background_color: themeColor,
      theme_color: themeColor,
      icons: [
        {
          src: "/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/icon-512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "Content-Type": "application/manifest+json; charset=utf-8",
      },
    }
  );
}
