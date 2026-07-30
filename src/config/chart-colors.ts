/**
 * Recharts accepts CSS color values, including custom-property references.
 * Keeping names here and values in globals.css prevents chart-only hex drift.
 */
export const chartColors = {
  primary: "var(--color-brown)",
  primarySoft: "var(--color-brown-medium)",
  secondary: "var(--color-brown-light)",
  accent: "var(--color-accent)",
  accentSoft: "var(--color-accent-light)",
  accentWash: "color-mix(in srgb, var(--color-accent-light) 8%, transparent)",
  border: "var(--color-border)",
  borderLight: "var(--color-border-light)",
  process: {
    washed: "var(--color-process-washed)",
    natural: "var(--color-process-natural)",
    honey: "var(--color-process-honey)",
    anaerobic: "var(--color-process-anaerobic)",
    carbonic: "var(--color-process-carbonic)",
    decaf: "var(--color-process-decaf)",
    other: "var(--color-process-other)",
  },
} as const;
