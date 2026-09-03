import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { buildLandingMetadata } from "@/lib/seo";

export const metadata: Metadata = buildLandingMetadata("ko");

export default function KoreanLandingPage() {
  return <LandingPage locale="ko" />;
}
