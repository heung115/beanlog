"use client";

import { OriginContours } from "@/components/brand/origin-contours";
import { useTranslations } from "next-intl";

export function AuthShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("auth");
  return (
    <div className="mx-auto max-w-5xl py-4 md:py-6">
      <div className="grid w-full lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] lg:gap-16">
        <aside className="relative hidden overflow-hidden rounded-lg bg-surface-warm p-9 lg:block">
          <OriginContours className="absolute -bottom-24 -left-36 h-[38rem] w-[46rem] opacity-50" />
          <div className="relative">
            <p className="journal-kicker">beanmap</p>
            <p className="mt-6 max-w-xs font-display text-3xl font-semibold leading-tight tracking-[-0.025em] text-brown">
              {t("journalPromise")}
            </p>
            <p className="mt-4 max-w-xs text-sm leading-7 text-brown-medium">{t("journalPromiseDescription")}</p>
          </div>
        </aside>
        <section className="min-w-0 px-1 py-5 sm:px-6 lg:py-8">
          <div className="mx-auto w-full max-w-sm">{children}</div>
        </section>
      </div>
    </div>
  );
}
