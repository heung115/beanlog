"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Restore a disabled submit control only when the user has not moved elsewhere. */
export function useAuthFailureFocus(pending: boolean, failed: boolean, control: RefObject<HTMLButtonElement | null>) {
  const wasPending = useRef(false);
  useEffect(() => {
    const active = document.activeElement;
    const lostControlFocus = active === document.body || active === document.getElementById("main-content");
    if (wasPending.current && !pending && failed && lostControlFocus) {
      control.current?.focus();
    }
    wasPending.current = pending;
  }, [pending, failed, control]);
}
