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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreDisplay } from "@/components/ui/score-display";
import { useToast } from "@/components/ui/toast";
import { tagDisplayName } from "@/components/beans/tag-input";
import { deleteBean, getBeanById } from "@/lib/actions/beans";
import { findCountryPreset } from "@/data/origin-presets";
import { chartColors } from "@/config/chart-colors";
import {
  cn,
  formatDate,
  getProcessColor,
  getRoastColor,
} from "@/lib/utils";
import type { BeanWithTags } from "@/types/database";

function InfoRow({ label, value }: { label: string; value?: string | null }) {
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
      className={cn("animate-rise", className)}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </section>
  );
}

function Overline({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="journal-section-title">
      {children}
    </h2>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="h-8 w-40 rounded bg-border-light" />
      <div className="h-32 rounded-lg border border-border bg-surface" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-48 rounded-lg border border-border bg-surface" />
        <div className="h-48 rounded-lg border border-border bg-surface" />
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
        <div className="animate-rise rounded-lg border border-border bg-surface px-6 py-16 text-center">
          <p className="font-display text-xl font-bold text-brown">
            {t("notFound")}
          </p>
          <p className="mt-2 text-sm text-brown-light">{t("notFoundSub")}</p>
          <Link href={`/${locale}/explore`} className="mt-6 inline-block">
            <Button variant="secondary">{t("back")}</Button>
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
    : bean.origin_country;

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
    <div className="mx-auto max-w-2xl">
      {/* Toolbar */}
      <div className="animate-rise mb-6 flex items-center justify-between gap-3">
        <Link
          href={`/${locale}/explore`}
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
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 py-1.5 pl-3 pr-1.5">
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
              variant="secondary"
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
      <header className="animate-rise mb-6" style={{ animationDelay: "40ms" }}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge>{bean.bean_type === "blend" ? t("blend") : t("singleOrigin")}</Badge>
          <Badge className={getProcessColor(bean.process_method)}>
            {tp(bean.process_method)}
          </Badge>
          <Badge className={getRoastColor(bean.roast_level)}>
            {tr(bean.roast_level)}
          </Badge>
        </div>
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-brown md:text-4xl">
          {bean.name}
        </h1>
        <p className="mt-1.5 text-base text-brown-light">{bean.roastery}</p>
        <p className="mt-3 flex items-center gap-2 text-sm text-brown-light">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <rect
              x="1"
              y="2"
              width="11"
              height="10"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path d="M1 5h11M4 1v2M9 1v2" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          {formatDate(bean.consumed_at, locale)}
          <span className="text-border">·</span>
          {bean.place_type === "cafe"
            ? bean.cafe_name || t("cafe")
            : t("home")}
        </p>
      </header>

      {/* Score + note */}
      <Card delay={80} className="py-6 md:py-7" testId="bean-overall-score">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex shrink-0 flex-col items-center gap-1 sm:border-r sm:border-border-light sm:pr-8">
            <Overline>{t("overallScore")}</Overline>
            <ScoreDisplay score={bean.overall_score} size="lg" />
          </div>
          <blockquote className="flex-1">
            <p className="font-display text-lg leading-relaxed text-brown-medium italic">
              “{bean.note}”
            </p>
          </blockquote>
        </div>
      </Card>

      {/* Detail scores radar */}
      {hasDetailScores && (
        <Card delay={120} className="border-t border-border-light py-6 md:py-8">
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
      <div className="grid grid-cols-1 border-t border-border-light md:grid-cols-2">
        <Card delay={160} className="py-6 md:py-8 md:pr-8">
          <Overline>{t("originInfo")}</Overline>
          <dl className="mt-2 divide-y divide-border-light">
            <InfoRow label={t("originCountry")} value={countryName} />
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
        </Card>

        <Card
          delay={200}
          className="border-t border-border-light py-6 md:border-l md:border-t-0 md:py-8 md:pl-8"
        >
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

      {/* Blend composition */}
      {bean.bean_type === "blend" && (bean.blend_components ?? []).length > 0 && (
        <Card delay={180} className="border-t border-border-light py-6 md:py-8">
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
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-cream-dark">
                        <div
                          className="h-full rounded-full bg-accent transition-all duration-500"
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

      {/* Tasting tags */}
      {tags.length > 0 && (
        <Card delay={240} className="border-t border-border-light py-6 md:py-8">
          <Overline>{t("tastingNotes")}</Overline>
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="rounded-full border border-border bg-cream-dark/60 px-3 py-1 text-xs font-medium text-brown-medium transition-colors hover:border-accent"
              >
                {tagDisplayName(tag.tag, locale)}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Purchase */}
      {hasPurchase && (
        <Card delay={280} className="border-t border-border-light py-6 md:py-8">
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
