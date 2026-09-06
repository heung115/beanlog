import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string, locale: string = "ko"): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
    // Calendar dates are not instants: UTC parsing must not shift them to the
    // previous day for users west of UTC. Timestamps keep local-time behavior.
    ...(/^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? { timeZone: "UTC" } : {}),
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** A recorded calendar day remains the same when the API serializes it as midnight UTC. */
export function formatCalendarDate(dateStr: string, locale: string = "ko"): string {
  return formatDate(dateStr.slice(0, 10), locale);
}

export function formatScore(score: number): string {
  return score.toFixed(1);
}

export function getProcessColor(method: string): string {
  const colors: Record<string, string> = {
    washed: "bg-process-washed/15 text-brown",
    natural: "bg-process-natural/15 text-brown",
    honey: "bg-process-honey/15 text-brown",
    anaerobic: "bg-process-anaerobic/15 text-brown",
    carbonic: "bg-process-carbonic/15 text-brown",
    decaf: "bg-process-decaf/15 text-brown",
    other: "bg-process-other/15 text-brown",
  };
  return colors[method] || colors.other;
}

export function getRoastColor(level: string): string {
  const colors: Record<string, string> = {
    light: "bg-roast-light/20 text-brown",
    medium: "bg-roast-medium/20 text-brown",
    dark: "bg-roast-dark/20 text-brown",
  };
  return colors[level] || colors.medium;
}
