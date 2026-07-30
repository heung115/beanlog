import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string, locale: string = "ko"): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatScore(score: number): string {
  return score.toFixed(1);
}

export function getProcessColor(method: string): string {
  const colors: Record<string, string> = {
    washed: "bg-process-washed/15 text-process-washed",
    natural: "bg-process-natural/15 text-process-natural",
    honey: "bg-process-honey/15 text-process-honey",
    anaerobic: "bg-process-anaerobic/15 text-process-anaerobic",
    carbonic: "bg-process-carbonic/15 text-process-carbonic",
    decaf: "bg-process-other/15 text-brown-medium",
    other: "bg-process-other/15 text-process-other",
  };
  return colors[method] || colors.other;
}

export function getRoastColor(level: string): string {
  const colors: Record<string, string> = {
    light: "bg-roast-light/20 text-roast-light",
    medium: "bg-roast-medium/20 text-roast-medium",
    dark: "bg-roast-dark/20 text-roast-dark",
  };
  return colors[level] || colors.medium;
}
