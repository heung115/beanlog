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
      <header className="mb-8 px-1 py-4 md:mb-10 md:py-6">
        <Link href="/" aria-label={brand.name} className="inline-flex focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <BeanmapMark compact />
        </Link>
        <h1 className="mt-6 max-w-xl font-display text-3xl font-semibold leading-tight tracking-[-0.03em] text-brown md:text-4xl">
          {t("title")}
        </h1>
      </header>
      <GuestRecordForm />
    </div>
  );
}
