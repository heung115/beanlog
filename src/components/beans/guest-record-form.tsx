"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Button, buttonClassName } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScoreSlider } from "@/components/beans/score-slider";
import {
  loadGuestBeanDraft,
  saveGuestBeanDraft,
} from "@/lib/coffee/guest-draft";
import type { BeanFormData, ProcessMethod, RoastLevel } from "@/types/database";
import { formatCalendarDate } from "@/lib/utils";
import { isCalendarDate, MIN_CALENDAR_DATE, MAX_CALENDAR_DATE } from "@/lib/coffee/calendar-date";
import { isGuestFormDraft } from "@/lib/coffee/record-draft-value";
import { parseRecordDraft, RECORD_DRAFT_PREFIX } from "@/lib/coffee/record-draft";
import { useRecordDraft } from "@/components/beans/use-record-draft";
import { RecordDraftNotice } from "@/components/beans/record-draft-notice";

function todayString() {
  return new Date().toLocaleDateString("sv");
}

function emptyDraft(): BeanFormData {
  return {
    name: "",
    roastery: "",
    bean_type: "single_origin",
    origin_country: "",
    process_method: "washed",
    roast_level: "medium",
    consumed_at: todayString(),
    place_type: "home",
    overall_score: 7,
    note: "",
    tags: [],
    blend_components: [],
  };
}

