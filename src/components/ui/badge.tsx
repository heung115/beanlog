import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "process" | "roast";
}

export function Badge({ children, className, variant = "default" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 font-mono text-[0.6875rem] font-semibold uppercase leading-5 tracking-[0.04em]",
        variant === "default" && "bg-cream-dark/60 text-brown-medium",
        className
      )}
    >
      {children}
    </span>
  );
}
