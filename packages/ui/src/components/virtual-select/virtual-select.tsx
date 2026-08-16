// a2ui.exposed: yes
"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
} from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "../../lib/cn";
import { Badge } from "../badge";
import { Button } from "../button";
import { Input } from "../input";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { type VirtualSelectOption, useVirtualListbox } from "./use-virtual-listbox";

export type { VirtualSelectOption };

export interface VirtualSelectProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "value" | "onChange" | "defaultValue"
> {
  /** The full option list. Only visible items are rendered in the DOM. */
  options: VirtualSelectOption[];
  /** Allow selecting multiple values. Default `false`. */
  multiple?: boolean;
  /** Controlled value — `string` in single mode, `string[]` in multiple mode. */
  value?: string | string[];
  /** Uncontrolled initial value. */
  defaultValue?: string | string[];
  /** Called when the selection changes. Emits `string` (single) or `string[]` (multiple). */
  onValueChange?: (value: string | string[]) => void;
  /** Trigger placeholder when nothing is selected. Default "Select…" */
  placeholder?: string;
  /** Search-input placeholder. Default "Search…" */
  searchPlaceholder?: string;
  /** Empty-state message when no options match the query. Default "No results." */
  emptyText?: string;
  /**
   * Estimated row height used by the virtualizer (px).
   * Increase for taller rows (e.g. with descriptions). Default 32.
   */
  estimateOptionHeight?: number;
  /**
   * CSS max-height for the scrollable listbox. Default "18rem".
   */
  maxListHeight?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toArray(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  if (Array.isArray(v)) return v;
  return v === "" ? [] : [v];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * VirtualSelect — a combobox that renders only the visible window of options
 * in the DOM, making it suitable for option lists of 10,000+ items.
 *
 * Uses `@tanstack/react-virtual` for windowed rendering and a purpose-built
 * `aria-activedescendant` keyboard model so focus stays on the search input
 * while navigating the listbox.
 */
export const VirtualSelect = forwardRef<HTMLButtonElement, VirtualSelectProps>(
  function VirtualSelect(
    {
      options,
      multiple = false,
      value,
      defaultValue,
      onValueChange,
      placeholder = "Select…",
      searchPlaceholder = "Search…",
      emptyText = "No results.",
      estimateOptionHeight = 32,
      maxListHeight = "18rem",
      className,
      ...props
    },
    ref,
  ) {
    // ------------------------------------------------------------------
    // Controlled / uncontrolled
    // ------------------------------------------------------------------
    const isControlled = value !== undefined;
    const [internal, setInternal] = useState<string[]>(() => toArray(defaultValue));
    const selected: string[] = isControlled ? toArray(value) : internal;

    const emit = useCallback(
      (next: string[]) => {
        if (!isControlled) setInternal(next);
        if (multiple) {
          onValueChange?.(next);
        } else {
          onValueChange?.(next[0] ?? "");
        }
      },
      [isControlled, multiple, onValueChange],
    );

    // ------------------------------------------------------------------
    // Popover state
    // ------------------------------------------------------------------
    const [open, setOpen] = useState(false);

    // ------------------------------------------------------------------
    // Search / filter
    // ------------------------------------------------------------------
    const [query, setQuery] = useState("");
    const searchRef = useRef<HTMLInputElement>(null);

    // Reset query when popover toggles
    useEffect(() => {
      setQuery("");
    }, [open]);

    const filtered = useMemo(
      () => options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())),
      [options, query],
    );

    // ------------------------------------------------------------------
    // Virtualizer
    // ------------------------------------------------------------------
    // State-backed scroll element (NOT a ref): the listbox mounts only when the
    // Popover opens, so a plain ref would leave the virtualizer with a null
    // scroll element and render zero options. A state callback ref forces the
    // re-render that lets the virtualizer measure once the element appears.
    const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
    const virtualizer = useVirtualizer({
      count: filtered.length,
      getScrollElement: () => scrollEl,
      estimateSize: () => estimateOptionHeight,
      overscan: 5,
    });

    // ------------------------------------------------------------------
    // Keyboard navigation
    // ------------------------------------------------------------------
    const handleSelect = useCallback(
      (optValue: string) => {
        if (multiple) {
          const next = selected.includes(optValue)
            ? selected.filter((v) => v !== optValue)
            : [...selected, optValue];
          emit(next);
          // Keep open in multi mode
        } else {
          emit(selected[0] === optValue ? [] : [optValue]);
          setOpen(false);
        }
      },
      [multiple, selected, emit],
    );

    const { activeIndex, setActiveIndex, onInputKeyDown } = useVirtualListbox({
      count: filtered.length,
      filtered,
      isOpen: open,
      onSelect: handleSelect,
      virtualizer,
    });

    // ------------------------------------------------------------------
    // IDs for ARIA wiring
    // ------------------------------------------------------------------
    const uid = useId();
    const listboxId = `${uid}-listbox`;
    const optionId = (index: number) => `${uid}-option-${index}`;

    // Focus the search input when the popover opens
    const handleOpenChange = useCallback((next: boolean) => {
      setOpen(next);
      if (next) {
        // Defer one frame so Radix has mounted the portal
        setTimeout(() => searchRef.current?.focus(), 0);
      }
    }, []);

    // ------------------------------------------------------------------
    // Trigger label
    // ------------------------------------------------------------------
    const selectedLabels = selected.map((v) => {
      const opt = options.find((o) => o.value === v);
      return { value: v, label: opt?.label ?? v };
    });

    const triggerContent =
      selectedLabels.length === 0 ? (
        <span className="text-muted-foreground">{placeholder}</span>
      ) : multiple ? (
        <>
          {selectedLabels.slice(0, 2).map((l) => (
            <Badge
              key={l.value}
              variant="secondary"
              className="max-w-[8rem] truncate border-border"
            >
              {l.label}
            </Badge>
          ))}
          {selectedLabels.length > 2 ? (
            <Badge
              variant="secondary"
              aria-label={`and ${selectedLabels.length - 2} more selected`}
            >
              +{selectedLabels.length - 2}
            </Badge>
          ) : null}
        </>
      ) : (
        <span className="truncate">{selectedLabels[0]?.label}</span>
      );

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------
    const virtualItems = virtualizer.getVirtualItems();
    // Only reference the active option from aria-activedescendant when it is
    // actually mounted in the virtual window (else the id would dangle).
    const activeMounted = virtualItems.some((v) => v.index === activeIndex);

    return (
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls={listboxId}
            className={cn("h-auto min-h-9 w-64 justify-between font-normal", className)}
            {...props}
          >
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-start">
              {triggerContent}
            </span>
            <ChevronsUpDown className="ms-2 size-4 shrink-0 opacity-50" aria-hidden="true" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-64 p-0"
          align="start"
          // Prevent Radix from stealing focus so it can go to the input
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Search input */}
          <div className="border-b p-1.5">
            <Input
              ref={searchRef}
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => onInputKeyDown(e)}
              aria-label={searchPlaceholder}
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-activedescendant={
                activeIndex >= 0 && activeMounted ? optionId(activeIndex) : undefined
              }
              className="h-8 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>

          {/* Listbox — always mounted so aria-controls never dangles (even when empty) */}
          <div
            ref={setScrollEl}
            id={listboxId}
            role="listbox"
            aria-multiselectable={multiple || undefined}
            style={{ maxHeight: maxListHeight }}
            className="overflow-auto p-1"
          >
            {filtered.length > 0 ? (
              // Spacer gives the virtualizer its full scroll height
              <div style={{ height: virtualizer.getTotalSize() }} className="relative">
                {virtualItems.map((virtualRow) => {
                  const opt = filtered[virtualRow.index];
                  if (!opt) return null;
                  const isSelected = selected.includes(opt.value);
                  const isActive = activeIndex === virtualRow.index;

                  return (
                    <div
                      key={virtualRow.key}
                      id={optionId(virtualRow.index)}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={opt.disabled || undefined}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      className={cn(
                        "flex cursor-pointer select-none items-center rounded-sm px-2 text-sm outline-none",
                        "transition-colors duration-fast motion-reduce:transition-none",
                        isActive && "bg-accent text-accent-foreground",
                        !isActive && "hover:bg-accent hover:text-accent-foreground",
                        opt.disabled && "pointer-events-none cursor-not-allowed opacity-50",
                      )}
                      onClick={() => {
                        if (!opt.disabled) handleSelect(opt.value);
                      }}
                      onMouseEnter={() => {
                        if (!opt.disabled) setActiveIndex(virtualRow.index);
                      }}
                    >
                      <Check
                        className={cn(
                          "me-2 size-4 shrink-0",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                        aria-hidden="true"
                      />
                      <span className="truncate">{opt.label}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
          {filtered.length === 0 ? (
            <div
              role="status"
              aria-live="polite"
              className="px-2 py-6 text-center text-sm text-muted-foreground"
            >
              {emptyText}
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    );
  },
);
