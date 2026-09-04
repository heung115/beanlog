"use client";

import { useTranslations } from "next-intl";
import { BeanForm } from "@/components/beans/bean-form";
import { PageIntro } from "@/components/layout/page-intro";

export default function NewBeanPage() {
  const t = useTranslations("beans");

  return (
    <div className="mx-auto max-w-5xl">
      <PageIntro
        testId="bean-form-header"
        eyebrow={t("newEyebrow")}
        title={t("newTitle")}
        description={t("newDescription")}
      />

      <div className="mt-8 max-w-4xl md:mt-10">
        <BeanForm mode="create" />
      </div>
    </div>
  );
}
