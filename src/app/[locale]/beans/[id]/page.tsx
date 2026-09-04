"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { Button, buttonClassName } from "@/components/ui/button";
import { ScoreDisplay } from "@/components/ui/score-display";
import { useToast } from "@/components/ui/toast";
import { tagDisplayName } from "@/components/beans/tag-input";
import { deleteBean, getBeanById } from "@/lib/actions/beans";
import { findCountryPreset, originSlug } from "@/data/origin-presets";
import { chartColors } from "@/config/chart-colors";
import { cn, formatDate } from "@/lib/utils";
import type { BeanWithTags } from "@/types/database";

function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: React.ReactNode;
}) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="shrink-0 text-xs text-brown-light">{label}</dt>
      <dd className="text-right text-sm font-medium text-brown">{value}</dd>
    </div>
  );
}

function Card({
  children,
  className,
  delay,
  testId,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  testId?: string;
}) {
  return (
    <section
      data-detail-section
      data-testid={testId}
      className={cn("paper-sheet animate-rise p-5 md:p-7", className)}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </section>
  );
}

function Overline({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-accent">
      {children}
    </h2>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="h-8 w-40 rounded bg-border-light" />
      <div className="h-32 rounded-lg bg-surface" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-48 rounded-lg bg-surface" />
        <div className="h-48 rounded-lg bg-surface" />
      </div>
    </div>
  );
}

