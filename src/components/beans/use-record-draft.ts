"use client";

import { startTransition, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { parseRecordDraft, RECORD_DRAFT_PREFIX, serializeRecordDraft } from "@/lib/coffee/record-draft";

export type DraftStatus = "idle" | "saved" | "recovered" | "unavailable" | "conflict";

export function useRecordDraft<T>({
  scope, value, baselineValue = value, sourceVersion = null, validate, onRestore, enabled = true,
}: {
  scope: string;
  value: T;
  baselineValue?: T;
  sourceVersion?: string | null;
  validate: (value: unknown) => value is T;
  onRestore: (value: T) => void;
  enabled?: boolean;
}) {
  const key = RECORD_DRAFT_PREFIX + scope;
  const [status, setStatus] = useState<DraftStatus>("idle");
  const [generation, setGeneration] = useState(0);
  const initializedGeneration = useRef(0);
  const baseline = useRef(JSON.stringify(baselineValue));
  const pendingConflict = useRef<T | null>(null);
  const latest = useRef({ value, baselineValue, onRestore, validate });
  const dirty = useRef(false);
  const stored = useRef(true);

  useLayoutEffect(() => { latest.current = { value, baselineValue, onRestore, validate }; });

  // Restore and establish the scope before the inputs become interactive. A
  // passive effect can lose a keystroke followed immediately by browser reload.
  useLayoutEffect(() => {
    if (!enabled) return;
    const nextGeneration = ++initializedGeneration.current;
    baseline.current = JSON.stringify(latest.current.baselineValue);
    pendingConflict.current = null;
    dirty.current = false;
    stored.current = true;
    try {
      const raw = sessionStorage.getItem(key);
      const draft = parseRecordDraft(raw, latest.current.validate);
      if (raw && !draft) sessionStorage.removeItem(key);
      let nextStatus: DraftStatus = "idle";
      if (draft) {
        dirty.current = true;
        if (draft.sourceVersion !== sourceVersion) {
          pendingConflict.current = draft.value;
          nextStatus = "conflict";
        } else {
          latest.current.onRestore(draft.value);
          nextStatus = "recovered";
        }
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Restoring browser state must finish before the first editable paint.
      setStatus(nextStatus);
    } catch {
      stored.current = false;
    }
    setGeneration(nextGeneration);
  }, [enabled, key, sourceVersion]);

  useLayoutEffect(() => {
    if (!enabled || generation === 0 || generation !== initializedGeneration.current || pendingConflict.current !== null) return;
    dirty.current = JSON.stringify(value) !== baseline.current;
    try {
      if (dirty.current) {
        sessionStorage.setItem(key, serializeRecordDraft(value, sourceVersion));
      } else {
        sessionStorage.removeItem(key);
      }
      stored.current = true;
      startTransition(() => setStatus((current) => dirty.current ? current === "recovered" ? current : "saved" : "idle"));
    } catch {
      stored.current = false;
      startTransition(() => setStatus(dirty.current ? "unavailable" : "idle"));
    }
  }, [enabled, generation, key, sourceVersion, value]);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!dirty.current || stored.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  const reset = useCallback((nextValue: T) => {
    baseline.current = JSON.stringify(nextValue);
    pendingConflict.current = null;
    dirty.current = false;
    try { sessionStorage.removeItem(key); } catch { /* Saving to the account already succeeded. */ }
    setStatus("idle");
  }, [key]);

  function discard(nextValue: T) {
    reset(nextValue);
    latest.current.onRestore(nextValue);
  }

  function restoreConflict() {
    const pending = pendingConflict.current;
    if (pending === null) return;
    pendingConflict.current = null;
    latest.current.onRestore(pending);
    setStatus("recovered");
  }

  function confirmLeave(message: string) {
    return !dirty.current || stored.current || window.confirm(message);
  }

  return { status, ready: enabled && generation > 0, reset, discard, restoreConflict, confirmLeave };
}
