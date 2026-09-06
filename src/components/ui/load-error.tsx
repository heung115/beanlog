"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function LoadError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("common");
  return (
    <div role="alert" className="paper-sheet px-6 py-12 text-center">
      <p className="text-lg font-semibold text-brown">{t("loadError")}</p>
      <p className="mt-2 text-sm leading-6 text-brown-light">{t("loadErrorHelp")}</p>
      <Button variant="secondary" onClick={onRetry} className="mt-5">
        {t("retry")}
      </Button>
    </div>
  );
}
