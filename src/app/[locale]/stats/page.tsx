"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getBeanStats } from "@/lib/actions/beans";
import { ScoreDisplay } from "@/components/ui/score-display";
import { chartColors } from "@/config/chart-colors";

interface BeanStats {
  total: number;
  avgScore: number;
  best: { name: string; roastery: string; score: number };
  byOrigin: [string, number][];
  byProcess: [string, number][];
  byVarietal: [string, number][];
  byMonth: [string, number][];
  scoreDist: [string, number][];
  topOrigin: [string, number];
  topProcess: [string, number];
}

const BROWN_PALETTE = [
  chartColors.primary,
  chartColors.primarySoft,
  chartColors.secondary,
  chartColors.accent,
  chartColors.accentSoft,
];

const PROCESS_COLORS: Record<string, string> = {
  ...chartColors.process,
};

const AXIS_TICK = { fontSize: 11, fill: chartColors.secondary };
const GRID_STROKE = chartColors.borderLight;

const CHART_CATEGORY_LIMIT = 8;

function summarizeCategories(entries: [string, number][], otherLabel: string) {
  if (entries.length <= CHART_CATEGORY_LIMIT) return entries;
  const visible = entries.slice(0, CHART_CATEGORY_LIMIT);
  const otherCount = entries
    .slice(CHART_CATEGORY_LIMIT)
    .reduce((sum, [, count]) => sum + count, 0);
  return [...visible, [otherLabel, otherCount] as [string, number]];
}

function ChartTooltip({
  active,
  payload,
  label,
  suffix,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: Record<string, unknown> }>;
  label?: string;
  suffix?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const name = (item.payload?.label as string) ?? item.name ?? label ?? "";
  return (
    <div className="rounded-sm border border-border bg-surface-warm px-3 py-2 shadow-[2px_2px_0_var(--color-cream-dark)]">
      <p className="text-[11px] font-medium text-brown-light">{name}</p>
      <p className="font-display text-base font-bold text-brown">
        {item.value}
        <span className="ml-1 text-[10px] font-normal text-brown-light">{suffix}</span>
      </p>
    </div>
  );
}

function SectionHeading({ index, title }: { index: string; title: string }) {
  return (
    <div className="mb-4 flex items-baseline gap-4 border-b-2 border-brown pb-3">
      <span className="font-display text-2xl font-semibold italic text-accent">{index}</span>
      <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-brown">{title}</h2>
    </div>
  );
}

