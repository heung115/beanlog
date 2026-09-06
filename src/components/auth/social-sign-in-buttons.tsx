"use client";

import { useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { signInWithOAuth } from "@/lib/actions/auth";
import { useAuthFailureFocus } from "./use-auth-failure-focus";

export function SocialSignInButtons({ acceptedTerms, nextPath }: { acceptedTerms: boolean; nextPath: string }) {
  const t = useTranslations("auth");
  const [pending, startTransition] = useTransition();
  const [provider, setProvider] = useState<"google" | "kakao" | null>(null);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const googleRef = useRef<HTMLButtonElement>(null);
  const kakaoRef = useRef<HTMLButtonElement>(null);
  useAuthFailureFocus(pending, failed, provider === "kakao" ? kakaoRef : googleRef);

  function startSignIn(nextProvider: "google" | "kakao") {
    if (!acceptedTerms || inFlight.current) return;
    inFlight.current = true;
    setProvider(nextProvider);
    setFailed(false);
    startTransition(async () => {
      try {
        const result = await signInWithOAuth(nextProvider, acceptedTerms, nextPath);
        if (result?.error) setFailed(true);
      } catch (error) {
        unstable_rethrow(error);
        setFailed(true);
      } finally {
        inFlight.current = false;
      }
    });
  }

  return (
    <div className="flex flex-col gap-3" aria-busy={pending}>
      {failed && <p role="alert" className="text-sm text-red-700">{t("socialError")}</p>}
      <Button
        ref={googleRef}
        type="button"
        variant="secondary"
        className="w-full"
        disabled={!acceptedTerms || pending}
        loading={pending && provider === "google"}
        onClick={() => startSignIn("google")}
      >
        <GoogleIcon className="mr-2 h-4 w-4" />
        {pending && provider === "google" ? t("socialConnecting") : t("loginWithGoogle")}
      </Button>
      <Button
        ref={kakaoRef}
        type="button"
        variant="secondary"
        className="w-full border-[#FEE500] bg-[#FEE500] text-[#191919] hover:bg-[#FEE500]/90"
        disabled={!acceptedTerms || pending}
        loading={pending && provider === "kakao"}
        onClick={() => startSignIn("kakao")}
      >
        <KakaoIcon className="mr-2 h-4 w-4" />
        {pending && provider === "kakao" ? t("socialConnecting") : t("loginWithKakao")}
      </Button>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function KakaoIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="#191919">
      <path d="M12 3C6.48 3 2 6.58 2 10.9c0 2.78 1.86 5.22 4.65 6.6l-.95 3.53c-.08.3.26.54.52.37l4.17-2.74c.52.07 1.05.1 1.61.1 5.52 0 10-3.58 10-7.96C22 6.58 17.52 3 12 3z" />
    </svg>
  );
}
