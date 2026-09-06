"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export const DETAIL_SCORE_KEYS = [
  "aroma",
  "acidity",
  "body",
  "sweetness",
  "aftertaste",
  "balance",
] as const;

export type DetailScoreKey = (typeof DETAIL_SCORE_KEYS)[number];

interface DetailScoreInputProps {
  scores: Record<string, number | undefined>;
  onChange: (key: string, value: number) => void;
}

function ScoreRow({
  label,
  value,
  onSelect,
}: {
  label: string;
  value: number | undefined;
  onSelect: (value: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || value || 0;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,12.5rem)] items-center gap-2 py-1.5">
      <div className="min-w-0">
        <span className="break-words text-sm text-brown-medium">{label}</span>
        <span className={cn("ml-2 whitespace-nowrap text-xs tabular-nums", value ? "text-brown" : "text-brown-light")}>
          {value ? `${value}/5` : "–"}
        </span>
      </div>

      <div
        className="grid grid-cols-5 gap-0.5"
        onMouseLeave={() => setHovered(0)}
        role="radiogroup"
        aria-label={label}
        onKeyDown={(event) => {
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="radio"]'));
          const index = controls.indexOf(event.target as HTMLButtonElement);
          if (index < 0) return;
          const next = event.key === "ArrowRight" || event.key === "ArrowDown"
            ? (index + 1) % 5
            : event.key === "ArrowLeft" || event.key === "ArrowUp"
              ? (index + 4) % 5
              : event.key === "Home" ? 0 : event.key === "End" ? 4 : null;
          if (next === null) return;
          event.preventDefault();
          onSelect(next + 1);
          controls[next]?.focus();
        }}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${label} ${n}`}
            tabIndex={(value || 1) === n ? 0 : -1}
            onMouseEnter={() => setHovered(n)}
            onFocus={() => setHovered(n)}
            onBlur={() => setHovered(0)}
            onClick={() => onSelect(value === n ? 0 : n)}
            className="flex min-h-11 min-w-0 items-center justify-center rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span aria-hidden="true" className={cn(
              "h-6 w-6 rounded-full border transition-all duration-150",
              n <= active
                ? hovered
                  ? "scale-110 border-accent-light bg-accent-light"
                  : "border-accent bg-accent"
                : "border-border bg-surface"
            )} />
          </button>
        ))}
      </div>

    </div>
  );
}

export function DetailScoreInput({ scores, onChange }: DetailScoreInputProps) {
  const t = useTranslations("beans");

  return (
    <div>
      <p className="mb-2 text-xs leading-5 text-brown-light">{t("detailScoreHint")}</p>
      <div className="flex flex-col divide-y divide-border-light">
      {DETAIL_SCORE_KEYS.map((key) => (
        <ScoreRow
          key={key}
          label={t(key)}
          value={scores[key]}
          onSelect={(v) => onChange(key, v)}
        />
      ))}
      </div>
    </div>
  );
}
