"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { requestPasswordResetAction, updatePasswordAction, type PasswordResetState } from "@/lib/actions/auth";
import { validateNewPassword } from "@/lib/validation/auth";
import { useAuthFailureFocus } from "./use-auth-failure-focus";

export function PasswordRecoveryForm({ mode, locale, next, expired = false }: {
  mode: "request" | "update";
  locale: string;
  next: string;
  expired?: boolean;
}) {
  const t = useTranslations("auth");
  const action = mode === "request" ? requestPasswordResetAction : updatePasswordAction;
  const [serverState, formAction, serverPending] = useActionState(action, {});
  const [clientState, setClientState] = useState<PasswordResetState | null>(null);
  const [clientPending, startTransition] = useTransition();
  const pending = serverPending || clientPending;
  const state = clientState ?? serverState;
  const inFlight = useRef(false);
  const submit = useRef<HTMLButtonElement>(null);
  const sentHeading = useRef<HTMLHeadingElement>(null);
  useAuthFailureFocus(pending, Boolean(state.error), submit);
  useEffect(() => { if (state.sent) sentHeading.current?.focus(); }, [state.sent]);
  useEffect(() => {
    if (state.field && !pending) document.querySelector<HTMLInputElement>(`main [name="${state.field}"]`)?.focus();
  }, [state.field, pending]);
  const query = next !== "/explore" ? `?${new URLSearchParams({ next })}` : "";
  const message = state.error === "invalid_email" ? "invalidEmail"
    : state.error === "password_length" ? "passwordRequirements"
    : state.error === "password_compromised" ? "passwordCompromised"
    : state.error === "password_mismatch" ? "passwordMismatch"
    : state.error === "same_password" ? "passwordMustDiffer"
    : state.error === "expired" ? "resetLinkExpired" : "resetUnavailable";

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || serverPending) return;
    inFlight.current = true;
    const form = event.currentTarget;
    const data = new FormData(form);
    let issue;
    try { issue = mode === "update" ? await validateNewPassword(data) : null; } catch {
      inFlight.current = false;
      setClientState({ error: "temporarily_unavailable" });
      return;
    }
    if (issue) {
      setClientState(issue);
      form.querySelector<HTMLElement>(`[name="${issue.field}"]`)?.focus();
      inFlight.current = false;
      return;
    }
    inFlight.current = true;
    setClientState({});
    startTransition(async () => {
      try {
        setClientState(await action(state, data));
      } catch (error) {
        unstable_rethrow(error);
        setClientState({ error: "temporarily_unavailable" });
      } finally {
        inFlight.current = false;
      }
    });
  }

  return (
    <>
      {expired && !state.sent && <p role="alert" className="mb-5 text-sm leading-6 text-red-700">{t("resetLinkExpired")}</p>}
      {state.sent && (
        <section role="status" className="mb-6 rounded-md bg-surface-warm p-4 text-brown-medium">
          <h2 ref={sentHeading} tabIndex={-1} className="font-semibold focus:outline-none">{t("resetEmailSentTitle")}</h2>
          <p className="mt-2 text-sm leading-6">{t("resetEmailSentDescription")}</p>
          <p className="mt-2 text-sm leading-6">{t("resetSameBrowser")}</p>
        </section>
      )}
      <form action={formAction} onSubmit={submitForm} onReset={(event) => event.preventDefault()} onChange={() => setClientState(state.requiresNewLink ? { requiresNewLink: true } : {})} className="flex flex-col gap-4">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="next" value={next} />
        {mode === "request" ? (
          <Input label={t("email")} type="email" name="email" placeholder="you@example.com" required maxLength={320} autoComplete="email"
            aria-invalid={state.field === "email" || undefined} aria-describedby={state.field === "email" ? "password-reset-error" : undefined} />
        ) : (
          <>
            <Input label={t("newPassword")} type="password" name="password" required minLength={15} maxLength={72} autoComplete="new-password"
              aria-invalid={state.field === "password" || undefined} aria-describedby={`password-requirements${state.field === "password" ? " password-reset-error" : ""}`} />
            <p id="password-requirements" className="-mt-2 text-xs leading-5 text-brown-light">{t("passwordRequirements")}</p>
            <Input label={t("passwordConfirm")} type="password" name="passwordConfirm" required minLength={15} maxLength={72} autoComplete="new-password"
              aria-invalid={state.field === "passwordConfirm" || undefined} aria-describedby={state.field === "passwordConfirm" ? "password-reset-error" : undefined} />
          </>
        )}
        {state.error && <p id="password-reset-error" role="alert" className="text-sm leading-6 text-red-700">{t(message)}</p>}
        {state.error === "expired" || state.requiresNewLink ? (
          <Link href={`/${locale}/forgot-password${query}`} className="text-sm font-semibold text-accent underline underline-offset-4">{t("requestNewResetLink")}</Link>
        ) : (
          <Button ref={submit} type="submit" loading={pending} className="mt-2 w-full">
            {t(mode === "request" ? state.sent ? "resendResetLink" : "sendResetLink" : "saveNewPassword")}
          </Button>
        )}
      </form>
      <p className="mt-8 text-center text-sm"><Link href={`/${locale}/login${query}`} className="font-medium text-accent underline underline-offset-4">{t("backToLogin")}</Link></p>
    </>
  );
}
