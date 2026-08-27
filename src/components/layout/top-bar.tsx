"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { brand } from "@/config/brand";

interface TopBarProps {
  user: { displayName: string } | null;
}

export function TopBar({ user }: TopBarProps) {
  const pathname = usePathname();
  const appPathname = pathname.replace(/^\/(ko|en)(?=\/|$)/, "") || "/";
  const t = useTranslations("nav");

  if (/^\/(?:login|signup(?:\/check-email)?|privacy|terms|try)\/?$/.test(appPathname)) {
    return null;
  }

  const links = [
    { href: "/explore", label: t("explore") },
    { href: "/beans/new", label: t("add") },
    { href: "/origins", label: t("origins") },
    { href: "/stats", label: t("stats") },
    { href: "/settings", label: t("settings") },
  ];

  return (
    <header className="sticky top-0 z-40 hidden border-b border-border bg-cream/95 backdrop-blur-sm md:block">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
        <Link href="/explore" className="font-display text-xl font-bold text-brown tracking-tight">
          {brand.name}
        </Link>
        <nav className="flex items-center gap-1">
          {links.map(({ href, label }) => {
            const isActive = appPathname === href || appPathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "border-b-2 border-transparent px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "border-brown text-brown"
                    : "text-brown-light hover:border-accent-light hover:text-brown"
                )}
              >
                {label}
              </Link>
            );
          })}
          {user && (
            <div className="ml-2 border-l border-border pl-3">
              <Link
                href="/settings"
                aria-label={`${t("account")}: ${user.displayName}`}
                title={user.displayName}
                className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-cream-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brown text-xs font-semibold text-cream">
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
          )}
        </nav>
      </div>
    </header>
  );
}