export default function BeanDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const locale = useLocale();
  const toast = useToast();
  const t = useTranslations("beans");
  const tp = useTranslations("process");
  const tr = useTranslations("roast");
  const tc = useTranslations("common");

  const [bean, setBean] = useState<BeanWithTags | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBeanById(params.id)
      .then((data) => {
        if (cancelled) return;
        setBean((data as BeanWithTags | null) ?? null);
      })
      .catch(() => {
        /* auth/network not ready — treat as not found */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  async function handleDelete() {
    if (!bean) return;
    setDeleting(true);
    try {
      const result = await deleteBean(bean.id);
      if (result?.error) {
        toast.show(tc("error"));
        setDeleting(false);
        return;
      }
      toast.show(t("deleted"));
      router.push(`/${locale}/explore`);
    } catch {
      toast.show(tc("error"));
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl pt-2">
        <DetailSkeleton />
      </div>
    );
  }

  if (!bean) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="paper-sheet animate-rise px-6 py-16 text-center">
          <p className="font-display text-xl font-bold text-brown">
            {t("notFound")}
          </p>
          <p className="mt-2 text-sm text-brown-light">{t("notFoundSub")}</p>
          <Link
            href={`/${locale}/explore`}
            prefetch={false}
            className={buttonClassName({ variant: "secondary", className: "mt-6" })}
          >
            {t("back")}
          </Link>
        </div>
      </div>
    );
  }

  const countryPreset = bean.origin_country
    ? findCountryPreset(bean.origin_country)
    : undefined;
  const countryName = countryPreset
    ? locale === "ko"
      ? countryPreset.countryKo
      : countryPreset.country
    : bean.origin_country ?? "";

  const radarData = [
    { key: "aroma", label: t("aroma"), value: bean.score_aroma ?? 0 },
    { key: "acidity", label: t("acidity"), value: bean.score_acidity ?? 0 },
    { key: "body", label: t("body"), value: bean.score_body ?? 0 },
    { key: "sweetness", label: t("sweetness"), value: bean.score_sweetness ?? 0 },
    { key: "aftertaste", label: t("aftertaste"), value: bean.score_aftertaste ?? 0 },
    { key: "balance", label: t("balance"), value: bean.score_balance ?? 0 },
  ];
  const hasDetailScores = radarData.some((d) => d.value > 0);

  const tags = bean.tasting_tags ?? [];
  const hasPurchase =
    bean.purchase_source || bean.price || bean.weight_g || bean.purchased_at;

  const priceLabel = bean.price
    ? locale === "ko"
      ? `${bean.price.toLocaleString("ko-KR")}원`
      : `$${bean.price.toLocaleString("en-US")}`
    : null;

  const purchaseSourceLabel = bean.purchase_source
    ? t(
        bean.purchase_source === "online"
          ? "purchaseOnline"
          : bean.purchase_source === "roastery"
            ? "purchaseRoastery"
            : bean.purchase_source === "cafe"
              ? "purchaseCafe"
              : "purchaseOther"
      )
    : null;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Toolbar */}
      <div className="animate-rise mb-6 flex items-center justify-between gap-3">
        <Link
          href={`/${locale}/explore`}
          prefetch={false}
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-brown-light transition-colors hover:text-brown"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className="transition-transform duration-150 group-hover:-translate-x-0.5"
          >
            <path
              d="M9 2L4 7l5 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {t("back")}
        </Link>

        {confirming ? (
          <div className="flex items-center gap-2 rounded-sm border border-red-200 bg-red-50 py-1.5 pl-3 pr-1.5">
            <span className="text-xs font-medium text-red-800">
              {t("deleteConfirm")}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(false)}
              disabled={deleting}
            >
              {tc("cancel")}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
              loading={deleting}
            >
              {t("delete")}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/${locale}/beans/${bean.id}/edit`)}
            >
              {t("edit")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-700 hover:bg-red-50 hover:text-red-800"
              onClick={() => setConfirming(true)}
            >
              {t("delete")}
            </Button>
          </div>
        )}
      </div>

      {/* Header */}
      <header
        data-testid="bean-detail-header"
        className="animate-rise mb-7 pt-1"
        style={{ animationDelay: "40ms" }}
      >
        <h1 className="break-words text-3xl font-semibold leading-tight tracking-[-0.025em] text-brown md:text-4xl">
          {bean.name}
        </h1>
        <p className="mt-2 text-sm font-medium text-brown-medium">
          {bean.roastery}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-brown-light">
          <span className="text-brown-medium">
            <span className="sr-only">{t("classification")}: </span>
            {[
              bean.bean_type === "blend" ? t("blend") : null,
              tp(bean.process_method),
              tr(bean.roast_level),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <span aria-hidden="true" className="text-border">
            ·
          </span>
          <span className="flex items-center gap-2">
            <svg
              aria-hidden="true"
              width="13"
              height="13"
              viewBox="0 0 13 13"
              fill="none"
            >
              <rect
                x="1"
                y="2"
                width="11"
                height="10"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path
                d="M1 5h11M4 1v2M9 1v2"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
            {formatDate(bean.consumed_at, locale)}
            <span aria-hidden="true" className="text-border">
              ·
            </span>
            {bean.place_type === "cafe"
              ? bean.cafe_name || t("cafe")
              : t("home")}
          </span>
        </div>
      </header>

      {/* Score + note */}
      <Card delay={80} testId="bean-overall-score">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex shrink-0 flex-col items-center gap-1 sm:border-r sm:border-border-light sm:pr-8">
            <Overline>{t("overallScore")}</Overline>
            <ScoreDisplay score={bean.overall_score} size="lg" />
          </div>
          <p className="flex-1 text-base leading-relaxed text-brown-medium">
            {bean.note}
          </p>
        </div>
      </Card>

      {/* Cup notes */}
      {tags.length > 0 && (
        <Card delay={120} className="mt-4" testId="bean-cup-notes">
          <Overline>{t("tastingNotes")}</Overline>
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="rounded-sm bg-cream-dark/60 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.04em] text-brown-medium"
              >
                {tagDisplayName(tag.tag, locale)}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Detail scores radar */}
      {hasDetailScores && (
        <Card delay={160} className="mt-4">
          <Overline>{t("detailedScores")}</Overline>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
                <PolarGrid stroke={chartColors.border} />
                <PolarAngleAxis
                  dataKey="label"
                  tick={{ fill: chartColors.secondary, fontSize: 12 }}
                />
                <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
                <Radar
                  dataKey="value"
                  stroke={chartColors.accent}
                  strokeWidth={2}
                  fill={chartColors.accent}
                  fillOpacity={0.32}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-x-4 gap-y-2 border-t border-border-light pt-4 sm:grid-cols-6">
            {radarData.map((d) => (
              <div key={d.key} className="flex flex-col items-center gap-0.5">
                <span className="text-[11px] text-brown-light">{d.label}</span>
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    d.value > 0 ? "text-brown" : "text-brown-light/40"
                  )}
                >
                  {d.value > 0 ? d.value : "–"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Origin + process */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card delay={200} testId="bean-origin-info">
          <Overline>{t("originInfo")}</Overline>
          <dl className="mt-2 divide-y divide-border-light">
            <InfoRow
              label={t("originCountry")}
              value={countryName}
            />
            <InfoRow label={t("originRegion")} value={bean.origin_region} />
            <InfoRow
              label={t("originSubregion")}
              value={(bean.origin_subregions ?? []).join(" · ")}
            />
            <InfoRow
              label={t("altitudeRange")}
              value={bean.altitude_m ? `${bean.altitude_m.toLocaleString()}m` : null}
            />
            <InfoRow label={t("farmProducer")} value={bean.farm_producer} />
            <InfoRow label={t("varietal")} value={bean.varietal} />
          </dl>
          {countryPreset && (
            <Link
              data-testid="origin-detail-guide-link"
              href={`/${locale}/origins/${originSlug(countryPreset.country)}`}
              className="mt-4 flex min-h-10 w-full items-center justify-between gap-3 rounded-md border border-border-light bg-surface-warm px-3 text-xs font-semibold text-accent transition-colors hover:border-border hover:bg-cream-dark hover:text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="inline-flex items-center gap-2">
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
              </span>
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
        </Card>

        <Card delay={240} testId="bean-process-roast-info">
          <Overline>{t("processMethod")} · {t("roastLevel")}</Overline>
          <dl className="mt-2 divide-y divide-border-light">
            <InfoRow label={t("processMethod")} value={tp(bean.process_method)} />
            <InfoRow label={t("processDetail")} value={bean.process_detail} />
            <InfoRow label={t("roastLevel")} value={tr(bean.roast_level)} />
            <InfoRow
              label={t("roastDate")}
              value={bean.roast_date ? formatDate(bean.roast_date, locale) : null}
            />
            <InfoRow
              label={t("harvestYear")}
              value={bean.harvest_year ? String(bean.harvest_year) : null}
            />
          </dl>
        </Card>
      </div>

      {countryPreset && (
        <Card
          delay={220}
          className="mt-4"
          testId="origin-flavor-guide"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Overline>{t("originFlavorGuide")}</Overline>
              <p className="mt-1 text-xs text-brown-light">
                {t("originFlavorGuideHint")}
              </p>
            </div>
            <Link
              href={`/${locale}/origins/${originSlug(countryPreset.country)}`}
              className="inline-flex min-h-9 shrink-0 items-center gap-1 self-start rounded-md border border-border-light px-3 text-xs font-medium text-accent transition-colors hover:border-border hover:text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
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
          </div>
          <p className="mt-5 font-display text-xl font-semibold leading-relaxed text-brown md:text-2xl">
            {locale === "ko" ? countryPreset.signatureKo : countryPreset.signature}
          </p>
          <div className="mt-5">
            <p className="text-xs font-medium text-brown-light">
              {t("originRegion")}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-brown-medium">
              {countryPreset.regions
                .map((region) => (locale === "ko" ? region.nameKo : region.name))
                .join(" · ")}
            </p>
          </div>
        </Card>
      )}

      {/* Blend composition */}
      {bean.bean_type === "blend" && (bean.blend_components ?? []).length > 0 && (
        <Card delay={180} className="mt-4">
          <Overline>{t("blendComposition")}</Overline>
          <div className="mt-3 flex flex-col gap-2">
            {(bean.blend_components ?? [])
              .slice()
              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
              .map((c) => {
                const preset = findCountryPreset(c.origin_country);
                const cname = preset
                  ? locale === "ko"
                    ? preset.countryKo
                    : preset.country
                  : c.origin_country;
                return (
                  <div key={c.id ?? c.origin_country} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-medium text-brown">
                          {[
                            cname,
                            c.origin_region,
                            ...(c.origin_subregions ?? []),
                            c.farm_producer,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        <span className="text-sm font-semibold tabular-nums text-brown">
                          {c.percentage}%
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden bg-cream-dark">
                        <div
                          className="h-full bg-accent transition-all duration-500"
                          style={{ width: `${c.percentage}%` }}
                        />
                      </div>
                      {(c.varietal || c.process_method || c.process_detail) && (
                        <p className="mt-1 text-xs text-brown-light">
                          {[
                            c.varietal,
                            c.process_detail,
                            c.process_method ? tp(c.process_method) : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>
      )}

      {/* Purchase */}
      {hasPurchase && (
        <Card delay={280} className="mt-4">
          <Overline>{t("purchaseInfo")}</Overline>
          <dl className="mt-2 divide-y divide-border-light">
            <InfoRow label={t("purchaseSource")} value={purchaseSourceLabel} />
            <InfoRow label={t("price")} value={priceLabel} />
            <InfoRow
              label={t("weight")}
              value={bean.weight_g ? `${bean.weight_g.toLocaleString()}g` : null}
            />
            <InfoRow
              label={t("purchasedAt")}
              value={
                bean.purchased_at ? formatDate(bean.purchased_at, locale) : null
              }
            />
          </dl>
        </Card>
      )}
    </div>
  );
}
