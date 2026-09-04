"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { deleteAccount, exportData, updateProfile } from "@/lib/actions/beans";
import { signOut } from "@/lib/actions/auth";
import { getProfile } from "@/lib/actions/profile";

type Locale = "ko" | "en";

function SectionCard({
  title,
  children,
  delay = 0,
  feature = false,
  plain = false,
}: {
  title: string;
  children: React.ReactNode;
  delay?: number;
  feature?: boolean;
  plain?: boolean;
}) {
  return (
    <section
      className={`settings-rise ${
        plain
          ? "px-1 pt-6"
          : feature
            ? "paper-sheet paper-sheet-feature p-5 md:p-7"
            : "paper-sheet p-5 md:p-7"
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <h2 className="mb-4 font-display text-lg font-bold tracking-tight text-brown">
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
    >
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-9 9h18M12 3c2.5 2.4 3.8 5.6 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.6-3.8-9S9.5 5.4 12 3Z",
  download: "M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M4 19h16",
  document: "M7 3h7l4 4v14H7V3Zm7 0v5h5M10 12h5m-5 4h5",
  logout: "M14 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2M9 12h11m0 0-3-3m3 3-3 3",
};

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();

  const [displayName, setDisplayName] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let mounted = true;
    getProfile()
      .then((p) => {
        if (mounted && p?.display_name) setDisplayName(p.display_name);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setProfileLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

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
    setSaving(true);
    try {
      const result = await updateProfile(displayName.trim(), locale);
      if (result?.error) {
        toast.show(tCommon("error"));
      } else {
        toast.show(t("saved"));
      }
    } catch {
      toast.show(tCommon("error"));
    } finally {
      setSaving(false);
    }
  }

  function switchLocale(next: Locale) {
    if (next === locale) return;
    // Persist the preference, then swap the locale segment in the URL.
    updateProfile(displayName.trim(), next).catch(() => {});
    const segments = pathname.split("/");
    segments[1] = next;
    router.replace(segments.join("/") || `/${next}`);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const data = await exportData();
      if (!data) {
        toast.show(tCommon("error"));
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
      toast.show(tCommon("error"));
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await deleteAccount();
    } catch {
      // deleteAccount redirects on success; ignore navigation errors
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

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <style>{`
        @keyframes settings-rise-kf {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .settings-rise {
          animation: settings-rise-kf 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
      `}</style>

      {/* ---------- header ---------- */}
      <header className="settings-rise py-9 md:py-12">
        <h1 className="display-title text-5xl text-brown md:text-7xl">
          {t("title")}
        </h1>
      </header>

      {/* ---------- profile ---------- */}
      <SectionCard title={t("profile")} delay={60} feature>
        <form onSubmit={handleSaveProfile} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label={t("displayName")}
              name="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={profileLoading ? tCommon("loading") : "beanmap"}
              maxLength={30}
              required
            />
          </div>
          <Button type="submit" loading={saving} className="sm:shrink-0">
            {tCommon("confirm")}
          </Button>
        </form>
      </SectionCard>

      {/* ---------- language ---------- */}
      <SectionCard title={t("language")} delay={120} plain>
        <div
          role="radiogroup"
          aria-label={t("language")}
          className="inline-flex rounded-md bg-cream-dark/60 p-1"
        >
          {locales.map((l) => {
            const active = l.value === locale;
            return (
              <button
                key={l.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => switchLocale(l.value)}
                className={`min-h-11 rounded-sm border border-transparent px-5 py-2 text-sm font-semibold transition-all duration-150 ${
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
      </SectionCard>

      {/* ---------- export ---------- */}
      <SectionCard title={t("exportData")} delay={180} plain>
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
      </SectionCard>

      {/* ---------- legal ---------- */}
      <SectionCard title={t("legal")} delay={240} plain>
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
      <SectionCard title={tAuth("logout")} delay={300} plain>
        <Button variant="secondary" onClick={() => signOut()} className="w-full sm:w-auto">
          <Icon path={ICONS.logout} className="mr-2 h-4 w-4" />
          {tAuth("logout")}
        </Button>
      </SectionCard>

      {/* ---------- account deletion ---------- */}
      <section
        data-account-deletion
        className="settings-rise px-1 pt-6"
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
            onClick={() => setConfirmOpen(true)}
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
          <div className="mt-6 flex justify-end gap-3">
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
  );
}
