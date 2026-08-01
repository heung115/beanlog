"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { BeanWithTags } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { ScoreDisplay } from "@/components/ui/score-display";
import {
  findCountryPreset,
  originSlug,
} from "@/data/origin-presets";
import { formatDate, getProcessColor, getRoastColor } from "@/lib/utils";

interface BeanCardProps {
  bean: BeanWithTags;
}

export function BeanCard({ bean }: BeanCardProps) {
  const t = useTranslations("beans");
  const tProcess = useTranslations("process");
  const tRoast = useTranslations("roast");
  const locale = useLocale();

  const visibleTags = (bean.tasting_tags ?? []).slice(0, 3);
  const hiddenTagCount = (bean.tasting_tags ?? []).length - visibleTags.length;
  const countryPreset = bean.origin_country
    ? findCountryPreset(bean.origin_country)
    : undefined;
  const countryName = countryPreset
    ? locale === "ko"
      ? countryPreset.countryKo
      : countryPreset.country
    : bean.origin_country ?? "";
  const originHref = countryPreset
    ? `/${locale}/origins/${originSlug(countryPreset.country)}`
    : null;

  return (
    <article
      data-bean-card
      className="journal-panel group relative border-l-2 border-l-transparent px-5 py-4 transition-all duration-200 hover:border-l-accent hover:border-t-border hover:border-r-border hover:border-b-border hover:bg-surface-warm md:px-6 md:py-5"
    >
      <Link
        href={`/${locale}/beans/${bean.id}`}
        aria-label={bean.name}
        className="absolute inset-0 z-0 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <span className="sr-only">{bean.name}</span>
      </Link>

      <div className="pointer-events-none relative z-10">
        {/* Name / roastery / origin + score */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold leading-snug text-brown transition-colors duration-150 group-hover:text-accent">
              {bean.name}
            </h3>
            <p className="mt-1 truncate text-sm text-brown-light">{bean.roastery}</p>
            <p className="mt-2 text-xs font-medium text-brown-light">
              {countryName}
              {bean.origin_region ? ` · ${bean.origin_region}` : ""}
            </p>
            {originHref && (
              <Link
                href={originHref}
                className="pointer-events-auto relative z-20 mt-3 inline-flex min-h-10 items-center gap-2 rounded-sm border border-border bg-surface-warm px-3 text-xs font-semibold text-accent transition-colors hover:border-accent hover:bg-cream-dark hover:text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path
                    d="M8 14s4-3.8 4-7a4 4 0 10-8 0c0 3.2 4 7 4 7z"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinejoin="round"
                  />
                  <circle cx="8" cy="7" r="1.35" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                {t("viewOriginGuide", { country: countryName })}
                <svg
                  aria-hidden="true"
                  width="11"
                  height="11"
                  viewBox="0 0 12 12"
                  fill="none"
                >
                  <path
                    d="M4 2.5L7.5 6 4 9.5"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            )}
          </div>
          <ScoreDisplay score={bean.overall_score} className="shrink-0" />
        </div>

        {/* Process / roast / type */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <Badge className={getProcessColor(bean.process_method)}>
            {tProcess(bean.process_method)}
          </Badge>
          <Badge className={getRoastColor(bean.roast_level)}>
            {tRoast(bean.roast_level)}
          </Badge>
          <span className="ml-0.5 text-xs text-brown-light">
            {bean.bean_type === "blend" ? t("blend") : t("singleOrigin")}
          </span>
        </div>

        {/* One-line note */}
        {bean.note && (
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
                className="rounded-sm bg-cream-dark px-2 py-0.5 text-[11px] text-brown-medium"
              >
                {tag.tag}
              </span>
            ))}
            {hiddenTagCount > 0 && (
              <span className="text-[11px] text-brown-light">+{hiddenTagCount}</span>
            )}
          </div>
        )}

        {/* Place + date */}
        <div className="mt-5 flex items-center justify-between border-t border-border-light pt-2.5">
          <span className="text-xs text-brown-light">
            {bean.place_type === "cafe" ? t("cafe") : t("home")}
          </span>
          <time className="text-xs text-brown-light" dateTime={bean.consumed_at}>
            {formatDate(bean.consumed_at, locale)}
          </time>
        </div>
      </div>
    </article>
  );
}
