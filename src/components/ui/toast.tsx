"use client";

import { create } from "zustand";
import { useEffect } from "react";

interface ToastState {
  message: string | null;
  show: (message: string) => void;
  hide: () => void;
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  show: (message) => set({ message }),
  hide: () => set({ message: null }),
}));

export function Toast() {
  const { message, hide } = useToast();

  useEffect(() => {
    if (message) {
      const timer = setTimeout(hide, 2500);
      return () => clearTimeout(timer);
    }
  }, [message, hide]);

  if (!message) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 md:bottom-8">
      <div className="rounded-md bg-brown px-4 py-2.5 text-sm text-cream shadow-lg">
        {message}
      </div>
    </div>
  );
}
