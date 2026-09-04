import Link from "next/link";
import { brand } from "@/config/brand";
import { legal } from "@/config/legal";

type FooterLocale = "ko" | "en";

const labels = {
  ko: {
    navigation: "사이트 안내, 법적 고지 및 문의",
    home: "홈",
    origins: "커피 산지",
    terms: "이용약관",
    privacy: "개인정보 처리방침",
    contact: "문의",
  },
  en: {
    navigation: "Site information, legal, and contact",
    home: "Home",
    origins: "Coffee origins",
    terms: "Terms of Service",
    privacy: "Privacy Policy",
    contact: "Contact",
  },
} as const;

export function SiteFooter({
  locale,
  wide = false,
  mobileNavOffset = false,
}: {
  locale: FooterLocale;
  wide?: boolean;
  mobileNavOffset?: boolean;
}) {
  const copy = labels[locale];

  return (
    <footer className="border-t-2 border-brown bg-surface text-xs text-brown-light">
      <div
        className={`mx-auto flex w-full flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between md:px-6 ${
          wide ? "max-w-6xl" : "max-w-6xl"
        } ${mobileNavOffset ? "pb-24 md:pb-6" : ""}`}
      >
        <span className="font-mono font-semibold uppercase tracking-[0.08em] text-brown">© {brand.name}</span>
        <nav
          aria-label={copy.navigation}
          className="flex flex-wrap items-center gap-x-4 gap-y-2"
        >
          <Link className="transition-colors hover:text-brown" href={`/${locale}`}>
            {copy.home}
          </Link>
          <Link className="transition-colors hover:text-brown" href={`/${locale}/origins`}>
            {copy.origins}
          </Link>
          <Link className="transition-colors hover:text-brown" href={`/${locale}/terms`}>
            {copy.terms}
          </Link>
          <Link className="transition-colors hover:text-brown" href={`/${locale}/privacy`}>
            {copy.privacy}
          </Link>
          {legal.contactEmail ? (
            <a
              className="transition-colors hover:text-brown"
              href={`mailto:${legal.contactEmail}`}
            >
              {copy.contact}: {legal.contactEmail}
            </a>
          ) : null}
        </nav>
      </div>
    </footer>
  );
}
