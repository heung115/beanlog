import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";
import { resolvePostAuthPath } from "@/lib/security/redirect";
import { checkPasswordRecoveryProof } from "@/lib/security/password-recovery";
import { isTemporaryAuthError } from "@/lib/supabase/auth-recovery";

export default async function ResetPasswordPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const next = resolvePostAuthPath((await searchParams).next);
  const query = new URLSearchParams({ recoveryError: "expired" });
  if (next !== "/explore") query.set("next", next);
  let valid = false;
  let unavailable = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    valid = !error && Boolean(data.user) && await checkPasswordRecoveryProof(supabase, data.user!.id);
    unavailable = isTemporaryAuthError(error);
  } catch { unavailable = true; }
  const t = await getTranslations({ locale, namespace: "auth" });
  if (unavailable) {
    const retry = next === "/explore" ? "" : `?${new URLSearchParams({ next })}`;
    return <AuthShell>
      <h1 className="font-display text-2xl font-semibold text-brown">{t("resetPasswordTitle")}</h1>
      <p role="alert" className="mt-4 text-sm leading-6 text-red-700">{t("resetUnavailable")}</p>
      <a href={`/${locale}/reset-password${retry}`} className="mt-5 inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4">{t("sessionRetry")}</a>
    </AuthShell>;
  }
  if (!valid) redirect(`/${locale}/forgot-password?${query}`);
  return (
    <AuthShell>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.025em] text-brown">{t("resetPasswordTitle")}</h1>
        <p className="mt-2 text-sm leading-6 text-brown-light">{t("resetPasswordDescription")}</p>
      </div>
      <PasswordRecoveryForm mode="update" locale={locale} next={next} />
    </AuthShell>
  );
}
