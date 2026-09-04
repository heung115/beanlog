"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { buttonClassName } from "@/components/ui/button";
import { BeanmapMark } from "@/components/brand/beanmap-mark";
import { LocaleSwitcher } from "./locale-switcher";

interface TopBarProps {
  user: { displayName: string } | null;
}

export function TopBar({ user }: TopBarProps) {
  const pathname = usePathname();
  const locale = useLocale() as "ko" | "en";
  const appPathname = pathname.replace(/^\/(ko|en)(?=\/|$)/, "") || "/";
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");

  if (appPathname === "/signup/check-email") {
    return null;
  }

  if (!user) {
    return (
      <header className="sticky top-0 z-40 bg-cream/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:min-h-[4.5rem] sm:flex-nowrap sm:px-6 sm:py-2">
          <Link
            href={`/${locale}`}
            className="w-fit focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <BeanmapMark />
          </Link>
          <nav
            aria-label={t("publicNavigation")}
            className="order-2 flex w-full items-center justify-between gap-1 pt-2 sm:order-none sm:w-auto sm:justify-end sm:pt-0"
          >
            <Link
              href={`/${locale}/origins`}
              aria-current={appPathname.startsWith("/origins") ? "page" : undefined}
              className="inline-flex min-h-11 items-center rounded-sm px-1.5 text-xs font-semibold text-brown-light transition-colors hover:bg-surface hover:text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:px-2 sm:text-sm"
            >
              {t("origins")}
            </Link>
            <LocaleSwitcher locale={locale} />
            <Link
              href={`/${locale}/login`}
              className="inline-flex min-h-11 items-center whitespace-nowrap rounded-sm px-1.5 text-xs font-semibold text-brown-light transition-colors hover:bg-surface hover:text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:px-2 sm:text-sm"
            >
              {tAuth("login")}
            </Link>
            <Link
              href={`/${locale}/signup`}
              className={buttonClassName({ size: "sm", className: "whitespace-nowrap" })}
            >
              {tAuth("signup")}
            </Link>
          </nav>
        </div>
      </header>
    );
  }

  if (/^\/(?:login|signup(?:\/check-email)?|privacy|terms|try)\/?$/.test(appPathname)) {
    return null;
  }

  const links = [
    { href: "/explore", label: t("explore"), prefetch: false },
    { href: "/beans/new", label: t("add"), prefetch: false },
    { href: "/origins", label: t("origins") },
    { href: "/stats", label: t("stats"), prefetch: false },
    { href: "/settings", label: t("settings"), prefetch: false },
  ];

  return (
    <header className="sticky top-0 z-40 hidden bg-cream/95 backdrop-blur-sm md:block">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link
          href={`/${locale}/explore`}
          prefetch={false}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <BeanmapMark compact />
        </Link>
        <nav className="flex items-center gap-1">
          {links.map(({ href, label, prefetch }, index) => {
            const isActive = appPathname === href || appPathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={`/${locale}${href}`}
                prefetch={prefetch}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group relative rounded-sm px-3 py-2 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-surface-warm text-brown"
                    : "text-brown-light hover:bg-surface/80 hover:text-brown"
                )}
              >
                <span aria-hidden="true" className="mr-1 font-mono text-[10px] font-semibold text-brown-light">{String(index + 1).padStart(2, "0")}</span>
                {label}
              </Link>
            );
          })}
          <div className="ml-3">
            <Link
              href={`/${locale}/settings`}
              prefetch={false}
              aria-label={`${t("account")}: ${user.displayName}`}
              title={user.displayName}
              className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brown font-mono text-xs font-semibold text-cream">
                {user.displayName.slice(0, 1).toLocaleUpperCase()}
              </span>
              <span className="flex min-w-0 max-w-28 flex-col leading-tight">
                <span className="truncate text-xs font-semibold text-brown">
                  {user.displayName}
                </span>
                <span className="text-[10px] text-brown-light">{t("loggedIn")}</span>
              </span>
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
