"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { GuestRecordForm } from "@/components/beans/guest-record-form";
import { brand } from "@/config/brand";

export default function GuestRecordPage() {
  const t = useTranslations("guest");

  return (
    <div className="mx-auto max-w-2xl py-4 md:py-8">
      <header className="mb-8 border-b border-border pb-6">
        <Link href="/" className="text-sm font-semibold text-accent hover:underline">
          {brand.name}
        </Link>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-[-0.035em] text-brown md:text-4xl">
          {t("title")}
        </h1>
      </header>
      <GuestRecordForm />
    </div>
  );
}
