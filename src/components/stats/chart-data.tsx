"use client";

import { useTranslations } from "next-intl";

/** Exact values remain available without hovering a chart or reading clipped axis labels. */
export function ChartData({ title, rows }: { title: string; rows: [string, number][] }) {
  const t = useTranslations("stats");
  return (
    <details className="mt-4 border-t border-border-light pt-2">
      <summary className="min-h-11 cursor-pointer rounded-sm py-3 text-sm font-medium text-brown-light focus-visible:outline-2 focus-visible:outline-accent">
        {t("viewData")}
      </summary>
      <table className="w-full table-fixed text-sm">
        <caption className="sr-only">{title}</caption>
        <thead className="text-xs text-brown-light">
          <tr>
            <th scope="col" className="py-2 text-left font-medium">{title}</th>
            <th scope="col" className="w-20 py-2 text-right font-medium">{t("recordCount")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, count]) => (
            <tr key={label} className="border-t border-border-light">
              <th scope="row" className="break-words py-2 pr-3 text-left font-normal text-brown">{label}</th>
              <td className="py-2 text-right tabular-nums text-brown">{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
