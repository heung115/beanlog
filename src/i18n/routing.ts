import { defineRouting } from "next-intl/routing";

export const localeCookie = {
  name: "NEXT_LOCALE",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
  path: "/",
} as const;

export const routing = defineRouting({
  locales: ["ko", "en"],
  defaultLocale: "ko",
  localeCookie,
  alternateLinks: false,
});
