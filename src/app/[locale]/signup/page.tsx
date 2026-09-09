"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { unstable_rethrow, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signUpAction, type SignUpState } from "@/lib/actions/auth";
import { resolvePostAuthPath } from "@/lib/security/redirect";
import { SocialSignInButtons } from "@/components/auth/social-sign-in-buttons";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthModeNav } from "@/components/auth/auth-mode-nav";
import { validateRegistrationFields } from "@/lib/validation/auth";
import { useAuthFailureFocus } from "@/components/auth/use-auth-failure-focus";

export default function SignupPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const hasGuestDraft = searchParams.get("draft") === "1";
  const requestedNext = resolvePostAuthPath(searchParams.get("next"));
  const nextPath = hasGuestDraft ? `/${locale}/beans/new?draft=1`
    : requestedNext !== "/explore" ? requestedNext : `/${locale}/explore`;
  const authQuery = hasGuestDraft ? "?draft=1"
    : requestedNext !== "/explore" ? `?${new URLSearchParams({ next: requestedNext })}` : "";
  const [serverState, formAction, serverPending] = useActionState(signUpAction, {});
  const [clientState, setClientState] = useState<SignUpState | null>(null);
  const [clientPending, startTransition] = useTransition();
  const state = clientState ?? serverState;
  const loading = serverPending || clientPending;
  const submitting = useRef(false);
  const submitRef = useRef<HTMLButtonElement>(null);
  const agreementRef = useRef<HTMLInputElement>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  useAuthFailureFocus(loading, Boolean(state.error), submitRef);
  useEffect(() => {
    if (agreementRef.current?.checked) startTransition(() => setAcceptedTerms(true));
  }, []);
  useEffect(() => {
    if (state.field && !loading) document.querySelector<HTMLInputElement>(`main [name="${state.field}"]`)?.focus();
  }, [state.field, loading]);
  const message = state.error === "display_name_required" ? "displayNameRequired"
    : state.error === "password_length" ? "passwordRequirements"
    : state.error === "password_compromised" ? "passwordCompromised"
    : state.error === "password_mismatch" ? "passwordMismatch"
    : state.error === "agreement_required" ? "agreementRequired" : "signupError";
  function fieldError(name: string) {
    return { "aria-invalid": state.field === name || undefined, "aria-describedby": state.field === name ? "signup-form-error" : undefined };
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current || serverPending) return;
    submitting.current = true;
    const form = e.currentTarget;
    const values = new FormData(form);
    let issue;
    try { issue = await validateRegistrationFields(values); } catch {
      submitting.current = false;
      setClientState({ error: "temporarily_unavailable" });
      return;
    }
    if (issue) {
      setClientState(issue);
      form.querySelector<HTMLElement>(`[name="${issue.field}"]`)?.focus();
      submitting.current = false;
      return;
    }
    submitting.current = true;
    setClientState({});
    startTransition(async () => {
      try {
        setClientState(await signUpAction(state, values));
      } catch (error) {
        unstable_rethrow(error);
        setClientState({ error: "temporarily_unavailable" });
      } finally {
        submitting.current = false;
      }
    });
  }

  return (
    <AuthShell>
      <AuthModeNav mode="signup" query={authQuery} />
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.025em] text-brown">
          {t("signup")}
        </h1>
      </div>

        <form action={formAction} onSubmit={handleSubmit} onReset={(event) => event.preventDefault()} onChange={() => setClientState({})} className="flex flex-col gap-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="next" value={nextPath} />
          <input type="hidden" name="draft" value={hasGuestDraft ? "1" : "0"} />
          <Input
            label={t("displayName")}
            type="text"
            name="displayName"
            {...fieldError("displayName")}
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
            aria-invalid={state.field === "password" || undefined}
            aria-describedby={`password-requirements${state.field === "password" ? " signup-form-error" : ""}`}
            placeholder="••••••••"
            required
            minLength={15}
            maxLength={72}
            autoComplete="new-password"
          />
          <p id="password-requirements" className="-mt-2 text-xs leading-5 text-brown-light">{t("passwordRequirements")}</p>

          <Input
            label={t("passwordConfirm")}
            type="password"
            name="passwordConfirm"
            {...fieldError("passwordConfirm")}
            placeholder="••••••••"
            required
            minLength={15}
            maxLength={72}
            autoComplete="new-password"
          />

          <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-6 text-brown-light">
            <input
              type="checkbox"
              name="acceptedTerms"
              ref={agreementRef}
              defaultChecked={false}
              onChange={(event) => {
                setAcceptedTerms(event.target.checked);
              }}
              {...fieldError("acceptedTerms")}
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

          {state.error && <p id="signup-form-error" role="alert" className="text-sm text-red-700">{t(message)}</p>}

          <Button ref={submitRef} type="submit" loading={loading} className="mt-2 w-full">
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

    </AuthShell>
  );
}
