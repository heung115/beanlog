import Link from "next/link";
import { regionGuidePath } from "@/data/origin-guides";
import type { OriginRegionGuide } from "@/data/origin-guides/types";

interface RegionGuideListProps {
  guides: OriginRegionGuide[];
  locale: string;
  parents?: OriginRegionGuide[];
}

export function RegionGuideList({ guides, locale, parents = guides }: RegionGuideListProps) {
  const language = locale === "en" ? "en" : "ko";
  const isKorean = language === "ko";
  const byId = new Map(parents.map((guide) => [guide.id, guide]));

  return (
    <ol className="min-w-0" data-testid="origin-region-list">
      {guides.map((guide) => {
        const parent = guide.parentId ? byId.get(guide.parentId) : undefined;
        const name = isKorean ? guide.nameKo : guide.name;
        const childCount = parents.filter((child) => child.parentId === guide.id).length;
        const secondaryName = isKorean ? guide.name : guide.nameKo;

        return (
          <li key={guide.id} className="ledger-row">
            <Link
              href={`/${locale}${regionGuidePath(guide)}`}
              prefetch={false}
              data-region-row
              className="group -mx-2 grid min-w-0 grid-cols-[minmax(0,1fr)_1rem] gap-x-4 rounded-md px-2 py-5 transition-colors hover:bg-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)_1rem] md:gap-x-6"
            >
              <span className="min-w-0">
                {guide.kind === "microregion" && (
                  <span className="mb-1.5 block text-[11px] font-medium text-accent">
                    {isKorean ? "세부 지역" : "Microregion"}
                    {parent ? ` · ${isKorean ? parent.nameKo : parent.name}` : ""}
                  </span>
                )}
                <span className="block break-words text-base font-semibold tracking-[-0.015em] text-brown transition-colors group-hover:text-accent md:text-lg">
                  {name}
                </span>
                {secondaryName !== name && <span className="mt-1 block text-xs text-brown-light">{secondaryName}</span>}
                {childCount > 0 && <span className="mt-2 block text-xs text-accent">{isKorean ? `세부 지역 ${childCount}곳 더 보기` : `Explore ${childCount} connected areas`}</span>}
                {guide.altitude && (
                  <span className="mt-2 block text-xs tabular-nums text-brown-light">
                    {guide.altitude.min.toLocaleString("en-US")}–{guide.altitude.max.toLocaleString("en-US")} m
                  </span>
                )}
              </span>
              <span className="col-start-1 row-start-2 mt-3 min-w-0 md:col-start-2 md:row-start-1 md:mt-0">
                <span className="block text-sm leading-6 text-brown-medium">{guide.summary[language]}</span>
                <span className="mt-2 block text-xs leading-6 text-accent">{guide.verification?.flavorBasis === "lot" ? (isKorean ? "향미 기록 · " : "Recorded flavors · ") : guide.verification?.flavorBasis === "mixed" ? (isKorean ? "향미 기록 · " : "Recorded flavors · ") : ""}{guide.flavorNotes[language].join(" · ")}</span>
              </span>
              <span aria-hidden="true" className="col-start-2 row-start-1 self-center text-lg text-accent transition-transform group-hover:translate-x-1 md:col-start-3">→</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
