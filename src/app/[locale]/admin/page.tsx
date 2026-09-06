import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageIntro } from "@/components/layout/page-intro";
import { buttonClassName } from "@/components/ui/button";
import { CatalogEditor } from "@/components/admin/catalog-editor";
import { apiFetch, ApiError } from "@/lib/api/client";
import { adminCopy } from "@/lib/admin/copy";
import type { AdminAuditItem, AdminOverview, CatalogKind, CatalogPage } from "@/lib/admin/types";
import { getPrivateAdminContext } from "@/lib/admin/private-access";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin · beanmap", robots: { index: false, follow: false } };

type Query = { kind?: string; q?: string; offset?: string };

export default async function AdminPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Query>;
}) {
  if (!await getPrivateAdminContext()) notFound();
  const { locale } = await params;
  const query = await searchParams;
  const t = adminCopy(locale);
  const kind: CatalogKind = query.kind === "region" || query.kind === "entity" ? query.kind : "country";
  const q = (typeof query.q === "string" ? query.q : "").trim().slice(0, 100);
  const rawOffset = typeof query.offset === "string" ? Number(query.offset) : 0;
  const offset = Number.isInteger(rawOffset) && rawOffset >= 0 && rawOffset <= 100000 ? rawOffset : 0;
  const path = `/${locale}/admin`;
  const href = (nextOffset: number) => `${path}?${new URLSearchParams({ kind, q, offset: String(nextOffset) })}`;

  let failure: "denied" | "unavailable" | null = null;
  let data: [AdminOverview, CatalogPage, { items: AdminAuditItem[] }] | undefined;
  try {
    const access = await apiFetch<{ is_admin: boolean }>("/api/admin/access");
    if (!access.is_admin) failure = "denied";
    else data = await Promise.all([
      apiFetch<AdminOverview>("/api/admin/overview"),
      apiFetch<CatalogPage>("/api/admin/catalog", { query: { kind, q, offset } }),
      apiFetch<{ items: AdminAuditItem[] }>("/api/admin/audit"),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(`/${locale}/login?${new URLSearchParams({ next: href(offset) })}`);
    }
    failure = error instanceof ApiError && error.status === 403 ? "denied" : "unavailable";
  }

  const back = <Link href={`/${locale}/settings`} prefetch={false}
    className={buttonClassName({ variant: "secondary" })}>{t.back}</Link>;

  if (!data || failure) return <div className="space-y-6">
    <PageIntro eyebrow={t.eyebrow} title={failure === "denied" ? t.deniedTitle : t.unavailable}
      description={failure === "denied" ? t.deniedDescription : t.unavailableHelp} />
    <div className="flex flex-wrap gap-3">
      {back}
      {failure !== "denied" && <Link href={href(offset)} prefetch={false} className={buttonClassName()}>{t.retry}</Link>}
    </div>
  </div>;

  const [overview, catalog, audit] = data;
  const number = new Intl.NumberFormat(locale);
  const metrics = ["users", "beans", "new_users_30d", "new_beans_30d", "active_users_30d"] as const;
  return <div className="space-y-10 pb-8">
    <PageIntro eyebrow={t.eyebrow} title={t.title} description={t.description} meta={back} />

    <section aria-labelledby="admin-overview-title">
      <h2 id="admin-overview-title" className="text-lg font-semibold text-brown">{t.overview}</h2>
      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map((metric) => <div key={metric}>
          <dt className="text-xs leading-5 text-brown-light">{t[metric]}</dt>
          <dd className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-brown">{number.format(overview[metric])}</dd>
        </div>)}
      </dl>
      <p className="mt-5 text-xs leading-5 text-brown-light">{t.periodHelp}</p>
    </section>

    <section aria-labelledby="admin-catalog-title" className="journal-panel p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="admin-catalog-title" className="text-lg font-semibold text-brown">{t.catalog}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brown-light">{t.catalogHelp}</p>
        </div>
        <p className="text-xs leading-6 tabular-nums text-brown-light">
          {t.country} {number.format(overview.countries)} · {t.region} {number.format(overview.regions)} · {t.entity} {number.format(overview.entities)}
        </p>
      </div>

      <form action={path} method="get" className="my-6 grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-end">
        <div className="space-y-2">
          <label htmlFor="catalog-kind" className="block text-sm font-semibold text-brown">{t.kind}</label>
          <select id="catalog-kind" name="kind" defaultValue={kind}
            className="min-h-12 w-full rounded-md border border-border-light bg-surface px-3 text-sm text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <option value="country">{t.country}</option><option value="region">{t.region}</option><option value="entity">{t.entity}</option>
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="catalog-search" className="block text-sm font-semibold text-brown">{t.search}</label>
          <input id="catalog-search" name="q" type="search" defaultValue={q} maxLength={100} placeholder={t.searchPlaceholder}
            className="min-h-12 w-full rounded-md border border-border-light bg-surface px-3 text-sm text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent" />
        </div>
        <button type="submit" className={buttonClassName({ className: "min-h-12" })}>{t.searchButton}</button>
      </form>

      <p className="mb-2 text-xs tabular-nums text-brown-light">{t.results} {number.format(catalog.total)} {t.count}</p>
      <CatalogEditor key={`${kind}:${q}:${offset}`} items={catalog.items} locale={locale} />
      {(catalog.total > catalog.limit || offset > 0) && <nav aria-label={t.results} className="mt-5 flex items-center justify-between gap-3">
        {offset > 0 ? <Link href={href(Math.max(0, offset - catalog.limit))} prefetch={false}
          className={buttonClassName({ variant: "secondary" })}>{t.previous}</Link> : <span />}
        <span className="text-xs tabular-nums text-brown-light">{Math.floor(offset / catalog.limit) + 1} / {Math.max(1, Math.ceil(catalog.total / catalog.limit))}</span>
        {offset + catalog.limit < catalog.total ? <Link href={href(offset + catalog.limit)} prefetch={false}
          className={buttonClassName({ variant: "secondary" })}>{t.next}</Link> : <span />}
      </nav>}
    </section>

    <section aria-labelledby="admin-audit-title">
      <h2 id="admin-audit-title" className="text-lg font-semibold text-brown">{t.audit}</h2>
      <p className="mt-2 text-sm text-brown-light">{t.auditHelp}</p>
      {audit.items.length === 0 ? <p className="mt-5 text-sm text-brown-light">{t.noAudit}</p> :
        <ol className="mt-5 divide-y divide-border-light">
          {audit.items.map((entry) => <li key={entry.id} className="grid gap-2 py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
            <time dateTime={entry.created_at} className="text-xs leading-6 tabular-nums text-brown-light">
              {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(entry.created_at))} KST
            </time>
            <div className="min-w-0 space-y-2 break-words">
              <p className="text-sm font-semibold text-brown"><span className="mr-2 font-normal text-brown-light">{t[entry.kind]}</span>{entry.item_name}</p>
              <p className="text-sm text-brown-light">{t.before}: {entry.old_name_ko ?? t.emptyName} <span aria-hidden="true">→</span> {t.after}: {entry.new_name_ko ?? t.emptyName}</p>
              <p className="text-sm leading-6 text-brown-light">{entry.reason}</p>
            </div>
          </li>)}
        </ol>}
    </section>
    <p className="text-xs leading-5 text-brown-light">{t.privacy}</p>
  </div>;
}
