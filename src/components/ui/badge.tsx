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
        "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium leading-5",
        variant === "default" && "bg-cream-dark text-brown-medium",
        className
      )}
    >
      {children}
    </span>
  );
}
