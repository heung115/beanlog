"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { GuestRecordForm } from "@/components/beans/guest-record-form";
import { brand } from "@/config/brand";
import { BeanmapMark } from "@/components/brand/beanmap-mark";

export default function GuestRecordPage() {
  const t = useTranslations("guest");

  return (
    <div className="mx-auto max-w-4xl py-4 md:py-8">
      <header className="relative mb-8 overflow-hidden border-y-2 border-brown bg-surface-warm px-5 py-8 md:px-8 md:py-10">
        <Link href="/" aria-label={brand.name} className="inline-flex focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
          <BeanmapMark compact />
        </Link>
        <p className="journal-kicker mt-8">TRY A FIELD NOTE / 00</p>
        <h1 className="display-title mt-3 max-w-xl text-4xl text-brown md:text-6xl">
          {t("title")}
        </h1>
      </header>
      <GuestRecordForm />
    </div>
  );
}
