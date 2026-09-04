import { OriginContours } from "@/components/brand/origin-contours";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[42rem] max-w-5xl items-center py-5 md:py-10">
      <div className="grid w-full overflow-hidden border-y-2 border-brown bg-surface md:grid-cols-[minmax(19rem,0.72fr)_minmax(23rem,0.9fr)] md:border-x">
        <aside className="relative hidden min-h-[42rem] overflow-hidden border-r border-brown bg-surface-warm p-9 md:flex md:flex-col md:justify-between">
          <OriginContours className="absolute -bottom-20 -left-36 h-[38rem] w-[46rem] opacity-70" />
          <div className="relative">
            <p className="journal-kicker">PRIVATE TASTING ARCHIVE</p>
            <p className="mt-5 max-w-xs font-display text-5xl font-bold leading-[1.03] tracking-[-0.045em] text-brown">
              Keep a field note for every memorable cup.
            </p>
          </div>
          <dl className="relative border-t-2 border-brown bg-surface/60">
            {[
              ["01", "ORIGIN / 산지"],
              ["02", "PROCESS / 가공"],
              ["03", "CUP NOTE / 향미"],
            ].map(([number, label]) => (
              <div key={number} className="grid grid-cols-[2.5rem_1fr] border-b border-border py-3">
                <dt className="font-display text-lg italic text-accent">{number}</dt>
                <dd className="folio-label self-center">{label}</dd>
              </div>
            ))}
          </dl>
        </aside>
        <section className="px-5 py-10 sm:px-10 md:flex md:min-h-[42rem] md:items-center md:px-14 md:py-12">
          <div className="mx-auto w-full max-w-sm">{children}</div>
        </section>
      </div>
    </div>
  );
}
