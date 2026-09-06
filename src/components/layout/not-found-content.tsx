import Link from "next/link";
import { BeanmapMark } from "@/components/brand/beanmap-mark";
import { OriginContours } from "@/components/brand/origin-contours";
import { buttonClassName } from "@/components/ui/button";

/** Content only: root and localized routes each provide their own main landmark. */
export function NotFoundContent({ locale }: { locale: string }) {
  const ko = locale !== "en";
  return (
    <section className="relative mx-auto w-full max-w-3xl overflow-hidden py-4 md:py-8">
      <OriginContours className="pointer-events-none absolute -right-40 -top-40 h-[38rem] w-[46rem] opacity-55" />
      <div className="relative max-w-2xl">
        <BeanmapMark />
        <p className="folio-label mt-12 text-accent">404</p>
        <h1 className="mt-4 max-w-xl font-display text-3xl font-semibold leading-tight tracking-[-0.03em] text-brown md:text-4xl">
          {ko ? "페이지를 찾을 수 없습니다." : "Page not found"}
        </h1>
        <p className="mt-5 max-w-lg text-sm leading-7 text-brown-medium">
          {ko ? "주소를 확인하거나 beanmap 홈으로 돌아가 주세요." : "Check the address or return to the beanmap home page."}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={ko ? "/ko" : "/en"} className={buttonClassName({ size: "lg" })}>{ko ? "홈으로 돌아가기" : "Return home"}</Link>
          <Link href={ko ? "/ko/origins" : "/en/origins"} className={buttonClassName({ variant: "secondary", size: "lg" })}>{ko ? "커피 산지 둘러보기" : "Explore coffee origins"}</Link>
        </div>
      </div>
    </section>
  );
}
