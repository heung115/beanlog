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
    "pressable inline-flex items-center justify-center rounded-sm font-semibold tracking-[-0.01em] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0",
    {
      "border border-brown bg-brown text-cream shadow-[3px_3px_0_var(--color-accent-light)] hover:bg-accent hover:shadow-[4px_4px_0_var(--color-accent-light)]": variant === "primary",
      "border border-brown bg-transparent text-brown shadow-[2px_2px_0_var(--color-cream-dark)] hover:bg-surface": variant === "secondary",
      "bg-transparent text-brown-light hover:bg-surface hover:text-brown": variant === "ghost",
      "border border-red-800 bg-red-800 text-white shadow-[3px_3px_0_var(--color-accent-light)] hover:bg-red-900": variant === "danger",
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
