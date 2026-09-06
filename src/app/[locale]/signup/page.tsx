"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signUp } from "@/lib/actions/auth";
import { resolvePostAuthPath } from "@/lib/security/redirect";
import { SocialSignInButtons } from "@/components/auth/social-sign-in-buttons";
import { AuthShell } from "@/components/auth/auth-shell";

export default function SignupPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasGuestDraft = searchParams.get("draft") === "1";
  const requestedNext = resolvePostAuthPath(searchParams.get("next"));
  const nextPath = hasGuestDraft ? `/${locale}/beans/new?draft=1`
    : requestedNext !== "/explore" ? requestedNext : `/${locale}/explore`;
  const authQuery = hasGuestDraft ? "?draft=1"
    : requestedNext !== "/explore" ? `?${new URLSearchParams({ next: requestedNext })}` : "";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [agreementError, setAgreementError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Read native input values so typing/autofill before hydration is preserved.
    const values = new FormData(e.currentTarget as HTMLFormElement);
    const email = String(values.get("email") ?? "");
    const password = String(values.get("password") ?? "");
    const passwordConfirm = String(values.get("passwordConfirm") ?? "");
    const displayName = String(values.get("displayName") ?? "");
    setError("");
    setAgreementError(false);

    if (!acceptedTerms) {
      setAgreementError(true);
      return;
    }

    if (password !== passwordConfirm) {
      setError(t("passwordMismatch"));
      return;
    }

    setLoading(true);
    try {
      const result = await signUp(email, password, displayName, acceptedTerms);
      if (result?.error) {
        setError(t("signupError"));
      } else {
        router.replace(
          `/${locale}/signup/check-email${authQuery}`
        );
      }
    } catch {
      setError(t("signupError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.025em] text-brown">
          {t("signup")}
        </h1>
        <p className="mt-1.5 text-sm text-brown-light">{t("signupTitle")}</p>
      </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label={t("displayName")}
            type="text"
            name="displayName"
            placeholder={t("displayNamePlaceholder")}
            maxLength={50}
            required
          />
          <Input
            label={t("email")}
            type="email"
            name="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
            maxLength={320}
          />
          <Input
            label={t("password")}
            type="password"
            name="password"
            placeholder="••••••••"
            required
            minLength={6}
            maxLength={128}
            autoComplete="new-password"
          />

          <Input
            label={t("passwordConfirm")}
            type="password"
            name="passwordConfirm"
            placeholder="••••••••"
            required
            minLength={6}
            maxLength={128}
            autoComplete="new-password"
          />

          <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-6 text-brown-light">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => {
                setAcceptedTerms(event.target.checked);
                setAgreementError(false);
              }}
              aria-invalid={agreementError}
              aria-describedby={agreementError ? "signup-agreement-error" : undefined}
              className="mt-1 h-4 w-4 shrink-0 rounded border-border accent-accent"
            />
            <span>
              {t.rich("legalAgreement", {
                terms: (chunks) => (
                  <Link
                    href={`/${locale}/terms`}
                    className="font-medium text-accent underline underline-offset-4"
                    target="_blank"
                  >
                    {chunks}
                  </Link>
                ),
                privacy: (chunks) => (
                  <Link
                    href={`/${locale}/privacy`}
                    className="font-medium text-accent underline underline-offset-4"
                    target="_blank"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </span>
          </label>

          {agreementError && (
            <p id="signup-agreement-error" role="alert" className="text-sm text-red-600">
              {t("agreementRequired")}
            </p>
          )}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

          <Button type="submit" loading={loading} className="mt-2 w-full">
            {t("signup")}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border-light" />
          <span className="text-xs text-brown-light">{t("orContinueWith")}</span>
          <div className="h-px flex-1 bg-border-light" />
        </div>

        <div className="flex flex-col gap-3">
          <SocialSignInButtons acceptedTerms={acceptedTerms} nextPath={nextPath} />
        </div>

        <p className="mt-8 text-center text-sm text-brown-light">
          {t("hasAccount")}{" "}
          <Link
            href={`/${locale}/login${authQuery}`}
            className="font-medium text-accent hover:underline"
          >
            {t("goLogin")}
          </Link>
        </p>
    </AuthShell>
  );
}
