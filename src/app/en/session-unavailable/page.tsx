import type { Metadata } from "next";
import { SessionUnavailablePage } from "@/components/auth/session-unavailable-page";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  return <SessionUnavailablePage locale="en" next={(await searchParams).next} />;
}