export function GuestRecordForm() {
  const locale = useLocale();
  const t = useTranslations("guest");
  const tb = useTranslations("beans");
  const tp = useTranslations("process");
  const tr = useTranslations("roast");
  const [form, setForm] = useState<BeanFormData>(emptyDraft);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const savedHeadingRef = useRef<HTMLHeadingElement>(null);
  const nextFocus = useRef<"saved" | "form" | null>(null);
  useEffect(() => {
    if (nextFocus.current === "saved" && saved) savedHeadingRef.current?.focus({ preventScroll: true });
    else if (nextFocus.current === "form" && !saved) formRef.current?.querySelector<HTMLInputElement>('[name="name"]')?.focus();
    else return;
    nextFocus.current = null;
  }, [saved]);
  const draftRecovery = useRecordDraft({
    scope: "guest", value: form, validate: isGuestFormDraft, enabled: !saved,
    onRestore: (restored) => { setForm(restored); setError(""); setErrorField(null); },
  });

  useEffect(() => {
    // A newer unfinished edit takes precedence over the explicit signup copy.
    try {
      if (parseRecordDraft(sessionStorage.getItem(RECORD_DRAFT_PREFIX + "guest"), isGuestFormDraft)) return;
    } catch { /* The hook explains unavailable browser storage while editing. */ }
    const draft = loadGuestBeanDraft();
    if (!draft) return;
    startTransition(() => {
      setForm(draft.bean);
      setSaved(true);
    });
  }, []);

  function set<K extends keyof BeanFormData>(key: K, value: BeanFormData[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === errorField) { setErrorField(null); setError(""); }
  }

  function errorProps(name: string) {
    return { "aria-invalid": errorField === name || undefined, "aria-describedby": errorField === name ? "guest-form-error" : undefined };
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draftRecovery.ready) return;
    setError("");
    setErrorField(null);
    const missing = (["name", "roastery", "origin_country", "note"] as const).find((key) => !form[key]?.trim());
    if (missing) {
      setErrorField(missing);
      setError(tb("requiredField", { field: tb(missing === "origin_country" ? "originCountry" : missing) }));
      formRef.current?.querySelector<HTMLElement>(`[name="${missing}"]`)?.focus();
      return;
    }

    if (!isCalendarDate(form.consumed_at)) {
      setErrorField("consumed_at");
      setError(tb("invalidDate", { field: tb("consumedAt") }));
      formRef.current?.querySelector<HTMLInputElement>('[name="consumed_at"]')?.focus();
      return;
    }

    const result = saveGuestBeanDraft(form);
    if (result.status === "invalid") {
      setError(tb("fillRequired"));
      return;
    }
    if (result.status === "storage_unavailable") {
      setError(t("storageError"));
      return;
    }

    setForm(result.draft.bean);
    draftRecovery.reset(result.draft.bean);
    nextFocus.current = "saved";
    setSaved(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (saved) {
    return (
      <article className="paper-sheet min-w-0 p-5 [overflow-wrap:anywhere] md:p-8" aria-label={t("savedTitle")}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 ref={savedHeadingRef} tabIndex={-1} className="font-display text-2xl font-bold text-brown focus:outline-none">{t("savedTitle")}</h2>
          <time className="folio-label" dateTime={form.consumed_at}>
            {formatCalendarDate(form.consumed_at, locale)}
          </time>
        </div>

        <div className="py-6">
          <p className="text-xs text-brown-light">{form.roastery}</p>
          <h3 className="mt-2 font-display text-2xl font-bold tracking-[-0.025em] text-brown">
            {form.name}
          </h3>
          <p className="mt-2 text-sm text-brown-medium">
            {form.origin_country} · {tp(form.process_method)} · {tr(form.roast_level)}
          </p>
        </div>

        <div className="flex items-end justify-between gap-6 py-5">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-brown-light">{tb("note")}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-brown">{form.note}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-brown-light">{tb("overallScore")}</p>
            <p className="data-value mt-1 text-3xl font-bold text-accent">
              {form.overall_score}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/${locale}/signup?draft=1`}
            className={buttonClassName({ size: "md", className: "sm:flex-1" })}
          >
            {t("signupToKeep")}
          </Link>
          <Link
            href={`/${locale}/login?draft=1`}
            className={buttonClassName({ variant: "secondary", size: "md", className: "sm:flex-1" })}
          >
            {t("loginToKeep")}
          </Link>
        </div>
        <Button variant="ghost" className="mt-3 w-full" onClick={() => { nextFocus.current = "form"; setSaved(false); }}>
          {t("edit")}
        </Button>
      </article>
    );
  }

  return (
    <form ref={formRef} method="post" noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
      <noscript><p role="alert" className="rounded-md bg-surface-warm p-4 text-sm leading-6 text-brown">{t("javascriptRequired")} <Link href={`/${locale}/login`} className="underline underline-offset-4">{t("loginToKeep")}</Link></p></noscript>
      <p className="max-w-2xl px-1 text-sm leading-6 text-brown-medium">
        {t("storageNotice")}
      </p>

      <RecordDraftNotice
        status={draftRecovery.status}
        onDiscard={() => {
          const savedDraft = loadGuestBeanDraft();
          draftRecovery.discard(savedDraft?.bean ?? emptyDraft());
          if (savedDraft) setSaved(true);
          else formRef.current?.querySelector<HTMLInputElement>('[name="name"]')?.focus();
        }}
        onRestore={draftRecovery.restoreConflict}
      />

      <fieldset disabled={!draftRecovery.ready} className="contents">
      <section className="paper-sheet p-5 md:p-8">
        <div className="mb-7 flex items-center justify-between">
          <p className="journal-kicker">{tb("basicInfo")}</p>
          <span className="font-display text-3xl text-accent">01</span>
        </div>
        <div className="flex flex-col gap-5">
          <Input
            label={`${tb("name")} *`}
            name="name"
            {...errorProps("name")}
            value={form.name}
            onChange={(event) => set("name", event.target.value)}
            placeholder={tb("namePlaceholder")}
            maxLength={200}
            required
          />
          <Input
            label={`${tb("roastery")} *`}
            name="roastery"
            {...errorProps("roastery")}
            value={form.roastery}
            onChange={(event) => set("roastery", event.target.value)}
            placeholder={tb("roasteryPlaceholder")}
            maxLength={200}
            required
          />
          <Input
            label={`${tb("originCountry")} *`}
            name="origin_country"
            {...errorProps("origin_country")}
            value={form.origin_country ?? ""}
            onChange={(event) => set("origin_country", event.target.value)}
            placeholder={tb("originCountryPlaceholder")}
            maxLength={100}
            required
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <Select
              label={`${tb("processMethod")} *`}
              name="process_method"
              value={form.process_method}
              onChange={(event) => set("process_method", event.target.value as ProcessMethod)}
              required
            >
              {(
                ["washed", "natural", "honey", "anaerobic", "carbonic", "decaf", "other"] as ProcessMethod[]
              ).map((method) => (
                <option key={method} value={method}>{tp(method)}</option>
              ))}
            </Select>
            <Select
              label={`${tb("roastLevel")} *`}
              name="roast_level"
              value={form.roast_level}
              onChange={(event) => set("roast_level", event.target.value as RoastLevel)}
              required
            >
              {(["light", "medium", "dark"] as RoastLevel[]).map((level) => (
                <option key={level} value={level}>{tr(level)}</option>
              ))}
            </Select>
          </div>
          <Input
            label={`${tb("consumedAt")} *`}
            name="consumed_at"
            type="date"
            min={MIN_CALENDAR_DATE}
            max={MAX_CALENDAR_DATE}
            {...errorProps("consumed_at")}
            value={form.consumed_at}
            onChange={(event) => set("consumed_at", event.target.value)}
            required
          />
          <div className="mt-8">
            <div className="mb-5 flex items-center justify-between">
              <p className="journal-kicker">{tb("evaluation")}</p>
              <span className="font-display text-2xl text-accent">02</span>
            </div>
            <div className="flex flex-col gap-5">
              <ScoreSlider
                label={`${tb("overallScore")} *`}
                value={form.overall_score}
                onChange={(value) => set("overall_score", value)}
              />
              <Textarea
                label={`${tb("note")} *`}
                name="note"
                {...errorProps("note")}
                value={form.note}
                onChange={(event) => set("note", event.target.value)}
                placeholder={tb("notePlaceholder")}
                maxLength={2000}
                rows={4}
                required
              />
            </div>
          </div>
        </div>
      </section>

      {error && <p id="guest-form-error" role="alert" className="text-sm text-red-700">{error}</p>}

      <Button type="submit" size="lg" className="w-full">
        {t("temporarySave")}
      </Button>
      </fieldset>
    </form>
  );
}
