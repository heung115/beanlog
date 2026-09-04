"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signUp, signInWithOAuth } from "@/lib/actions/auth";
import { brand } from "@/config/brand";
import { AuthShell } from "@/components/auth/auth-shell";

export default function SignupPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasGuestDraft = searchParams.get("draft") === "1";
  const nextPath = hasGuestDraft ? `/${locale}/beans/new?draft=1` : undefined;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [agreementError, setAgreementError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAgreementError(false);

    if (!acceptedTerms) {
      setAgreementError(true);
      return;
    }

    if (password !== passwordConfirm) {
      setError(t("signupError"));
      return;
    }

    setLoading(true);
    try {
      const result = await signUp(email, password, displayName, acceptedTerms);
      if (result?.error) {
        setError(t("signupError"));
      } else {
        router.replace(
          `/${locale}/signup/check-email${hasGuestDraft ? "?draft=1" : ""}`
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
        <div className="mb-9 border-b-2 border-brown pb-5">
          <h1 className="font-display text-4xl font-bold tracking-[-0.04em] text-brown">
            {brand.name}
          </h1>
          <p className="mt-2 text-sm text-brown-light">{t("signupTitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label={t("displayName")}
            type="text"
            name="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Coffee Lover"
            required
          />
          <Input
            label={t("email")}
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
          <Input
            label={t("password")}
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
            autoComplete="new-password"
          />

          <Input
            label={t("passwordConfirm")}
            type="password"
            name="passwordConfirm"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
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
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-brown-light">{t("orContinueWith")}</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="flex flex-col gap-3">
          <Button
            variant="secondary"
            className="w-full"
            disabled={!acceptedTerms}
            onClick={() => signInWithOAuth("google", acceptedTerms, nextPath)}
          >
            <GoogleIcon className="mr-2 h-4 w-4" />
            {t("loginWithGoogle")}
          </Button>
          <Button
            variant="secondary"
            className="w-full border-[#FEE500] bg-[#FEE500] text-[#191919] hover:bg-[#FEE500]/90"
            disabled={!acceptedTerms}
            onClick={() => signInWithOAuth("kakao", acceptedTerms, nextPath)}
          >
            <KakaoIcon className="mr-2 h-4 w-4" />
            {t("loginWithKakao")}
          </Button>
        </div>

        <p className="mt-8 text-center text-sm text-brown-light">
          {t("hasAccount")}{" "}
          <Link
            href={`/${locale}/login${hasGuestDraft ? "?draft=1" : ""}`}
            className="font-medium text-accent hover:underline"
          >
            {t("goLogin")}
          </Link>
        </p>
    </AuthShell>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function KakaoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#191919">
      <path d="M12 3C6.48 3 2 6.58 2 10.9c0 2.78 1.86 5.22 4.65 6.6l-.95 3.53c-.08.3.26.54.52.37l4.17-2.74c.52.07 1.05.1 1.61.1 5.52 0 10-3.58 10-7.96C22 6.58 17.52 3 12 3z" />
    </svg>
  );
}
