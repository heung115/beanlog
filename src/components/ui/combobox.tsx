"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  /** Canonical value stored when a suggestion is picked */
  value: string;
  /** Primary display label (locale-aware) */
  label: string;
  /** Secondary label shown right-aligned (e.g. the other language) */
  sublabel?: string;
}

interface ComboboxProps {
  label?: string;
  ariaLabel?: string;
  name: string;
  value: string;
  options: ComboboxOption[];
  /** Called on every keystroke with the raw text (free input is always allowed) */
  onTextChange: (text: string) => void;
  /** Called when a suggestion is picked */
  onPick?: (option: ComboboxOption) => void;
  /** Called on blur with the current text — use to normalize exact matches */
  onCommit?: (text: string) => void;
  placeholder?: string;
  /** Show every option when no search term is entered (use for short catalogs). */
  showAllOptions?: boolean;
  required?: boolean;
  optional?: boolean;
  optionalLabel?: string;
  className?: string;
  inputClassName?: string;
}

const MAX_SUGGESTIONS = 8;

function displayFor(value: string, options: ComboboxOption[]): string {
  const exact = options.find(
    (o) => o.value === value || o.label === value || o.sublabel === value
  );
  return exact ? exact.label : value;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-accent">
        {text.slice(idx, idx + q.length)}
      </span>
      {text.slice(idx + q.length)}
    </>
  );
}

/**
 * Autocomplete text input: type freely, or pick from filtered suggestions.
 * Suggestions match against label, sublabel and canonical value.
 */
const Combobox = forwardRef<HTMLInputElement, ComboboxProps>(
  (
    {
      label,
      ariaLabel,
      name,
      value,
      options,
      onTextChange,
      onPick,
      onCommit,
      placeholder,
      showAllOptions = false,
      required,
      optional,
      optionalLabel = "선택",
      className,
      inputClassName,
    },
    ref
  ) => {
    const inputId = useId();
    const listId = useId();
    const innerRef = useRef<HTMLInputElement | null>(null);
    const listRef = useRef<HTMLUListElement | null>(null);
    const lastEmitted = useRef(value);
    const selectAfterComposition = useRef(false);

    const [text, setText] = useState(() => displayFor(value, options));
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);

    // Sync when the value changes from outside (pick, reset, normalization)
    useEffect(() => {
      if (value !== lastEmitted.current) {
        lastEmitted.current = value;
        setText(displayFor(value, options));
      }
    }, [value, options]);

    const filtered = useMemo(() => {
      const q = text.trim().toLowerCase();
      const matches = q
        ? options.filter(
            (o) =>
              o.label.toLowerCase().includes(q) ||
              (o.sublabel ?? "").toLowerCase().includes(q) ||
              o.value.toLowerCase().includes(q)
          )
        : options;
      return showAllOptions ? matches : matches.slice(0, MAX_SUGGESTIONS);
    }, [text, options, showAllOptions]);

    const isMatched = useMemo(() => {
      const t = text.trim().toLowerCase();
      if (!t) return false;
      return options.some(
        (o) =>
          o.label.toLowerCase() === t ||
          o.value.toLowerCase() === t ||
          (o.sublabel ?? "").toLowerCase() === t
      );
    }, [text, options]);

    const showList = open && filtered.length > 0;

    useEffect(() => {
      if (!showList) return;
      listRef.current
        ?.querySelector('[data-active="true"]')
        ?.scrollIntoView({ block: "nearest" });
    }, [active, showList]);

    function emit(next: string) {
      lastEmitted.current = next;
      setText(next);
      onTextChange(next);
    }

    function pick(option: ComboboxOption) {
      lastEmitted.current = option.value;
      setText(option.label);
      if (onPick) {
        onPick(option);
      } else {
        onTextChange(option.label);
        lastEmitted.current = option.label;
      }
      setOpen(false);
      innerRef.current?.focus();
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      // In Korean/Japanese IME, Enter first commits the composing text. It must
      // not select before that text has reached React state.
      if (e.nativeEvent.isComposing) {
        if (e.key === "Enter") selectAfterComposition.current = true;
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (filtered.length === 0) return;
        setOpen(true);
        setActive((i) =>
          e.key === "ArrowDown"
            ? (i + 1) % filtered.length
            : (i - 1 + filtered.length) % filtered.length
        );
      } else if (e.key === "Enter") {
        if (showList) {
          e.preventDefault();
          pick(filtered[Math.min(active, filtered.length - 1)]);
        }
      } else if (e.key === "Escape" || e.key === "Tab") {
        setOpen(false);
      }
    }

    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-brown-medium"
          >
            {label}
            {optional && (
              <span className="ml-1.5 text-xs font-normal text-brown-light">
                {optionalLabel}
              </span>
            )}
          </label>
        )}
        <div className="relative">
          <input
            ref={(node) => {
              innerRef.current = node;
              if (typeof ref === "function") ref(node);
              else if (ref) ref.current = node;
            }}
            id={inputId}
            name={name}
            type="text"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-label={ariaLabel}
            aria-activedescendant={
              showList ? `${listId}-${Math.min(active, filtered.length - 1)}` : undefined
            }
            value={text}
            placeholder={placeholder}
            required={required}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              emit(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => {
              setOpen(true);
            }}
            onBlur={() => {
              selectAfterComposition.current = false;
              setOpen(false);
              onCommit?.(text);
            }}
            onCompositionStart={() => {
              selectAfterComposition.current = false;
            }}
            onKeyUp={(e) => {
              if (e.key !== "Enter" || !selectAfterComposition.current) return;

              selectAfterComposition.current = false;
              const query = e.currentTarget.value.trim().toLowerCase();
              const matches = query
                ? options.filter(
                    (option) =>
                      option.label.toLowerCase().includes(query) ||
                      (option.sublabel ?? "").toLowerCase().includes(query) ||
                      option.value.toLowerCase().includes(query)
                  )
                : options;
              const visibleMatches = showAllOptions
                ? matches
                : matches.slice(0, MAX_SUGGESTIONS);

              if (visibleMatches.length > 0) pick(visibleMatches[0]);
            }}
            onKeyDown={handleKeyDown}
            className={cn(
              "w-full rounded-sm border border-border bg-surface px-3 py-2.5 pr-9 text-sm text-brown placeholder:text-brown-light/40",
              "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
              "transition-colors duration-150",
              inputClassName
            )}
          />

          {/* Status icon: check when the text resolves to a known option */}
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brown-light/50">
            {isMatched ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                className="text-accent"
              >
                <path
                  d="M2.5 7.5l3 3 6-7"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className={cn(
                  "transition-transform duration-200",
                  showList && "rotate-180"
                )}
              >
                <path
                  d="M2 4l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>

          {showList && (
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={ariaLabel ?? label}
              className="absolute z-20 mt-1 max-h-60 w-full min-w-72 overflow-y-auto rounded-sm border border-border bg-surface py-1 shadow-lg"
            >
              {filtered.map((option, i) => (
                <li
                  key={option.value}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  data-active={i === active || undefined}
                >
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(option);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      "grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                      i === active ? "bg-cream-dark text-brown" : "text-brown"
                    )}
                  >
                    <span className="min-w-0 truncate">
                      <Highlight text={option.label} query={text} />
                    </span>
                    {option.sublabel && (
                      <span className="max-w-40 truncate text-xs text-brown-light/60">
                        <Highlight text={option.sublabel} query={text} />
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }
);
Combobox.displayName = "Combobox";

export { Combobox };
