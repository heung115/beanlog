import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";
import { resolvePostAuthPath } from "@/lib/security/redirect";

export default async function ForgotPasswordPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; draft?: string; recoveryError?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: "auth" });
  const next = query.draft === "1" ? `/${locale}/beans/new?draft=1` : resolvePostAuthPath(query.next);
  return (
    <AuthShell>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.025em] text-brown">{t("forgotPasswordTitle")}</h1>
        <p className="mt-2 text-sm leading-6 text-brown-light">{t("forgotPasswordDescription")}</p>
      </div>
      <PasswordRecoveryForm mode="request" locale={locale} next={next} expired={query.recoveryError === "expired"} />
    </AuthShell>
  );
}
