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
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="w-20 shrink-0 text-sm text-brown-medium">{label}</span>

      <div
        className="flex items-center gap-2"
        onMouseLeave={() => setHovered(0)}
        role="radiogroup"
        aria-label={label}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${label} ${n}`}
            onMouseEnter={() => setHovered(n)}
            onFocus={() => setHovered(n)}
            onBlur={() => setHovered(0)}
            onClick={() => onSelect(value === n ? 0 : n)}
            className={cn(
              "h-6 w-6 rounded-full border transition-all duration-150",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
              n <= active
                ? hovered
                  ? "scale-110 border-accent-light bg-accent-light"
                  : "border-accent bg-accent"
                : "border-border bg-surface hover:border-accent-light"
            )}
          />
        ))}
      </div>

      <span
        className={cn(
          "w-8 shrink-0 text-right text-xs tabular-nums transition-colors",
          value ? "font-medium text-brown" : "text-brown-light/40"
        )}
      >
        {value ? `${value}/5` : "–"}
      </span>
    </div>
  );
}

export function DetailScoreInput({ scores, onChange }: DetailScoreInputProps) {
  const t = useTranslations("beans");

  return (
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
  );
}
