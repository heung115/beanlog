import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  optional?: boolean;
  optionalLabel?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, optional, optionalLabel = "선택", id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-brown-medium">
            {label}
            {optional && (
              <span className="ml-1.5 text-xs font-normal text-brown-light">{optionalLabel}</span>
            )}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full rounded-sm border border-border bg-surface px-3 py-2.5 text-sm text-brown placeholder:text-brown-light/40",
            "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
            "transition-colors duration-150",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
