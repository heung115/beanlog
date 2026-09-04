"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { BeanWithTags } from "@/types/database";
import { ScoreDisplay } from "@/components/ui/score-display";
import { tagDisplayName } from "@/components/beans/tag-input";
import { findCountryPreset } from "@/data/origin-presets";
import { cn, formatDate } from "@/lib/utils";

interface BeanCardProps {
  bean: BeanWithTags;
  view?: "grid" | "list";
}

export function BeanCard({ bean, view = "grid" }: BeanCardProps) {
  const t = useTranslations("beans");
  const tProcess = useTranslations("process");
  const tRoast = useTranslations("roast");
  const locale = useLocale();

  const visibleTags = (bean.tasting_tags ?? []).slice(0, 2);
  const hiddenTagCount = (bean.tasting_tags ?? []).length - visibleTags.length;
  const countryPreset = bean.origin_country
    ? findCountryPreset(bean.origin_country)
    : undefined;
  const countryName = countryPreset
    ? locale === "ko"
      ? countryPreset.countryKo
      : countryPreset.country
    : bean.origin_country ?? "";

  return (
    <article
      data-bean-card
      data-testid="bean-card"
      data-view={view}
      className={cn(
        "journal-panel pressable group relative flex flex-col overflow-hidden border-t-[3px] border-t-brown px-5 py-4 hover:border-t-accent hover:bg-surface-warm hover:shadow-[4px_4px_0_var(--color-cream-dark)] md:px-5 md:py-5",
        view === "grid" ? "min-h-60" : "min-h-0"
      )}
    >
      <div className="relative z-10 flex h-full flex-1 flex-col">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <span className="folio-label">TASTING RECORD</span>
          <time className="folio-label" dateTime={bean.consumed_at}>
            {formatDate(bean.consumed_at, locale)}
          </time>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="line-clamp-2 font-display text-xl font-bold leading-[1.15] tracking-[-0.025em] text-brown transition-colors duration-150 group-hover:text-accent">
              <Link
                href={`/${locale}/beans/${bean.id}`}
                className="rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                {bean.name}
              </Link>
            </h3>
            <p className="mt-1 truncate text-xs font-semibold uppercase tracking-[0.05em] text-brown-light">{bean.roastery}</p>
            <p className="mt-3 text-xs font-semibold text-brown-medium">
              {countryName}
              {bean.origin_region ? ` · ${bean.origin_region}` : ""}
            </p>
          </div>
          <ScoreDisplay score={bean.overall_score} className="shrink-0" />
        </div>

        <p
          data-testid="bean-card-metadata"
          className="mt-4 border-l-2 border-accent pl-3 font-mono text-[10px] font-semibold uppercase tracking-[0.04em] text-brown-medium"
        >
          {[
            tProcess(bean.process_method),
            tRoast(bean.roast_level),
            bean.bean_type === "blend" ? t("blend") : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {view === "list" && bean.note && (
          <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-brown-medium">
            {bean.note}
          </p>
        )}

        {/* Tasting tags */}
        {visibleTags.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {visibleTags.map((tag) => (
              <span
                key={tag.id}
                className="rounded-sm border border-border px-2 py-0.5 text-[11px] font-medium text-brown-medium"
              >
                {tagDisplayName(tag.tag, locale)}
              </span>
            ))}
            {hiddenTagCount > 0 && (
              <span className="text-[11px] text-brown-light">+{hiddenTagCount}</span>
            )}
          </div>
        )}

        {/* Place + date */}
        <div
          className={cn(
            "flex items-center justify-between border-t border-border-light pt-3",
            view === "grid" ? "mt-auto" : "mt-5"
          )}
        >
          <span className="folio-label">
            {bean.place_type === "cafe" ? t("cafe") : t("home")}
          </span>
          <span aria-hidden="true" className="font-display text-lg text-accent transition-transform group-hover:translate-x-1">→</span>
        </div>
      </div>
    </article>
  );
}
