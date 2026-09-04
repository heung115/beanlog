"use client";

import { useTranslations } from "next-intl";
import { BeanForm } from "@/components/beans/bean-form";

export default function NewBeanPage() {
  const t = useTranslations("beans");

  return (
    <div className="mx-auto max-w-4xl">
      <header className="animate-rise mb-8 border-y-2 border-brown py-9 md:grid md:grid-cols-[1fr_13rem] md:items-end md:py-12">
        <div>
          <p className="journal-kicker">NEW TASTING RECORD / 01</p>
          <h1 className="display-title mt-3 text-5xl text-brown md:text-7xl">
          {t("newTitle")}
          </h1>
        </div>
        <p className="folio-label mt-5 border-l-2 border-accent pl-4 md:mt-0">ORIGIN · PROCESS · CUP</p>
      </header>

      <BeanForm mode="create" />
    </div>
  );
}
