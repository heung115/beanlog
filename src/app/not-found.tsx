import Link from "next/link";
import { BeanmapMark } from "@/components/brand/beanmap-mark";
import { OriginContours } from "@/components/brand/origin-contours";
import { buttonClassName } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main-content" className="flex min-h-screen items-center bg-cream px-4 py-12">
      <section className="relative mx-auto w-full max-w-3xl overflow-hidden py-4 md:py-8">
        <OriginContours className="pointer-events-none absolute -right-40 -top-40 h-[38rem] w-[46rem] opacity-55" />
        <div className="relative max-w-2xl">
          <BeanmapMark />
          <p className="folio-label mt-12 text-accent">404</p>
          <h1 className="mt-4 max-w-xl font-display text-3xl font-semibold leading-tight tracking-[-0.03em] text-brown md:text-4xl">
            페이지를 찾을 수 없습니다.
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-7 text-brown-medium">
            주소를 확인하거나 beanmap 홈으로 돌아가 주세요.<br />
            Check the address or return to the beanmap home page.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/ko" className={buttonClassName({ size: "lg" })}>한국어 홈</Link>
            <Link href="/en" className={buttonClassName({ variant: "secondary", size: "lg" })}>English home</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
