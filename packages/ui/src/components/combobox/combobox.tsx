import { forwardRef, useState, type ComponentPropsWithoutRef } from "react";
import { defaultFilter } from "cmdk";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../button";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { useLocale } from "../locale-provider";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../command";

export interface ComboboxOption {
  label: string;
  value: string;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  /**
   * Message shown when the search yields no results. Defaults to "No
   * results." — or, when `allowCustomValue` is set, a message that also
   * signals a custom value is acceptable.
   */
  emptyText?: string;
  className?: string;
  /** Disables the trigger and prevents the popover from opening. */
  disabled?: boolean;
  /**
   * When `true`, typed text that doesn't match any option becomes a
   * submittable value: a synthetic "Use…" suggestion is shown, and pressing
   * Enter with no listed option highlighted accepts the typed text via
   * `onValueChange`. Suggestions still filter as usual. Default `false`
   * (selection-only, unchanged behavior) — #359.
   */
  allowCustomValue?: boolean;
  /** `id` applied to the trigger button. */
  id?: string;
  /**
   * The trigger's accessible name always defaults to the SELECTED VALUE (or
   * the placeholder) — that tells AT what is currently chosen, never what the
   * control is FOR. Pass `aria-label`/`aria-labelledby` to also name the
   * control's purpose (e.g. "Session switcher").
   */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /**
   * Escape hatch spread onto the trigger `Button` (after the named props
   * above, so it wins if both are set) for anything not covered by a named
   * prop — `data-*`, `name`, `data-testid`, etc. `role`/`aria-expanded` stay
   * component-owned and can't be passed here; disabling stays on the
   * top-level `disabled` prop so the popover-open guard below can't drift
   * out of sync with the trigger's actual disabled state.
   */
  triggerProps?: Omit<
    ComponentPropsWithoutRef<typeof Button>,
    "role" | "aria-expanded" | "disabled"
  > & {
    /** Arbitrary `data-*` attributes (test hooks, analytics, …). */
    [key: `data-${string}`]: string | number | boolean | undefined;
  };
}

/**
 * Sentinel `value` for the synthetic "Use …" row (`allowCustomValue`).
 *
 * It must NOT be the search text. cmdk scores every item against the search and
 * re-sorts the list by score, then auto-highlights the top one — so a row whose
 * `value` IS the search text scores a perfect 1 and outranks every real partial
 * match. Typing "Prod" against a "Production" option then highlighted
 * `Use "Prod"`, and Enter emitted the raw string instead of selecting the
 * option — the exact opposite of #359's "Enter accepts the highlighted
 * suggestion, or the typed value if none is highlighted".
 */
const CUSTOM_VALUE_ITEM = "__brand-ui-combobox-custom-value__";

/**
 * Keeps the "Use …" row visible (score > 0) but always ranked LAST, behind
 * every real suggestion, so the top match stays highlighted and Enter still
 * selects it. When nothing else matches, the row is the only item and Enter
 * accepts the typed value — which is the behavior #359 asks for.
 */
const customValueFilter = (value: string, search: string, keywords?: string[]) =>
  value === CUSTOM_VALUE_ITEM ? Number.MIN_VALUE : defaultFilter(value, search, keywords);

/** Single-select combobox (Popover + Command). Controlled or uncontrolled. */
export const Combobox = forwardRef<HTMLButtonElement, ComboboxProps>(function Combobox(
  {
    options,
    value,
    onValueChange,
    placeholder = "Select…",
    searchPlaceholder = "Search…",
    emptyText,
    className,
    disabled = false,
    allowCustomValue = false,
    id,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledby,
    triggerProps,
  },
  ref,
) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState("");
  const [search, setSearch] = useState("");
  const selected = value ?? internal;
  const setValue = (v: string) => (onValueChange ? onValueChange(v) : setInternal(v));
  const current = options.find((o) => o.value === selected);

  const trimmedSearch = search.trim();
  const hasExactMatch = options.some(
    (o) => o.label.trim().toLowerCase() === trimmedSearch.toLowerCase(),
  );
  const showCustomValueItem = allowCustomValue && trimmedSearch.length > 0 && !hasExactMatch;
  const resolvedEmptyText =
    emptyText ?? (allowCustomValue ? t("ui.combobox.emptyAllowCustom") : t("noResults"));

  return (
    <Popover
      open={disabled ? false : open}
      onOpenChange={(o) => {
        if (disabled) return;
        setOpen(o);
        // Reset the search text on close, matching the previous (uncontrolled
        // cmdk-internal) behavior where the popover content unmounted and its
        // own internal search state reset with it.
        if (!o) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          variant="outline"
          id={id}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby}
          {...triggerProps}
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          data-slot="combobox"
          className={cn("w-56 justify-between font-normal", triggerProps?.className, className)}
        >
          {current ? current.label : selected || placeholder}
          <ChevronsUpDown className="ms-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-0"
        data-slot="combobox-content"
        // Radix Popover.Content renders role="dialog"; without a name axe's
        // aria-dialog-name rule (rightly) flags it. Reuse the trigger's own
        // purpose label when the consumer set one, else fall back to the
        // (already-translatable) search placeholder — no new hardcoded copy.
        aria-label={ariaLabel ?? searchPlaceholder}
      >
        <Command filter={allowCustomValue ? customValueFilter : undefined}>
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{resolvedEmptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.label}
                  onSelect={() => {
                    setValue(o.value === selected ? "" : o.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "me-2 size-4",
                      selected === o.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {o.label}
                </CommandItem>
              ))}
              {showCustomValueItem ? (
                <CommandItem
                  value={CUSTOM_VALUE_ITEM}
                  data-slot="combobox-custom-value"
                  onSelect={() => {
                    setValue(trimmedSearch);
                    setOpen(false);
                  }}
                >
                  <Plus className="me-2 size-4 shrink-0 opacity-50" />
                  {t("ui.combobox.useCustomValue", { value: trimmedSearch })}
                </CommandItem>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});
