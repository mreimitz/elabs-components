"use client";

import { forwardRef, useId, useRef, type InputHTMLAttributes } from "react";
import { Input, useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { SearchIcon } from "@elabs-ai/components-icons";

export interface SearchInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value"
> {
  value: string;
  onValueChange: (value: string) => void;
  /** Visually-hidden accessible label. Defaults to the localized "Search" microcopy. */
  label?: string;
  containerClassName?: string;
}

/**
 * Search field with a leading icon and a clear button. Controlled.
 *
 * `disabled` (available via the extended `InputHTMLAttributes`) is how a
 * consumer signals a pending fetch (D5 — the app owns fetch state, this
 * control just reflects it; see loading-states.md). It is forwarded to the
 * `<Input>` explicitly AND gates the clear button — while disabled the clear
 * affordance is hidden so it can't mutate the filter mid-request (#269/#8).
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  {
    value,
    onValueChange,
    label,
    placeholder,
    className,
    containerClassName,
    disabled,
    id: idProp,
    ...props
  },
  forwardedRef,
) {
  const { t } = useLocale();
  const resolvedLabel = label ?? t("data.searchInput.label");
  const resolvedPlaceholder = placeholder ?? t("data.searchInput.placeholder");
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const inputRef = useRef<HTMLInputElement>(null);

  const setRefs = (node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  const handleClear = () => {
    onValueChange("");
    // The clear button unmounts the instant `value` becomes falsy — without
    // this, the browser drops focus to <body> instead of leaving it
    // somewhere the keyboard user can keep typing.
    inputRef.current?.focus();
  };

  return (
    <div className={cn("relative w-full max-w-xs", containerClassName)}>
      <label htmlFor={id} className="sr-only">
        {resolvedLabel}
      </label>
      <SearchIcon
        size={16}
        className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        ref={setRefs}
        id={id}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={resolvedPlaceholder}
        disabled={disabled}
        className={cn("ps-8", value && "pe-8", className)}
        {...props}
      />
      {value && !disabled ? (
        <button
          type="button"
          onClick={handleClear}
          aria-label={t("data.searchInput.clear")}
          className="absolute end-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors duration-fast ease-standard hover:text-foreground focus-ring animate-in fade-in zoom-in-95 duration-fast ease-entrance"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      ) : null}
    </div>
  );
});
