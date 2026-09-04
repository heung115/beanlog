import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function buttonClassName({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "pressable inline-flex items-center justify-center rounded-md font-semibold tracking-[-0.01em] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0",
    {
      "bg-brown text-cream shadow-[0_0.35rem_0.9rem_color-mix(in_srgb,var(--color-brown)_16%,transparent)] hover:bg-accent hover:shadow-[0_0.5rem_1.25rem_color-mix(in_srgb,var(--color-accent)_18%,transparent)]": variant === "primary",
      "border border-border-light bg-surface text-brown hover:bg-surface-warm": variant === "secondary",
      "bg-transparent text-brown-light hover:bg-surface hover:text-brown": variant === "ghost",
      "bg-red-800 text-white shadow-[0_0.35rem_0.9rem_color-mix(in_srgb,var(--color-red-800)_16%,transparent)] hover:bg-red-900 hover:shadow-[0_0.5rem_1.25rem_color-mix(in_srgb,var(--color-red-800)_20%,transparent)]": variant === "danger",
    },
    {
      "min-h-11 text-sm px-3 py-1.5": size === "sm",
      "min-h-11 text-sm px-4 py-2.5": size === "md",
      "min-h-12 text-base px-6 py-3": size === "lg",
    },
    className
  );
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={buttonClassName({ variant, size, className })}
        {...props}
      >
        {loading && <span aria-hidden="true" className="mr-2 font-mono text-xs tracking-widest">···</span>}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };
