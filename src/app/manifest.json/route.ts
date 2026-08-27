import {
  getBeanmapThemeColor,
  resolveBeanmapTheme,
} from "@/config/theme";

export const dynamic = "force-dynamic";

export function GET() {
  const themeColor = getBeanmapThemeColor(resolveBeanmapTheme());

  return Response.json(
    {
      name: "beanmap",
      short_name: "beanmap",
      description: "My Coffee Bean Journal",
      start_url: "/ko/explore",
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
        "Cache-Control": "no-store",
        "Content-Type": "application/manifest+json; charset=utf-8",
      },
    }
  );
}
