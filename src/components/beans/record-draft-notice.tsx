"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { DraftStatus } from "./use-record-draft";

export function RecordDraftNotice({ status, onDiscard, onRestore, disabled = false }: {
  status: DraftStatus;
  onDiscard: () => void;
  onRestore: () => void;
  disabled?: boolean;
}) {
  const t = useTranslations("draft");
  const [confirming, setConfirming] = useState(false);
  const discardRef = useRef<HTMLButtonElement>(null);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (status === "idle") {
      restoreFocus.current = false;
      if (confirming) startTransition(() => setConfirming(false));
    } else if (confirming) {
      keepEditingRef.current?.focus();
    } else if (restoreFocus.current) {
      restoreFocus.current = false;
      discardRef.current?.focus();
    }
  }, [confirming, status]);
  function keepEditing() {
    restoreFocus.current = true;
    setConfirming(false);
  }
  if (status === "idle") return null;
  return (
    <div className="journal-panel-quiet px-4 py-3 text-sm leading-6 text-brown-medium" data-testid="record-draft-notice">
      <p role={status === "unavailable" || status === "conflict" ? "alert" : "status"}>{t(status)}</p>
      {status === "conflict" ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={onRestore} disabled={disabled}>{t("restore")}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDiscard} disabled={disabled}>{t("useSaved")}</Button>
        </div>
      ) : confirming ? (
        <div className="mt-2" onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          keepEditing();
        }}>
          <p>{t("discardConfirm")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => { setConfirming(false); onDiscard(); }}>{t("discardYes")}</Button>
            <Button ref={keepEditingRef} type="button" size="sm" variant="ghost" onClick={keepEditing}>{t("keepEditing")}</Button>
          </div>
        </div>
      ) : (
        <button ref={discardRef} type="button" disabled={disabled} onClick={() => setConfirming(true)} className="mt-1 min-h-11 underline underline-offset-4 disabled:opacity-50">{t("discard")}</button>
      )}
    </div>
  );
}
