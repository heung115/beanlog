"use client";

import { useTranslations } from "next-intl";
import { BeanForm } from "@/components/beans/bean-form";

export default function NewBeanPage() {
  const t = useTranslations("beans");

  return (
    <div className="mx-auto max-w-4xl">
      <header data-testid="bean-form-header" className="animate-rise mb-6 pt-2 md:mb-7 md:pt-3">
        <h1 className="text-2xl font-semibold leading-tight tracking-[-0.025em] text-brown md:text-3xl">
          {t("newTitle")}
        </h1>
      </header>

      <BeanForm mode="create" />
    </div>
  );
}
