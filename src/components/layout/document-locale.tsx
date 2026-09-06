"use client";

import { useEffect } from "react";

// Next.js retains the root layout during client navigation. Keep its language
// (screen readers and locale typography) in sync with the active page.
export function DocumentLocale({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
