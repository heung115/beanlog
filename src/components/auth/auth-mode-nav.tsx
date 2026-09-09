"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

export function AuthModeNav({ mode, query }: { mode: "login" | "signup"; query: string }) {
  const locale = useLocale();
  const t = useTranslations("auth");
  return (
    <nav aria-label={`${t("login")} / ${t("signup")}`} className="mb-7 grid grid-cols-2 border-b border-border-light">
      {(["login", "signup"] as const).map((item) => (
        <Link
          key={item}
          href={`/${locale}/${item}${query}`}
          aria-current={mode === item ? "page" : undefined}
          className={`inline-flex min-h-12 items-center justify-center border-b-2 px-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${mode === item ? "border-brown text-brown" : "border-transparent text-brown-light hover:border-border hover:text-brown"}`}
        >
          {t(item)}
        </Link>
      ))}
    </nav>
  );
}
