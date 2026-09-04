"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { BeanForm } from "@/components/beans/bean-form";
import { buttonClassName } from "@/components/ui/button";
import { getBeanById } from "@/lib/actions/beans";
import type { BeanWithTags } from "@/types/database";

function FormSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="h-72 rounded-lg border border-border bg-surface" />
      <div className="h-12 rounded-lg border border-dashed border-border" />
      <div className="h-14 rounded-lg" />
    </div>
  );
}

export default function EditBeanPage() {
  const params = useParams<{ id: string }>();
  const locale = useLocale();
  const t = useTranslations("beans");

  const [bean, setBean] = useState<BeanWithTags | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getBeanById(params.id)
      .then((data) => {
        if (cancelled) return;
        setBean((data as BeanWithTags | null) ?? null);
      })
      .catch(() => {
        /* auth/network not ready — treat as not found */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="animate-rise mb-8 border-y border-border-light py-9 md:py-12">
        <h1 className="display-title text-5xl text-brown md:text-7xl">
          {t("editTitle")}
        </h1>
      </header>

      {loading ? (
        <FormSkeleton />
      ) : !bean ? (
        <div className="paper-sheet animate-rise px-6 py-16 text-center">
          <p className="font-display text-xl font-bold text-brown">
            {t("notFound")}
          </p>
          <p className="mt-2 text-sm text-brown-light">{t("notFoundSub")}</p>
          <Link
            href={`/${locale}/explore`}
            prefetch={false}
            className={buttonClassName({ variant: "secondary", className: "mt-6" })}
          >
            {t("back")}
          </Link>
        </div>
      ) : (
        <BeanForm key={bean.id} mode="edit" initial={bean} />
      )}
    </div>
  );
}
