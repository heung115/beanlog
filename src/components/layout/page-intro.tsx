import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageIntroProps {
  eyebrow: string;
  title: string;
  description: string;
  meta?: ReactNode;
  testId?: string;
  className?: string;
}

export function PageIntro({
  eyebrow,
  title,
  description,
  meta,
  testId,
  className,
}: PageIntroProps) {
  return (
    <header
      data-testid={testId}
      className={cn("animate-rise pt-2 md:pt-3", className)}
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-8">
        <div className="min-w-0">
          <p className="journal-kicker">{eyebrow}</p>
          <h1 className="app-page-title mt-2">{title}</h1>
          <p className="app-page-deck mt-3">{description}</p>
        </div>
        {meta ? <div className="shrink-0 pb-1 sm:text-right">{meta}</div> : null}
      </div>
    </header>
  );
}