function ChartCard({
  children,
  className = "",
  delay = 0,
  emphasis = false,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`stats-rise ${emphasis ? "paper-sheet paper-sheet-feature" : "journal-panel"} p-5 transition-all duration-200 hover:border-accent ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function formatMonth(key: string, locale: string, long = false): string {
  const [y, m] = key.split("-");
  const month = Number(m);
  if (locale === "ko") {
    return long ? `${y}년 ${month}월` : `${month}월`;
  }
  const date = new Date(Number(y), month - 1, 1);
  const name = date.toLocaleString("en-US", { month: "short" });
  return long ? `${name} ${y}` : name;
}

export default function StatsPage() {
  const t = useTranslations("stats");
  const tProcess = useTranslations("process");
  const tCommon = useTranslations("common");
  const tExplore = useTranslations("explore");
  const locale = useLocale();

  const [stats, setStats] = useState<BeanStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getBeanStats()
      .then((s) => {
        if (mounted) setStats(s as BeanStats | null);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const processLabel = (method: string) =>
    tProcess.has(method as "washed") ? tProcess(method as "washed") : method;

  /* ---------- loading skeleton ---------- */
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-16 w-56 animate-pulse rounded-md bg-cream-dark" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg border border-border bg-surface" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-lg border border-border bg-surface" />
        <div className="h-64 animate-pulse rounded-lg border border-border bg-surface" />
      </div>
    );
  }

  /* ---------- empty state ---------- */
  if (!stats || stats.total === 0) {
    return (
      <div className="stats-rise flex min-h-[70vh] flex-col items-center justify-center text-center">
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="mb-6 text-accent-light">
          <path
            d="M10 22h30v14a10 10 0 0 1-10 10H20a10 10 0 0 1-10-10V22Z"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <path d="M40 26h4a6 6 0 0 1 0 12h-4" stroke="currentColor" strokeWidth="2.5" />
          <path
            d="M20 8c-2 3 2 4 0 8M28 8c-2 3 2 4 0 8"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
        <h1 className="font-display text-2xl font-bold text-brown">{t("noData")}</h1>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-brown-light">
          {tExplore("emptySub")}
        </p>
        <Link
          href={`/${locale}/beans/new`}
          className="pressable mt-8 inline-flex items-center gap-2 rounded-sm border border-brown bg-brown px-6 py-3 text-sm font-semibold text-cream shadow-[3px_3px_0_var(--color-accent-light)] hover:bg-accent"
        >
          {tExplore("addFirst")}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
    );
  }

  /* ---------- chart data ---------- */
  const originData = summarizeCategories(stats.byOrigin, t("otherCategories")).map(
    ([name, count]) => ({ name, count })
  );
  const varietalData = summarizeCategories(stats.byVarietal, t("otherCategories")).map(
    ([name, count]) => ({ name, count })
  );
  const processData = stats.byProcess.map(([method, count]) => ({
    name: processLabel(method),
    label: processLabel(method),
    value: count,
    color: PROCESS_COLORS[method] ?? PROCESS_COLORS.other,
  }));
  const monthData = stats.byMonth.map(([month, count]) => ({
    name: month,
    label: formatMonth(month, locale, true),
    count,
  }));
  const distMap = new Map(stats.scoreDist);
  const scoreData = Array.from({ length: 10 }, (_, i) => ({
    name: `${i + 1}`,
    count: Number(distMap.get(`${i + 1}`) ?? 0),
  }));

  const originHeight = Math.max(200, originData.length * 40 + 40);
  const varietalHeight = Math.max(200, varietalData.length * 40 + 40);
  const cupsSuffix = tCommon("cups");

  return (
    <div className="mx-auto max-w-6xl space-y-14">
      <style>{`
        @keyframes stats-rise-kf {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .stats-rise {
          animation: stats-rise-kf 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
      `}</style>

      {/* ---------- header ---------- */}
      <header className="stats-rise grid border-y-2 border-brown md:grid-cols-[1fr_14rem]">
        <div className="py-9 md:py-12">
          <p className="journal-kicker">TASTE REPORT / ARCHIVE</p>
          <h1 className="display-title mt-3 text-5xl text-brown md:text-7xl">
            {t("title")}
          </h1>
        </div>
        <div className="border-t border-border bg-surface-warm p-5 md:border-l md:border-t-0 md:p-7">
          <p className="folio-label">
            {tExplore("results", { count: stats.total })}
          </p>
          <p className="mt-3 font-display text-6xl font-bold italic tabular-nums tracking-[-0.06em] text-accent">{stats.total}</p>
        </div>
      </header>

      {/* ---------- summary cards ---------- */}
      <section className="stats-rise grid border-y-2 border-brown sm:grid-cols-3" style={{ animationDelay: "60ms" }}>
        <div className="p-5 sm:border-r sm:border-border md:p-7">
          <p className="text-xs font-medium text-brown-light">
            {t("totalBeans")}
          </p>
          <p className="mt-2 font-display text-4xl font-bold tabular-nums text-brown">
            {stats.total}
            <span className="ml-1.5 text-sm font-normal text-brown-light">{cupsSuffix}</span>
          </p>
        </div>
        <div className="border-t border-border p-5 sm:border-r sm:border-t-0 md:p-7">
          <p className="text-xs font-medium text-brown-light">
            {t("avgScore")}
          </p>
          <div className="mt-2">
            <ScoreDisplay score={stats.avgScore} size="lg" />
          </div>
        </div>
        <div className="border-t border-border p-5 sm:border-t-0 md:p-7">
          <p className="text-xs font-medium text-brown-light">
            {t("bestBean")}
          </p>
          <p className="mt-2 truncate font-display text-lg font-bold leading-snug text-brown">
            {stats.best.name}
          </p>
          <p className="truncate text-xs text-brown-light">
            {stats.best.roastery} · {Number(stats.best.score).toFixed(1)}
            {tCommon("score")}
          </p>
        </div>
      </section>

      {/* ---------- my taste ---------- */}
      <section className="stats-rise" style={{ animationDelay: "240ms" }}>
        <SectionHeading index="01" title={t("myTaste")} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border-l-2 border-accent bg-surface-warm p-5">
            <p className="text-xs font-medium text-brown-light">
              {t("topOrigin")}
            </p>
            <p className="mt-2 font-display text-2xl font-bold text-brown">{stats.topOrigin[0]}</p>
            <p className="mt-1 text-xs text-brown-light">
              {stats.topOrigin[1]}
              {cupsSuffix}
            </p>
          </div>
          <div className="border-l-2 border-accent bg-surface-warm p-5">
            <p className="text-xs font-medium text-brown-light">
              {t("topProcess")}
            </p>
            <p className="mt-2 flex items-center gap-2.5 font-display text-2xl font-bold text-brown">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: PROCESS_COLORS[stats.topProcess[0]] ?? PROCESS_COLORS.other }}
              />
              {processLabel(stats.topProcess[0])}
            </p>
            <p className="mt-1 text-xs text-brown-light">
              {stats.topProcess[1]}
              {cupsSuffix}
            </p>
          </div>
        </div>
      </section>

      {/* ---------- by origin ---------- */}
      <section className="stats-rise" style={{ animationDelay: "300ms" }}>
        <SectionHeading index="02" title={t("byOrigin")} />
        <ChartCard>
          <ResponsiveContainer width="100%" height={originHeight}>
            <BarChart data={originData} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={88}
                tickLine={false}
                axisLine={false}
                tick={AXIS_TICK}
              />
              <Tooltip
                cursor={{ fill: chartColors.accentWash }}
                content={<ChartTooltip suffix={cupsSuffix} />}
              />
              <Bar dataKey="count" barSize={18} radius={[0, 4, 4, 0]}>
                {originData.map((_, i) => (
                  <Cell key={i} fill={BROWN_PALETTE[i % BROWN_PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {/* ---------- by process ---------- */}
      <section className="stats-rise" style={{ animationDelay: "360ms" }}>
        <SectionHeading index="03" title={t("byProcess")} />
        <ChartCard>
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <div className="relative h-52 w-52 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={processData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={92}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {processData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip suffix={cupsSuffix} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-3xl font-bold tabular-nums text-brown">
                  {stats.total}
                </span>
                <span className="text-[10px] text-brown-light">{cupsSuffix}</span>
              </div>
            </div>
            <ul className="w-full flex-1 space-y-2.5">
              {processData.map((p) => {
                const pct = Math.round((p.value / stats.total) * 100);
                return (
                  <li key={p.name} className="group">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="flex items-center gap-2 font-medium text-brown">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
                        {p.name}
                      </span>
                      <span className="tabular-nums text-xs text-brown-light">
                        {p.value}
                        {cupsSuffix} · {pct}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden bg-border-light">
                      <div
                        className="h-full transition-[width] duration-700 ease-out"
                        style={{ width: `${pct}%`, backgroundColor: p.color }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </ChartCard>
      </section>

      {/* ---------- by varietal ---------- */}
      {varietalData.length > 0 && (
        <section className="stats-rise" style={{ animationDelay: "420ms" }}>
          <SectionHeading index="04" title={t("byVarietal")} />
          <ChartCard>
            <ResponsiveContainer width="100%" height={varietalHeight}>
              <BarChart data={varietalData} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={88}
                  tickLine={false}
                  axisLine={false}
                  tick={AXIS_TICK}
                />
                <Tooltip
                  cursor={{ fill: chartColors.accentWash }}
                  content={<ChartTooltip suffix={cupsSuffix} />}
                />
                <Bar dataKey="count" barSize={18} radius={[0, 4, 4, 0]}>
                  {varietalData.map((_, i) => (
                    <Cell key={i} fill={BROWN_PALETTE[(i + 2) % BROWN_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>
      )}

      {/* ---------- monthly trend ---------- */}
      <section className="stats-rise" style={{ animationDelay: "480ms" }}>
        <SectionHeading index="05" title={t("monthlyTrend")} />
        <ChartCard>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthData} margin={{ left: -18, right: 16, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID_STROKE} />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={{ stroke: GRID_STROKE }}
                tick={AXIS_TICK}
                tickFormatter={(v: string) => formatMonth(v, locale)}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS_TICK} />
              <Tooltip cursor={{ stroke: chartColors.accentSoft }} content={<ChartTooltip suffix={cupsSuffix} />} />
              <Line
                type="monotone"
                dataKey="count"
                stroke={chartColors.accent}
                strokeWidth={2}
                dot={{ r: 3.5, fill: chartColors.accent, strokeWidth: 0 }}
                activeDot={{ r: 5.5, fill: chartColors.primary, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {/* ---------- score distribution ---------- */}
      <section className="stats-rise" style={{ animationDelay: "540ms" }}>
        <SectionHeading index="06" title={t("scoreDistribution")} />
        <ChartCard>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={scoreData} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID_STROKE} />
              <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: GRID_STROKE }} tick={AXIS_TICK} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS_TICK} />
              <Tooltip cursor={{ fill: chartColors.accentWash }} content={<ChartTooltip suffix={cupsSuffix} />} />
              <Bar dataKey="count" fill={chartColors.primarySoft} radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>
    </div>
  );
}
