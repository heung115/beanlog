"use client";

import { startTransition, useEffect, useState } from "react";
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

  useEffect(() => {
    const draft = loadGuestBeanDraft();
    if (!draft) return;
    startTransition(() => {
      setForm(draft.bean);
      setSaved(true);
    });
  }, []);

  function set<K extends keyof BeanFormData>(key: K, value: BeanFormData[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

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
    setSaved(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (saved) {
    return (
      <article className="journal-panel-feature bg-surface p-5 md:p-7" aria-label={t("savedTitle")}>
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h2 className="font-display text-lg font-bold text-brown">{t("savedTitle")}</h2>
          <time className="text-xs text-brown-light" dateTime={form.consumed_at}>
            {form.consumed_at.replaceAll("-", ". ")}
          </time>
        </div>

        <div className="border-b border-border py-6">
          <p className="text-xs text-brown-light">{form.roastery}</p>
          <h3 className="mt-2 font-display text-2xl font-bold tracking-[-0.025em] text-brown">
            {form.name}
          </h3>
          <p className="mt-2 text-sm text-brown-medium">
            {form.origin_country} · {tp(form.process_method)} · {tr(form.roast_level)}
          </p>
        </div>

        <div className="flex items-end justify-between gap-6 border-b border-border py-5">
          <div>
            <p className="text-xs text-brown-light">{tb("note")}</p>
            <p className="mt-2 text-sm leading-6 text-brown">{form.note}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-brown-light">{tb("overallScore")}</p>
            <p className="mt-1 font-display text-3xl font-bold tabular-nums text-accent">
              {form.overall_score}
            </p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-6 text-brown-light">{t("savedNotice")}</p>

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
        <Button variant="ghost" className="mt-3 w-full" onClick={() => setSaved(false)}>
          {t("edit")}
        </Button>
      </article>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <p className="journal-panel-quiet px-4 py-3 text-sm leading-6 text-brown-medium">
        {t("storageNotice")}
      </p>

      <section className="journal-panel-feature bg-surface p-5 md:p-6">
        <div className="flex flex-col gap-5">
          <Input
            label={`${tb("name")} *`}
            name="name"
            value={form.name}
            onChange={(event) => set("name", event.target.value)}
            placeholder={tb("namePlaceholder")}
            maxLength={200}
            required
          />
          <Input
            label={`${tb("roastery")} *`}
            name="roastery"
            value={form.roastery}
            onChange={(event) => set("roastery", event.target.value)}
            placeholder={tb("roasteryPlaceholder")}
            maxLength={200}
            required
          />
          <Input
            label={`${tb("originCountry")} *`}
            name="origin_country"
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
            value={form.consumed_at}
            onChange={(event) => set("consumed_at", event.target.value)}
            required
          />
          <ScoreSlider
            label={`${tb("overallScore")} *`}
            value={form.overall_score}
            onChange={(value) => set("overall_score", value)}
          />
          <Textarea
            label={`${tb("note")} *`}
            name="note"
            value={form.note}
            onChange={(event) => set("note", event.target.value)}
            placeholder={tb("notePlaceholder")}
            maxLength={2000}
            rows={4}
            required
          />
        </div>
      </section>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <Button type="submit" size="lg" className="w-full">
        {t("temporarySave")}
      </Button>
    </form>
  );
}
