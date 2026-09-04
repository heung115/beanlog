"use client";

import { useSyncExternalStore } from "react";
import { LEGAL_EFFECTIVE_DATE } from "@/config/legal-version";

export const SOCIAL_AUTH_CONSENT_STORAGE_KEY = "beanmap:social-auth-consent";

const STORAGE_SCHEMA_VERSION = 1;
const CONSENT_CHANGE_EVENT = "beanmap:social-auth-consent-change";

type StoredSocialAuthConsent = {
  version: typeof STORAGE_SCHEMA_VERSION;
  legalVersion: typeof LEGAL_EFFECTIVE_DATE;
  accepted: true;
  acceptedAt: string;
};

let inMemoryConsent = false;

function parseStoredConsent(value: string | null): StoredSocialAuthConsent | null {
  if (!value) return null;

  try {
    const consent = JSON.parse(value) as Partial<StoredSocialAuthConsent>;
    if (
      consent.version !== STORAGE_SCHEMA_VERSION ||
      consent.legalVersion !== LEGAL_EFFECTIVE_DATE ||
      consent.accepted !== true ||
      typeof consent.acceptedAt !== "string" ||
      !Number.isFinite(Date.parse(consent.acceptedAt))
    ) {
      return null;
    }
    return consent as StoredSocialAuthConsent;
  } catch {
    return null;
  }
}

function getStoredConsent() {
  if (typeof window === "undefined") return false;

  try {
    inMemoryConsent = Boolean(
      parseStoredConsent(window.localStorage.getItem(SOCIAL_AUTH_CONSENT_STORAGE_KEY))
    );
  } catch {
    // Keep the current-tab choice when browser storage is unavailable.
  }
  return inMemoryConsent;
}

function getServerConsent() {
  return false;
}

function subscribeToConsent(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === SOCIAL_AUTH_CONSENT_STORAGE_KEY) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(CONSENT_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(CONSENT_CHANGE_EVENT, onStoreChange);
  };
}

function storeConsent(accepted: boolean) {
  inMemoryConsent = accepted;
  try {
    if (accepted) {
      const consent: StoredSocialAuthConsent = {
        version: STORAGE_SCHEMA_VERSION,
        legalVersion: LEGAL_EFFECTIVE_DATE,
        accepted: true,
        acceptedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(
        SOCIAL_AUTH_CONSENT_STORAGE_KEY,
        JSON.stringify(consent)
      );
    } else {
      window.localStorage.removeItem(SOCIAL_AUTH_CONSENT_STORAGE_KEY);
    }
  } catch {
    // The checkbox remains usable even when browser storage is unavailable.
  }
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
}

export function useSocialAuthConsent() {
  const accepted = useSyncExternalStore(
    subscribeToConsent,
    getStoredConsent,
    getServerConsent
  );
  return [accepted, storeConsent] as const;
}
