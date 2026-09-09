import type { OriginSpecialtyLot } from "@/data/origin-guides/types";
import { varietyDisplayNames } from "@/data/coffee-varieties/display";

export function SpecialtyLots({ lots, locale }: { lots: OriginSpecialtyLot[]; locale: string }) {
  if (lots.length === 0) return null;
  const language = locale === "en" ? "en" : "ko";
  const isKorean = language === "ko";
  return (
    <section className="mt-10" data-testid="specialty-lots" aria-labelledby="specialty-lots-title">
      <h2 id="specialty-lots-title" className="py-3 text-lg font-semibold tracking-[-0.015em] text-brown">{isKorean ? "세부 랏" : "Lot details"}</h2>
      <ol className="mt-3 divide-y divide-border-light">
        {lots.map((lot, index) => (
          <li key={`${lot.name}-${lot.producer}-${index}`} className="grid min-w-0 gap-4 py-5 md:grid-cols-2 md:gap-10" data-specialty-lot>
            <div className="min-w-0">
              <h3 className="break-words text-base font-semibold leading-7 text-brown">{lot.name}</h3>
              {lot.producer && <p className="mt-1 break-words text-sm leading-6 text-brown-medium">{lot.producer}</p>}
              <p className="mt-1 break-words text-xs leading-6 text-brown-light">{lot.location}{lot.harvest ? ` · ${isKorean ? "수확" : "Harvest"} ${lot.harvest}` : ""}</p>
              <details className="mt-2" data-lot-sources>
                <summary className="min-h-11 cursor-pointer py-3 text-xs font-medium text-brown-light">{isKorean ? "출처" : "Sources"}</summary>
                <ul className="space-y-1">
                  {lot.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center break-words text-xs leading-6 text-accent underline underline-offset-4">{source.publisher} · {source.title}</a></li>)}
                </ul>
              </details>
            </div>
            <dl className="min-w-0 space-y-3 text-sm leading-6">
              {(lot.varieties.length > 0 || lot.process) && <div><dt className="folio-label">{lot.varieties.length > 0 ? (lot.process ? (isKorean ? "품종 · 가공" : "Variety · process") : (isKorean ? "품종" : "Variety")) : (isKorean ? "가공" : "Process")}</dt><dd className="mt-1 break-words text-brown-medium">{varietyDisplayNames(lot.varieties).join(" · ")}{lot.process && <span className="block">{lot.process[language]}</span>}</dd></div>}
              {lot.flavorNotes[language].length > 0 && <div><dt className="folio-label">{isKorean ? "향미" : "Tasting notes"}</dt><dd className="mt-1 break-words text-accent">{lot.flavorNotes[language].join(" · ")}</dd></div>}
            </dl>
          </li>
        ))}
      </ol>
    </section>
  );
}
