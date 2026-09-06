"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { getBeanFilterOptions } from "@/lib/actions/beans";
import { Button } from "@/components/ui/button";

type FilterOptions = { origins: string[]; roasteries: string[]; varietals: string[] };

export function FilterOptionsRecovery({ initialError, onRecovered }: {
  initialError?: string;
  onRecovered: (options: FilterOptions) => void;
}) {
  const t = useTranslations("explore");
  const common = useTranslations("common");
  const [failed, setFailed] = useState(Boolean(initialError));
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  if (!failed) return null;

  async function retry() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      const result = await getBeanFilterOptions();
      if (!result.error) {
        onRecovered(result);
        setFailed(false);
      }
    } catch {
      // Retain the explanation and retry action until the full set loads.
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md bg-surface-warm px-4 py-3" data-testid="filter-options-error">
      <p role="alert" className="min-w-0 flex-1 text-sm leading-6 text-brown-medium">{t("filterOptionsError")}</p>
      <Button type="button" variant="secondary" size="sm" onClick={retry} loading={pending}>{common("retry")}</Button>
    </div>
  );
}
