import Link from "next/link";
import { BeanmapMark } from "@/components/brand/beanmap-mark";
import { OriginContours } from "@/components/brand/origin-contours";
import { buttonClassName } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main-content" className="flex min-h-screen items-center bg-cream px-4 py-12">
      <section className="relative mx-auto grid w-full max-w-5xl overflow-hidden border-y-2 border-brown bg-surface md:grid-cols-[1fr_18rem] md:border-x">
        <OriginContours className="pointer-events-none absolute -right-40 -top-40 h-[38rem] w-[46rem] opacity-55" />
        <div className="relative p-7 md:p-14">
          <BeanmapMark />
          <h1 className="display-title mt-16 max-w-xl text-5xl text-brown md:text-7xl">
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
        <div className="relative flex min-h-52 items-end justify-end border-t border-border bg-surface-warm/65 p-7 md:min-h-0 md:border-l md:border-t-0">
          <span className="font-display text-8xl font-bold tracking-[-0.08em] text-accent">404</span>
        </div>
      </section>
    </main>
  );
}
