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
          <p className="journal-kicker mt-16">ARCHIVE ERROR / 404</p>
          <h1 className="display-title mt-4 max-w-xl text-5xl text-brown md:text-7xl">
            이 페이지는 기록에서 찾을 수 없어요.
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-7 text-brown-medium">
            주소를 다시 확인하거나 beanmap 첫 화면으로 돌아가 주세요.<br />
            This page is not part of the archive. Check the address or return home.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/ko" className={buttonClassName({ size: "lg" })}>한국어 홈</Link>
            <Link href="/en" className={buttonClassName({ variant: "secondary", size: "lg" })}>English home</Link>
          </div>
        </div>
        <div className="relative flex min-h-52 items-end justify-end border-t border-border bg-surface-warm/65 p-7 md:min-h-0 md:border-l md:border-t-0">
          <span className="font-display text-8xl font-bold italic tracking-[-0.08em] text-accent">404</span>
        </div>
      </section>
    </main>
  );
}
