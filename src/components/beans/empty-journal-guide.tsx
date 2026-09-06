import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";

interface EmptyJournalGuideProps {
  testId: string;
  title: string;
  actionLabel: string;
  href: string;
}

export function EmptyJournalGuide({
  testId,
  title,
  actionLabel,
  href,
}: EmptyJournalGuideProps) {
  const titleId = `${testId}-title`;

  return (
    <section
      data-testid={testId}
      aria-labelledby={titleId}
      className="animate-rise col-span-full flex flex-col items-start py-10 md:py-12"
      style={{ animationDelay: "80ms" }}
    >
      <h2 id={titleId} className="max-w-xl text-xl font-semibold leading-tight tracking-[-0.025em] text-brown">
        {title}
      </h2>
      <Link
        href={href}
        prefetch={false}
        className={buttonClassName({ size: "md", className: "mt-5" })}
      >
        {actionLabel}
        <span aria-hidden="true" className="ml-2 text-base leading-none">
          →
        </span>
      </Link>
    </section>
  );
}
