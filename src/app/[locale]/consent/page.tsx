import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { OAuthConsentForm } from "@/components/auth/oauth-consent-form";
import { createClient } from "@/lib/supabase/server";
import { isTemporaryAuthError } from "@/lib/supabase/auth-recovery";
import { resolvePostAuthPath } from "@/lib/security/redirect";

export default async function ConsentPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const requestedNext = resolvePostAuthPath((await searchParams).next);
  const next = requestedNext === "/explore" ? `/${locale}/explore` : requestedNext;
  const query = new URLSearchParams({ next });
  const t = await getTranslations({ locale, namespace: "auth" });
  let user;
  let unavailable = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    user = error ? null : data.user;
    unavailable = isTemporaryAuthError(error);
  } catch {
    unavailable = true;
  }

  if (unavailable) {
    return (
      <AuthShell>
        <h1 className="font-display text-2xl font-semibold tracking-[-0.025em] text-brown">{t("consentTitle")}</h1>
        <p role="alert" className="mt-4 text-sm text-red-700">{t("consentUnavailable")}</p>
        <a href={`/${locale}/consent?${query}`} className="mt-5 inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4">{t("sessionRetry")}</a>
      </AuthShell>
    );
  }
  if (!user) redirect(`/${locale}/login?${query}`);
  if (user.app_metadata.beanmap_pending_consent !== true) redirect(next);

  return (
    <AuthShell>
      <h1 className="mb-8 font-display text-2xl font-semibold tracking-[-0.025em] text-brown">{t("consentTitle")}</h1>
      <OAuthConsentForm locale={locale} next={next} />
    </AuthShell>
  );
}
