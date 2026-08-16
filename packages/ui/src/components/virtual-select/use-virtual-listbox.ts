// a2ui.exposed: yes
"use client";

import { useCallback, useEffect, useState } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";

export interface VirtualSelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface UseVirtualListboxOptions {
  count: number;
  filtered: VirtualSelectOption[];
  /** Reserved for future use (e.g. multi-select keyboard shortcuts). */
  multiple?: boolean;
  isOpen: boolean;
  onSelect: (value: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  virtualizer: Virtualizer<any, any> | null;
}

interface UseVirtualListboxReturn {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  onInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

/** First non-disabled option index at or after `from`; -1 if none exists. */
function findNext(filtered: VirtualSelectOption[], from: number): number {
  for (let i = Math.max(0, from); i < filtered.length; i++) {
    if (!filtered[i]?.disabled) return i;
  }
  return -1;
}

/** Last non-disabled option index at or before `from`; -1 if none exists. */
function findPrev(filtered: VirtualSelectOption[], from: number): number {
  for (let i = Math.min(from, filtered.length - 1); i >= 0; i--) {
    if (!filtered[i]?.disabled) return i;
  }
  return -1;
}

/**
 * Keyboard navigation logic for the VirtualSelect listbox.
 * Encapsulates ArrowDown/Up/Home/End/Enter/Escape handling.
 * Focus stays on the search input; `aria-activedescendant` tracks the active row.
 */
export function useVirtualListbox({
  count,
  filtered,
  isOpen,
  onSelect,
  virtualizer,
}: UseVirtualListboxOptions): UseVirtualListboxReturn {
  const [activeIndex, setActiveIndexRaw] = useState(0);

  // When the filtered list changes, reset to the first enabled option.
  useEffect(() => {
    const first = findNext(filtered, 0);
    setActiveIndexRaw(first >= 0 ? first : 0);
  }, [filtered]);

  // When the popover closes, reset to 0.
  useEffect(() => {
    if (!isOpen) setActiveIndexRaw(0);
  }, [isOpen]);

  const setActiveIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, count - 1));
      setActiveIndexRaw(clamped);
      virtualizer?.scrollToIndex(clamped, { align: "auto" });
    },
    [count, virtualizer],
  );

  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          if (count === 0) return;
          const next = findNext(filtered, activeIndex + 1);
          if (next >= 0) setActiveIndex(next);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          if (count === 0) return;
          const prev = findPrev(filtered, activeIndex - 1);
          if (prev >= 0) setActiveIndex(prev);
          break;
        }
        case "Home": {
          e.preventDefault();
          if (count === 0) return;
          const first = findNext(filtered, 0);
          setActiveIndex(first >= 0 ? first : 0);
          break;
        }
        case "End": {
          e.preventDefault();
          if (count === 0) return;
          const last = findPrev(filtered, filtered.length - 1);
          setActiveIndex(last >= 0 ? last : 0);
          break;
        }
        case "Enter": {
          e.preventDefault();
          if (count === 0) return;
          const opt = filtered[activeIndex];
          if (opt && !opt.disabled) {
            onSelect(opt.value);
          }
          break;
        }
        // Escape is handled by Radix Popover (it closes the portal and
        // returns focus to the trigger). No additional handling required here.
        default:
          break;
      }
    },
    [isOpen, count, filtered, activeIndex, setActiveIndex, onSelect],
  );

  return { activeIndex, setActiveIndex, onInputKeyDown };
}
