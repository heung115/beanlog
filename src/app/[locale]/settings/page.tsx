"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { PageIntro } from "@/components/layout/page-intro";
import { Button } from "@/components/ui/button";
import { LoadError } from "@/components/ui/load-error";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { deleteAccount, exportData, updateProfile } from "@/lib/actions/beans";
import { LogoutButton } from "@/components/auth/logout-button";
import { RecordDraftNotice } from "@/components/beans/record-draft-notice";
import { useRecordDraft } from "@/components/beans/use-record-draft";
import { getProfile } from "@/lib/actions/profile";

type Locale = "ko" | "en";

const LOCALE_FOCUS_KEY = "beanmap-settings-language-focus";

function rememberLocaleFocus(locale: Locale) {
  // Locale routes can remount the page. This tab-only marker contains no
  // account information and is consumed after the destination is ready.
  try { sessionStorage.setItem(LOCALE_FOCUS_KEY, locale); } catch { /* Navigation still works without storage. */ }
}

function isDisplayNameDraft(value: unknown): value is string {
  return typeof value === "string" && value.length <= 50;
}

function SectionCard({
  title,
  children,
  delay = 0,
}: {
  title: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <section
      data-settings-section
      className="settings-rise px-1"
      style={{ animationDelay: `${delay}ms` }}
    >
      <h2 className="mb-3 text-base font-semibold tracking-tight text-brown">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Icon({ path, className = "h-4 w-4" }: { path: string; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-9 9h18M12 3c2.5 2.4 3.8 5.6 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.6-3.8-9S9.5 5.4 12 3Z",
  download: "M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M4 19h16",
  document: "M7 3h7l4 4v14H7V3Zm7 0v5h5M10 12h5m-5 4h5",
};

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const tDraft = useTranslations("draft");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();

  const [displayName, setDisplayName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<"nameRequired" | "saveError" | null>(null);
  const displayNameRef = useRef<HTMLInputElement>(null);
  const mutationRef = useRef(false);
  const [profileError, setProfileError] = useState(false);
  const [profileAttempt, setProfileAttempt] = useState(0);
  const [switchingLocale, setSwitchingLocale] = useState(false);
  const [localePending, startLocaleTransition] = useTransition();
  const [localeError, setLocaleError] = useState<Locale | null>(null);
  const localeRefs = useRef<Partial<Record<Locale, HTMLButtonElement | null>>>({});
  const [deleteError, setDeleteError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<"connection" | "limit" | null>(null);
  const exportPendingRef = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const draft = useRecordDraft({
    scope: `settings:${profileId}`,
    value: displayName,
    baselineValue: savedName,
    sourceVersion: savedName,
    validate: isDisplayNameDraft,
    onRestore: setDisplayName,
    enabled: profileId !== null && !profileLoading && !profileError,
  });
  const profileUnavailable = profileLoading || profileError || !profileId || !draft.ready || draft.status === "conflict";
  const profileBusy = saving || switchingLocale || localePending;

  useEffect(() => {
    let mounted = true;
    getProfile()
      .then((p) => {
        if (!p) throw new Error("Unable to load profile");
        if (mounted) {
          setProfileId(p.id);
          setSavedName(p.display_name ?? "");
          setDisplayName(p.display_name ?? "");
        }
      })
      .catch(() => { if (mounted) setProfileError(true); })
      .finally(() => {
        if (mounted) setProfileLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [profileAttempt]);

  useEffect(() => {
    if (profileUnavailable || profileBusy) return;
    try {
      if (sessionStorage.getItem(LOCALE_FOCUS_KEY) !== locale) return;
      localeRefs.current[locale]?.focus();
      sessionStorage.removeItem(LOCALE_FOCUS_KEY);
    } catch { /* Storage is optional for focus recovery. */ }
  }, [locale, profileUnavailable, profileBusy]);

  useEffect(() => {
    if (!confirmOpen) return;

    const dialog = deleteDialogRef.current;
    if (!dialog) return;

    const trigger = deleteTriggerRef.current;
    const previousOverflow = document.body.style.overflow;
    if (!dialog.open) dialog.showModal();
    const focusFrame = window.requestAnimationFrame(() => {
      cancelDeleteRef.current?.focus();
    });

    document.body.style.overflow = "hidden";

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
      window.requestAnimationFrame(() => trigger?.focus());
    };
  }, [confirmOpen]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (profileUnavailable || profileBusy || mutationRef.current) return;
    const submittedName = displayName.trim();
    if (!submittedName) {
      setSaveError("nameRequired");
      displayNameRef.current?.focus();
      return;
    }
    mutationRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await updateProfile(submittedName, locale);
      if (result?.error) {
        setSaveError("saveError");
      } else {
        setSavedName(submittedName);
        setDisplayName(submittedName);
        draft.reset(submittedName);
        toast.show(t("saved"));
        router.refresh();
      }
    } catch {
      setSaveError("saveError");
    } finally {
      mutationRef.current = false;
      setSaving(false);
    }
  }

  async function switchLocale(next: Locale) {
    if (next === locale || profileUnavailable || profileBusy || mutationRef.current) return;
    if (!draft.confirmLeave(tDraft("leaveConfirm"))) return;
    mutationRef.current = true;
    setSwitchingLocale(true);
    setLocaleError(null);
    try {
      const result = await updateProfile(savedName, next);
      if (result?.error) {
        setLocaleError(next);
        rememberLocaleFocus(locale);
        return;
      }
      const segments = pathname.split("/");
      segments[1] = next;
      rememberLocaleFocus(next);
      startLocaleTransition(() => {
        router.replace(segments.join("/") || `/${next}`);
      });
    } catch {
      setLocaleError(next);
      rememberLocaleFocus(locale);
    } finally {
      mutationRef.current = false;
      setSwitchingLocale(false);
    }
  }

  async function handleExport() {
    if (exportPendingRef.current) return;
    exportPendingRef.current = true;
    setExporting(true);
    setExportError(null);
    try {
      const data = await exportData();
      if (!data) {
        setExportError("connection");
        return;
      }
      if ("error" in data) {
        setExportError("limit");
        return;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `beanmap-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("connection");
    } finally {
      exportPendingRef.current = false;
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(false);
    try {
      const result = await deleteAccount(locale);
      if (result?.error) setDeleteError(true);
    } catch {
      setDeleteError(true);
    } finally {
      setDeleting(false);
    }
  }

  function handleDeleteDialogKeyDown(
    event: React.KeyboardEvent<HTMLDialogElement>
  ) {
    if (event.key !== "Tab") return;

    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        "button:not([disabled])"
      )
    );
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const locales: { value: Locale; label: string }[] = [
    { value: "ko", label: t("korean") },
    { value: "en", label: t("english") },
  ];

  function handleLocaleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (profileUnavailable || profileBusy) return;
    let nextIndex: number;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % locales.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index + locales.length - 1) % locales.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = locales.length - 1;
    else return;
    event.preventDefault();
    const next = locales[nextIndex].value;
    localeRefs.current[next]?.focus();
    void switchLocale(next);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <style>{`
        @keyframes settings-rise-kf {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .settings-rise {
          animation: settings-rise-kf 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
      `}</style>

      <PageIntro
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        testId="settings-header"
      />

      <div className="mt-10 max-w-2xl space-y-7">

        {/* ---------- profile ---------- */}
        <SectionCard title={t("profile")} delay={60}>
          {profileError ? <LoadError onRetry={() => {
            setProfileError(false);
            setProfileLoading(true);
            setProfileAttempt((value) => value + 1);
          }} /> : <form
            onSubmit={handleSaveProfile}
            noValidate
            aria-busy={profileUnavailable || profileBusy}
            className="space-y-3"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                ref={displayNameRef}
                label={t("displayName")}
                name="displayName"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (saveError === "nameRequired" && e.target.value.trim()) setSaveError(null);
                }}
                placeholder={profileLoading ? tCommon("loading") : "beanmap"}
                maxLength={50}
                required
                aria-invalid={saveError === "nameRequired" || undefined}
                aria-describedby={saveError ? "profile-save-error" : undefined}
                disabled={profileUnavailable || profileBusy}
              />
            </div>
            <Button
              type="submit"
              loading={saving}
              disabled={profileUnavailable || profileBusy}
              className="sm:shrink-0"
            >
              {t("saveProfile")}
            </Button>
            </div>
            {saveError && <div>
              <p id="profile-save-error" role="alert" className="text-sm leading-6 text-red-600">{t(saveError)}</p>
              {saveError === "saveError" && <Button type="submit" variant="secondary" size="sm" className="mt-2" disabled={profileUnavailable || profileBusy}>{tCommon("retry")}</Button>}
            </div>}
            <RecordDraftNotice status={draft.status} onDiscard={() => { draft.discard(savedName); setSaveError(null); }} onRestore={draft.restoreConflict} disabled={profileLoading || profileError || !profileId || !draft.ready || profileBusy} />
          </form>}
        </SectionCard>

        {/* ---------- language ---------- */}
        <SectionCard title={t("language")} delay={120}>
          <div
            role="radiogroup"
            aria-label={t("language")}
            aria-busy={switchingLocale || localePending}
            aria-describedby={localeError ? "language-save-error" : undefined}
            className="inline-flex rounded-md bg-cream-dark/60 p-1"
          >
            {locales.map((l, index) => {
              const active = l.value === locale;
              return (
                <button
                  key={l.value}
                  ref={(element) => { localeRefs.current[l.value] = element; }}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => switchLocale(l.value)}
                  onKeyDown={(event) => handleLocaleKeyDown(event, index)}
                  disabled={profileUnavailable || profileBusy}
                  className={`min-h-11 rounded-sm border border-transparent px-5 py-2 text-sm font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                    active
                      ? "bg-brown text-cream"
                      : "text-brown-light hover:bg-surface hover:text-brown"
                  }`}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
          {localeError && <div className="mt-3">
            <p id="language-save-error" role="alert" className="text-sm leading-6 text-red-600">{t("languageError")}</p>
            <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => switchLocale(localeError)} disabled={profileUnavailable || profileBusy}>{tCommon("retry")}</Button>
          </div>}
        </SectionCard>

        {/* ---------- export ---------- */}
        <SectionCard title={t("exportData")} delay={180}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2.5 text-sm leading-relaxed text-brown-light">
              <Icon path={ICONS.download} className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              {t("exportDesc")}
            </p>
            <Button
              variant="secondary"
              onClick={handleExport}
              loading={exporting}
              className="sm:shrink-0"
            >
              {exporting ? t("exporting") : t("export")}
            </Button>
          </div>
          {exportError && <div className="mt-3">
            <p role="alert" className="text-sm leading-6 text-red-600">{t(exportError === "limit" ? "exportLimit" : "exportError")}</p>
            {exportError === "connection" && <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={handleExport} disabled={exporting}>{tCommon("retry")}</Button>}
          </div>}
        </SectionCard>

        {/* ---------- legal ---------- */}
        <SectionCard title={t("legal")} delay={240}>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              href={`/${locale}/terms`}
              className="flex min-h-11 items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium text-brown transition-colors hover:bg-surface-warm hover:text-accent"
            >
              <Icon path={ICONS.document} className="h-4 w-4 text-accent" />
              {t("terms")}
            </Link>
            <Link
              href={`/${locale}/privacy`}
              className="flex min-h-11 items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium text-brown transition-colors hover:bg-surface-warm hover:text-accent"
            >
              <Icon path={ICONS.document} className="h-4 w-4 text-accent" />
              {t("privacy")}
            </Link>
          </div>
        </SectionCard>

        {/* ---------- logout ---------- */}
        <SectionCard title={tAuth("logout")} delay={300}>
          <LogoutButton />
        </SectionCard>

        {/* ---------- account deletion ---------- */}
        <section
          data-account-deletion
          className="settings-rise px-1"
          style={{ animationDelay: "360ms" }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-brown">{t("deleteAccount")}</h2>
              <p className="mt-1 text-sm leading-6 text-brown-light">
                {t("deleteAccountDesc")}
              </p>
            </div>
            <Button
              ref={deleteTriggerRef}
              variant="ghost"
              onClick={() => { setDeleteError(false); setConfirmOpen(true); }}
              className="self-start sm:shrink-0"
            >
              {t("deleteAccount")}
            </Button>
          </div>
        </section>

        {/* ---------- delete confirmation dialog ---------- */}
        {confirmOpen && (
          <dialog
            ref={deleteDialogRef}
            aria-labelledby="delete-account-title"
            aria-describedby="delete-account-description"
            onKeyDown={handleDeleteDialogKeyDown}
            onCancel={(event) => {
              event.preventDefault();
              if (!deleting) setConfirmOpen(false);
            }}
            onClick={(event) => {
              if (event.target !== event.currentTarget || deleting) return;
              const rect = event.currentTarget.getBoundingClientRect();
              const inside =
                event.clientX >= rect.left &&
                event.clientX <= rect.right &&
                event.clientY >= rect.top &&
                event.clientY <= rect.bottom;
              if (!inside) setConfirmOpen(false);
            }}
            className="settings-rise paper-sheet m-auto hidden w-[calc(100%_-_2rem)] max-w-sm border-0 p-6 text-brown shadow-[0_0.75rem_2rem_color-mix(in_srgb,var(--color-brown)_10%,transparent)] backdrop:bg-brown/35 backdrop:backdrop-blur-[2px] open:block"
          >
            <h3
              id="delete-account-title"
              className="font-display text-xl font-bold text-brown"
            >
              {t("deleteAccount")}
            </h3>
            <p
              id="delete-account-description"
              className="mt-2 text-sm leading-relaxed text-brown-light"
            >
              {t("deleteAccountConfirm")}
            </p>
            {deleteError && <p role="alert" className="mt-4 text-sm leading-6 text-red-600">{t("deleteError")}</p>}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button
                ref={cancelDeleteRef}
                variant="ghost"
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
              >
                {tCommon("cancel")}
              </Button>
              <Button variant="danger" onClick={handleDeleteAccount} loading={deleting}>
                {tCommon("confirm")}
              </Button>
            </div>
          </dialog>
        )}
      </div>
    </div>
  );
}
