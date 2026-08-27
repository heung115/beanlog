import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { brand } from "@/config/brand";

const recordFields = [
  ["산지", "에티오피아 · 벤사"],
  ["가공", "내추럴"],
  ["품종", "74158"],
  ["로스팅", "약배전"],
] as const;

const features = [
  ["기록", "원두 이름 · 로스터리 · 산지 · 품종 · 가공 방식 · 점수 · 테이스팅 노트"],
  ["검색", "원두 · 로스터리 · 메모 검색 / 산지 · 가공 방식 · 품종 필터"],
  ["통계", "산지 · 가공 방식 · 품종 · 월별 기록 · 점수 분포"],
  ["산지 정보", "20개 산지의 대표 향미 · 재배 고도 · 주요 품종 · 생산 지역"],
] as const;

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
          <Link
            href="/"
            className="font-display text-xl font-bold tracking-[-0.03em] text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {brand.name}
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/ko/login"
              className="px-3 py-2 text-sm font-medium text-brown-light transition-colors hover:text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              로그인
            </Link>
            <Link href="/ko/signup" className={buttonClassName({ size: "sm" })}>
              회원가입
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-14 md:grid-cols-[minmax(0,0.82fr)_minmax(24rem,0.78fr)] md:items-center md:gap-20 md:px-6 md:py-20">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-[-0.045em] text-brown md:text-6xl">
              {brand.name}
            </h1>

            <dl className="mt-10 border-t-2 border-brown">
              <div className="grid grid-cols-[5rem_1fr] border-b border-border py-4 text-sm">
                <dt className="text-brown-light">기록</dt>
                <dd className="font-medium text-brown">원두 정보 · 점수 · 테이스팅 노트</dd>
              </div>
              <div className="grid grid-cols-[5rem_1fr] border-b border-border py-4 text-sm">
                <dt className="text-brown-light">찾기</dt>
                <dd className="font-medium text-brown">검색 · 필터 · 정렬</dd>
              </div>
              <div className="grid grid-cols-[5rem_1fr] border-b border-border py-4 text-sm">
                <dt className="text-brown-light">확인</dt>
                <dd className="font-medium text-brown">산지 정보 · 기록 통계</dd>
              </div>
            </dl>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/ko/try" className={buttonClassName({ size: "lg" })}>
                로그인 없이 기록
              </Link>
              <Link
                href="/ko/login"
                className={buttonClassName({ variant: "secondary", size: "lg" })}
              >
                로그인
              </Link>
            </div>
          </div>

          <article
            className="journal-panel-feature bg-surface p-5 md:p-7"
            aria-label="커피 기록 예시"
          >
            <div className="flex items-center justify-between border-b border-border pb-4 text-xs text-brown-light">
              <span className="font-semibold text-accent">기록 예시</span>
              <time dateTime="2026-08-12">2026. 08. 12</time>
            </div>

            <div className="border-b border-border py-6">
              <p className="text-xs font-medium text-brown-light">Fritz Coffee Company</p>
              <h2 className="mt-2 font-display text-2xl font-bold leading-tight tracking-[-0.025em] text-brown">
                Ethiopia Bensa Bombe
              </h2>
            </div>

            <dl className="grid grid-cols-2 border-b border-border">
              {recordFields.map(([term, value], index) => (
                <div
                  key={term}
                  className={`py-4 ${index % 2 === 0 ? "border-r border-border pr-4" : "pl-4"}`}
                >
                  <dt className="text-xs text-brown-light">{term}</dt>
                  <dd className="mt-1 text-sm font-medium text-brown">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="flex items-end justify-between gap-6 pt-5">
              <div>
                <p className="text-xs text-brown-light">테이스팅 노트</p>
                <p className="mt-2 text-sm leading-6 text-brown">복숭아 · 재스민 · 꿀 같은 단맛</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-brown-light">종합 점수</p>
                <p className="mt-1 font-display text-3xl font-bold tabular-nums tracking-tight text-accent">
                  4.6
                </p>
              </div>
            </div>
          </article>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 md:px-6 md:py-20">
            <h2 className="font-display text-2xl font-bold tracking-[-0.03em] text-brown">기능</h2>
            <dl className="mt-8 border-t-2 border-brown">
              {features.map(([term, description]) => (
                <div
                  key={term}
                  className="grid gap-2 border-b border-border py-5 text-sm md:grid-cols-[10rem_1fr] md:gap-8"
                >
                  <dt className="font-semibold text-brown">{term}</dt>
                  <dd className="leading-6 text-brown-medium">{description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-14 md:px-6 md:py-20">
          <h2 className="font-display text-2xl font-bold tracking-[-0.03em] text-brown">이용 방법</h2>
          <ol className="mt-8 grid border-y border-border md:grid-cols-3">
            <li className="flex items-center gap-4 border-b border-border py-5 md:border-b-0 md:border-r md:px-6">
              <span className="text-sm font-semibold tabular-nums text-accent">01</span>
              <span className="font-medium text-brown">회원가입</span>
            </li>
            <li className="flex items-center gap-4 border-b border-border py-5 md:border-b-0 md:border-r md:px-6">
              <span className="text-sm font-semibold tabular-nums text-accent">02</span>
              <span className="font-medium text-brown">커피 기록 추가</span>
            </li>
            <li className="flex items-center gap-4 py-5 md:px-6">
              <span className="text-sm font-semibold tabular-nums text-accent">03</span>
              <span className="font-medium text-brown">목록 · 통계 확인</span>
            </li>
          </ol>
        </section>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 text-xs text-brown-light md:px-6">
          <span className="font-semibold text-brown">{brand.name}</span>
          <span>한국어 · English</span>
        </div>
      </footer>
    </div>
  );
}
