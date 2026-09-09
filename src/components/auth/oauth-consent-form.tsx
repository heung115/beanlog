"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { completeConsentAction } from "@/lib/actions/consent";
import { signOut } from "@/lib/actions/auth";
import { useAuthFailureFocus } from "./use-auth-failure-focus";

type ConsentState = { error?: "agreement_required" | "temporarily_unavailable" };

export function OAuthConsentForm({ locale, next }: { locale: string; next: string }) {
  const t = useTranslations("auth");
  const [serverState, formAction, serverPending] = useActionState<ConsentState, FormData>(completeConsentAction, {});
  const [clientState, setClientState] = useState<ConsentState | null>(null);
  const [clientPending, startTransition] = useTransition();
  const [logoutState, logoutAction, logoutPending] = useActionState(signOut.bind(null, locale), undefined);
  const state = clientState ?? serverState;
  const pending = serverPending || clientPending;
  const inFlight = useRef(false);
  const submit = useRef<HTMLButtonElement>(null);
  useAuthFailureFocus(pending, Boolean(state.error), submit);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || serverPending || logoutPending) return;
    const data = new FormData(event.currentTarget);
    inFlight.current = true;
    setClientState({});
    startTransition(async () => {
      try {
        setClientState(await completeConsentAction(state, data));
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
      <form action={formAction} onSubmit={handleSubmit} onReset={(event) => event.preventDefault()} className="flex flex-col gap-4">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="next" value={next} />
        <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-6 text-brown-light">
          <input type="checkbox" name="acceptedTerms" required
            aria-invalid={state.error === "agreement_required" || undefined}
            aria-describedby={state.error === "agreement_required" ? "consent-error" : undefined}
            className="mt-1 h-4 w-4 shrink-0 rounded border-border accent-accent" />
          <span>{t.rich("legalAgreement", {
            terms: (chunks) => <Link href={`/${locale}/terms`} target="_blank" className="font-medium text-accent underline underline-offset-4">{chunks}</Link>,
            privacy: (chunks) => <Link href={`/${locale}/privacy`} target="_blank" className="font-medium text-accent underline underline-offset-4">{chunks}</Link>,
          })}</span>
        </label>
        {state.error && <p id="consent-error" role="alert" className="text-sm text-red-700">{t(state.error === "agreement_required" ? "consentRequired" : "consentUnavailable")}</p>}
        <Button ref={submit} type="submit" loading={pending} disabled={logoutPending} className="mt-2 w-full">{t("consentSubmit")}</Button>
      </form>
      <form action={logoutAction} className="mt-4">
        {logoutState?.error && <p role="alert" className="mb-3 text-sm text-red-700">{t("logoutError")}</p>}
        <Button type="submit" variant="ghost" loading={logoutPending} disabled={pending} className="w-full">{t("logout")}</Button>
      </form>
    </>
  );
}
