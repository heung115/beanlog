"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type SupportedLocale = "ko" | "en";

const localeOptions = [
  { locale: "ko", label: "한국어" },
  { locale: "en", label: "English" },
] as const;

const accessibleLabels = {
  ko: {
    group: "언어",
    ko: "현재 언어: 한국어",
    en: "영어로 전환",
  },
  en: {
    group: "Language",
    ko: "Switch to Korean",
    en: "Current language: English",
  },
} as const;

export function localizedPathname(
  pathname: string,
  targetLocale: SupportedLocale
): string {
  const pathWithoutLocale = pathname.replace(/^\/(?:ko|en)(?=\/|$)/, "");
  const suffix = pathWithoutLocale === "/" ? "" : pathWithoutLocale;
  return `/${targetLocale}${suffix}`;
}

export function LocaleSwitcher({
  locale: localeProp,
  className,
}: {
  locale?: SupportedLocale;
  className?: string;
}) {
  const pathname = usePathname();
  const pathnameLocale = pathname.split("/")[1];
  const currentLocale =
    localeProp ?? (pathnameLocale === "en" ? "en" : "ko");
  const labels = accessibleLabels[currentLocale];

  return (
    <div
      role="group"
      aria-label={labels.group}
      className={cn(
        "inline-flex min-h-11 items-center rounded-sm border border-border bg-surface p-0.5",
        className
      )}
    >
      {localeOptions.map(({ locale, label }) => {
        const isCurrent = locale === currentLocale;

        return (
          <Link
            key={locale}
            href={localizedPathname(pathname, locale)}
            hrefLang={locale}
            lang={locale}
            aria-label={labels[locale]}
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              "inline-flex min-h-9 items-center rounded-sm px-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:px-2",
              isCurrent
                ? "bg-brown text-cream"
                : "text-brown-light hover:bg-cream-dark hover:text-brown"
            )}
          >
            <span className="sm:hidden">{locale.toUpperCase()}</span>
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
