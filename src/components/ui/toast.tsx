"use client";

import { create } from "zustand";
import { useEffect } from "react";

interface ToastState {
  message: string | null;
  revision: number;
  show: (message: string) => void;
  hide: () => void;
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  revision: 0,
  show: (message) => set((state) => ({ message, revision: state.revision + 1 })),
  hide: () => set({ message: null }),
}));

export function Toast() {
  const { message, revision, hide } = useToast();

  useEffect(() => {
    if (message) {
      const timer = setTimeout(hide, 5000);
      return () => clearTimeout(timer);
    }
  }, [message, revision, hide]);

  if (!message) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-50 w-max max-w-[calc(100%_-_2rem)] -translate-x-1/2 md:bottom-8">
      <div
        role="status"
        aria-live="polite"
        className="rounded-md bg-brown px-4 py-2.5 text-sm text-cream shadow-lg"
      >
        {message}
      </div>
    </div>
  );
}
