"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { unstable_rethrow, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInAction, type SignInState } from "@/lib/actions/auth";
import { resolvePostAuthPath } from "@/lib/security/redirect";
import { SocialSignInButtons } from "@/components/auth/social-sign-in-buttons";
import { AuthShell } from "@/components/auth/auth-shell";
import { useSocialAuthConsent } from "@/components/auth/use-social-auth-consent";

export default function LoginPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const hasGuestDraft = searchParams.get("draft") === "1";
  const requestedNext = resolvePostAuthPath(searchParams.get("next"));
  const nextPath = hasGuestDraft ? `/${locale}/beans/new?draft=1`
    : requestedNext !== "/explore" ? requestedNext : `/${locale}/explore`;
  const authQuery = hasGuestDraft ? "?draft=1"
    : requestedNext !== "/explore" ? `?${new URLSearchParams({ next: requestedNext })}` : "";
  // Keep the actual server action here so the rendered form can POST before
  // hydration or with JavaScript disabled. A client wrapper loses that metadata.
  const [serverState, formAction, serverPending] = useActionState(signInAction, {});
  const [clientState, setClientState] = useState<SignInState | null>(null);
  const [clientPending, startTransition] = useTransition();
  const submittingRef = useRef(false);
  const state = clientState ?? serverState;
  const pending = serverPending || clientPending;
  const [socialTermsAccepted, setSocialTermsAccepted] = useSocialAuthConsent();
  const oauthError = searchParams.get("authError");
  const oauthMessage = oauthError === "expired" ? "socialExpired"
    : oauthError === "cancelled" ? "socialCancelled"
    : oauthError === "failed" ? "socialError" : null;
  const loginErrorMessage = state.error === "email_not_confirmed" ? "emailNotConfirmed"
    : state.error === "rate_limited" ? "loginRateLimited"
    : state.error === "temporarily_unavailable" ? "loginUnavailable"
    : "loginError";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || serverPending) return;
    const formData = new FormData(event.currentTarget);
    submittingRef.current = true;
    setClientState({});
    startTransition(async () => {
      try {
        setClientState(await signInAction(state, formData));
      } catch (error) {
        unstable_rethrow(error);
        // Hydrated submissions can recover from a browser-to-app failure
        // without replacing the native form or losing its entered values.
        setClientState({ error: "temporarily_unavailable" });
      } finally {
        submittingRef.current = false;
      }
    });
  }

  return (
    <AuthShell>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.025em] text-brown">
          {t("login")}
        </h1>
        <p className="mt-1.5 text-sm text-brown-light">{t("loginTitle")}</p>
        {oauthMessage && <p role="alert" className="mt-4 text-sm text-red-600">{t(oauthMessage)}</p>}
      </div>

        <form
          action={formAction}
          onSubmit={handleSubmit}
          // Failed actions must preserve input and the session preference.
          // Successful sign-in redirects and unmounts this form.
          onReset={(event) => event.preventDefault()}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="next" value={nextPath} />
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
            <p role="alert" className="text-sm text-red-600">
              {t(loginErrorMessage)}
            </p>
          )}

          <Button type="submit" loading={pending} className="mt-2 w-full">
            {t("login")}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border-light" />
          <span className="text-xs text-brown-light">{t("orContinueWith")}</span>
          <div className="h-px flex-1 bg-border-light" />
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
          <SocialSignInButtons acceptedTerms={socialTermsAccepted} nextPath={nextPath} />
        </div>

        <p className="mt-8 text-center text-sm text-brown-light">
          {t("noAccount")}{" "}
          <Link
            href={`/${locale}/signup${authQuery}`}
            className="font-medium text-accent hover:underline"
          >
            {t("goSignup")}
          </Link>
        </p>
    </AuthShell>
  );
}
