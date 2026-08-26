"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInAction, signInWithOAuth } from "@/lib/actions/auth";
import { brand } from "@/config/brand";

export default function LoginPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(signInAction, {});
  const [socialTermsAccepted, setSocialTermsAccepted] = useState(false);

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="font-display text-3xl font-bold text-brown tracking-tight">
            {brand.name}
          </h1>
          <p className="mt-2 text-sm text-brown-light">{t("loginTitle")}</p>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <Input
            label={t("email")}
            type="email"
            name="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
          <Input
            label={t("password")}
            type="password"
            name="password"
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />

          <label className="flex cursor-pointer items-center gap-2 text-sm text-brown-light">
            <input
              type="checkbox"
              name="remember"
              defaultChecked
              className="h-4 w-4 rounded border-border accent-accent"
            />
            {t("rememberLogin")}
          </label>

          {state.error && (
            <p className="text-sm text-red-600">{t("loginError")}</p>
          )}

          <Button type="submit" loading={pending} className="mt-2 w-full">
            {t("login")}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-brown-light">{t("orContinueWith")}</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="flex flex-col gap-3">
          <label className="mb-1 flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-brown-light">
            <input
              type="checkbox"
              checked={socialTermsAccepted}
              onChange={(event) => setSocialTermsAccepted(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-accent"
            />
            <span>
              {t.rich("socialLegalAgreement", {
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
          <Button
            variant="secondary"
            className="w-full"
            disabled={!socialTermsAccepted}
            onClick={() => signInWithOAuth("google", socialTermsAccepted)}
          >
            <GoogleIcon className="mr-2 h-4 w-4" />
            {t("loginWithGoogle")}
          </Button>
          <Button
            variant="secondary"
            className="w-full border-[#FEE500] bg-[#FEE500] text-[#191919] hover:bg-[#FEE500]/90"
            disabled={!socialTermsAccepted}
            onClick={() => signInWithOAuth("kakao", socialTermsAccepted)}
          >
            <KakaoIcon className="mr-2 h-4 w-4" />
            {t("loginWithKakao")}
          </Button>
        </div>

        <p className="mt-8 text-center text-sm text-brown-light">
          {t("noAccount")}{" "}
          <Link href="/signup" className="font-medium text-accent hover:underline">
            {t("goSignup")}
          </Link>
        </p>
      </div>
    </div>
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
