"use client";

import { useTranslations } from "next-intl";
import { BeanForm } from "@/components/beans/bean-form";

export default function NewBeanPage() {
  const t = useTranslations("beans");

  return (
    <div className="mx-auto max-w-4xl">
      <header className="animate-rise mb-8 border-y border-border-light py-9 md:py-12">
        <h1 className="display-title text-5xl text-brown md:text-7xl">
          {t("newTitle")}
        </h1>
      </header>

      <BeanForm mode="create" />
    </div>
  );
}
