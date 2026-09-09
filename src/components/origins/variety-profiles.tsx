import type { CoffeeVarietyGuide } from "@/data/coffee-varieties/types";

export function VarietyProfiles({ guides, locale }: { guides: CoffeeVarietyGuide[]; locale: string }) {
  if (guides.length === 0) return null;
  const language = locale === "en" ? "en" : "ko";
  const ko = language === "ko";
  return (
    <details className="mt-6 border-t border-border-light" data-testid="region-variety-profiles">
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-brown">{ko ? "품종별 특성" : "Variety profiles"}</summary>
      <div className="divide-y divide-border-light">
        {guides.map((guide) => (
          <section key={guide.id} className="py-5" data-variety-profile={guide.id} aria-labelledby={`variety-${guide.id}`}>
            <h3 id={`variety-${guide.id}`} className="text-base font-semibold text-brown">{ko ? guide.nameKo : guide.name}</h3>
            {ko && <p className="mt-1 text-xs text-brown-light">{guide.name}</p>}
            <p className="mt-3 text-sm leading-7 text-brown-medium">{guide.summary[language]}</p>
            <dl className="mt-4 space-y-3 text-sm leading-7">
              {guide.lineage && <div><dt className="folio-label">{ko ? "계통" : "Lineage"}</dt><dd className="mt-1 text-brown-medium">{guide.lineage[language]}</dd></div>}
              {guide.growing && <div><dt className="folio-label">{ko ? "재배 환경" : "Growing conditions"}</dt><dd className="mt-1 text-brown-medium">{guide.growing[language]}</dd></div>}
              {guide.traits && <div><dt className="folio-label">{ko ? "특성" : "Traits"}</dt><dd className="mt-1 text-brown-medium">{guide.traits[language]}</dd></div>}
            </dl>
            <details className="mt-3" data-variety-sources>
              <summary className="min-h-11 cursor-pointer py-3 text-xs font-medium text-brown-light">{ko ? "출처" : "Sources"}</summary>
              <ul className="space-y-2">
                {guide.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center break-words text-xs leading-6 text-accent underline underline-offset-4">{source.publisher} · {source.title}</a></li>)}
              </ul>
            </details>
          </section>
        ))}
      </div>
    </details>
  );
}
