"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";

export function LogoutButton() {
  const locale = useLocale();
  const t = useTranslations("auth");
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleLogout() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setFailed(false);
    try {
      const result = await signOut(locale);
      if (result?.error) setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <div>
      <Button
        variant="secondary"
        onClick={handleLogout}
        loading={pending}
        aria-busy={pending}
        aria-describedby={failed ? "logout-error" : undefined}
        className="w-full sm:w-auto"
      >
        <svg aria-hidden="true" className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2M9 12h11m0 0-3-3m3 3-3 3" />
        </svg>
        {pending ? t("loggingOut") : t("logout")}
      </Button>
      {failed && (
        <p id="logout-error" role="alert" className="mt-3 text-sm leading-6 text-red-600">
          {t("logoutError")}
        </p>
      )}
    </div>
  );
}
