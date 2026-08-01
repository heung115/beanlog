"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

interface SubregionInputProps {
  label: string;
  placeholder: string;
  value: string[];
  suggestions: string[];
  onChange: (value: string[]) => void;
  inputClassName?: string;
  showLabel?: boolean;
  optional?: boolean;
  optionalLabel?: string;
}

export function parseSubregionText(text: string): string[] {
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const part of text.split(",")) {
    const subregion = part.trim().replace(/\s+/g, " ");
    if (!subregion) continue;
    const key = subregion.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(subregion);
  }

  return parts;
}

export function nextSubregionSuggestions(
  chains: string[][],
  prefix: string[]
): string[] {
  const suggestions = new Set<string>();

  for (const chain of chains) {
    const matchesPrefix = prefix.every(
      (item, index) => chain[index]?.toLowerCase() === item.toLowerCase()
    );
    if (!matchesPrefix) continue;
    const next = chain[prefix.length];
    if (next) suggestions.add(next);
  }

  return Array.from(suggestions).sort((a, b) => a.localeCompare(b));
}

export function SubregionInput({
  label,
  placeholder,
  value,
  suggestions,
  onChange,
  inputClassName,
  showLabel = false,
  optional = false,
  optionalLabel = "선택",
}: SubregionInputProps) {
  const inputId = useId();
  const text = value.join(", ");
  const currentParts = parseSubregionText(text);
  const lastPart = currentParts.at(-1) ?? "";
  const filteredSuggestions = suggestions.filter(
    (suggestion) =>
      suggestion.toLowerCase().includes(lastPart.toLowerCase()) &&
      !currentParts.some((item) => item.toLowerCase() === suggestion.toLowerCase())
  );

  function updateText(next: string) {
    onChange(parseSubregionText(next));
  }

  function pickSuggestion(suggestion: string) {
    const prefix = text.includes(",")
      ? text.slice(0, text.lastIndexOf(",") + 1)
      : "";
    const spacer = prefix && !prefix.endsWith(" ") ? " " : "";
    updateText(`${prefix}${spacer}${suggestion}`);
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      {showLabel && (
        <label htmlFor={inputId} className="text-sm font-medium text-brown-medium">
          {label}
          {optional && (
            <span className="ml-1.5 text-xs font-normal text-brown-light">
              {optionalLabel}
            </span>
          )}
        </label>
      )}
      <input
        id={inputId}
        type="text"
        aria-label={label}
        value={text}
        onChange={(e) => updateText(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-sm border border-border bg-surface px-3 py-2 text-xs text-brown placeholder:text-brown-light/40",
          "transition-colors duration-150 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
          inputClassName
        )}
      />
      {filteredSuggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-sm border border-border bg-surface py-1 shadow-lg">
          {filteredSuggestions.slice(0, 5).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                pickSuggestion(suggestion);
              }}
              className="block w-full truncate px-3 py-2 text-left text-xs font-medium text-brown transition-colors hover:bg-cream-dark"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
