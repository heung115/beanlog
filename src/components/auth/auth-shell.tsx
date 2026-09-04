import { OriginContours } from "@/components/brand/origin-contours";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[42rem] max-w-5xl items-center py-5 md:py-10">
      <div className="grid w-full md:grid-cols-[minmax(18rem,0.72fr)_minmax(23rem,0.9fr)] md:gap-10 lg:gap-16">
        <aside className="relative hidden min-h-[40rem] overflow-hidden bg-surface-warm p-9 md:block">
          <OriginContours className="absolute -bottom-20 -left-36 h-[38rem] w-[46rem] opacity-70" />
          <div className="relative">
            <p className="max-w-xs font-display text-3xl font-semibold leading-tight tracking-[-0.025em] text-brown">
              beanmap
            </p>
          </div>
        </aside>
        <section className="px-5 py-9 sm:px-10 md:flex md:min-h-[40rem] md:items-center md:px-8 md:py-10 lg:px-10">
          <div className="mx-auto w-full max-w-sm">{children}</div>
        </section>
      </div>
    </div>
  );
}
