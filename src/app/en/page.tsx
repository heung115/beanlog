import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { buildLandingMetadata } from "@/lib/seo";

export const metadata: Metadata = buildLandingMetadata("en");

export default function EnglishLandingPage() {
  return <LandingPage locale="en" />;
}
