import { cn } from "@/lib/utils";

export function BeanmapMark({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        fill="none"
        className={cn("shrink-0 text-accent", compact ? "h-6 w-6" : "h-7 w-7")}
      >
        <path
          d="M20.8 3.7C13.2 1.25 5.25 7.75 6.05 16.35c.72 7.72 8.13 12.38 14.24 8.67 6.12-3.72 8.06-18.88.51-21.32Z"
          stroke="currentColor"
          strokeWidth="1.55"
        />
        <path
          d="M20.25 4.35c-.77 4.45-5.72 5.73-7.05 10.08-1.23 4 .64 7.84 4.07 10.97"
          stroke="currentColor"
          strokeWidth="1.55"
          strokeLinecap="round"
        />
        <circle cx="8.35" cy="10.15" r="1.15" fill="currentColor" />
      </svg>
      <span className="font-body text-[1.15rem] font-extrabold tracking-[-0.045em] text-brown">
        beanmap
      </span>
    </span>
  );
}
