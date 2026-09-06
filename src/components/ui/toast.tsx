"use client";

import { create } from "zustand";
import { useEffect } from "react";
import { consumeNavigationNotice, saveNavigationNotice } from "@/lib/navigation-notice";

interface ToastState {
  message: string | null;
  revision: number;
  show: (message: string) => void;
  showAfterNavigation: (message: string) => void;
  hide: () => void;
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  revision: 0,
  show: (message) => set((state) => ({ message, revision: state.revision + 1 })),
  showAfterNavigation: (message) => {
    try {
      if (saveNavigationNotice(window.sessionStorage, message)) return;
    } catch {
      // Browsers can deny storage access. Keep immediate feedback in that case.
    }
    set((state) => ({ message, revision: state.revision + 1 }));
  },
  hide: () => set({ message: null }),
}));

export function Toast() {
  const { message, revision, show, hide } = useToast();

  useEffect(() => {
    try {
      const pending = consumeNavigationNotice(window.sessionStorage);
      if (pending) show(pending);
    } catch {
      // A storage restriction must not prevent the destination page from loading.
    }
  }, [show]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(hide, 5000);
      return () => clearTimeout(timer);
    }
  }, [message, revision, hide]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="fixed bottom-20 left-1/2 z-50 w-max max-w-[calc(100%_-_2rem)] -translate-x-1/2 md:bottom-8">
      {message && (
        <div className="rounded-md bg-brown px-4 py-2.5 text-sm text-cream shadow-lg">
          {message}
        </div>
      )}
    </div>
  );
}
