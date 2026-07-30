"use client";

import { useTranslations } from "next-intl";
import { BeanForm } from "@/components/beans/bean-form";

export default function NewBeanPage() {
  const t = useTranslations("beans");

  return (
    <div className="mx-auto max-w-2xl">
      <header className="animate-rise mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-brown md:text-4xl">
          {t("newTitle")}
        </h1>
      </header>

      <BeanForm mode="create" />
    </div>
  );
}
