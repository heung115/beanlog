"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { BeanWithTags } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { ScoreDisplay } from "@/components/ui/score-display";
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

  return (
    <Link
      href={`/beans/${bean.id}`}
      className="journal-panel group block border-l-2 border-l-transparent px-5 py-4 transition-all duration-200 hover:border-l-accent hover:border-t-border hover:border-r-border hover:border-b-border hover:bg-surface-warm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 md:px-6 md:py-5"
    >
      {/* Name / roastery / origin + score */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold leading-snug text-brown transition-colors duration-150 group-hover:text-accent">
            {bean.name}
          </h3>
          <p className="mt-1 truncate text-sm text-brown-light">{bean.roastery}</p>
          <p className="mt-2 text-xs font-medium text-brown-light/70">
            {bean.origin_country}
            {bean.origin_region ? ` · ${bean.origin_region}` : ""}
          </p>
        </div>
        <ScoreDisplay score={bean.overall_score} className="shrink-0" />
      </div>

      {/* Process / roast / type */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <Badge className={getProcessColor(bean.process_method)}>
          {tProcess(bean.process_method)}
        </Badge>
        <Badge className={getRoastColor(bean.roast_level)}>{tRoast(bean.roast_level)}</Badge>
        <span className="ml-0.5 text-xs text-brown-light/70">
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
              className="rounded-full bg-cream-dark px-2 py-0.5 text-[11px] text-brown-medium"
            >
              {tag.tag}
            </span>
          ))}
          {hiddenTagCount > 0 && (
            <span className="text-[11px] text-brown-light/60">+{hiddenTagCount}</span>
          )}
        </div>
      )}

      {/* Place + date */}
      <div className="mt-5 flex items-center justify-between border-t border-border-light pt-2.5">
        <span className="text-xs text-brown-light/70">
          {bean.place_type === "cafe" ? t("cafe") : t("home")}
        </span>
        <time className="text-xs text-brown-light/70" dateTime={bean.consumed_at}>
          {formatDate(bean.consumed_at, locale)}
        </time>
      </div>
    </Link>
  );
}
