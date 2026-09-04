import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";

interface GuideStep {
  title: string;
  description: string;
}

interface EmptyJournalGuideProps {
  testId: string;
  eyebrow: string;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  steps: GuideStep[];
}

export function EmptyJournalGuide({
  testId,
  eyebrow,
  title,
  description,
  actionLabel,
  href,
  steps,
}: EmptyJournalGuideProps) {
  const titleId = `${testId}-title`;

  return (
    <section
      data-testid={testId}
      aria-labelledby={titleId}
      className="animate-rise col-span-full mt-10 grid gap-9 pb-6 md:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] md:gap-14 md:pb-10"
      style={{ animationDelay: "80ms" }}
    >
      <div className="max-w-sm">
        <p className="journal-kicker">{eyebrow}</p>
        <h2 id={titleId} className="mt-3 text-2xl font-semibold leading-tight tracking-[-0.025em] text-brown">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-brown-light">{description}</p>
        <Link
          href={href}
          prefetch={false}
          className={buttonClassName({ size: "md", className: "mt-6" })}
        >
          {actionLabel}
          <span aria-hidden="true" className="ml-2 text-base leading-none">
            →
          </span>
        </Link>
      </div>

      <ol className="border-t border-border-light">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 border-b border-border-light py-4 md:py-5"
          >
            <span className="pt-0.5 font-mono text-[11px] font-medium tabular-nums text-accent">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <h3 className="text-sm font-semibold text-brown">{step.title}</h3>
              <p className="mt-1 text-xs leading-5 text-brown-light">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
