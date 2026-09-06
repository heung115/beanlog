import { getLocale, getTranslations } from "next-intl/server";
import { BeanForm } from "@/components/beans/bean-form";
import { PageIntro } from "@/components/layout/page-intro";
import { createClient } from "@/lib/supabase/server";
import { buttonClassName } from "@/components/ui/button";

export default async function NewBeanPage({ searchParams }: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const t = await getTranslations("beans");
  const locale = await getLocale();
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    const auth = await getTranslations("auth");
    return (
      <div className="mx-auto max-w-xl py-12">
        <h1 className="text-2xl font-semibold text-brown">{auth("sessionUnavailableTitle")}</h1>
        <p className="mt-4 text-sm leading-7 text-brown-medium">{auth("sessionUnavailableDescription")}</p>
        <a href={`/${locale}/beans/new`} className={buttonClassName({ className: "mt-6" })}>{auth("sessionRetry")}</a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageIntro
        testId="bean-form-header"
        eyebrow={t("newEyebrow")}
        title={t("newTitle")}
      />

      <div className="mt-8 max-w-4xl md:mt-10">
        {params.error && (
          <p role="alert" className="mb-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
            {t(params.error === "invalid" ? "nativeInvalid" : "nativeSaveFailed")}
          </p>
        )}
        {params.saved === "1" && <p role="status" className="mb-5 text-sm text-brown">{t("saved")}</p>}
        <BeanForm key={user.id} mode="create" draftOwnerId={user.id} labelImportEnabled />
      </div>
    </div>
  );
}
