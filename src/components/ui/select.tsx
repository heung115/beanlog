import { SelectHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  optional?: boolean;
  optionalLabel?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, optional, optionalLabel = "선택", id, children, ...props }, ref) => {
    const selectId = id || props.name;
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label htmlFor={selectId} className="text-[0.8125rem] font-semibold text-brown">
            {label}
            {optional && (
              <span className="ml-1.5 text-xs font-normal text-brown-light">{optionalLabel}</span>
            )}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "min-h-12 w-full rounded-sm border border-border bg-surface px-3.5 py-2.5 text-sm text-brown",
            "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15",
            "transition-colors duration-150 appearance-none",
            "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%238B7355%22%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_12px_center] bg-no-repeat pr-8",
            className
          )}
          {...props}
        >
          {children}
        </select>
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
